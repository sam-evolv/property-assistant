'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  Clock,
  AlertCircle,
  CheckCircle,
  User,
  Search,
  Filter,
  Plus,
  Upload,
  Image,
  ChevronRight,
  Calendar,
  Wrench,
  Building2,
} from 'lucide-react';

import { DataTable, Column } from '@/components/ui/DataTable';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert } from '@/components/ui/ProactiveAlerts';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { EmptyState } from '@/components/ui/EmptyState';

// Types
type SnagStatus = 'submitted' | 'acknowledged' | 'in-progress' | 'resolved' | 'verified';
type SnagPriority = 'low' | 'medium' | 'high' | 'urgent';
type SnagCategory = 'kitchen' | 'bathroom' | 'painting' | 'carpentry' | 'electrical' | 'plumbing' | 'other';

interface Snag {
  id: string;
  unitNumber: string;
  title: string;
  description: string;
  category: SnagCategory;
  priority: SnagPriority;
  status: SnagStatus;
  daysOpen: number;
  submittedDate: Date;
  contractor?: string;
  photos?: number;
  location?: string;
}

// Mock data
const mockSnags: Snag[] = [
  {
    id: '1',
    unitNumber: '46',
    title: 'Kitchen cabinet door misaligned',
    description: 'Upper cabinet door on left side does not close properly',
    category: 'kitchen',
    priority: 'medium',
    status: 'in-progress',
    daysOpen: 3,
    submittedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    contractor: 'ABC Kitchens',
    photos: 2,
    location: 'Kitchen - Upper cabinets',
  },
  {
    id: '2',
    unitNumber: '46',
    title: 'Bathroom tile crack',
    description: 'Hairline crack in floor tile near shower entrance',
    category: 'bathroom',
    priority: 'low',
    status: 'submitted',
    daysOpen: 5,
    submittedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    photos: 3,
    location: 'Bathroom - Floor',
  },
  {
    id: '3',
    unitNumber: '51',
    title: 'Paint touch-up needed',
    description: 'Scuff marks on hallway wall near entrance',
    category: 'painting',
    priority: 'low',
    status: 'submitted',
    daysOpen: 2,
    submittedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    photos: 1,
    location: 'Hallway',
  },
  {
    id: '4',
    unitNumber: '51',
    title: 'Door alignment issue',
    description: 'Bedroom door sticks when closing',
    category: 'carpentry',
    priority: 'medium',
    status: 'resolved',
    daysOpen: 0,
    submittedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    contractor: 'Murphy Carpentry',
    photos: 1,
    location: 'Master Bedroom',
  },
  {
    id: '5',
    unitNumber: '33',
    title: 'Electrical outlet not working',
    description: 'Double outlet in living room has no power',
    category: 'electrical',
    priority: 'high',
    status: 'acknowledged',
    daysOpen: 1,
    submittedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    contractor: 'Spark Electric',
    photos: 1,
    location: 'Living Room - East wall',
  },
  {
    id: '6',
    unitNumber: '34',
    title: 'Kitchen tap dripping',
    description: 'Slow drip from kitchen mixer tap',
    category: 'plumbing',
    priority: 'urgent',
    status: 'in-progress',
    daysOpen: 4,
    submittedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    contractor: 'Reliable Plumbing',
    photos: 2,
    location: 'Kitchen - Sink',
  },
  {
    id: '7',
    unitNumber: '47',
    title: 'Window seal gap',
    description: 'Small gap visible in window seal, potential draft',
    category: 'other',
    priority: 'medium',
    status: 'verified',
    daysOpen: 0,
    submittedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    photos: 2,
    location: 'Living Room - Window',
  },
];

const statusConfig: Record<SnagStatus, { label: string; color: string; bgColor: string }> = {
  submitted: { label: 'Submitted', color: 'text-red-600', bgColor: 'bg-red-50' },
  acknowledged: { label: 'Acknowledged', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  'in-progress': { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  resolved: { label: 'Resolved', color: 'text-green-600', bgColor: 'bg-green-50' },
  verified: { label: 'Verified', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
};

const priorityConfig: Record<SnagPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-600' },
  medium: { label: 'Medium', color: 'text-amber-600' },
  high: { label: 'High', color: 'text-orange-600' },
  urgent: { label: 'Urgent', color: 'text-red-600' },
};

const categoryConfig: Record<SnagCategory, { label: string; icon: typeof ClipboardList }> = {
  kitchen: { label: 'Kitchen', icon: ClipboardList },
  bathroom: { label: 'Bathroom', icon: ClipboardList },
  painting: { label: 'Painting', icon: ClipboardList },
  carpentry: { label: 'Carpentry', icon: Wrench },
  electrical: { label: 'Electrical', icon: ClipboardList },
  plumbing: { label: 'Plumbing', icon: ClipboardList },
  other: { label: 'Other', icon: ClipboardList },
};

// Snag Card for detail view
function SnagCard({ snag, onClick }: { snag: Snag; onClick?: () => void }) {
  const status = statusConfig[snag.status];
  const priority = priorityConfig[snag.priority];
  const category = categoryConfig[snag.category];

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border p-4 cursor-pointer transition-all',
        'hover:shadow-md hover:border-gray-300',
        snag.priority === 'urgent' && 'border-red-200'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Unit {snag.unitNumber}</span>
          <Badge
            variant={
              snag.status === 'verified' || snag.status === 'resolved'
                ? 'success'
                : snag.status === 'in-progress'
                ? 'info'
                : snag.status === 'acknowledged'
                ? 'warning'
                : 'error'
            }
            size="sm"
          >
            {status.label}
          </Badge>
        </div>
        {snag.photos && snag.photos > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Image className="w-3 h-3" />
            {snag.photos}
          </div>
        )}
      </div>

      <p className="text-sm text-gray-900 font-medium mb-1 line-clamp-1">{snag.title}</p>
      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{snag.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" size="sm">
            {category.label}
          </Badge>
          <span className={cn('text-xs font-medium', priority.color)}>
            {priority.label}
          </span>
        </div>

        {snag.daysOpen > 0 && (
          <span className="text-xs text-gray-400">{snag.daysOpen} days</span>
        )}
      </div>

      {snag.contractor && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
          <User className="w-3 h-3" />
          {snag.contractor}
        </div>
      )}
    </div>
  );
}

// Main Snagging Page
export default function SnaggingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<SnagStatus | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<SnagCategory | 'all'>('all');
  const [selectedUnit, setSelectedUnit] = useState<string | 'all'>('all');

  // Filter snags
  const filteredSnags = useMemo(() => {
    return mockSnags.filter((snag) => {
      const matchesSearch =
        !searchQuery ||
        snag.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        snag.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        snag.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatus === 'all' || snag.status === selectedStatus;
      const matchesCategory = selectedCategory === 'all' || snag.category === selectedCategory;
      const matchesUnit = selectedUnit === 'all' || snag.unitNumber === selectedUnit;

      return matchesSearch && matchesStatus && matchesCategory && matchesUnit;
    });
  }, [searchQuery, selectedStatus, selectedCategory, selectedUnit]);

  // Stats
  const stats = useMemo(() => {
    const open = mockSnags.filter((s) => !['resolved', 'verified'].includes(s.status));
    const avgResolutionTime =
      mockSnags
        .filter((s) => s.status === 'resolved' || s.status === 'verified')
        .reduce((acc, s) => acc + s.daysOpen, 0) / Math.max(1, mockSnags.filter((s) => ['resolved', 'verified'].includes(s.status)).length);

    return {
      open: open.length,
      inProgress: mockSnags.filter((s) => s.status === 'in-progress').length,
      resolved: mockSnags.filter((s) => s.status === 'resolved' || s.status === 'verified').length,
      avgResolutionTime: avgResolutionTime.toFixed(1),
      overdue: mockSnags.filter((s) => s.daysOpen > 5 && !['resolved', 'verified'].includes(s.status)).length,
    };
  }, []);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    mockSnags.forEach((snag) => {
      if (!['resolved', 'verified'].includes(snag.status)) {
        breakdown[snag.category] = (breakdown[snag.category] || 0) + 1;
      }
    });
    return breakdown;
  }, []);

  // Unique units for filter
  const uniqueUnits = useMemo(() => {
    return [...new Set(mockSnags.map((s) => s.unitNumber))].sort();
  }, []);

  // Alerts
  const alerts: Alert[] = useMemo(() => {
    const alerts: Alert[] = [];

    if (stats.overdue > 0) {
      alerts.push({
        id: 'overdue',
        title: `${stats.overdue} snags overdue`,
        description: 'Open for more than 5 days without resolution',
        priority: 'critical',
        count: stats.overdue,
      });
    }

    const urgent = mockSnags.filter((s) => s.priority === 'urgent' && !['resolved', 'verified'].includes(s.status));
    if (urgent.length > 0) {
      alerts.push({
        id: 'urgent',
        title: `${urgent.length} urgent items`,
        description: 'High priority snags requiring immediate attention',
        priority: 'warning',
        count: urgent.length,
      });
    }

    return alerts;
  }, [stats.overdue]);

  // Table columns
  const columns: Column<Snag>[] = [
    {
      id: 'unit',
      header: 'Unit',
      accessor: 'unitNumber',
      sortable: true,
      cell: (_, row) => (
        <span className="font-medium text-gray-900">Unit {row.unitNumber}</span>
      ),
    },
    {
      id: 'title',
      header: 'Item',
      accessor: 'title',
      sortable: true,
      cell: (value) => (
        <span className="text-gray-900 line-clamp-1">{value as string}</span>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      accessor: 'category',
      sortable: true,
      cell: (value) => (
        <Badge variant="outline" size="sm">
          {categoryConfig[value as SnagCategory].label}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (value) => {
        const config = statusConfig[value as SnagStatus];
        return (
          <Badge
            variant={
              value === 'verified' || value === 'resolved'
                ? 'success'
                : value === 'in-progress'
                ? 'info'
                : value === 'acknowledged'
                ? 'warning'
                : 'error'
            }
            size="sm"
          >
            {config.label}
          </Badge>
        );
      },
    },
    {
      id: 'priority',
      header: 'Priority',
      accessor: 'priority',
      sortable: true,
      cell: (value) => {
        const config = priorityConfig[value as SnagPriority];
        return (
          <span className={cn('text-sm font-medium', config.color)}>
            {config.label}
          </span>
        );
      },
    },
    {
      id: 'days',
      header: 'Days',
      accessor: 'daysOpen',
      sortable: true,
      align: 'right',
      cell: (value, row) => (
        <span
          className={cn(
            'text-sm',
            (value as number) > 5 && !['resolved', 'verified'].includes(row.status)
              ? 'text-red-600 font-medium'
              : 'text-gray-600'
          )}
        >
          {value as number}
        </span>
      ),
    },
  ];

  const handleExport = async (format: string) => {
    console.log('Exporting as', format);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Snagging</h1>
              <p className="text-sm text-gray-500 mt-1">
                {stats.open} open items across {uniqueUnits.length} units
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ExportMenu onExport={handleExport} />
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                <Upload className="w-4 h-4" />
                Import
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors">
                <Plus className="w-4 h-4" />
                Add Snag
              </button>
            </div>
          </div>

          {/* Stats */}
          <StatCardGrid columns={5}>
            <StatCard
              label="Open"
              value={stats.open}
              icon={AlertCircle}
              iconColor="text-red-500"
            />
            <StatCard
              label="In Progress"
              value={stats.inProgress}
              icon={Clock}
              iconColor="text-blue-500"
            />
            <StatCard
              label="Resolved"
              value={stats.resolved}
              icon={CheckCircle}
              iconColor="text-green-500"
            />
            <StatCard
              label="Avg Resolution"
              value={stats.avgResolutionTime}
              suffix=" days"
              icon={Calendar}
              iconColor="text-purple-500"
            />
            <StatCard
              label="Overdue"
              value={stats.overdue}
              icon={AlertCircle}
              iconColor="text-amber-500"
              description="> 5 days open"
            />
          </StatCardGrid>

          {/* Alerts */}
          {alerts.length > 0 && <ProactiveAlertsWidget alerts={alerts} />}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
            >
              <option value="all">All Units</option>
              {uniqueUnits.map((unit) => (
                <option key={unit} value={unit}>
                  Unit {unit}
                </option>
              ))}
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as SnagCategory | 'all')}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as SnagStatus | 'all')}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
            >
              <option value="all">All Status</option>
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search snags..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
              />
            </div>

            <p className="text-sm text-gray-500 ml-auto">
              {filteredSnags.length} of {mockSnags.length} items
            </p>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Open Items by Category</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(categoryBreakdown).map(([category, count]) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category as SnagCategory)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                    selectedCategory === category
                      ? 'border-gold-500 bg-gold-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <span className="text-sm font-medium text-gray-900">
                    {categoryConfig[category as SnagCategory].label}
                  </span>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Data Table */}
          <DataTable
            data={filteredSnags}
            columns={columns}
            selectable
            bulkActions={[
              {
                label: 'Assign Contractor',
                icon: User,
                onClick: (ids) => console.log('Assign contractor to', ids),
              },
              {
                label: 'Mark Resolved',
                icon: CheckCircle,
                onClick: (ids) => console.log('Mark resolved', ids),
              },
            ]}
            emptyMessage="No snags match your filters"
          />
        </div>
      </div>
    </div>
  );
}
