'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import {
  Building,
  Users,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  ChevronRight,
  Calendar,
  Layers,
  X,
  Loader2,
} from 'lucide-react';
import {
  PageHeader,
  MetricCard,
  MetricCardGrid,
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  EmptyState,
} from '@/components/ui/premium';
import Link from 'next/link';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  _count?: {
    developments: number;
    admins: number;
  };
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const TenantRow = memo(function TenantRow({
  tenant,
  onRefresh,
}: {
  tenant: Tenant;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-5 hover:bg-neutral-50 transition-colors group border-b border-neutral-100 last:border-b-0">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 flex items-center justify-center">
          <Building className="w-6 h-6 text-brand-600" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-neutral-900 group-hover:text-brand-600 transition-colors">
              {tenant.name}
            </h3>
            <Badge variant="neutral" size="sm">
              {tenant.slug}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Created {formatDate(tenant.created_at)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="font-semibold text-neutral-900">
              {tenant._count?.developments || 0}
            </div>
            <div className="text-xs text-neutral-500">Developments</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-neutral-900">
              {tenant._count?.admins || 0}
            </div>
            <div className="text-xs text-neutral-500">Users</div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
      </div>
    </div>
  );
});

function CreateTenantModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/super/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create tenant');
      }

      setName('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-900">Create New Tenant</h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Company Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cairn Homes"
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              leftIcon={isSubmitting ? Loader2 : Plus}
              className={cn(isSubmitting && '[&_svg]:animate-spin')}
            >
              {isSubmitting ? 'Creating...' : 'Create Tenant'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/super/tenants');
      if (!response.ok) throw new Error('Failed to fetch tenants');

      const data = await response.json();
      setTenants(data.tenants || []);
    } catch (err) {
      console.error('Error fetching tenants:', err);
      setError('Unable to load tenants. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const filteredTenants = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDevelopments = tenants.reduce((acc, t) => acc + (t._count?.developments || 0), 0);
  const totalAdmins = tenants.reduce((acc, t) => acc + (t._count?.admins || 0), 0);

  return (
    <div className="p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Tenants"
          subtitle="Manage developer companies and their configurations"
          icon={Building}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                leftIcon={RefreshCw}
                onClick={fetchTenants}
                disabled={isLoading}
                className={cn(isLoading && '[&_svg]:animate-spin')}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={Plus}
                onClick={() => setShowCreateModal(true)}
              >
                New Tenant
              </Button>
            </div>
          }
        />

        <MetricCardGrid columns={3}>
          <MetricCard
            label="Total Tenants"
            value={tenants.length}
            icon={Building}
            variant="highlighted"
          />
          <MetricCard
            label="Total Developments"
            value={totalDevelopments}
            icon={Layers}
          />
          <MetricCard
            label="Total Users"
            value={totalAdmins}
            icon={Users}
          />
        </MetricCardGrid>

        <Card>
          <CardContent className="py-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card>
            <CardContent className="py-8">
              <EmptyState
                variant="error"
                title="Failed to Load"
                description={error}
                action={{ label: 'Try Again', onClick: fetchTenants }}
              />
            </CardContent>
          </Card>
        )}

        {!error && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Developer Companies</h3>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {filteredTenants.length} {filteredTenants.length === 1 ? 'tenant' : 'tenants'} found
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">Loading tenants...</p>
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    variant={searchQuery ? 'no-results' : 'default'}
                    title={searchQuery ? 'No matches found' : 'No tenants yet'}
                    description={
                      searchQuery
                        ? 'Try adjusting your search criteria'
                        : 'Create your first tenant to get started'
                    }
                    action={
                      searchQuery
                        ? {
                            label: 'Clear Search',
                            onClick: () => setSearchQuery(''),
                          }
                        : {
                            label: 'Create Tenant',
                            onClick: () => setShowCreateModal(true),
                          }
                    }
                  />
                </div>
              ) : (
                <div>
                  {filteredTenants.map((tenant) => (
                    <TenantRow
                      key={tenant.id}
                      tenant={tenant}
                      onRefresh={fetchTenants}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <CreateTenantModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchTenants}
      />
    </div>
  );
}
