'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Building2,
  Users,
  FileText,
  Clock,
  AlertCircle,
  ChevronRight,
  Search,
  Filter,
  Download,
  Plus,
  Mail,
  LayoutGrid,
  List,
  GripVertical,
  Calendar,
  CheckCircle,
  Phone,
  MapPin,
  DollarSign,
  User,
  ArrowRight,
  History,
  Edit3,
  Send,
  MessageSquare,
} from 'lucide-react';

import { DataTable, Column } from '@/components/ui/DataTable';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { Badge, StageBadge } from '@/components/ui/Badge';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert } from '@/components/ui/ProactiveAlerts';
import { ActivityFeedWidget } from '@/components/ui/ActivityFeed';
import type { Activity } from '@/components/ui/ActivityFeed';
import { toast } from '@/components/ui/Toast';

// Types
type PipelineStage = 'available' | 'reserved' | 'contracts-out' | 'signed' | 'complete';

interface Unit {
  id: string;
  unitNumber: string;
  houseType: string;
  purchaserName?: string;
  purchaserEmail?: string;
  purchaserPhone?: string;
  stage: PipelineStage;
  daysInStage: number;
  mortgageExpiry?: Date;
  agent?: string;
  reservedDate?: Date;
  price?: number;
  sqft?: number;
  bedrooms?: number;
  address?: string;
  stageHistory?: { stage: PipelineStage; date: Date; note?: string }[];
}

// Mock data with more details
const mockUnits: Unit[] = [
  { id: '1', unitNumber: '1', houseType: 'Type A', purchaserName: 'M. Walsh', purchaserEmail: 'm.walsh@email.com', purchaserPhone: '+353 87 123 4567', stage: 'signed', daysInStage: 45, agent: 'J. Murphy', price: 425000, sqft: 1250, bedrooms: 3, address: '1 Riverside Manor, Dublin 15', stageHistory: [{ stage: 'available', date: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) }, { stage: 'reserved', date: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000) }, { stage: 'contracts-out', date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }, { stage: 'signed', date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) }] },
  { id: '2', unitNumber: '2', houseType: 'Type A', purchaserName: 'P. Burke', purchaserEmail: 'p.burke@email.com', purchaserPhone: '+353 86 234 5678', stage: 'signed', daysInStage: 38, agent: 'J. Murphy', price: 425000, sqft: 1250, bedrooms: 3, address: '2 Riverside Manor, Dublin 15' },
  { id: '3', unitNumber: '33', houseType: 'Type B', purchaserName: 'A. Murphy', purchaserEmail: 'a.murphy@email.com', purchaserPhone: '+353 85 345 6789', stage: 'reserved', daysInStage: 12, agent: 'S. O\'Brien', price: 385000, sqft: 1100, bedrooms: 3, address: '33 Riverside Manor, Dublin 15' },
  { id: '4', unitNumber: '34', houseType: 'Type B', purchaserName: 'S. Walsh', purchaserEmail: 's.walsh@email.com', stage: 'reserved', daysInStage: 8, agent: 'S. O\'Brien', price: 385000, sqft: 1100, bedrooms: 3, address: '34 Riverside Manor, Dublin 15' },
  { id: '5', unitNumber: '46', houseType: 'Type C', purchaserName: 'J. O\'Connor', purchaserEmail: 'j.oconnor@email.com', purchaserPhone: '+353 87 456 7890', stage: 'contracts-out', daysInStage: 4, mortgageExpiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), agent: 'K. Dolan', price: 450000, sqft: 1400, bedrooms: 4, address: '46 Riverside Manor, Dublin 15' },
  { id: '6', unitNumber: '47', houseType: 'Type C', purchaserName: 'A. Dolan', purchaserEmail: 'a.dolan@email.com', stage: 'contracts-out', daysInStage: 15, mortgageExpiry: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), agent: 'K. Dolan', price: 450000, sqft: 1400, bedrooms: 4, address: '47 Riverside Manor, Dublin 15' },
  { id: '7', unitNumber: '67', houseType: 'Type B', stage: 'available', daysInStage: 0, price: 385000, sqft: 1100, bedrooms: 3, address: '67 Riverside Manor, Dublin 15' },
  { id: '8', unitNumber: '68', houseType: 'Type B', stage: 'available', daysInStage: 0, price: 385000, sqft: 1100, bedrooms: 3, address: '68 Riverside Manor, Dublin 15' },
  { id: '9', unitNumber: '51', houseType: 'Type A', purchaserName: 'T. Brennan', purchaserEmail: 't.brennan@email.com', stage: 'complete', daysInStage: 0, price: 425000, sqft: 1250, bedrooms: 3, address: '51 Riverside Manor, Dublin 15' },
];

const stageConfig: Record<PipelineStage, { label: string; color: string; bgColor: string; order: number }> = {
  available: { label: 'Available', color: 'text-gray-600', bgColor: 'bg-gray-100', order: 0 },
  reserved: { label: 'Reserved', color: 'text-blue-600', bgColor: 'bg-blue-50', order: 1 },
  'contracts-out': { label: 'Contracts Out', color: 'text-amber-600', bgColor: 'bg-amber-50', order: 2 },
  signed: { label: 'Signed', color: 'text-green-600', bgColor: 'bg-green-50', order: 3 },
  complete: { label: 'Complete', color: 'text-emerald-600', bgColor: 'bg-emerald-50', order: 4 },
};

const stages: PipelineStage[] = ['available', 'reserved', 'contracts-out', 'signed', 'complete'];

// Draggable Kanban Card Component
function KanbanCard({
  unit,
  onClick,
  onDragStart,
  isDragging,
}: {
  unit: Unit;
  onClick?: () => void;
  onDragStart: (e: React.DragEvent, unit: Unit) => void;
  isDragging?: boolean;
}) {
  const isMortgageExpiring = unit.mortgageExpiry && unit.mortgageExpiry < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const isMortgageOverdue = unit.mortgageExpiry && unit.mortgageExpiry < new Date();

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, unit)}
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border p-3 cursor-grab transition-all',
        'hover:shadow-md hover:border-gray-300',
        'active:cursor-grabbing active:shadow-lg',
        isDragging && 'opacity-50 scale-95',
        isMortgageOverdue && 'border-red-300 bg-red-50',
        isMortgageExpiring && !isMortgageOverdue && 'border-amber-300 bg-amber-50'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">Unit {unit.unitNumber}</p>
          <p className="text-xs text-gray-500">{unit.houseType}</p>
        </div>
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </div>

      {unit.purchaserName && (
        <p className="text-sm text-gray-700 mb-2">{unit.purchaserName}</p>
      )}

      {unit.price && (
        <p className="text-xs font-medium text-gray-600 mb-2">
          EUR {unit.price.toLocaleString()}
        </p>
      )}

      <div className="flex items-center justify-between">
        {unit.daysInStage > 0 ? (
          <span className={cn(
            'text-xs',
            unit.daysInStage > 30 ? 'text-amber-600 font-medium' : 'text-gray-500'
          )}>
            {unit.daysInStage} days
          </span>
        ) : (
          <span className="text-xs text-gray-400">New</span>
        )}

        {isMortgageOverdue && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
            <AlertCircle className="w-3 h-3" />
            Overdue
          </span>
        )}
        {isMortgageExpiring && !isMortgageOverdue && (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <Clock className="w-3 h-3" />
            Expiring
          </span>
        )}
        {unit.stage === 'signed' && !isMortgageExpiring && (
          <CheckCircle className="w-4 h-4 text-green-500" />
        )}
      </div>
    </div>
  );
}

// Kanban Column Component with Drop Zone
function KanbanColumn({
  stage,
  units,
  onCardClick,
  onDragStart,
  onDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
  draggingUnit,
}: {
  stage: PipelineStage;
  units: Unit[];
  onCardClick?: (unit: Unit) => void;
  onDragStart: (e: React.DragEvent, unit: Unit) => void;
  onDrop: (e: React.DragEvent, stage: PipelineStage) => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  draggingUnit: Unit | null;
}) {
  const config = stageConfig[stage];

  return (
    <div className="flex-1 min-w-[220px] max-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className={cn('text-xs font-semibold uppercase tracking-wide', config.color)}>
            {config.label}
          </h3>
          <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', config.bgColor, config.color)}>
            {units.length}
          </span>
        </div>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, stage)}
        className={cn(
          'rounded-lg p-2 min-h-[400px] transition-all duration-200',
          config.bgColor,
          isDragOver && 'ring-2 ring-gold-500 ring-offset-2 bg-gold-50/50'
        )}
      >
        <div className="space-y-2">
          {units.map((unit) => (
            <KanbanCard
              key={unit.id}
              unit={unit}
              onClick={() => onCardClick?.(unit)}
              onDragStart={onDragStart}
              isDragging={draggingUnit?.id === unit.id}
            />
          ))}
          {units.length === 0 && (
            <div className={cn(
              'text-center py-8 text-sm rounded-lg border-2 border-dashed',
              isDragOver ? 'border-gold-400 text-gold-600' : 'border-gray-300 text-gray-400'
            )}>
              {isDragOver ? 'Drop here' : 'No units'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Unit Detail Slide-Over Content
function UnitDetailPanel({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'activity'>('details');

  const stageProgress = useMemo(() => {
    const currentOrder = stageConfig[unit.stage].order;
    return ((currentOrder + 1) / stages.length) * 100;
  }, [unit.stage]);

  const mockActivity: Activity[] = [
    { id: '1', type: 'stage', title: 'Stage changed to ' + stageConfig[unit.stage].label, description: 'By J. Murphy', timestamp: new Date(Date.now() - unit.daysInStage * 24 * 60 * 60 * 1000) },
    { id: '2', type: 'email', title: 'Email sent to purchaser', description: 'Welcome email', timestamp: new Date(Date.now() - (unit.daysInStage + 2) * 24 * 60 * 60 * 1000) },
    { id: '3', type: 'note', title: 'Note added', description: 'First-time buyer, requires additional support', timestamp: new Date(Date.now() - (unit.daysInStage + 5) * 24 * 60 * 60 * 1000) },
  ];

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-lg font-semibold text-gray-900">EUR {unit.price?.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Price</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-lg font-semibold text-gray-900">{unit.sqft}</p>
          <p className="text-xs text-gray-500">Sq Ft</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-lg font-semibold text-gray-900">{unit.bedrooms}</p>
          <p className="text-xs text-gray-500">Bedrooms</p>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">Pipeline Progress</span>
          <Badge variant={unit.stage === 'complete' ? 'success' : unit.stage === 'signed' ? 'success' : 'info'}>
            {stageConfig[unit.stage].label}
          </Badge>
        </div>
        <ProgressBar value={stageProgress} variant="default" size="md" showLabel />
        <div className="flex justify-between mt-2 text-[10px] text-gray-500">
          {stages.map((s) => (
            <span
              key={s}
              className={cn(
                stageConfig[s].order <= stageConfig[unit.stage].order
                  ? 'text-gold-600 font-medium'
                  : ''
              )}
            >
              {stageConfig[s].label}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['details', 'history', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px capitalize',
              activeTab === tab
                ? 'text-gold-600 border-gold-500'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          {/* Purchaser Info */}
          {unit.purchaserName && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Purchaser
              </h4>
              <div className="space-y-2">
                <p className="text-sm text-gray-900 font-medium">{unit.purchaserName}</p>
                {unit.purchaserEmail && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {unit.purchaserEmail}
                  </div>
                )}
                {unit.purchaserPhone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {unit.purchaserPhone}
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors">
                  <Mail className="w-4 h-4" />
                  Email
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  <Phone className="w-4 h-4" />
                  Call
                </button>
              </div>
            </div>
          )}

          {/* Property Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Property Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">House Type</p>
                <p className="font-medium text-gray-900">{unit.houseType}</p>
              </div>
              <div>
                <p className="text-gray-500">Days in Stage</p>
                <p className="font-medium text-gray-900">{unit.daysInStage} days</p>
              </div>
              <div>
                <p className="text-gray-500">Agent</p>
                <p className="font-medium text-gray-900">{unit.agent || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-gray-500">Address</p>
                <p className="font-medium text-gray-900">{unit.address}</p>
              </div>
            </div>
          </div>

          {/* Mortgage Warning */}
          {unit.mortgageExpiry && (
            <div className={cn(
              'p-4 rounded-lg border',
              unit.mortgageExpiry < new Date() ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            )}>
              <div className="flex items-start gap-3">
                <AlertCircle className={cn(
                  'w-5 h-5',
                  unit.mortgageExpiry < new Date() ? 'text-red-500' : 'text-amber-500'
                )} />
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    unit.mortgageExpiry < new Date() ? 'text-red-700' : 'text-amber-700'
                  )}>
                    {unit.mortgageExpiry < new Date() ? 'Mortgage Approval Expired' : 'Mortgage Expiring Soon'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Expires: {unit.mortgageExpiry.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {unit.stageHistory?.map((entry, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className={cn('p-2 rounded-lg', stageConfig[entry.stage].bgColor)}>
                <ArrowRight className={cn('w-4 h-4', stageConfig[entry.stage].color)} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Moved to {stageConfig[entry.stage].label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {entry.date.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                {entry.note && (
                  <p className="text-xs text-gray-600 mt-1">{entry.note}</p>
                )}
              </div>
            </div>
          )) || (
            <p className="text-sm text-gray-500 text-center py-4">No history available</p>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <ActivityFeedWidget activities={mockActivity} maxItems={10} />
      )}
    </div>
  );
}

// Main Pipeline Page
export default function PipelinePage() {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<PipelineStage | 'all'>('all');
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [units, setUnits] = useState(mockUnits);

  // Drag state
  const [draggingUnit, setDraggingUnit] = useState<Unit | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);

  // Filter units
  const filteredUnits = useMemo(() => {
    return units.filter((unit) => {
      const matchesSearch =
        !searchQuery ||
        unit.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.purchaserName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.houseType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStage = selectedStage === 'all' || unit.stage === selectedStage;

      return matchesSearch && matchesStage;
    });
  }, [units, searchQuery, selectedStage]);

  // Group units by stage for Kanban
  const unitsByStage = useMemo(() => {
    return stages.reduce((acc, stage) => {
      acc[stage] = filteredUnits.filter((u) => u.stage === stage);
      return acc;
    }, {} as Record<PipelineStage, Unit[]>);
  }, [filteredUnits]);

  // Stats
  const stats = useMemo(() => ({
    total: units.length,
    available: units.filter((u) => u.stage === 'available').length,
    reserved: units.filter((u) => u.stage === 'reserved').length,
    contractsOut: units.filter((u) => u.stage === 'contracts-out').length,
    signed: units.filter((u) => u.stage === 'signed').length,
    complete: units.filter((u) => u.stage === 'complete').length,
    atRisk: units.filter((u) => u.mortgageExpiry && u.mortgageExpiry < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length,
  }), [units]);

  // Alerts
  const alerts: Alert[] = useMemo(() => {
    const alerts: Alert[] = [];

    const overdueUnits = units.filter(u => u.mortgageExpiry && u.mortgageExpiry < new Date());
    if (overdueUnits.length > 0) {
      alerts.push({
        id: 'mortgage-overdue',
        title: `${overdueUnits.length} mortgage approval(s) expired`,
        description: 'These units require immediate attention',
        priority: 'critical',
        count: overdueUnits.length,
      });
    }

    const expiringUnits = units.filter(u =>
      u.mortgageExpiry &&
      u.mortgageExpiry >= new Date() &&
      u.mortgageExpiry < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );
    if (expiringUnits.length > 0) {
      alerts.push({
        id: 'mortgage-expiring',
        title: `${expiringUnits.length} mortgage approval(s) expiring soon`,
        description: 'Within the next 7 days',
        priority: 'warning',
        count: expiringUnits.length,
      });
    }

    const staleUnits = units.filter(u => u.daysInStage > 30 && u.stage !== 'complete');
    if (staleUnits.length > 0) {
      alerts.push({
        id: 'stale-units',
        title: `${staleUnits.length} unit(s) stale in pipeline`,
        description: 'Over 30 days in current stage',
        priority: 'info',
        count: staleUnits.length,
      });
    }

    return alerts;
  }, [units]);

  // Drag and Drop Handlers
  const handleDragStart = useCallback((e: React.DragEvent, unit: Unit) => {
    setDraggingUnit(unit);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', unit.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, newStage: PipelineStage) => {
    e.preventDefault();

    if (draggingUnit && draggingUnit.stage !== newStage) {
      setUnits(prev => prev.map(u =>
        u.id === draggingUnit.id
          ? { ...u, stage: newStage, daysInStage: 0 }
          : u
      ));

      toast.success(`Unit ${draggingUnit.unitNumber} moved to ${stageConfig[newStage].label}`);
    }

    setDraggingUnit(null);
    setDragOverStage(null);
  }, [draggingUnit]);

  // Table columns
  const columns: Column<Unit>[] = [
    {
      id: 'unitNumber',
      header: 'Unit',
      accessor: 'unitNumber',
      sortable: true,
      cell: (_, row) => (
        <span className="font-medium text-gray-900">Unit {row.unitNumber}</span>
      ),
    },
    {
      id: 'houseType',
      header: 'Type',
      accessor: 'houseType',
      sortable: true,
    },
    {
      id: 'purchaser',
      header: 'Purchaser',
      accessor: 'purchaserName',
      sortable: true,
      cell: (value) => value || <span className="text-gray-400">-</span>,
    },
    {
      id: 'price',
      header: 'Price',
      accessor: 'price',
      sortable: true,
      align: 'right',
      cell: (value) => value ? `EUR ${(value as number).toLocaleString()}` : '-',
    },
    {
      id: 'stage',
      header: 'Stage',
      accessor: 'stage',
      sortable: true,
      cell: (value) => <StageBadge stage={value as PipelineStage} />,
    },
    {
      id: 'daysInStage',
      header: 'Days',
      accessor: 'daysInStage',
      sortable: true,
      align: 'right',
      cell: (value, row) => (
        <span className={cn(
          (value as number) > 30 && row.stage !== 'complete' ? 'text-amber-600 font-medium' : ''
        )}>
          {value}
        </span>
      ),
    },
    {
      id: 'agent',
      header: 'Agent',
      accessor: 'agent',
      cell: (value) => value || <span className="text-gray-400">-</span>,
    },
  ];

  const handleExport = async (format: string) => {
    console.log('Exporting as', format);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success(`Exported pipeline data as ${format.toUpperCase()}`);
  };

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
              <p className="text-sm text-gray-500 mt-1">
                Track every unit from reservation to completion
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ExportMenu onExport={handleExport} />
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors">
                <Plus className="w-4 h-4" />
                Add Unit
              </button>
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && <ProactiveAlertsWidget alerts={alerts} />}

          {/* Stats */}
          <StatCardGrid columns={5}>
            <StatCard
              label="Total Units"
              value={stats.total}
              icon={Building2}
              iconColor="text-gold-500"
            />
            <StatCard
              label="Available"
              value={stats.available}
              icon={Building2}
              iconColor="text-gray-500"
            />
            <StatCard
              label="Reserved"
              value={stats.reserved}
              icon={Users}
              iconColor="text-blue-500"
            />
            <StatCard
              label="Contracts Out"
              value={stats.contractsOut}
              icon={FileText}
              iconColor="text-amber-500"
            />
            <StatCard
              label="Signed"
              value={stats.signed}
              icon={CheckCircle}
              iconColor="text-green-500"
            />
          </StatCardGrid>

          {/* Filters & View Toggle */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    viewMode === 'kanban'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Kanban
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    viewMode === 'table'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <List className="w-4 h-4" />
                  Table
                </button>
              </div>

              {/* Stage Filter */}
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value as PipelineStage | 'all')}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
              >
                <option value="all">All Stages</option>
                {stages.map((stage) => (
                  <option key={stage} value={stage}>{stageConfig[stage].label}</option>
                ))}
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search units..."
                  className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
                />
              </div>
            </div>

            <p className="text-sm text-gray-500">
              {filteredUnits.length} of {units.length} units
            </p>
          </div>

          {/* Content */}
          {viewMode === 'kanban' ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {stages.map((stage) => (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  units={unitsByStage[stage]}
                  onCardClick={setSelectedUnit}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  isDragOver={dragOverStage === stage}
                  onDragOver={(e) => handleDragOver(e, stage)}
                  onDragLeave={handleDragLeave}
                  draggingUnit={draggingUnit}
                />
              ))}
            </div>
          ) : (
            <DataTable
              data={filteredUnits}
              columns={columns}
              selectable
              onSelectionChange={setSelectedUnits}
              onRowClick={setSelectedUnit}
              emptyMessage="No units match your filters"
              bulkActions={[
                {
                  label: 'Send Email',
                  icon: Mail,
                  onClick: (ids) => console.log('Send email to', ids),
                },
                {
                  label: 'Update Stage',
                  icon: ChevronRight,
                  onClick: (ids) => console.log('Update stage for', ids),
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Unit Detail Slide-Over */}
      <SlideOver
        open={!!selectedUnit}
        onClose={() => setSelectedUnit(null)}
        title={selectedUnit ? `Unit ${selectedUnit.unitNumber}` : ''}
        subtitle={selectedUnit?.houseType}
        width="lg"
        footer={
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedUnit(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors">
                <ArrowRight className="w-4 h-4" />
                Move to Next Stage
              </button>
            </div>
          </div>
        }
      >
        {selectedUnit && (
          <UnitDetailPanel unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
        )}
      </SlideOver>
    </div>
  );
}
