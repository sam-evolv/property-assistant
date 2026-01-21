'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Layers,
  Clock,
  AlertCircle,
  CheckCircle,
  Mail,
  Settings,
  Search,
  Filter,
  ChevronRight,
  Calendar,
  Bell,
  User,
} from 'lucide-react';

import { DataTable, Column } from '@/components/ui/DataTable';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { ProgressBar, CircularProgress } from '@/components/ui/ProgressBar';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert } from '@/components/ui/ProactiveAlerts';
import { BulkActionModal } from '@/components/ui/BulkActionModal';

// Types
type SelectionStatus = 'not-started' | 'in-progress' | 'complete' | 'overdue';

interface KitchenSelection {
  id: string;
  unitNumber: string;
  purchaserName: string;
  purchaserEmail: string;
  status: SelectionStatus;
  progressPercent: number;
  deadline: Date;
  daysUntilDeadline: number;
  lastUpdated?: Date;
  selections?: {
    cabinets: boolean;
    countertops: boolean;
    appliances: boolean;
    flooring: boolean;
    backsplash: boolean;
  };
}

// Mock data
const mockSelections: KitchenSelection[] = [
  {
    id: '1',
    unitNumber: '33',
    purchaserName: 'A. Murphy',
    purchaserEmail: 'a.murphy@email.com',
    status: 'overdue',
    progressPercent: 20,
    deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    daysUntilDeadline: -5,
    selections: { cabinets: true, countertops: false, appliances: false, flooring: false, backsplash: false },
  },
  {
    id: '2',
    unitNumber: '34',
    purchaserName: 'S. Walsh',
    purchaserEmail: 's.walsh@email.com',
    status: 'overdue',
    progressPercent: 0,
    deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    daysUntilDeadline: -5,
    selections: { cabinets: false, countertops: false, appliances: false, flooring: false, backsplash: false },
  },
  {
    id: '3',
    unitNumber: '35',
    purchaserName: 'P. Byrne',
    purchaserEmail: 'p.byrne@email.com',
    status: 'overdue',
    progressPercent: 40,
    deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    daysUntilDeadline: -3,
    selections: { cabinets: true, countertops: true, appliances: false, flooring: false, backsplash: false },
  },
  {
    id: '4',
    unitNumber: '38',
    purchaserName: 'K. Dolan',
    purchaserEmail: 'k.dolan@email.com',
    status: 'overdue',
    progressPercent: 60,
    deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    daysUntilDeadline: -3,
    selections: { cabinets: true, countertops: true, appliances: true, flooring: false, backsplash: false },
  },
  {
    id: '5',
    unitNumber: '46',
    purchaserName: 'J. O\'Connor',
    purchaserEmail: 'j.oconnor@email.com',
    status: 'in-progress',
    progressPercent: 60,
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    daysUntilDeadline: 3,
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    selections: { cabinets: true, countertops: true, appliances: true, flooring: false, backsplash: false },
  },
  {
    id: '6',
    unitNumber: '47',
    purchaserName: 'A. Dolan',
    purchaserEmail: 'a.dolan@email.com',
    status: 'in-progress',
    progressPercent: 80,
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    daysUntilDeadline: 5,
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    selections: { cabinets: true, countertops: true, appliances: true, flooring: true, backsplash: false },
  },
  {
    id: '7',
    unitNumber: '48',
    purchaserName: 'M. Collins',
    purchaserEmail: 'm.collins@email.com',
    status: 'complete',
    progressPercent: 100,
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    daysUntilDeadline: 7,
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    selections: { cabinets: true, countertops: true, appliances: true, flooring: true, backsplash: true },
  },
  {
    id: '8',
    unitNumber: '49',
    purchaserName: 'T. Ryan',
    purchaserEmail: 't.ryan@email.com',
    status: 'not-started',
    progressPercent: 0,
    deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    daysUntilDeadline: 10,
    selections: { cabinets: false, countertops: false, appliances: false, flooring: false, backsplash: false },
  },
];

const statusConfig: Record<SelectionStatus, { label: string; color: string; bgColor: string }> = {
  'not-started': { label: 'Not Started', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  'in-progress': { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  complete: { label: 'Complete', color: 'text-green-600', bgColor: 'bg-green-50' },
  overdue: { label: 'Overdue', color: 'text-red-600', bgColor: 'bg-red-50' },
};

// Selection Card Component
function SelectionCard({
  selection,
  onSendReminder,
}: {
  selection: KitchenSelection;
  onSendReminder: (id: string) => void;
}) {
  const config = statusConfig[selection.status];

  return (
    <div
      className={cn(
        'bg-white rounded-lg border p-4 transition-all hover:shadow-md',
        selection.status === 'overdue' && 'border-red-200'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Unit {selection.unitNumber}</p>
          <p className="text-sm text-gray-600">{selection.purchaserName}</p>
        </div>
        <Badge
          variant={
            selection.status === 'complete'
              ? 'success'
              : selection.status === 'overdue'
              ? 'error'
              : selection.status === 'in-progress'
              ? 'info'
              : 'default'
          }
        >
          {config.label}
        </Badge>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{selection.progressPercent}%</span>
        </div>
        <ProgressBar
          value={selection.progressPercent}
          variant={
            selection.status === 'overdue'
              ? 'error'
              : selection.progressPercent >= 100
              ? 'success'
              : 'default'
          }
          size="sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs font-medium',
            selection.daysUntilDeadline < 0
              ? 'text-red-600'
              : selection.daysUntilDeadline <= 3
              ? 'text-amber-600'
              : 'text-gray-500'
          )}
        >
          {selection.daysUntilDeadline < 0
            ? `${Math.abs(selection.daysUntilDeadline)} days overdue`
            : selection.daysUntilDeadline === 0
            ? 'Due today'
            : `${selection.daysUntilDeadline} days left`}
        </span>

        {selection.status !== 'complete' && (
          <button
            onClick={() => onSendReminder(selection.id)}
            className="flex items-center gap-1 text-xs font-medium text-gold-600 hover:text-gold-700"
          >
            <Mail className="w-3 h-3" />
            Remind
          </button>
        )}
      </div>
    </div>
  );
}

// Main Kitchen Selections Page
export default function KitchenSelectionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<SelectionStatus | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkReminder, setShowBulkReminder] = useState(false);

  // Filter selections
  const filteredSelections = useMemo(() => {
    return mockSelections.filter((sel) => {
      const matchesSearch =
        !searchQuery ||
        sel.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sel.purchaserName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatus === 'all' || sel.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, selectedStatus]);

  // Stats
  const stats = useMemo(() => {
    const total = mockSelections.length;
    const complete = mockSelections.filter((s) => s.status === 'complete').length;
    const inProgress = mockSelections.filter((s) => s.status === 'in-progress').length;
    const notStarted = mockSelections.filter((s) => s.status === 'not-started').length;
    const overdue = mockSelections.filter((s) => s.status === 'overdue').length;

    return {
      total,
      complete,
      inProgress,
      notStarted,
      overdue,
      completionRate: Math.round((complete / total) * 100),
    };
  }, []);

  // Group by status for display
  const selectionsByStatus = useMemo(() => {
    return {
      overdue: filteredSelections.filter((s) => s.status === 'overdue'),
      inProgress: filteredSelections.filter((s) => s.status === 'in-progress'),
      notStarted: filteredSelections.filter((s) => s.status === 'not-started'),
      complete: filteredSelections.filter((s) => s.status === 'complete'),
    };
  }, [filteredSelections]);

  // Generate alerts
  const alerts: Alert[] = useMemo(() => {
    const alerts: Alert[] = [];

    if (stats.overdue > 0) {
      alerts.push({
        id: 'overdue',
        title: `${stats.overdue} overdue selections`,
        description: 'These purchasers have missed their selection deadline',
        priority: 'critical',
        count: stats.overdue,
        actionLabel: 'Send Bulk Reminder',
        action: () => setShowBulkReminder(true),
      });
    }

    const almostDue = mockSelections.filter(
      (s) => s.daysUntilDeadline > 0 && s.daysUntilDeadline <= 3 && s.status !== 'complete'
    );
    if (almostDue.length > 0) {
      alerts.push({
        id: 'almost-due',
        title: `${almostDue.length} selections due soon`,
        description: 'Deadline within the next 3 days',
        priority: 'warning',
        count: almostDue.length,
      });
    }

    return alerts;
  }, [stats.overdue]);

  const handleSendReminder = (id: string) => {
    console.log('Send reminder to', id);
    // TODO: Implement reminder sending
  };

  const handleBulkReminder = async () => {
    console.log('Sending bulk reminder');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  };

  // Table columns
  const columns: Column<KitchenSelection>[] = [
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
      id: 'purchaser',
      header: 'Purchaser',
      accessor: 'purchaserName',
      sortable: true,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (value) => {
        const config = statusConfig[value as SelectionStatus];
        return (
          <Badge
            variant={
              value === 'complete'
                ? 'success'
                : value === 'overdue'
                ? 'error'
                : value === 'in-progress'
                ? 'info'
                : 'default'
            }
          >
            {config.label}
          </Badge>
        );
      },
    },
    {
      id: 'progress',
      header: 'Progress',
      accessor: 'progressPercent',
      sortable: true,
      cell: (value, row) => (
        <div className="flex items-center gap-2">
          <ProgressBar
            value={value as number}
            variant={row.status === 'overdue' ? 'error' : (value as number) >= 100 ? 'success' : 'default'}
            size="sm"
            className="w-20"
          />
          <span className="text-xs text-gray-500">{value}%</span>
        </div>
      ),
    },
    {
      id: 'deadline',
      header: 'Deadline',
      accessor: (row) => row.daysUntilDeadline,
      sortable: true,
      cell: (_, row) => (
        <span
          className={cn(
            'text-sm',
            row.daysUntilDeadline < 0
              ? 'text-red-600 font-medium'
              : row.daysUntilDeadline <= 3
              ? 'text-amber-600'
              : 'text-gray-600'
          )}
        >
          {row.daysUntilDeadline < 0
            ? `${Math.abs(row.daysUntilDeadline)} days overdue`
            : row.daysUntilDeadline === 0
            ? 'Today'
            : `${row.daysUntilDeadline} days`}
        </span>
      ),
    },
  ];

  const overdueRecipients = selectionsByStatus.overdue.map((s) => ({
    id: s.id,
    name: s.purchaserName,
    email: s.purchaserEmail,
    unitNumber: s.unitNumber,
  }));

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kitchen Selections</h1>
              <p className="text-sm text-gray-500 mt-1">
                {stats.complete} of {stats.total} selections complete
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                <Settings className="w-4 h-4" />
                Settings
              </button>
              {stats.overdue > 0 && (
                <button
                  onClick={() => setShowBulkReminder(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Send Reminders ({stats.overdue})
                </button>
              )}
            </div>
          </div>

          {/* Progress Overview */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Overall Progress</h3>
                <p className="text-xs text-gray-500">
                  Deadline: {new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })} (5 days)
                </p>
              </div>
              <CircularProgress value={stats.completionRate} size="lg" />
            </div>

            <ProgressBar value={stats.completionRate} size="lg" className="mb-3" />

            <div className="flex items-center gap-6 text-sm">
              <span className="text-green-600">
                <span className="font-medium">{stats.complete}</span> complete
              </span>
              <span className="text-blue-600">
                <span className="font-medium">{stats.inProgress}</span> in progress
              </span>
              <span className="text-gray-500">
                <span className="font-medium">{stats.notStarted}</span> not started
              </span>
              <span className="text-red-600">
                <span className="font-medium">{stats.overdue}</span> overdue
              </span>
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && <ProactiveAlertsWidget alerts={alerts} />}

          {/* Filters */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as SelectionStatus | 'all')}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
            >
              <option value="all">All Status</option>
              <option value="overdue">Overdue</option>
              <option value="in-progress">In Progress</option>
              <option value="not-started">Not Started</option>
              <option value="complete">Complete</option>
            </select>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
              />
            </div>
          </div>

          {/* Overdue Section */}
          {selectionsByStatus.overdue.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <h2 className="text-sm font-semibold text-gray-900">
                    Overdue ({selectionsByStatus.overdue.length})
                  </h2>
                </div>
                <button
                  onClick={() => setShowBulkReminder(true)}
                  className="text-xs font-medium text-gold-600 hover:text-gold-700"
                >
                  Send Bulk Reminder
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {selectionsByStatus.overdue.map((sel) => (
                  <SelectionCard
                    key={sel.id}
                    selection={sel}
                    onSendReminder={handleSendReminder}
                  />
                ))}
              </div>
            </div>
          )}

          {/* In Progress Section */}
          {selectionsByStatus.inProgress.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  In Progress ({selectionsByStatus.inProgress.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {selectionsByStatus.inProgress.map((sel) => (
                  <SelectionCard
                    key={sel.id}
                    selection={sel}
                    onSendReminder={handleSendReminder}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Full Table View */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">All Selections</h2>
            <DataTable
              data={filteredSelections}
              columns={columns}
              selectable
              onSelectionChange={setSelectedIds}
              bulkActions={[
                {
                  label: 'Send Reminder',
                  icon: Mail,
                  onClick: (ids) => console.log('Send reminder to', ids),
                },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Bulk Reminder Modal */}
      <BulkActionModal
        open={showBulkReminder}
        onOpenChange={setShowBulkReminder}
        title="Send Reminder Email"
        description="Send a reminder to purchasers with overdue kitchen selections"
        recipients={overdueRecipients}
        confirmLabel="Send Reminder"
        onConfirm={handleBulkReminder}
        previewContent={
          <div className="space-y-2 text-gray-600">
            <p className="font-medium">Subject: Kitchen Selection Reminder</p>
            <p>
              Dear [Name],
            </p>
            <p>
              This is a friendly reminder that your kitchen selection for Unit [Unit Number] is overdue.
              Please complete your selections at your earliest convenience to avoid any delays.
            </p>
            <p>
              Best regards,<br />
              OpenHouse Team
            </p>
          </div>
        }
      />
    </div>
  );
}
