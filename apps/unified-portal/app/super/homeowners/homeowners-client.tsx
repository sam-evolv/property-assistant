'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Users,
  MessageSquare,
  Activity,
  CheckCircle2,
  Home,
  Search,
  Filter,
  Download,
  RefreshCw,
  Mail,
  ChevronRight,
  TrendingUp,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  PageHeader,
  MetricCard,
  MetricCardGrid,
  Button,
  Badge,
  EmptyState,
} from '@/components/ui/premium';
import { DataTable, Column } from '@/components/admin-enterprise/DataTable';
import { useProjectContext } from '@/contexts/ProjectContext';

// ============================================================================
// TYPES
// ============================================================================
interface Homeowner {
  id: string;
  name: string;
  email: string;
  house_type: string | null;
  address: string | null;
  development_name: string | null;
  created_at: string;
  chat_message_count: number;
  last_active: string | null;
  handover_date?: string | null;
  is_registered?: boolean;
}

// ============================================================================
// LOADING SKELETON
// ============================================================================
function HomeownersSkeleton() {
  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto animate-pulse">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-8 w-64 bg-neutral-200 rounded-lg mb-2" />
            <div className="h-4 w-96 bg-neutral-100 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-28 bg-neutral-200 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-neutral-200 p-6">
              <div className="h-4 w-24 bg-neutral-100 rounded mb-3" />
              <div className="h-8 w-16 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-neutral-200">
          <div className="h-14 border-b border-neutral-100" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 border-b border-neutral-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function HomeownersDirectory() {
  const { selectedProjectId, selectedProject, isLoading: projectsLoading } = useProjectContext();
  const [homeowners, setHomeowners] = useState<Homeowner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHomeowners = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (selectedProjectId) {
        const url = `/api/super/homeowners?projectId=${selectedProjectId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch homeowners');
        const data = await res.json();
        setHomeowners(data.homeowners || []);
      } else {
        const url = '/api/admin/homeowners/stats';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch homeowners');
        const data = await res.json();
        setHomeowners(data.homeowners || []);
      }
    } catch (err: any) {
      console.error('[HomeownersDirectory] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (projectsLoading) return;
    fetchHomeowners();
  }, [selectedProjectId, projectsLoading, fetchHomeowners]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHomeowners();
  };

  // Activity status helper
  const getActivityStatus = (lastActive: string | null) => {
    if (!lastActive) return { label: 'Never', status: 'inactive' as const, color: 'text-neutral-400' };

    const daysSince = Math.floor(
      (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince === 0) return { label: 'Today', status: 'active' as const, color: 'text-emerald-600' };
    if (daysSince <= 7) return { label: `${daysSince}d ago`, status: 'active' as const, color: 'text-emerald-500' };
    if (daysSince <= 30) return { label: `${daysSince}d ago`, status: 'inactive' as const, color: 'text-amber-600' };
    return { label: `${daysSince}d ago`, status: 'inactive' as const, color: 'text-neutral-500' };
  };

  // Filter homeowners
  const filteredHomeowners = useMemo(() => {
    return homeowners.filter((ho) => {
      const matchesSearch =
        ho.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ho.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ho.development_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const activity = getActivityStatus(ho.last_active);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && activity.status === 'active') ||
        (statusFilter === 'inactive' && activity.status === 'inactive');

      return matchesSearch && matchesStatus;
    });
  }, [homeowners, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = homeowners.length;
    const active = homeowners.filter((ho) => getActivityStatus(ho.last_active).status === 'active').length;
    const totalMessages = homeowners.reduce((acc, ho) => acc + ho.chat_message_count, 0);
    const registered = homeowners.filter((ho) => ho.is_registered).length;

    return { total, active, totalMessages, registered };
  }, [homeowners]);

  if (loading || projectsLoading) {
    return <HomeownersSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8 min-h-screen bg-neutral-50">
        <div className="max-w-7xl mx-auto">
          <EmptyState
            icon={Users}
            title="Failed to load homeowners"
            description={error}
            action={{
              label: 'Try Again',
              onClick: fetchHomeowners,
            }}
          />
        </div>
      </div>
    );
  }

  const columns: Column<Homeowner>[] = [
    {
      key: 'name',
      label: 'Homeowner',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 flex items-center justify-center">
            <span className="text-brand-700 font-semibold text-sm">
              {item.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-neutral-900">{item.name}</p>
            <p className="text-xs text-neutral-500">{item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'house_type',
      label: 'House Type',
      sortable: true,
      render: (item) =>
        item.house_type ? (
          <Badge variant="info" size="sm">
            {item.house_type}
          </Badge>
        ) : (
          <span className="text-neutral-400 text-sm">—</span>
        ),
    },
    {
      key: 'development_name',
      label: 'Development',
      sortable: true,
      render: (item) => (
        <span className="text-neutral-700">{item.development_name || '—'}</span>
      ),
    },
    {
      key: 'chat_message_count',
      label: 'Messages',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-500" />
          <span className="font-medium text-neutral-900">{item.chat_message_count}</span>
        </div>
      ),
    },
    {
      key: 'last_active',
      label: 'Last Active',
      sortable: true,
      render: (item) => {
        const activity = getActivityStatus(item.last_active);
        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                activity.status === 'active' ? 'bg-emerald-500' : 'bg-neutral-300'
              )}
            />
            <span className={cn('text-sm', activity.color)}>{activity.label}</span>
          </div>
        );
      },
    },
    {
      key: 'is_registered',
      label: 'Status',
      sortable: true,
      render: (item) => (
        <Badge variant={item.is_registered ? 'success' : 'neutral'} size="sm">
          {item.is_registered ? 'Registered' : 'Pending'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <PageHeader
          title="Homeowner Directory"
          subtitle={
            selectedProject
              ? `Viewing homeowners for ${selectedProject.name}`
              : 'All homeowners across all developments'
          }
          icon={Users}
          badge={{ label: 'Live', variant: 'live' }}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          actions={
            <Button variant="outline" leftIcon={Download}>
              Export
            </Button>
          }
        />

        {/* Stats Grid */}
        <MetricCardGrid columns={4} className="mb-8">
          <MetricCard
            label="Total Homeowners"
            value={stats.total}
            icon={Users}
            variant="highlighted"
          />
          <MetricCard
            label="Active (7d)"
            value={stats.active}
            icon={UserCheck}
            description={`${Math.round((stats.active / stats.total) * 100) || 0}% engagement`}
            variant="success"
          />
          <MetricCard
            label="Total Messages"
            value={stats.totalMessages.toLocaleString()}
            icon={MessageSquare}
            trend={12}
          />
          <MetricCard
            label="Registered"
            value={stats.registered}
            icon={CheckCircle2}
            description={`${Math.round((stats.registered / stats.total) * 100) || 0}% completion`}
          />
        </MetricCardGrid>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search homeowners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            {(['all', 'active', 'inactive'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  statusFilter === status
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200'
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
          {filteredHomeowners.length === 0 ? (
            <EmptyState
              icon={Users}
              title={searchQuery ? 'No homeowners found' : 'No homeowners yet'}
              description={
                searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Homeowners will appear here once they register'
              }
            />
          ) : (
            <DataTable
              data={filteredHomeowners}
              columns={columns}
              pageSize={15}
              searchable={false}
            />
          )}
        </div>

        {/* Footer */}
        {filteredHomeowners.length > 0 && (
          <div className="mt-4 text-center text-sm text-neutral-500">
            Showing {filteredHomeowners.length} of {homeowners.length} homeowners
          </div>
        )}
      </div>
    </div>
  );
}

export default HomeownersDirectory;
