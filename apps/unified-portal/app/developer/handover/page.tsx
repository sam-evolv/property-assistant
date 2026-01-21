'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Home,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Download,
  Upload,
  Eye,
  Send,
  Search,
  Filter,
  Plus,
  Key,
  Shield,
  Zap,
  Droplets,
  Thermometer,
  Camera,
  MapPin,
  User,
  ChevronRight,
  Package,
  Wrench,
  Phone,
  Mail,
  ExternalLink,
  CheckSquare,
  Square,
  Sparkles,
  QrCode,
} from 'lucide-react';

import { DataTable, Column } from '@/components/ui/DataTable';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar, CircularProgress } from '@/components/ui/ProgressBar';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert } from '@/components/ui/ProactiveAlerts';
import { SlideOver, DetailSlideOver } from '@/components/ui/SlideOver';
import { EmptyState } from '@/components/ui/EmptyState';

// Types
type HandoverStatus = 'pending' | 'scheduled' | 'in-progress' | 'completed' | 'follow-up';
type ChecklistItemStatus = 'pending' | 'completed' | 'na';

interface HandoverUnit {
  id: string;
  unitNumber: string;
  houseType: string;
  purchaserName: string;
  purchaserEmail: string;
  status: HandoverStatus;
  scheduledDate?: Date;
  completedDate?: Date;
  checklistProgress: number;
  documentsUploaded: number;
  totalDocuments: number;
  meterReadings?: {
    electricity: boolean;
    gas: boolean;
    water: boolean;
  };
  keysHandedOver: boolean;
  warrantyRegistered: boolean;
}

interface ChecklistItem {
  id: string;
  category: string;
  item: string;
  status: ChecklistItemStatus;
  notes?: string;
  completedBy?: string;
  completedAt?: Date;
}

interface HandoverDocument {
  id: string;
  name: string;
  category: string;
  uploaded: boolean;
  uploadedAt?: Date;
  required: boolean;
  fileSize?: string;
}

// Mock Data
const mockHandoverUnits: HandoverUnit[] = [
  {
    id: '1', unitNumber: '46', houseType: 'Type A', purchaserName: 'J. O\'Connor', purchaserEmail: 'j.oconnor@email.com',
    status: 'scheduled', scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), checklistProgress: 65,
    documentsUploaded: 8, totalDocuments: 12, meterReadings: { electricity: true, gas: true, water: false },
    keysHandedOver: false, warrantyRegistered: true,
  },
  {
    id: '2', unitNumber: '47', houseType: 'Type A', purchaserName: 'A. Dolan', purchaserEmail: 'a.dolan@email.com',
    status: 'in-progress', scheduledDate: new Date(), checklistProgress: 40,
    documentsUploaded: 5, totalDocuments: 12, meterReadings: { electricity: true, gas: false, water: false },
    keysHandedOver: false, warrantyRegistered: false,
  },
  {
    id: '3', unitNumber: '48', houseType: 'Type B', purchaserName: 'M. Collins', purchaserEmail: 'm.collins@email.com',
    status: 'completed', scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    completedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), checklistProgress: 100,
    documentsUploaded: 12, totalDocuments: 12, meterReadings: { electricity: true, gas: true, water: true },
    keysHandedOver: true, warrantyRegistered: true,
  },
  {
    id: '4', unitNumber: '49', houseType: 'Type B', purchaserName: 'T. Ryan', purchaserEmail: 't.ryan@email.com',
    status: 'pending', checklistProgress: 0,
    documentsUploaded: 2, totalDocuments: 12, meterReadings: { electricity: false, gas: false, water: false },
    keysHandedOver: false, warrantyRegistered: false,
  },
  {
    id: '5', unitNumber: '50', houseType: 'Type C', purchaserName: 'S. Murphy', purchaserEmail: 's.murphy@email.com',
    status: 'follow-up', scheduledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), checklistProgress: 85,
    documentsUploaded: 10, totalDocuments: 12, meterReadings: { electricity: true, gas: true, water: true },
    keysHandedOver: true, warrantyRegistered: false,
  },
  {
    id: '6', unitNumber: '51', houseType: 'Type A', purchaserName: 'T. Brennan', purchaserEmail: 't.brennan@email.com',
    status: 'completed', completedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), checklistProgress: 100,
    documentsUploaded: 12, totalDocuments: 12, meterReadings: { electricity: true, gas: true, water: true },
    keysHandedOver: true, warrantyRegistered: true,
  },
];

const mockChecklist: ChecklistItem[] = [
  { id: '1', category: 'Pre-Handover', item: 'Final inspection completed', status: 'completed', completedBy: 'J. Murphy', completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
  { id: '2', category: 'Pre-Handover', item: 'All snags resolved', status: 'completed', completedBy: 'Site Team', completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
  { id: '3', category: 'Pre-Handover', item: 'Professional clean completed', status: 'completed', completedBy: 'CleanPro Ltd', completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
  { id: '4', category: 'Documentation', item: 'All certificates uploaded', status: 'pending' },
  { id: '5', category: 'Documentation', item: 'Appliance manuals provided', status: 'completed', completedBy: 'System', completedAt: new Date() },
  { id: '6', category: 'Documentation', item: 'Warranty information registered', status: 'pending' },
  { id: '7', category: 'Utilities', item: 'Electricity meter reading taken', status: 'completed', completedBy: 'J. Murphy', completedAt: new Date() },
  { id: '8', category: 'Utilities', item: 'Gas meter reading taken', status: 'completed', completedBy: 'J. Murphy', completedAt: new Date() },
  { id: '9', category: 'Utilities', item: 'Water meter reading taken', status: 'pending' },
  { id: '10', category: 'Handover', item: 'Keys handed to purchaser', status: 'pending' },
  { id: '11', category: 'Handover', item: 'Alarm codes provided', status: 'na' },
  { id: '12', category: 'Handover', item: 'Smart home setup completed', status: 'pending' },
  { id: '13', category: 'Post-Handover', item: 'Follow-up call scheduled', status: 'pending' },
  { id: '14', category: 'Post-Handover', item: 'Feedback survey sent', status: 'pending' },
];

const mockDocuments: HandoverDocument[] = [
  { id: '1', name: 'BCMS Certificate', category: 'Compliance', uploaded: true, uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), required: true, fileSize: '2.4 MB' },
  { id: '2', name: 'HomeBond Registration', category: 'Compliance', uploaded: true, uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), required: true, fileSize: '1.2 MB' },
  { id: '3', name: 'BER Certificate', category: 'Compliance', uploaded: true, uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), required: true, fileSize: '856 KB' },
  { id: '4', name: 'Fire Safety Certificate', category: 'Safety', uploaded: false, required: true },
  { id: '5', name: 'Electrical Certificate', category: 'Safety', uploaded: true, uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), required: true, fileSize: '1.1 MB' },
  { id: '6', name: 'Kitchen Appliance Manuals', category: 'Manuals', uploaded: true, uploadedAt: new Date(), required: true, fileSize: '15.2 MB' },
  { id: '7', name: 'Heating System Manual', category: 'Manuals', uploaded: true, uploadedAt: new Date(), required: true, fileSize: '4.8 MB' },
  { id: '8', name: 'Alarm System Guide', category: 'Manuals', uploaded: false, required: false },
  { id: '9', name: 'Floor Plans', category: 'Property', uploaded: true, uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), required: true, fileSize: '3.2 MB' },
  { id: '10', name: 'Site Map', category: 'Property', uploaded: true, uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), required: false, fileSize: '2.1 MB' },
  { id: '11', name: 'Warranty Documentation', category: 'Warranty', uploaded: false, required: true },
  { id: '12', name: 'Contact Directory', category: 'Support', uploaded: true, uploadedAt: new Date(), required: true, fileSize: '245 KB' },
];

const statusConfig: Record<HandoverStatus, { label: string; color: string; bgColor: string; icon: typeof CheckCircle }> = {
  pending: { label: 'Pending', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Clock },
  scheduled: { label: 'Scheduled', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Calendar },
  'in-progress': { label: 'In Progress', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: Sparkles },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  'follow-up': { label: 'Follow-up', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: AlertCircle },
};

// Handover Card Component
function HandoverCard({
  unit,
  onClick,
}: {
  unit: HandoverUnit;
  onClick: () => void;
}) {
  const status = statusConfig[unit.status];
  const StatusIcon = status.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border p-5 cursor-pointer transition-all',
        'hover:shadow-lg hover:border-gray-300',
        unit.status === 'follow-up' && 'border-purple-200'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-semibold text-gray-900">Unit {unit.unitNumber}</span>
            <Badge
              variant={
                unit.status === 'completed' ? 'success' :
                unit.status === 'in-progress' ? 'warning' :
                unit.status === 'scheduled' ? 'info' :
                unit.status === 'follow-up' ? 'error' : 'default'
              }
              size="sm"
            >
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">{unit.purchaserName}</p>
          <p className="text-xs text-gray-400">{unit.houseType}</p>
        </div>
        <CircularProgress value={unit.checklistProgress} size="md" />
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Checklist Progress</span>
          <span>{unit.checklistProgress}%</span>
        </div>
        <ProgressBar
          value={unit.checklistProgress}
          variant={unit.checklistProgress >= 100 ? 'success' : unit.checklistProgress >= 60 ? 'warning' : 'default'}
          size="sm"
        />
      </div>

      {/* Quick Status Icons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" title="Documents">
            <FileText className={cn('w-4 h-4', unit.documentsUploaded === unit.totalDocuments ? 'text-green-500' : 'text-gray-400')} />
            <span className="text-xs text-gray-500">{unit.documentsUploaded}/{unit.totalDocuments}</span>
          </div>
          <div className="flex items-center gap-1" title="Keys">
            <Key className={cn('w-4 h-4', unit.keysHandedOver ? 'text-green-500' : 'text-gray-400')} />
          </div>
          <div className="flex items-center gap-1" title="Warranty">
            <Shield className={cn('w-4 h-4', unit.warrantyRegistered ? 'text-green-500' : 'text-gray-400')} />
          </div>
        </div>

        {unit.scheduledDate && (
          <span className="text-xs text-gray-500">
            {unit.scheduledDate.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  );
}

// Checklist Section Component
function ChecklistSection({
  items,
  category,
  onToggle,
}: {
  items: ChecklistItem[];
  category: string;
  onToggle: (id: string) => void;
}) {
  const categoryItems = items.filter(i => i.category === category);
  const completed = categoryItems.filter(i => i.status === 'completed').length;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">{category}</h4>
        <span className="text-xs text-gray-500">{completed}/{categoryItems.length}</span>
      </div>
      <div className="space-y-2">
        {categoryItems.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border transition-colors',
              item.status === 'completed' ? 'bg-green-50 border-green-200' :
              item.status === 'na' ? 'bg-gray-50 border-gray-200 opacity-50' :
              'bg-white border-gray-200 hover:border-gray-300'
            )}
          >
            <button
              onClick={() => onToggle(item.id)}
              className="mt-0.5"
              disabled={item.status === 'na'}
            >
              {item.status === 'completed' ? (
                <CheckSquare className="w-5 h-5 text-green-500" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <div className="flex-1">
              <p className={cn('text-sm', item.status === 'completed' ? 'text-gray-600' : 'text-gray-900')}>
                {item.item}
              </p>
              {item.completedBy && (
                <p className="text-xs text-gray-400 mt-1">
                  Completed by {item.completedBy} on {item.completedAt?.toLocaleDateString('en-IE')}
                </p>
              )}
              {item.status === 'na' && (
                <p className="text-xs text-gray-400 mt-1">Not applicable</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Handover Page
export default function DigitalHandoverPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<HandoverStatus | 'all'>('all');
  const [selectedUnit, setSelectedUnit] = useState<HandoverUnit | null>(null);
  const [checklistItems, setChecklistItems] = useState(mockChecklist);
  const [activeDetailTab, setActiveDetailTab] = useState('checklist');

  // Filter units
  const filteredUnits = useMemo(() => {
    return mockHandoverUnits.filter((unit) => {
      const matchesSearch =
        !searchQuery ||
        unit.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.purchaserName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatus === 'all' || unit.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, selectedStatus]);

  // Stats
  const stats = useMemo(() => {
    const total = mockHandoverUnits.length;
    const completed = mockHandoverUnits.filter(u => u.status === 'completed').length;
    const scheduled = mockHandoverUnits.filter(u => u.status === 'scheduled').length;
    const inProgress = mockHandoverUnits.filter(u => u.status === 'in-progress').length;
    const followUp = mockHandoverUnits.filter(u => u.status === 'follow-up').length;
    const pending = mockHandoverUnits.filter(u => u.status === 'pending').length;

    return {
      total,
      completed,
      scheduled,
      inProgress,
      followUp,
      pending,
      completionRate: Math.round((completed / total) * 100),
    };
  }, []);

  // Alerts
  const alerts: Alert[] = useMemo(() => {
    const alerts: Alert[] = [];

    if (stats.followUp > 0) {
      alerts.push({
        id: 'follow-up',
        title: `${stats.followUp} unit(s) require follow-up`,
        description: 'Incomplete handovers needing attention',
        priority: 'warning',
        count: stats.followUp,
      });
    }

    const scheduledToday = mockHandoverUnits.filter(u =>
      u.status === 'scheduled' &&
      u.scheduledDate &&
      u.scheduledDate.toDateString() === new Date().toDateString()
    );

    if (scheduledToday.length > 0) {
      alerts.push({
        id: 'today',
        title: `${scheduledToday.length} handover(s) scheduled today`,
        description: 'Units ready for handover today',
        priority: 'info',
        count: scheduledToday.length,
      });
    }

    return alerts;
  }, [stats.followUp]);

  // Toggle checklist item
  const handleToggleChecklistItem = (id: string) => {
    setChecklistItems(items =>
      items.map(item =>
        item.id === id
          ? {
              ...item,
              status: item.status === 'completed' ? 'pending' : 'completed',
              completedBy: item.status === 'pending' ? 'Current User' : undefined,
              completedAt: item.status === 'pending' ? new Date() : undefined,
            }
          : item
      )
    );
  };

  // Table columns
  const columns: Column<HandoverUnit>[] = [
    {
      id: 'unit',
      header: 'Unit',
      accessor: 'unitNumber',
      sortable: true,
      cell: (_, row) => (
        <div>
          <span className="font-medium text-gray-900">Unit {row.unitNumber}</span>
          <p className="text-xs text-gray-500">{row.houseType}</p>
        </div>
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
        const config = statusConfig[value as HandoverStatus];
        const Icon = config.icon;
        return (
          <Badge
            variant={
              value === 'completed' ? 'success' :
              value === 'in-progress' ? 'warning' :
              value === 'scheduled' ? 'info' :
              value === 'follow-up' ? 'error' : 'default'
            }
            size="sm"
          >
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        );
      },
    },
    {
      id: 'progress',
      header: 'Progress',
      accessor: 'checklistProgress',
      sortable: true,
      cell: (value, row) => (
        <div className="flex items-center gap-2">
          <ProgressBar
            value={value as number}
            variant={(value as number) >= 100 ? 'success' : 'default'}
            size="sm"
            className="w-20"
          />
          <span className="text-xs text-gray-500">{value}%</span>
        </div>
      ),
    },
    {
      id: 'documents',
      header: 'Docs',
      accessor: (row) => row.documentsUploaded,
      sortable: true,
      cell: (_, row) => (
        <span className={cn(
          'text-sm',
          row.documentsUploaded === row.totalDocuments ? 'text-green-600' : 'text-gray-600'
        )}>
          {row.documentsUploaded}/{row.totalDocuments}
        </span>
      ),
    },
    {
      id: 'scheduledDate',
      header: 'Date',
      accessor: (row) => row.scheduledDate || row.completedDate,
      sortable: true,
      cell: (_, row) => {
        const date = row.completedDate || row.scheduledDate;
        return date ? (
          <span className="text-sm text-gray-600">
            {date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
          </span>
        ) : (
          <span className="text-sm text-gray-400">Not set</span>
        );
      },
    },
  ];

  // Get categories for checklist
  const checklistCategories = useMemo(() => {
    return [...new Set(checklistItems.map(i => i.category))];
  }, [checklistItems]);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Digital Handover</h1>
              <p className="text-sm text-gray-500 mt-1">
                {stats.completed} of {stats.total} handovers completed
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <QrCode className="w-4 h-4" />
                Generate QR Codes
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors">
                <Plus className="w-4 h-4" />
                Schedule Handover
              </button>
            </div>
          </div>

          {/* Progress Overview */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Overall Progress</h3>
                <p className="text-xs text-gray-500">
                  {stats.completed} completed, {stats.scheduled + stats.inProgress} in pipeline
                </p>
              </div>
              <CircularProgress value={stats.completionRate} size="lg" />
            </div>

            <ProgressBar value={stats.completionRate} size="lg" className="mb-4" />

            <StatCardGrid columns={5}>
              <StatCard
                label="Completed"
                value={stats.completed}
                icon={CheckCircle}
                iconColor="text-green-500"
                size="sm"
              />
              <StatCard
                label="Scheduled"
                value={stats.scheduled}
                icon={Calendar}
                iconColor="text-blue-500"
                size="sm"
              />
              <StatCard
                label="In Progress"
                value={stats.inProgress}
                icon={Sparkles}
                iconColor="text-amber-500"
                size="sm"
              />
              <StatCard
                label="Follow-up"
                value={stats.followUp}
                icon={AlertCircle}
                iconColor="text-purple-500"
                size="sm"
              />
              <StatCard
                label="Pending"
                value={stats.pending}
                icon={Clock}
                iconColor="text-gray-500"
                size="sm"
              />
            </StatCardGrid>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && <ProactiveAlertsWidget alerts={alerts} />}

          {/* Filters */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as HandoverStatus | 'all')}
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
                placeholder="Search units or purchasers..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
              />
            </div>

            <p className="text-sm text-gray-500 ml-auto">
              {filteredUnits.length} units
            </p>
          </div>

          {/* Handover Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUnits.map((unit) => (
              <HandoverCard
                key={unit.id}
                unit={unit}
                onClick={() => setSelectedUnit(unit)}
              />
            ))}
          </div>

          {filteredUnits.length === 0 && (
            <EmptyState
              variant="search"
              title="No handovers found"
              description="Try adjusting your search or filter criteria"
              actionLabel="Clear filters"
              onAction={() => {
                setSearchQuery('');
                setSelectedStatus('all');
              }}
            />
          )}
        </div>
      </div>

      {/* Detail SlideOver */}
      <SlideOver
        open={!!selectedUnit}
        onClose={() => setSelectedUnit(null)}
        title={selectedUnit ? `Unit ${selectedUnit.unitNumber} Handover` : ''}
        subtitle={selectedUnit?.purchaserName}
        width="xl"
        footer={
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              Export Pack
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedUnit(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors">
                <CheckCircle className="w-4 h-4" />
                Complete Handover
              </button>
            </div>
          </div>
        }
      >
        {selectedUnit && (
          <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <Badge
                variant={
                  selectedUnit.status === 'completed' ? 'success' :
                  selectedUnit.status === 'in-progress' ? 'warning' :
                  selectedUnit.status === 'scheduled' ? 'info' : 'default'
                }
              >
                {statusConfig[selectedUnit.status].label}
              </Badge>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{selectedUnit.checklistProgress}% Complete</p>
                <p className="text-xs text-gray-500">
                  {selectedUnit.scheduledDate?.toLocaleDateString('en-IE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <FileText className={cn('w-5 h-5 mx-auto mb-1', selectedUnit.documentsUploaded === selectedUnit.totalDocuments ? 'text-green-500' : 'text-gray-400')} />
                <p className="text-sm font-semibold text-gray-900">{selectedUnit.documentsUploaded}/{selectedUnit.totalDocuments}</p>
                <p className="text-xs text-gray-500">Documents</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <Key className={cn('w-5 h-5 mx-auto mb-1', selectedUnit.keysHandedOver ? 'text-green-500' : 'text-gray-400')} />
                <p className="text-sm font-semibold text-gray-900">{selectedUnit.keysHandedOver ? 'Yes' : 'No'}</p>
                <p className="text-xs text-gray-500">Keys</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <Shield className={cn('w-5 h-5 mx-auto mb-1', selectedUnit.warrantyRegistered ? 'text-green-500' : 'text-gray-400')} />
                <p className="text-sm font-semibold text-gray-900">{selectedUnit.warrantyRegistered ? 'Yes' : 'No'}</p>
                <p className="text-xs text-gray-500">Warranty</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <Zap className={cn('w-5 h-5 mx-auto mb-1', selectedUnit.meterReadings?.electricity && selectedUnit.meterReadings?.gas && selectedUnit.meterReadings?.water ? 'text-green-500' : 'text-gray-400')} />
                <p className="text-sm font-semibold text-gray-900">
                  {[selectedUnit.meterReadings?.electricity, selectedUnit.meterReadings?.gas, selectedUnit.meterReadings?.water].filter(Boolean).length}/3
                </p>
                <p className="text-xs text-gray-500">Meters</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200">
              {['checklist', 'documents', 'contact'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDetailTab(tab)}
                  className={cn(
                    'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px capitalize',
                    activeDetailTab === tab
                      ? 'text-gold-600 border-gold-500'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeDetailTab === 'checklist' && (
              <div>
                {checklistCategories.map((category) => (
                  <ChecklistSection
                    key={category}
                    items={checklistItems}
                    category={category}
                    onToggle={handleToggleChecklistItem}
                  />
                ))}
              </div>
            )}

            {activeDetailTab === 'documents' && (
              <div className="space-y-3">
                {mockDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      doc.uploaded ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        doc.uploaded ? 'bg-green-100' : 'bg-gray-100'
                      )}>
                        <FileText className={cn('w-4 h-4', doc.uploaded ? 'text-green-600' : 'text-gray-400')} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">
                          {doc.category}
                          {doc.required && <span className="text-red-500 ml-1">*</span>}
                          {doc.fileSize && <span className="ml-2">{doc.fileSize}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.uploaded ? (
                        <>
                          <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gold-600 bg-gold-50 rounded-lg hover:bg-gold-100 transition-colors">
                          <Upload className="w-4 h-4" />
                          Upload
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeDetailTab === 'contact' && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{selectedUnit.purchaserName}</p>
                      <p className="text-xs text-gray-500">{selectedUnit.houseType}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {selectedUnit.purchaserEmail}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      +353 87 123 4567
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      Unit {selectedUnit.unitNumber}, Riverside Manor
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <Mail className="w-4 h-4" />
                    Send Email
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <Phone className="w-4 h-4" />
                    Call
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  );
}
