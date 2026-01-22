'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Building2,
  Home,
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  MapPin,
  Calendar,
  Activity,
  ChevronRight,
  RefreshCw,
  Download,
  TrendingUp,
} from 'lucide-react';
import {
  PageHeader,
  MetricCard,
  MetricCardGrid,
  Button,
  Badge,
  Input,
  ListCard,
  ListItem,
  EmptyState,
} from '@/components/ui/premium';

// ============================================================================
// TYPES
// ============================================================================
interface Development {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
  created_at: string;
  tenant?: {
    id: string;
    name: string;
  };
  _count?: {
    units: number;
    homeowners: number;
  };
}

interface DevelopmentsContentProps {
  isSuperAdmin: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function DevelopmentsContent({ isSuperAdmin }: DevelopmentsContentProps) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDevelopments = useCallback(async () => {
    try {
      const res = await fetch('/api/super/developments');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDevelopments(data.developments || []);
    } catch (err) {
      console.error('Error fetching developments:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDevelopments();
  }, [fetchDevelopments]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDevelopments();
  };

  // Filter developments
  const filteredDevelopments = developments.filter((dev) => {
    const matchesSearch =
      dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.tenant?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && dev.is_active) ||
      (statusFilter === 'inactive' && !dev.is_active);

    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalDevelopments = developments.length;
  const activeDevelopments = developments.filter((d) => d.is_active).length;
  const totalUnits = developments.reduce((acc, d) => acc + (d._count?.units || 0), 0);
  const totalHomeowners = developments.reduce((acc, d) => acc + (d._count?.homeowners || 0), 0);

  return (
    <div className="p-8 min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <PageHeader
          title="Developments"
          subtitle="Manage all developments across all tenants"
          icon={Building2}
          badge={{ label: 'Live', variant: 'live' }}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          actions={
            isSuperAdmin && (
              <Button
                variant="primary"
                leftIcon={Plus}
                onClick={() => (window.location.href = '/super/developments/new')}
              >
                New Development
              </Button>
            )
          }
        />

        {/* Stats Grid */}
        <MetricCardGrid columns={4} className="mb-8">
          <MetricCard
            label="Total Developments"
            value={totalDevelopments}
            icon={Building2}
            trend={12}
            trendLabel="vs last month"
            variant="highlighted"
          />
          <MetricCard
            label="Active"
            value={activeDevelopments}
            icon={Activity}
            description={`${Math.round((activeDevelopments / totalDevelopments) * 100) || 0}% of total`}
            variant="success"
          />
          <MetricCard
            label="Total Units"
            value={totalUnits.toLocaleString()}
            icon={Home}
            trend={8}
          />
          <MetricCard
            label="Homeowners"
            value={totalHomeowners.toLocaleString()}
            icon={Users}
            trend={15}
          />
        </MetricCardGrid>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search developments..."
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

        {/* Developments List */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-neutral-300 animate-spin mx-auto mb-3" />
              <p className="text-sm text-neutral-500">Loading developments...</p>
            </div>
          ) : filteredDevelopments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={searchQuery ? 'No developments found' : 'No developments yet'}
              description={
                searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first development'
              }
              action={
                isSuperAdmin && !searchQuery
                  ? {
                      label: 'Create Development',
                      onClick: () => (window.location.href = '/super/developments/new'),
                    }
                  : undefined
              }
            />
          ) : (
            <div className="divide-y divide-neutral-100">
              {filteredDevelopments.map((dev) => (
                <a
                  key={dev.id}
                  href={`/super/developments/${dev.id}`}
                  className="flex items-center justify-between px-6 py-5 hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-brand-600" />
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-neutral-900 group-hover:text-brand-600 transition-colors">
                          {dev.name}
                        </h3>
                        <Badge
                          variant={dev.is_active ? 'success' : 'neutral'}
                          size="sm"
                        >
                          {dev.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-neutral-500">
                        {dev.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {dev.address}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {dev.tenant?.name || 'Unknown Tenant'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats & Arrow */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-neutral-900">
                          {dev._count?.units || 0}
                        </div>
                        <div className="text-xs text-neutral-500">Units</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-neutral-900">
                          {dev._count?.homeowners || 0}
                        </div>
                        <div className="text-xs text-neutral-500">Homeowners</div>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredDevelopments.length > 0 && (
          <div className="mt-4 text-center text-sm text-neutral-500">
            Showing {filteredDevelopments.length} of {developments.length} developments
          </div>
        )}
      </div>
    </div>
  );
}

export default DevelopmentsContent;
