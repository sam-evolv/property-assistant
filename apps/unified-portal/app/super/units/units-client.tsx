'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Home,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  Calendar,
  FileText,
  QrCode,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  Button,
  Badge,
} from '@/components/ui/premium';

interface Unit {
  id: string;
  unit_uid: string;
  unit_number: string;
  unit_code: string;
  address: string;
  purchaser: {
    name: string;
    email: string;
    phone: string;
  } | null;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  development: {
    id: string;
    name: string;
  };
  status: 'handed_over' | 'assigned' | 'available';
  timeline: {
    created: string;
    handedOver: string | null;
    lastActivity: string | null;
  };
}

interface Development {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  withPurchaser: number;
  handedOver: number;
  pending: number;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'success' | 'info' | 'neutral', label: string }> = {
    handed_over: { variant: 'success', label: 'Handed Over' },
    assigned: { variant: 'info', label: 'Assigned' },
    available: { variant: 'neutral', label: 'Available' },
  };
  const config = variants[status] || { variant: 'neutral', label: status };
  return <Badge variant={config.variant} size="sm">{config.label}</Badge>;
}

function UnitRow({ unit }: { unit: Unit }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-neutral-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
              <Home className="w-5 h-5 text-neutral-500" />
            </div>
            <div>
              <p className="font-medium text-neutral-900">{unit.unit_number || unit.address}</p>
              <p className="text-sm text-neutral-500">{unit.propertyType}</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <p className="text-sm text-neutral-700">{unit.development.name}</p>
        </td>
        <td className="px-6 py-4">
          {unit.purchaser ? (
            <div>
              <p className="text-sm font-medium text-neutral-900">{unit.purchaser.name}</p>
              <p className="text-xs text-neutral-500">{unit.purchaser.email}</p>
            </div>
          ) : (
            <span className="text-sm text-neutral-400">No purchaser</span>
          )}
        </td>
        <td className="px-6 py-4">
          <StatusBadge status={unit.status} />
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
              {unit.purchaser && (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Contact Details
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2 text-neutral-600">
                      <Mail className="w-3 h-3" />
                      {unit.purchaser.email || 'N/A'}
                    </p>
                    <p className="flex items-center gap-2 text-neutral-600">
                      <Phone className="w-3 h-3" />
                      {unit.purchaser.phone || 'N/A'}
                    </p>
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Timeline
                </h4>
                <div className="space-y-1 text-sm">
                  <p className="text-neutral-600">
                    Created: {unit.timeline.created ? new Date(unit.timeline.created).toLocaleDateString() : 'N/A'}
                  </p>
                  <p className="text-neutral-600">
                    Handed Over: {unit.timeline.handedOver ? new Date(unit.timeline.handedOver).toLocaleDateString() : 'N/A'}
                  </p>
                  <p className="text-neutral-600">
                    Last Activity: {unit.timeline.lastActivity ? new Date(unit.timeline.lastActivity).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-2">Quick Actions</h4>
                <div className="flex gap-2">
                  <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200">
                    <FileText className="w-3 h-3" />
                    Documents
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200">
                    <QrCode className="w-3 h-3" />
                    QR Code
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function UnitsExplorer() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [developmentFilter, setDevelopmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (developmentFilter) params.set('development_id', developmentFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/super/units?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch units');

      const data = await res.json();
      setUnits(data.units || []);
      setDevelopments(data.developments || []);
      setStats(data.stats);
    } catch (err) {
      console.error('Units fetch error:', err);
      setError('Failed to load units');
    } finally {
      setIsLoading(false);
    }
  }, [search, developmentFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchUnits(), 300);
    return () => clearTimeout(timer);
  }, [fetchUnits]);

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'with_purchaser', label: 'With Purchaser' },
    { value: 'active', label: 'Handed Over' },
    { value: 'no_purchaser', label: 'Available' },
  ];

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Units Explorer"
          subtitle="View and manage all units across developments"
          icon={Home}
          actions={
            <Button
              variant="outline"
              size="sm"
              leftIcon={RefreshCw}
              onClick={fetchUnits}
              disabled={isLoading}
              className={cn(isLoading && '[&_svg]:animate-spin')}
            >
              Refresh
            </Button>
          }
        />

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-sm text-neutral-500">Total Units</p>
                <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-sm text-neutral-500">With Purchaser</p>
                <p className="text-2xl font-bold text-amber-600">{stats.withPurchaser}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-sm text-neutral-500">Handed Over</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.handedOver}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-sm text-neutral-500">Pending</p>
                <p className="text-2xl font-bold text-neutral-600">{stats.pending}</p>
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
                  placeholder="Search units, addresses, purchasers..."
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
            ) : units.length === 0 ? (
              <div className="py-12 text-center">
                <Home className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-600">No units found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Development</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Purchaser</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {units.map((unit) => (
                      <UnitRow key={unit.id} unit={unit} />
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

export default UnitsExplorer;
