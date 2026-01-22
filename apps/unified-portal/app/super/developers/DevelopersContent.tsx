'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Mail,
  Calendar,
  Search,
  RefreshCw,
  MoreHorizontal,
  Edit2,
  Trash2,
  Eye,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
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
  Input,
  EmptyState,
} from '@/components/ui/premium';
import Link from 'next/link';

// ============================================================================
// TYPES
// ============================================================================
interface Developer {
  id: string;
  email: string;
  role: string;
  tenant_id?: string;
  created_at: string;
  updated_at?: string;
  last_login_at?: string;
  is_active?: boolean;
}

interface DevelopersStats {
  total: number;
  superAdmins: number;
  admins: number;
  developers: number;
  activeToday: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
}

function getRoleBadgeVariant(role: string): 'error' | 'warning' | 'info' | 'default' {
  switch (role?.toLowerCase()) {
    case 'super_admin':
      return 'error';
    case 'admin':
      return 'warning';
    case 'developer':
      return 'info';
    default:
      return 'default';
  }
}

function formatRoleName(role: string): string {
  switch (role?.toLowerCase()) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'developer':
      return 'Developer';
    default:
      return role || 'Unknown';
  }
}

function getInitials(email: string): string {
  return email.substring(0, 2).toUpperCase();
}

// ============================================================================
// DEVELOPER ROW COMPONENT
// ============================================================================
const DeveloperRow = memo(function DeveloperRow({
  developer,
  onRefresh,
}: {
  developer: Developer;
  onRefresh: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <tr className="hover:bg-neutral-50 transition-colors group">
      {/* Developer Info */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-semibold text-sm">
              {getInitials(developer.email)}
            </span>
          </div>
          <div>
            <p className="font-medium text-neutral-900">{developer.email}</p>
            <p className="text-xs text-neutral-500">ID: {developer.id.slice(0, 8)}...</p>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-6 py-4">
        <Badge variant={getRoleBadgeVariant(developer.role)} size="sm">
          {formatRoleName(developer.role)}
        </Badge>
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        {developer.is_active !== false ? (
          <div className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Active</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Inactive</span>
          </div>
        )}
      </td>

      {/* Created */}
      <td className="px-6 py-4 text-sm text-neutral-600">
        {formatDate(developer.created_at)}
      </td>

      {/* Last Login */}
      <td className="px-6 py-4 text-sm text-neutral-600">
        {formatRelativeTime(developer.last_login_at)}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            href={`/admin/developers/${developer.id}/edit`}
            className="p-2 text-neutral-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const DevelopersContent = memo(function DevelopersContent() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [stats, setStats] = useState<DevelopersStats>({
    total: 0,
    superAdmins: 0,
    admins: 0,
    developers: 0,
    activeToday: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Fetch developers from API
  const fetchDevelopers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use the admin endpoint since it queries the admins table directly
      const response = await fetch('/api/admin/users');

      if (!response.ok) {
        // Fallback: Try to fetch directly from DB via a simpler endpoint
        // For now, show empty state with instructions
        throw new Error('Unable to load developers');
      }

      const data = await response.json();
      const developersList: Developer[] = data.users || data.admins || [];

      setDevelopers(developersList);

      // Calculate stats
      const stats: DevelopersStats = {
        total: developersList.length,
        superAdmins: developersList.filter((d: Developer) => d.role === 'super_admin').length,
        admins: developersList.filter((d: Developer) => d.role === 'admin').length,
        developers: developersList.filter((d: Developer) => d.role === 'developer').length,
        activeToday: developersList.filter((d: Developer) => {
          if (!d.last_login_at) return false;
          const lastLogin = new Date(d.last_login_at);
          const today = new Date();
          return lastLogin.toDateString() === today.toDateString();
        }).length,
      };
      setStats(stats);
    } catch (err) {
      console.error('Error fetching developers:', err);
      // Try alternate endpoint
      try {
        const altResponse = await fetch('/api/super/users');
        if (altResponse.ok) {
          const data = await altResponse.json();
          const developersList: Developer[] = data.users || data.admins || [];
          setDevelopers(developersList);

          const stats: DevelopersStats = {
            total: developersList.length,
            superAdmins: developersList.filter((d: Developer) => d.role === 'super_admin').length,
            admins: developersList.filter((d: Developer) => d.role === 'admin').length,
            developers: developersList.filter((d: Developer) => d.role === 'developer').length,
            activeToday: 0,
          };
          setStats(stats);
          return;
        }
      } catch {
        // Ignore alternate endpoint errors
      }
      setError('Unable to load developers. The API may not be available.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevelopers();
  }, [fetchDevelopers]);

  // Filter developers
  const filteredDevelopers = developers.filter((dev) => {
    const matchesSearch = dev.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || dev.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'developer', label: 'Developer' },
  ];

  return (
    <div className="p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Developers & Admins"
          subtitle="Manage developer accounts, admin users, and access permissions"
          icon={Users}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                leftIcon={RefreshCw}
                onClick={fetchDevelopers}
                disabled={isLoading}
                className={cn(isLoading && '[&_svg]:animate-spin')}
              >
                Refresh
              </Button>
              <Link href="/admin/developers/new">
                <Button variant="primary" size="sm" leftIcon={UserPlus}>
                  Add Developer
                </Button>
              </Link>
            </div>
          }
        />

        {/* Stats Cards */}
        <MetricCardGrid columns={4}>
          <MetricCard
            label="Total Users"
            value={stats.total}
            icon={Users}
            variant="highlighted"
          />
          <MetricCard
            label="Super Admins"
            value={stats.superAdmins}
            icon={ShieldCheck}
            variant="error"
          />
          <MetricCard
            label="Admins"
            value={stats.admins}
            icon={Shield}
            variant="warning"
          />
          <MetricCard
            label="Developers"
            value={stats.developers}
            icon={Building2}
            variant="default"
          />
        </MetricCardGrid>

        {/* Search and Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div className="flex items-center gap-2">
                {roleOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setRoleFilter(option.value)}
                    className={cn(
                      'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      roleFilter === option.value
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card>
            <CardContent className="py-8">
              <EmptyState
                variant="error"
                title="Failed to Load"
                description={error}
                action={{
                  label: 'Try Again',
                  onClick: fetchDevelopers,
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Developers Table */}
        {!error && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    User Directory
                  </h3>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {filteredDevelopers.length} {filteredDevelopers.length === 1 ? 'user' : 'users'} found
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">Loading developers...</p>
                </div>
              ) : filteredDevelopers.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    variant={searchQuery || roleFilter !== 'all' ? 'no-results' : 'default'}
                    title={searchQuery || roleFilter !== 'all' ? 'No matches found' : 'No developers yet'}
                    description={
                      searchQuery || roleFilter !== 'all'
                        ? 'Try adjusting your search or filter criteria'
                        : 'Get started by adding your first developer or admin user'
                    }
                    action={
                      searchQuery || roleFilter !== 'all'
                        ? {
                            label: 'Clear Filters',
                            onClick: () => {
                              setSearchQuery('');
                              setRoleFilter('all');
                            },
                          }
                        : {
                            label: 'Add Developer',
                            href: '/admin/developers/new',
                          }
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50 border-y border-neutral-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Last Login
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {filteredDevelopers.map((developer) => (
                        <DeveloperRow
                          key={developer.id}
                          developer={developer}
                          onRefresh={fetchDevelopers}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <AlertCircle className="w-4 h-4" />
                <span>Need to manage more settings?</span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/developers/new"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Invite User →
                </Link>
                <span className="text-neutral-300">|</span>
                <Link
                  href="/super"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Back to Dashboard →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default DevelopersContent;
