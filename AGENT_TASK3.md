# Agent Task: Phase 1 Telemetry — Wire HomeScreen to API + Generation Chart

Work in `apps/unified-portal/`. Read each file before editing it.

---

## CHANGE 1: Add telemetry tables to migrations

Create `migrations/007_telemetry_tables.sql`:

```sql
-- Installation telemetry (time-series readings)
CREATE TABLE IF NOT EXISTS installation_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Solar
  generation_kwh DECIMAL,
  export_kwh DECIMAL,
  self_consumption_pct DECIMAL,
  irradiance_wm2 DECIMAL,
  -- Heat pump
  cop DECIMAL,
  flow_temp_c DECIMAL,
  return_temp_c DECIMAL,
  heat_output_kwh DECIMAL,
  -- General
  power_w DECIMAL,
  voltage_v DECIMAL,
  status TEXT DEFAULT 'ok',
  raw_data JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_telemetry_installation_id ON installation_telemetry(installation_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON installation_telemetry(recorded_at DESC);

-- Installation alerts
CREATE TABLE IF NOT EXISTS installation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'fault', 'warning', 'info'
  code TEXT,
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_installation_id ON installation_alerts(installation_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON installation_alerts(installation_id) WHERE resolved = false;

ALTER TABLE installation_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS telemetry_service_role ON installation_telemetry TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS alerts_service_role ON installation_alerts TO service_role USING (true) WITH CHECK (true);

-- Add telemetry credential fields to installations
ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS telemetry_source TEXT, -- 'solarEdge', 'fronius', 'mock', null
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS telemetry_api_key TEXT,
  ADD COLUMN IF NOT EXISTS last_telemetry_at TIMESTAMPTZ;
```

---

## CHANGE 2: Create a telemetry API endpoint

Create `app/api/care/telemetry/[installationId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchSolarEdgeData, getMockDailyProfile } from '@/lib/care/solarEdgeApi';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ installationId: string }> }
) {
  const { installationId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: installation, error } = await supabase
    .from('installations')
    .select('id, system_type, system_size_kwp, telemetry_source, serial_number, telemetry_api_key, install_date, health_status')
    .eq('id', installationId)
    .single();

  if (error || !installation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isHeatPump = installation.system_type?.toLowerCase().includes('heat_pump');

  // Try real SolarEdge API if credentials present
  let solarData = null;
  if (!isHeatPump && installation.telemetry_source === 'solarEdge' && installation.serial_number && installation.telemetry_api_key) {
    try {
      solarData = await fetchSolarEdgeData(installation.serial_number, installation.telemetry_api_key);
    } catch {
      // fall through to mock
    }
  }

  // Fall back to realistic mock
  if (!solarData) {
    solarData = await fetchSolarEdgeData(installation.id); // no api key = mock
  }

  const hourlyProfile = getMockDailyProfile();

  // Get unresolved alerts
  const { data: alerts } = await supabase
    .from('installation_alerts')
    .select('id, alert_type, code, message, created_at')
    .eq('installation_id', installationId)
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    generation: solarData.generation,
    status: solarData.status,
    lastUpdate: solarData.lastUpdate,
    selfConsumption: solarData.selfConsumption,
    hourlyProfile,
    alerts: alerts || [],
    source: installation.telemetry_source || 'estimated',
  });
}
```

---

## CHANGE 3: Wire HomeScreen to real telemetry + add generation chart

File: `app/care/[installationId]/screens/HomeScreen.tsx`

This is the big one. Read the full file first.

### 3a. Add telemetry fetching

At the top of the `HomeScreen` component, add state and a fetch:

```tsx
const { installation, installationId } = useCareApp();
const [telemetry, setTelemetry] = useState<any>(null);
const [telemetryLoading, setTelemetryLoading] = useState(true);

useEffect(() => {
  fetch(`/api/care/telemetry/${installationId}`)
    .then(r => r.json())
    .then(data => { setTelemetry(data); setTelemetryLoading(false); })
    .catch(() => setTelemetryLoading(false));
}, [installationId]);
```

### 3b. Replace the 3 performance metric cards with real data

The current cards use hardcoded values. Replace them with telemetry data when available, showing a subtle shimmer while loading:

- **Generated Today**: `telemetry?.generation?.today?.toFixed(1) + ' kWh'` or fallback to estimated
- **Saved Today**: `'€' + ((telemetry?.generation?.today || 0) * 0.35).toFixed(2)` 
- **Self-consumption**: `Math.round(telemetry?.selfConsumption || 68) + '%'` — change the label from "System Efficiency" to "Self-Use" and use the selfConsumption figure. Use a Leaf icon instead of Zap for this one to reflect self-consumption rather than efficiency.

For the loading state, show `'...'` as the value while `telemetryLoading` is true.

### 3c. Add a generation chart

Add a new card between the performance cards row and the savings card. This shows today's hourly generation profile as a simple bar chart.

Use only inline SVG — do NOT install any chart library. Build it as a pure SVG bar chart component.

```tsx
function GenerationChart({ hourlyProfile, loading }: { hourlyProfile: Array<{ hour: number; generation: number }>, loading: boolean }) {
  if (loading) {
    return (
      <div className="card-item rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
        <div className="h-28 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const maxVal = Math.max(...hourlyProfile.map(h => h.generation), 0.1);
  const now = new Date().getHours();
  const chartHours = hourlyProfile.filter(h => h.hour >= 6 && h.hour <= 21); // daylight hours only
  const barWidth = 100 / chartHours.length;

  return (
    <div className="card-item rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 sm:p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Generation Today</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Hourly output (kWh)</p>
        </div>
        <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Live</span>
      </div>
      <svg viewBox={`0 0 100 40`} className="w-full h-28" preserveAspectRatio="none">
        {chartHours.map((h, i) => {
          const barH = (h.generation / maxVal) * 36;
          const isPast = h.hour <= now;
          const isCurrent = h.hour === now;
          return (
            <rect
              key={h.hour}
              x={i * barWidth + barWidth * 0.1}
              y={40 - barH}
              width={barWidth * 0.8}
              height={barH}
              rx="1"
              fill={isCurrent ? '#D4AF37' : isPast ? '#10b981' : '#e2e8f0'}
              opacity={isCurrent ? 1 : isPast ? 0.7 : 0.4}
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[9px] text-slate-300 mt-1 px-0.5">
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>9pm</span>
      </div>
    </div>
  );
}
```

Render it in the JSX: `<GenerationChart hourlyProfile={telemetry?.hourlyProfile || []} loading={telemetryLoading} />`

Place it after the 3-col performance cards grid and before the savings card.

### 3d. Add alerts banner

If `telemetry?.alerts?.length > 0`, show a warning banner above the system status card:

```tsx
{telemetry?.alerts?.length > 0 && (
  <div className="card-item rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
    <div>
      <p className="text-sm font-semibold text-amber-800">{telemetry.alerts[0].message}</p>
      {telemetry.alerts.length > 1 && <p className="text-xs text-amber-600 mt-0.5">+{telemetry.alerts.length - 1} more alert{telemetry.alerts.length > 2 ? 's' : ''}</p>}
    </div>
  </div>
)}
```

Make sure to import `AlertTriangle` from lucide-react if not already imported (it should already be there).

Also import `useEffect, useState` from react at the top (they may already be imported — check first).

---

## CHANGE 4: Add telemetry fields to the installer onboarding form

File: `app/care-dashboard/installations/new/page.tsx`

Read the file first. After the system details section (system type, size, inverter model etc), add an optional "Telemetry Integration" section:

```tsx
{/* Telemetry Integration (Optional) */}
<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-sm font-bold text-gray-900">Telemetry Integration</h2>
      <p className="text-xs text-gray-400 mt-0.5">Optional — connect to inverter monitoring for live data</p>
    </div>
    <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Optional</span>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <label className={labelClass}>Telemetry Source</label>
      <select value={form.telemetry_source} onChange={(e) => update('telemetry_source', e.target.value)} className={inputClass}>
        <option value="">None (use estimates)</option>
        <option value="solarEdge">SolarEdge Monitoring</option>
        <option value="fronius">Fronius Solar.web</option>
        <option value="sma">SMA Sunny Portal</option>
      </select>
    </div>
    <div>
      <label className={labelClass}>Site / Serial Number</label>
      <input value={form.serial_number} onChange={(e) => update('serial_number', e.target.value)} placeholder="e.g. 12345678" className={inputClass} />
    </div>
    <div className="sm:col-span-2">
      <label className={labelClass}>API Key</label>
      <input type="password" value={form.telemetry_api_key} onChange={(e) => update('telemetry_api_key', e.target.value)} placeholder="Monitoring portal API key" className={inputClass} />
      <p className="text-[11px] text-gray-400 mt-1">Found in your SolarEdge / Fronius monitoring portal under API access.</p>
    </div>
  </div>
</div>
```

Add these fields to the FormData interface:
```ts
telemetry_source: string;
serial_number: string;
telemetry_api_key: string;
```

Add them to the initial form state with empty strings.

Include them in the POST body when submitting.

Also update the `/api/care/installations` POST handler (`app/api/care/installations/route.ts`) to accept and save `telemetry_source`, `serial_number`, `telemetry_api_key` fields when creating the installation. Read that file first to understand its current structure.

---

## After all changes:

1. Run `npm run typecheck` and fix any new TypeScript errors.
2. `git add -A && git commit -m 'feat: phase 1 telemetry - live generation chart, real API hookup, telemetry tables, installer credentials'`
3. `openclaw system event --text "Done: Phase 1 telemetry complete - HomeScreen wired to API, generation chart live, SolarEdge credentials in onboarding form" --mode now`
