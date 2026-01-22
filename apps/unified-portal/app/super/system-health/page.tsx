'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Zap,
  Wifi,
  HardDrive,
  Cpu,
} from 'lucide-react';
import {
  PageHeader,
  DataCard,
  StatusBadge,
  DataRow,
  StatGridItem,
  MetricCard,
  MetricCardGrid,
  Badge,
  Button,
} from '@/components/ui/premium';

// ============================================================================
// TYPES
// ============================================================================
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

// ============================================================================
// HEALTH STATUS MAPPING
// ============================================================================
function mapStatus(status: string): 'healthy' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'OK':
    case 'healthy':
      return 'healthy';
    case 'FAIL':
    case 'critical':
      return 'error';
    case 'degraded':
      return 'warning';
    case 'SKIP':
    default:
      return 'neutral';
  }
}

// ============================================================================
// LOADING SKELETON
// ============================================================================
function HealthSkeleton() {
  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="h-8 w-48 bg-neutral-200 rounded-lg mb-2" />
              <div className="h-4 w-64 bg-neutral-100 rounded" />
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-20 bg-neutral-200 rounded-full" />
              <div className="h-10 w-28 bg-neutral-200 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-neutral-200 rounded-xl" />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-neutral-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      setIsRefreshing(true);
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
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading && !health) {
    return <HealthSkeleton />;
  }

  const overallStatus = health?.status || 'healthy';
  const dbStatus =
    health?.databases.drizzle.status === 'OK' &&
    (health?.databases.supabase.status === 'OK' || health?.databases.supabase.status === 'SKIP')
      ? 'healthy'
      : 'error';

  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <PageHeader
          title="System Health"
          subtitle="Real-time operational status and monitoring"
          icon={Activity}
          badge={{
            label: overallStatus === 'healthy' ? 'All Systems Operational' : overallStatus.toUpperCase(),
            variant: overallStatus === 'healthy' ? 'live' : 'default',
          }}
          onRefresh={fetchHealth}
          isRefreshing={isRefreshing}
        />

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-700">Error loading health status</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {health && (
          <>
            {/* Quick Stats */}
            <MetricCardGrid columns={4} className="mb-8">
              <MetricCard
                label="System Status"
                value={overallStatus === 'healthy' ? 'Healthy' : overallStatus}
                icon={Activity}
                variant={overallStatus === 'healthy' ? 'success' : 'warning'}
              />
              <MetricCard
                label="Database Latency"
                value={`${health.databases.drizzle.latencyMs}ms`}
                icon={Database}
                description="Drizzle primary"
                variant={health.databases.drizzle.latencyMs < 100 ? 'default' : 'warning'}
              />
              <MetricCard
                label="Errors (10min)"
                value={health.errors.last10Minutes}
                icon={AlertTriangle}
                variant={health.errors.last10Minutes === 0 ? 'success' : 'warning'}
              />
              <MetricCard
                label="Uptime"
                value={health.deployment.uptimeFormatted}
                icon={Clock}
                variant="default"
              />
            </MetricCardGrid>

            {/* Detailed Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Database Connections */}
              <DataCard
                title="Database Connections"
                icon={Database}
                status={mapStatus(dbStatus)}
                statusLabel={dbStatus === 'healthy' ? 'Connected' : 'Issues Detected'}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <HardDrive className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">Drizzle (Primary)</p>
                        <p className="text-xs text-neutral-500">PostgreSQL connection</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-neutral-600">
                        {health.databases.drizzle.latencyMs}ms
                      </span>
                      <StatusBadge
                        status={mapStatus(health.databases.drizzle.status)}
                        label={health.databases.drizzle.status}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Wifi className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">Supabase</p>
                        <p className="text-xs text-neutral-500">Real-time & auth</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-neutral-600">
                        {health.databases.supabase.latencyMs}ms
                      </span>
                      <StatusBadge
                        status={mapStatus(health.databases.supabase.status)}
                        label={health.databases.supabase.status}
                      />
                    </div>
                  </div>

                  {(health.databases.drizzle.error || health.databases.supabase.error) && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-600">
                        {health.databases.drizzle.error || health.databases.supabase.error}
                      </p>
                    </div>
                  )}
                </div>
              </DataCard>

              {/* Analytics Pipeline */}
              <DataCard
                title="Analytics Pipeline"
                icon={Zap}
                status={health.analytics.isRecent ? 'healthy' : 'warning'}
                statusLabel={health.analytics.isRecent ? 'Active' : 'Stale'}
              >
                <div className="space-y-4">
                  <div className="p-4 bg-neutral-50 rounded-xl">
                    <p className="text-xs text-neutral-500 mb-2">Last Event Received</p>
                    {health.analytics.lastEvent.timestamp ? (
                      <>
                        <p className="text-lg font-semibold text-neutral-900 font-mono">
                          {new Date(health.analytics.lastEvent.timestamp).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="info" size="sm">
                            {health.analytics.lastEvent.eventType}
                          </Badge>
                          {health.analytics.lastEvent.ageSeconds !== null && (
                            <span className="text-xs text-neutral-500">
                              {health.analytics.lastEvent.ageSeconds}s ago
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-neutral-500">No events recorded</p>
                    )}
                  </div>

                  <div
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg text-sm',
                      health.analytics.isRecent
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    )}
                  >
                    {health.analytics.isRecent ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Pipeline active - events flowing normally
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        No recent events - pipeline may be stale
                      </>
                    )}
                  </div>
                </div>
              </DataCard>

              {/* Error Tracking */}
              <DataCard
                title="Error Tracking"
                icon={AlertTriangle}
                status={
                  health.errors.last10Minutes === 0
                    ? 'healthy'
                    : health.errors.last10Minutes < 5
                    ? 'warning'
                    : 'error'
                }
                statusLabel={
                  health.errors.last10Minutes === 0
                    ? 'No Errors'
                    : `${health.errors.last10Minutes} Recent`
                }
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <StatGridItem
                      label="Total Since Deploy"
                      value={health.errors.criticalCount}
                      status="neutral"
                    />
                    <StatGridItem
                      label="Last 10 Minutes"
                      value={health.errors.last10Minutes}
                      status={health.errors.last10Minutes === 0 ? 'healthy' : 'error'}
                    />
                  </div>

                  <div className="text-center p-3 bg-neutral-50 rounded-lg">
                    <p className="text-xs text-neutral-500">
                      Error counter resets on each deployment
                    </p>
                  </div>
                </div>
              </DataCard>

              {/* Deployment Info */}
              <DataCard title="Deployment Info" icon={Server}>
                <div className="space-y-0">
                  <DataRow label="Version" value={health.deployment.version} />
                  <DataRow
                    label="Build Hash"
                    value={
                      <code className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded">
                        {health.deployment.buildHash}
                      </code>
                    }
                  />
                  <DataRow
                    label="Deployed At"
                    value={new Date(health.deployment.deployedAt).toLocaleString()}
                  />
                  <DataRow label="Uptime" value={health.deployment.uptimeFormatted} />
                  <DataRow
                    label="Environment"
                    value={
                      <Badge
                        variant={
                          health.deployment.environment === 'production' ? 'success' : 'warning'
                        }
                        size="sm"
                      >
                        {health.deployment.environment}
                      </Badge>
                    }
                  />
                </div>
              </DataCard>
            </div>

            {/* Footer */}
            {lastRefresh && (
              <div className="mt-8 text-center">
                <p className="text-xs text-neutral-400 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last checked: {lastRefresh.toLocaleTimeString()} • Auto-refresh every 30s
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
