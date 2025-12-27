'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Activity, 
  Database, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Server,
  Zap
} from 'lucide-react';

interface HealthData {
  status: 'healthy' | 'degraded' | 'critical';
  checkedAt: string;
  databases: {
    drizzle: { status: 'OK' | 'FAIL'; latencyMs: number; error?: string };
    supabase: { status: 'OK' | 'FAIL' | 'SKIP'; latencyMs: number; error?: string };
  };
  analytics: {
    lastEvent: { timestamp: string | null; eventType: string | null; ageSeconds: number | null };
    isRecent: boolean;
  };
  errors: {
    criticalCount: number;
    last10Minutes: number;
  };
  deployment: {
    version: string;
    buildHash: string;
    deployedAt: string;
    environment: string;
    uptimeSeconds: number;
    uptimeFormatted: string;
  };
}

function StatusBadge({ status }: { status: 'OK' | 'FAIL' | 'SKIP' | 'healthy' | 'degraded' | 'critical' }) {
  const isGood = status === 'OK' || status === 'healthy';
  const isBad = status === 'FAIL' || status === 'critical';
  const isSkip = status === 'SKIP';
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      isGood ? 'bg-green-100 text-green-700' :
      isBad ? 'bg-red-100 text-red-700' :
      isSkip ? 'bg-gray-100 text-gray-600' :
      'bg-amber-100 text-amber-700'
    }`}>
      {isGood ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
       isBad ? <XCircle className="w-3.5 h-3.5" /> : 
       <AlertTriangle className="w-3.5 h-3.5" />}
      {status.toUpperCase()}
    </span>
  );
}

function HealthCard({ 
  title, 
  icon: Icon, 
  children,
  status
}: { 
  title: string; 
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  status?: 'OK' | 'FAIL' | 'healthy' | 'degraded' | 'critical';
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        {status && <StatusBadge status={status} />}
      </div>
      {children}
    </div>
  );
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/super/system-health');
      if (!res.ok) throw new Error('Failed to fetch health status');
      const data = await res.json();
      setHealth(data);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading && !health) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-48 bg-gray-200 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-gray-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
              <p className="text-sm text-gray-500">
                Real-time operational status
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {health && (
              <StatusBadge status={health.status} />
            )}
            <button
              onClick={() => { setLoading(true); fetchHealth(); }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Error loading health status</span>
            </div>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {health && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <HealthCard 
              title="Database Connections" 
              icon={Database}
              status={health.databases.drizzle.status === 'OK' && (health.databases.supabase.status === 'OK' || health.databases.supabase.status === 'SKIP') ? 'OK' : 'FAIL'}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Drizzle (Primary)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{health.databases.drizzle.latencyMs}ms</span>
                    <StatusBadge status={health.databases.drizzle.status} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Supabase</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{health.databases.supabase.latencyMs}ms</span>
                    <StatusBadge status={health.databases.supabase.status} />
                  </div>
                </div>
                {(health.databases.drizzle.error || health.databases.supabase.error) && (
                  <p className="text-xs text-red-600 mt-2">
                    {health.databases.drizzle.error || health.databases.supabase.error}
                  </p>
                )}
              </div>
            </HealthCard>

            <HealthCard 
              title="Analytics Pipeline" 
              icon={Zap}
              status={health.analytics.isRecent ? 'OK' : 'FAIL'}
            >
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Last Event</div>
                  {health.analytics.lastEvent.timestamp ? (
                    <>
                      <div className="font-mono text-sm text-gray-900">
                        {new Date(health.analytics.lastEvent.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Type: {health.analytics.lastEvent.eventType} • 
                        {health.analytics.lastEvent.ageSeconds !== null && (
                          <span> {health.analytics.lastEvent.ageSeconds}s ago</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">No events recorded</div>
                  )}
                </div>
                <div className={`text-xs px-3 py-2 rounded-lg ${
                  health.analytics.isRecent ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {health.analytics.isRecent 
                    ? 'Pipeline active - events flowing normally' 
                    : 'No recent events - pipeline may be stale'}
                </div>
              </div>
            </HealthCard>

            <HealthCard 
              title="Error Tracking" 
              icon={AlertTriangle}
              status={health.errors.last10Minutes === 0 ? 'OK' : health.errors.last10Minutes < 5 ? 'degraded' : 'FAIL'}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{health.errors.criticalCount}</div>
                    <div className="text-xs text-gray-500">Total Since Deploy</div>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${
                    health.errors.last10Minutes === 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      health.errors.last10Minutes === 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {health.errors.last10Minutes}
                    </div>
                    <div className="text-xs text-gray-500">Last 10 Minutes</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  Error counter resets on deploy
                </div>
              </div>
            </HealthCard>

            <HealthCard 
              title="Deployment Info" 
              icon={Server}
            >
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Version</span>
                  <span className="text-sm font-mono text-gray-900">{health.deployment.version}</span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Build Hash</span>
                  <span className="text-sm font-mono text-gray-900">{health.deployment.buildHash}</span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Deployed At</span>
                  <span className="text-sm font-mono text-gray-900">
                    {new Date(health.deployment.deployedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Uptime</span>
                  <span className="text-sm font-mono text-gray-900">{health.deployment.uptimeFormatted}</span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Environment</span>
                  <span className={`text-sm font-mono ${
                    health.deployment.environment === 'production' ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {health.deployment.environment}
                  </span>
                </div>
              </div>
            </HealthCard>
          </div>
        )}

        {lastRefresh && (
          <div className="mt-8 text-center text-xs text-gray-400">
            <Clock className="w-3 h-3 inline mr-1" />
            Last checked: {lastRefresh.toLocaleTimeString()} • Auto-refresh every 30s
          </div>
        )}
      </div>
    </div>
  );
}
