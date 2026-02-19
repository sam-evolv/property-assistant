/**
 * Met Éireann Weather Integration
 *
 * Two data sources — both free, no API key required:
 * 1. prodapi.metweb.ie — current hourly observations by city
 * 2. met.ie/Open_Data/json/National.json — human-readable today/tonight/tomorrow forecast
 */

import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const WEATHER_TIMEOUT_MS = 8000;
const OBSERVATIONS_URL = 'https://prodapi.metweb.ie/observations';
const NATIONAL_FORECAST_URL = 'https://www.met.ie/Open_Data/json/National.json';

// Cache in module memory — weather is global, no per-user storage needed
let forecastCache: { data: NationalForecast; fetchedAt: number } | null = null;
let observationsCache: Map<string, { data: Observation[]; fetchedAt: number }> = new Map();

const FORECAST_TTL_MS = 60 * 60 * 1000;      // 1 hour
const OBSERVATIONS_TTL_MS = 30 * 60 * 1000;  // 30 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Observation {
  name: string;
  temperature: string;
  symbol: string;
  weatherDescription: string;
  text: string;
  windSpeed: string;
  windGust: string;
  cardinalWindDirection: string;
  humidity: string;
  rainfall: string;
  pressure: string;
  dayName: string;
  date: string;
  reportTime: string;
}

export interface NationalForecast {
  issued: string;
  today: string;
  tonight: string;
  tomorrow: string;
  outlook?: string;
}

export interface WeatherResult {
  current: Observation | null;
  forecast: NationalForecast | null;
  city: string;
  fetched_at: Date;
}

// ─── City mapping ─────────────────────────────────────────────────────────────

// Maps address keywords to Met Éireann observation station city names
const COUNTY_TO_STATION: Record<string, string> = {
  'cork': 'cork',
  'dublin': 'dublin',
  'limerick': 'limerick',
  'galway': 'galway',
  'waterford': 'waterford',
  'kilkenny': 'kilkenny',
  'wexford': 'wexford',
  'wicklow': 'wicklow',
  'kildare': 'kildare',
  'meath': 'meath',
  'louth': 'drogheda',
  'tipperary': 'clonmel',
  'kerry': 'tralee',
  'clare': 'shannon',
  'mayo': 'castlebar',
  'sligo': 'sligo',
  'donegal': 'donegal',
  'monaghan': 'monaghan',
  'cavan': 'cavan',
  'roscommon': 'roscommon',
  'longford': 'longford',
  'westmeath': 'athlone',
  'offaly': 'tullamore',
  'laois': 'portlaoise',
  'carlow': 'carlow',
  'leitrim': 'carrick-on-shannon',
};

function inferCity(address: string | null | undefined): string {
  if (!address) return 'dublin';
  const lower = address.toLowerCase();
  for (const [county, city] of Object.entries(COUNTY_TO_STATION)) {
    if (lower.includes(county)) return city;
  }
  return 'dublin';
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function getObservations(city: string): Promise<Observation[]> {
  const now = Date.now();
  const cached = observationsCache.get(city);
  if (cached && now - cached.fetchedAt < OBSERVATIONS_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetchWithTimeout(`${OBSERVATIONS_URL}/${city}/today`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: Observation[] = await response.json();
    observationsCache.set(city, { data, fetchedAt: now });
    return data;
  } catch (err) {
    console.error('[Weather] Observations fetch failed:', err);
    return cached?.data || [];
  }
}

async function getNationalForecast(): Promise<NationalForecast | null> {
  const now = Date.now();
  if (forecastCache && now - forecastCache.fetchedAt < FORECAST_TTL_MS) {
    return forecastCache.data;
  }

  try {
    const response = await fetchWithTimeout(NATIONAL_FORECAST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();

    const regions: Record<string, string>[] = json?.forecasts?.[0]?.regions || [];
    const forecast: Partial<NationalForecast> = {};

    for (const region of regions) {
      if (region.issued) forecast.issued = region.issued;
      if (region.today) forecast.today = cleanForecastText(region.today);
      if (region.tonight) forecast.tonight = cleanForecastText(region.tonight);
      if (region.tomorrow) forecast.tomorrow = cleanForecastText(region.tomorrow);
      if (region.outlook) forecast.outlook = cleanForecastText(region.outlook);
    }

    if (forecast.today) {
      const result = forecast as NationalForecast;
      forecastCache = { data: result, fetchedAt: now };
      return result;
    }
  } catch (err) {
    console.error('[Weather] Forecast fetch failed:', err);
  }

  return forecastCache?.data || null;
}

function cleanForecastText(text: string): string {
  return text
    .replace(/&rsquo;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Main export ──────────────────────────────────────────────────────────────

async function getSchemeAddress(schemeId: string | null | undefined): Promise<string | null> {
  if (!schemeId) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('scheme_profile')
      .select('scheme_address')
      .eq('id', schemeId)
      .limit(1)
      .single();
    if (error) {
      console.warn('[Weather] getSchemeAddress error:', error.message);
      return null;
    }
    return (data as any)?.scheme_address || null;
  } catch (e) {
    console.warn('[Weather] getSchemeAddress exception:', e);
    return null;
  }
}

export async function getWeather(schemeId: string | null | undefined): Promise<WeatherResult> {
  const schemeAddress = await getSchemeAddress(schemeId);
  const city = inferCity(schemeAddress);
  console.log('[Weather] Fetching for city:', city);

  const [observations, forecast] = await Promise.all([
    getObservations(city),
    getNationalForecast(),
  ]);

  // Use the most recent observation
  const current = observations.length > 0 ? observations[observations.length - 1] : null;

  return {
    current,
    forecast,
    city,
    fetched_at: new Date(),
  };
}

// ─── Formatter ────────────────────────────────────────────────────────────────

function windDescription(speedKmh: string, gust: string, direction: string): string {
  const speed = parseInt(speedKmh, 10);
  if (isNaN(speed)) return '';

  let desc = '';
  if (speed < 20) desc = 'Light winds';
  else if (speed < 40) desc = 'Moderate winds';
  else if (speed < 60) desc = 'Fresh winds';
  else desc = 'Strong winds';

  desc += ` from the ${direction}`;

  const gustVal = parseInt(gust, 10);
  if (!isNaN(gustVal) && gustVal > speed + 10) {
    desc += `, gusting to ${gustVal} km/h`;
  }

  return desc;
}

function weatherEmoji(description: string): string {
  const d = description.toLowerCase();
  if (d.includes('thunder')) return '⛈️';
  if (d.includes('heavy rain') || d.includes('persistent rain')) return '🌧️';
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return '🌦️';
  if (d.includes('snow') || d.includes('sleet') || d.includes('hail')) return '🌨️';
  if (d.includes('fog') || d.includes('mist')) return '🌫️';
  if (d.includes('cloudy') || d.includes('overcast')) return '☁️';
  if (d.includes('partly') || d.includes('cloud') || d.includes('sun')) return '⛅';
  if (d.includes('clear') || d.includes('sunny') || d.includes('bright')) return '☀️';
  return '🌤️';
}

export function formatWeatherResponse(result: WeatherResult): string {
  const { current, forecast, city } = result;
  const cityDisplay = city.charAt(0).toUpperCase() + city.slice(1);
  const lines: string[] = [];

  // Current conditions
  if (current) {
    const temp = current.temperature ? `${current.temperature} degrees` : '';
    const desc = current.weatherDescription || '';
    const wind = windDescription(current.windSpeed, current.windGust, current.cardinalWindDirection);
    const humidity = current.humidity?.trim() ? `, humidity ${current.humidity.trim()}%` : '';

    lines.push(`${cityDisplay} right now: ${[temp, desc].filter(Boolean).join(', ')}${humidity}.`);
    if (wind) lines.push(wind + '.');
    lines.push('');
  }

  // Today's forecast
  if (forecast?.today) {
    lines.push(`Today: ${forecast.today}`);
    lines.push('');
  }

  // Tonight — first sentence only
  if (forecast?.tonight) {
    const tonight = forecast.tonight.split('.')[0] + '.';
    lines.push(`Tonight: ${tonight}`);
    lines.push('');
  }

  // Tomorrow — first sentence only
  if (forecast?.tomorrow) {
    const tomorrow = forecast.tomorrow.split('.')[0] + '.';
    lines.push(`Tomorrow: ${tomorrow}`);
    lines.push('');
  }

  if (lines.length === 0) {
    return `I wasn't able to get the weather right now. Check met.ie for the latest forecast.`;
  }

  lines.push(`Source: Met Eireann (met.ie)`);

  return lines.join('\n').trim();
}
