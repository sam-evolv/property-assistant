'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Building2,
  Users,
  FileText,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
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
  XCircle,
} from 'lucide-react';

import { DataTable, Column } from '@/components/ui/DataTable';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { Badge, StageBadge } from '@/components/ui/Badge';
import { QuickActionsBar } from '@/components/ui/QuickActions';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { EmptyState } from '@/components/ui/EmptyState';

// Types
type PipelineStage = 'available' | 'reserved' | 'contracts-out' | 'signed' | 'complete';

interface Unit {
  id: string;
  unitNumber: string;
  houseType: string;
  purchaserName?: string;
  purchaserEmail?: string;
  stage: PipelineStage;
  daysInStage: number;
  mortgageExpiry?: Date;
  agent?: string;
  reservedDate?: Date;
  price?: number;
}

// Mock data
const mockUnits: Unit[] = [
  { id: '1', unitNumber: '1', houseType: 'Type A', purchaserName: 'M. Walsh', stage: 'signed', daysInStage: 45, agent: 'J. Murphy', price: 425000 },
  { id: '2', unitNumber: '2', houseType: 'Type A', purchaserName: 'P. Burke', stage: 'signed', daysInStage: 38, agent: 'J. Murphy', price: 425000 },
  { id: '3', unitNumber: '33', houseType: 'Type B', purchaserName: 'A. Murphy', stage: 'reserved', daysInStage: 12, agent: 'S. O\'Brien', price: 385000 },
  { id: '4', unitNumber: '34', houseType: 'Type B', purchaserName: 'S. Walsh', stage: 'reserved', daysInStage: 8, agent: 'S. O\'Brien', price: 385000 },
  { id: '5', unitNumber: '46', houseType: 'Type C', purchaserName: 'J. O\'Connor', stage: 'contracts-out', daysInStage: 4, mortgageExpiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), agent: 'K. Dolan', price: 450000 },
  { id: '6', unitNumber: '47', houseType: 'Type C', purchaserName: 'A. Dolan', stage: 'contracts-out', daysInStage: 15, mortgageExpiry: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), agent: 'K. Dolan', price: 450000 },
  { id: '7', unitNumber: '67', houseType: 'Type B', stage: 'available', daysInStage: 0, price: 385000 },
  { id: '8', unitNumber: '68', houseType: 'Type B', stage: 'available', daysInStage: 0, price: 385000 },
  { id: '9', unitNumber: '51', houseType: 'Type A', purchaserName: 'T. Brennan', stage: 'complete', daysInStage: 0, price: 425000 },
];

const stageConfig: Record<PipelineStage, { label: string; color: string; bgColor: string }> = {
  available: { label: 'Available', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  reserved: { label: 'Reserved', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'contracts-out': { label: 'Contracts Out', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  signed: { label: 'Signed', color: 'text-green-600', bgColor: 'bg-green-50' },
  complete: { label: 'Complete', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
};

// Kanban Card Component
function KanbanCard({ unit, onClick }: { unit: Unit; onClick?: () => void }) {
  const isMortgageExpiring = unit.mortgageExpiry && unit.mortgageExpiry < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const isMortgageOverdue = unit.mortgageExpiry && unit.mortgageExpiry < new Date();

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border p-3 cursor-pointer transition-all',
        'hover:shadow-md hover:border-gray-300',
        isMortgageOverdue && 'border-red-300 bg-red-50',
        isMortgageExpiring && !isMortgageOverdue && 'border-amber-300 bg-amber-50'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">Unit {unit.unitNumber}</p>
          <p className="text-xs text-gray-500">{unit.houseType}</p>
        </div>
        <GripVertical className="w-4 h-4 text-gray-300" />
      </div>

      {unit.purchaserName && (
        <p className="text-sm text-gray-700 mb-2">{unit.purchaserName}</p>
      )}

      <div className="flex items-center justify-between">
        {unit.daysInStage > 0 ? (
          <span className="text-xs text-gray-500">{unit.daysInStage} days</span>
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
        {unit.stage === 'signed' && (
          <CheckCircle className="w-4 h-4 text-green-500" />
        )}
      </div>
    </div>
  );
}

// Kanban Column Component
function KanbanColumn({
  stage,
  units,
  onCardClick,
}: {
  stage: PipelineStage;
  units: Unit[];
  onCardClick?: (unit: Unit) => void;
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

      <div className={cn('rounded-lg p-2 min-h-[400px]', config.bgColor)}>
        <div className="space-y-2">
          {units.map((unit) => (
            <KanbanCard
              key={unit.id}
              unit={unit}
              onClick={() => onCardClick?.(unit)}
            />
          ))}
          {units.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              No units
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Pipeline Page
export default function PipelinePage() {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<PipelineStage | 'all'>('all');
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // Filter units
  const filteredUnits = useMemo(() => {
    return mockUnits.filter((unit) => {
      const matchesSearch =
        !searchQuery ||
        unit.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.purchaserName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.houseType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStage = selectedStage === 'all' || unit.stage === selectedStage;

      return matchesSearch && matchesStage;
    });
  }, [searchQuery, selectedStage]);

  // Group units by stage for Kanban
  const unitsByStage = useMemo(() => {
    const stages: PipelineStage[] = ['available', 'reserved', 'contracts-out', 'signed', 'complete'];
    return stages.reduce((acc, stage) => {
      acc[stage] = filteredUnits.filter((u) => u.stage === stage);
      return acc;
    }, {} as Record<PipelineStage, Unit[]>);
  }, [filteredUnits]);

  // Stats
  const stats = useMemo(() => ({
    total: mockUnits.length,
    available: mockUnits.filter((u) => u.stage === 'available').length,
    reserved: mockUnits.filter((u) => u.stage === 'reserved').length,
    contractsOut: mockUnits.filter((u) => u.stage === 'contracts-out').length,
    signed: mockUnits.filter((u) => u.stage === 'signed').length,
    closingThisMonth: mockUnits.filter((u) => u.stage === 'contracts-out' || u.stage === 'signed').length,
  }), []);

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
  };

  const handleUnitClick = (unit: Unit) => {
    console.log('Unit clicked:', unit);
    // TODO: Open unit detail slide-over
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
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="contracts-out">Contracts Out</option>
                <option value="signed">Signed</option>
                <option value="complete">Complete</option>
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
              {filteredUnits.length} of {mockUnits.length} units
            </p>
          </div>

          {/* Content */}
          {viewMode === 'kanban' ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {(['available', 'reserved', 'contracts-out', 'signed', 'complete'] as PipelineStage[]).map(
                (stage) => (
                  <KanbanColumn
                    key={stage}
                    stage={stage}
                    units={unitsByStage[stage]}
                    onCardClick={handleUnitClick}
                  />
                )
              )}
            </div>
          ) : (
            <DataTable
              data={filteredUnits}
              columns={columns}
              selectable
              onSelectionChange={setSelectedUnits}
              onRowClick={handleUnitClick}
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
    </div>
  );
}
