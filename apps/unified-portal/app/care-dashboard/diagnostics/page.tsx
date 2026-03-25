'use client';

import { useEffect, useState } from 'react';
import { Wrench, Loader2, Eye, Zap, Thermometer, Battery } from 'lucide-react';

interface DiagnosticFlow {
  id: string;
  flow_name: string;
  system_type: string;
  step_count: number;
  times_triggered: number;
  updated_at: string;
}

const SYSTEM_ICONS: Record<string, typeof Zap> = {
  solar_pv: Zap,
  heat_pump: Thermometer,
  battery: Battery,
};

const SYSTEM_LABELS: Record<string, string> = {
  solar_pv: 'Solar PV',
  heat_pump: 'Heat Pump',
  battery: 'Battery',
};

const SYSTEM_COLORS: Record<string, { bg: string; text: string }> = {
  solar_pv: { bg: 'bg-amber-50', text: 'text-amber-700' },
  heat_pump: { bg: 'bg-blue-50', text: 'text-blue-700' },
  battery: { bg: 'bg-green-50', text: 'text-green-700' },
};

export default function DiagnosticsPage() {
  const [flows, setFlows] = useState<DiagnosticFlow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFlows() {
      try {
        const res = await fetch('/api/care/diagnostic-flows');
        if (res.ok) {
          const data = await res.json();
          setFlows(data.flows || []);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    fetchFlows();
  }, []);

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Diagnostics</h1>
            <p className="text-sm text-gray-500 mt-1">
              Guided troubleshooting flows for common installer issues
            </p>
          </div>

          {/* Flows */}
          {flows.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center">
              <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">No diagnostic flows yet</h2>
              <p className="text-sm text-gray-500">
                Diagnostic flows help homeowners troubleshoot common issues step-by-step.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {flows.map((flow) => {
                const colors = SYSTEM_COLORS[flow.system_type] || SYSTEM_COLORS.solar_pv;
                const Icon = SYSTEM_ICONS[flow.system_type] || Wrench;
                const dateStr = new Date(flow.updated_at).toLocaleDateString('en-IE', {
                  day: 'numeric', month: 'short', year: 'numeric',
                });

                return (
                  <div
                    key={flow.id}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-2 rounded-lg ${colors.bg}`}>
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                        {SYSTEM_LABELS[flow.system_type] || flow.system_type}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-gray-900 mb-3">{flow.flow_name}</h3>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                      <span>{flow.step_count} steps</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span>Triggered {flow.times_triggered} times</span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-400">Updated {dateStr}</span>
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all duration-150 active:scale-[0.98]">
                        <Eye className="w-3.5 h-3.5" />
                        View Flow
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
