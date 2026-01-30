'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Users,
  Search,
  RefreshCw,
  Mail,
  Phone,
  Home,
  Calendar,
  MessageSquare,
  Activity,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  Button,
  Badge,
} from '@/components/ui/premium';

interface Homeowner {
  id: string;
  name: string;
  email: string;
  phone: string;
  unit: {
    id: string;
    number: string;
    address: string;
  };
  development: {
    id: string;
    name: string;
  };
  consentDate: string | null;
  lastActivity: string | null;
  questionsCount: number;
  status: 'active' | 'pending' | 'inactive';
}

interface Development {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  active: number;
  questionsTotal: number;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'success' | 'warning' | 'neutral', label: string }> = {
    active: { variant: 'success', label: 'Active' },
    pending: { variant: 'warning', label: 'Pending' },
    inactive: { variant: 'neutral', label: 'Inactive' },
  };
  const config = variants[status] || { variant: 'neutral', label: status };
  return <Badge variant={config.variant} size="sm">{config.label}</Badge>;
}

function HomeownerRow({ homeowner }: { homeowner: Homeowner }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-neutral-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-amber-700 font-semibold text-sm">
                {homeowner.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="font-medium text-neutral-900">{homeowner.name || 'Unknown'}</p>
              <p className="text-sm text-neutral-500">{homeowner.email}</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <p className="text-sm text-neutral-700">{homeowner.unit?.number || 'N/A'}</p>
          <p className="text-xs text-neutral-500">{homeowner.development?.name}</p>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-neutral-400" />
            <span className="text-sm text-neutral-700">{homeowner.questionsCount || 0}</span>
          </div>
        </td>
        <td className="px-6 py-4">
          <StatusBadge status={homeowner.status} />
        </td>
        <td className="px-6 py-4">
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-neutral-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-neutral-400" />
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-neutral-50">
          <td colSpan={5} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Contact Details
                </h4>
                <div className="space-y-1 text-sm">
                  <p className="text-neutral-600">{homeowner.email || 'No email'}</p>
                  <p className="flex items-center gap-2 text-neutral-600">
                    <Phone className="w-3 h-3" />
                    {homeowner.phone || 'No phone'}
                  </p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Property
                </h4>
                <div className="space-y-1 text-sm">
                  <p className="text-neutral-600">Unit: {homeowner.unit?.number || 'N/A'}</p>
                  <p className="text-neutral-600">{homeowner.unit?.address || 'N/A'}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Activity
                </h4>
                <div className="space-y-1 text-sm">
                  <p className="text-neutral-600">
                    Consented: {homeowner.consentDate ? new Date(homeowner.consentDate).toLocaleDateString() : 'N/A'}
                  </p>
                  <p className="text-neutral-600">
                    Last Active: {homeowner.lastActivity ? new Date(homeowner.lastActivity).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function HomeownersDirectory() {
  const [homeowners, setHomeowners] = useState<Homeowner[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [developmentFilter, setDevelopmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchHomeowners = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (developmentFilter) params.set('development_id', developmentFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/super/homeowners?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch homeowners');

      const data = await res.json();
      setHomeowners(data.homeowners || []);
      setDevelopments(data.developments || []);
      setStats(data.stats);
    } catch (err) {
      console.error('Homeowners fetch error:', err);
      setError('Failed to load homeowners');
    } finally {
      setIsLoading(false);
    }
  }, [search, developmentFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchHomeowners(), 300);
    return () => clearTimeout(timer);
  }, [fetchHomeowners]);

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
  ];

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Homeowners Directory"
          subtitle="View and manage all homeowners across developments"
          icon={Users}
          actions={
            <Button
              variant="outline"
              size="sm"
              leftIcon={RefreshCw}
              onClick={fetchHomeowners}
              disabled={isLoading}
              className={cn(isLoading && '[&_svg]:animate-spin')}
            >
              Refresh
            </Button>
          }
        />

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-sm text-neutral-500">Total Homeowners</p>
                <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-sm text-neutral-500">Active</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-sm text-neutral-500">Total Questions</p>
                <p className="text-2xl font-bold text-amber-600">{stats.questionsTotal}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, unit..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={developmentFilter}
                  onChange={(e) => setDevelopmentFilter(e.target.value)}
                  className="px-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">All Developments</option>
                  {developments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <div className="flex items-center bg-white rounded-lg border border-neutral-200 p-1">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value)}
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                        statusFilter === opt.value
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-600 hover:text-neutral-900'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-neutral-600">{error}</p>
              </div>
            ) : homeowners.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-600">No homeowners found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Homeowner</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Questions</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {homeowners.map((homeowner) => (
                      <HomeownerRow key={homeowner.id} homeowner={homeowner} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default HomeownersDirectory;
