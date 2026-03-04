import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Plus, Sun, Zap, Battery as BatteryIcon } from 'lucide-react';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const SYSTEM_LABELS: Record<string, string> = {
  solar_pv: 'Solar PV',
  heat_pump: 'Heat Pump',
  ev_charger: 'EV Charger',
};

const HEALTH_COLORS: Record<string, { bg: string; text: string }> = {
  healthy: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700' },
  fault: { bg: 'bg-red-50', text: 'text-red-700' },
};

export default async function InstallationsPage() {
  const supabase = getSupabaseAdmin();

  const { data: installations } = await supabase
    .from('installations')
    .select('id, customer_name, address_line_1, city, county, system_type, system_size_kwp, job_reference, access_code, health_status')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const rows = installations || [];

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Installations</h1>
              <p className="text-sm text-gray-500 mt-1">{rows.length} active installation{rows.length !== 1 ? 's' : ''}</p>
            </div>
            <Link
              href="/care-dashboard/installations/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #B8934C)' }}
            >
              <Plus className="w-4 h-4" />
              New Installation
            </Link>
          </div>

          {rows.length === 0 ? (
            <div className="bg-white border border-gold-100 rounded-xl shadow-sm p-12 text-center">
              <Sun className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">No installations yet</h2>
              <p className="text-sm text-gray-500 mb-6">Create your first installation to start managing customer aftercare.</p>
              <Link
                href="/care-dashboard/installations/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #B8934C)' }}
              >
                <Plus className="w-4 h-4" />
                Create Installation
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-gold-100 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">System</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Access Code</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((inst) => {
                      const systemLabel = SYSTEM_LABELS[inst.system_type] || inst.system_type;
                      const healthColors = HEALTH_COLORS[inst.health_status] || HEALTH_COLORS.healthy;
                      return (
                        <tr key={inst.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/care-dashboard/installations/${inst.id}`} className="hover:text-[#D4AF37] transition-colors">
                              <p className="font-medium text-gray-900">{inst.customer_name}</p>
                              <p className="text-xs text-gray-400">{[inst.address_line_1, inst.city].filter(Boolean).join(', ')}</p>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-gray-700">{systemLabel}{inst.system_size_kwp ? ` · ${inst.system_size_kwp} kWp` : ''}</p>
                            <p className="text-xs text-gray-400">{inst.job_reference}</p>
                          </td>
                          <td className="px-4 py-3">
                            {inst.access_code ? (
                              <code className="px-2 py-1 bg-amber-50 text-amber-800 rounded text-xs font-mono font-medium">
                                {inst.access_code}
                              </code>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${healthColors.bg} ${healthColors.text}`}>
                              {inst.health_status || 'healthy'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
