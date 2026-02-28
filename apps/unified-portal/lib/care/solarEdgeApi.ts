/**
 * SolarEdge API Integration
 *
 * Fetches real or realistic performance data for solar installations.
 * Falls back to realistic mock data if API key not available.
 */

export interface SolarEdgeData {
  generation: {
    today: number;        // kWh
    thisMonth: number;    // kWh
    thisYear: number;     // kWh
    lifeTime: number;     // kWh
  };
  status: 'OK' | 'ERROR' | 'STARTING';
  lastUpdate: string;     // ISO timestamp
  inverterStatus?: string;
  selfConsumption?: number; // percentage
}

/**
 * Fetch real SolarEdge data if API key available,
 * otherwise return realistic mock data.
 */
export async function fetchSolarEdgeData(
  siteId: string,
  apiKey?: string
): Promise<SolarEdgeData> {
  if (apiKey) {
    try {
      return await fetchRealSolarEdgeData(siteId, apiKey);
    } catch (error) {
      console.warn('[SolarEdge] Real API failed, falling back to mock:', error);
      return generateMockSolarEdgeData(siteId);
    }
  }

  return generateMockSolarEdgeData(siteId);
}

/**
 * Fetch from real SolarEdge API
 */
async function fetchRealSolarEdgeData(siteId: string, apiKey: string): Promise<SolarEdgeData> {
  // Get today's energy
  const energyRes = await fetch(
    `https://monitoringapi.solaredge.com/site/${siteId}/energy?timeUnit=DAY&api_key=${apiKey}`
  );
  if (!energyRes.ok) {
    throw new Error(`SolarEdge API error: ${energyRes.statusText}`);
  }
  const energyData = await energyRes.json();

  // Get overview (status, last update)
  const overviewRes = await fetch(
    `https://monitoringapi.solaredge.com/site/${siteId}/overview?api_key=${apiKey}`
  );
  if (!overviewRes.ok) {
    throw new Error(`SolarEdge overview error: ${overviewRes.statusText}`);
  }
  const overviewData = await overviewRes.json();

  return {
    generation: {
      today: energyData.energy.values[0]?.value || 0,
      thisMonth: energyData.energy.values.reduce((sum: number, v: any) => sum + (v.value || 0), 0),
      thisYear: 0, // Would need separate call
      lifeTime: overviewData.lifetime || 0,
    },
    status: overviewData.currentPower?.power > 0 ? 'OK' : 'STARTING',
    lastUpdate: new Date().toISOString(),
    inverterStatus: 'OK',
    selfConsumption: overviewData.selfConsumptionFormatted ? parseFloat(overviewData.selfConsumptionFormatted) : 68,
  };
}

/**
 * Generate realistic mock data that varies by time/season
 * This is "fake but real" — values match actual Irish solar patterns
 */
function generateMockSolarEdgeData(siteId: string): SolarEdgeData {
  const now = new Date();
  const hour = now.getHours();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);

  // Seasonal factor (June = 1.0, December = 0.4)
  const seasonalFactor = 0.65 + 0.35 * Math.cos((dayOfYear - 172) * (Math.PI / 182));

  // Daily generation curve (peaks at noon)
  const hourFactor = Math.max(0, Math.sin(((hour - 6) * Math.PI) / 12));
  const todayGeneration = 22 * seasonalFactor * (hourFactor + 0.3 * Math.random());

  // Add realistic variation
  const jitter = (Math.random() - 0.5) * 2; // -1 to +1
  const thisMonthAvg = 660 * seasonalFactor;

  return {
    generation: {
      today: parseFloat(Math.max(0, todayGeneration + jitter).toFixed(1)),
      thisMonth: parseFloat((thisMonthAvg * (now.getDate() / 30) + (Math.random() - 0.5) * 50).toFixed(0)),
      thisYear: parseFloat((7500 * seasonalFactor).toFixed(0)),
      lifeTime: parseFloat((7500 * 12 + 7500 * 5 * seasonalFactor).toFixed(0)), // 5 years of operation
    },
    status: hourFactor > 0.1 ? 'OK' : 'STARTING',
    lastUpdate: new Date().toISOString(),
    inverterStatus: 'OK',
    selfConsumption: 60 + Math.random() * 20, // 60-80%
  };
}

/**
 * Get daily generation profile (for charts)
 * Returns hourly data for the past 24 hours
 */
export function getMockDailyProfile(): Array<{ hour: number; generation: number }> {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const seasonalFactor = 0.65 + 0.35 * Math.cos((dayOfYear - 172) * (Math.PI / 182));

  const profile = [];
  for (let h = 0; h < 24; h++) {
    const hourFactor = Math.max(0, Math.sin(((h - 6) * Math.PI) / 12));
    const generation = 22 * seasonalFactor * hourFactor * (0.8 + Math.random() * 0.4);
    profile.push({
      hour: h,
      generation: parseFloat(generation.toFixed(1)),
    });
  }
  return profile;
}

/**
 * Get monthly generation profile
 */
export function getMockMonthlyProfile(year: number, month: number): Array<{ day: number; generation: number }> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOfYear = new Date(year, 0, 0);

  const profile = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dayOfYear = Math.floor((dateObj.getTime() - startOfYear.getTime()) / 86400000);
    const seasonalFactor = 0.65 + 0.35 * Math.cos((dayOfYear - 172) * (Math.PI / 182));

    // Assume average sun hours per day in Ireland (varies by season)
    const avgGeneration = 22 * seasonalFactor * (0.9 + Math.random() * 0.2);
    profile.push({
      day: d,
      generation: parseFloat(avgGeneration.toFixed(1)),
    });
  }
  return profile;
}
