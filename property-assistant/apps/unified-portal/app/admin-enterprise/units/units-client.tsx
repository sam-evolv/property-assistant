'use client';

import { useEffect, useState } from 'react';
import { Home, AlertTriangle, CheckCircle, XCircle, FileText, User } from 'lucide-react';
import { InsightCard } from '@/components/admin-enterprise/InsightCard';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import { TableSkeleton } from '@/components/admin-enterprise/LoadingSkeleton';
import { DataTable, Column } from '@/components/admin-enterprise/DataTable';

interface Unit {
  id: string;
  unit_number: string;
  unit_uid: string;
  address_line_1: string;
  house_type_code: string;
  development_name: string;
  purchaser_name: string | null;
  purchaser_email: string | null;
  homeowner: { name: string; email: string } | null;
  has_floor_plan: boolean;
  has_elevations: boolean;
  missing_docs: boolean;
}

export function UnitsExplorer() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'missing_docs' | 'has_homeowner'>('all');

  useEffect(() => {
    fetch('/api/admin/units')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch units');
        return res.json();
      })
      .then((data) => setUnits(data.units || []))
      .catch((err) => {
        console.error('Units error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <SectionHeader title="Unit Explorer" description="Loading..." />
        <TableSkeleton rows={10} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load units</p>
          <p className="text-red-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const filteredUnits = units.filter((u) => {
    if (filter === 'missing_docs') return u.missing_docs;
    if (filter === 'has_homeowner') return u.homeowner !== null;
    return true;
  });

  const missingDocsCount = units.filter((u) => u.missing_docs).length;
  const withHomeownerCount = units.filter((u) => u.homeowner !== null).length;
  const completeDocsCount = units.filter((u) => u.has_floor_plan && u.has_elevations).length;

  const columns: Column<Unit>[] = [
    {
      key: 'unit_number',
      label: 'Unit',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-semibold text-gray-900">{item.unit_number}</p>
          <p className="text-xs text-gray-500">{item.address_line_1}</p>
        </div>
      ),
    },
    {
      key: 'house_type_code',
      label: 'Type',
      sortable: true,
      render: (item) => (
        <span className="px-2 py-1 bg-gold-100 text-gold-700 rounded text-xs font-medium">
          {item.house_type_code}
        </span>
      ),
    },
    {
      key: 'development_name',
      label: 'Development',
      sortable: true,
      render: (item) => <span className="text-gray-700">{item.development_name}</span>,
    },
    {
      key: 'homeowner',
      label: 'Homeowner',
      sortable: false,
      render: (item) =>
        item.homeowner ? (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">{item.homeowner.name}</p>
              <p className="text-xs text-gray-500">{item.homeowner.email}</p>
            </div>
          </div>
        ) : item.purchaser_name ? (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-orange-500" />
            <div>
              <p className="text-sm font-medium text-orange-700">{item.purchaser_name}</p>
              <p className="text-xs text-orange-500">Pending</p>
            </div>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">Unassigned</span>
        ),
    },
    {
      key: 'has_floor_plan',
      label: 'Status',
      sortable: false,
      render: (item) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {item.has_floor_plan ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-gray-600">Floor Plan</span>
          </div>
          <div className="flex items-center gap-2">
            {item.has_elevations ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-gray-600">Elevations</span>
          </div>
        </div>
      ),
    },
    {
      key: 'missing_docs',
      label: 'Completeness',
      sortable: true,
      render: (item) =>
        item.missing_docs ? (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3" />
            Missing Docs
          </span>
        ) : (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Complete
          </span>
        ),
    },
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <SectionHeader
        title="Unit Explorer"
        description={`Manage ${units.length} units across all developments`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <InsightCard
          title="Total Units"
          value={units.length}
          subtitle="All properties"
          icon={<Home className="w-5 h-5" />}
        />
        <InsightCard
          title="With Homeowner"
          value={withHomeownerCount}
          subtitle={`${Math.round((withHomeownerCount / units.length) * 100) || 0}% occupied`}
          icon={<User className="w-5 h-5" />}
        />
        <InsightCard
          title="Complete Docs"
          value={completeDocsCount}
          subtitle={`${Math.round((completeDocsCount / units.length) * 100) || 0}% ready`}
          icon={<FileText className="w-5 h-5" />}
        />
        <InsightCard
          title="Missing Docs"
          value={missingDocsCount}
          subtitle="Needs attention"
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg transition-all duration-premium font-medium shadow-sm ${
            filter === 'all'
              ? 'bg-gold-500 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gold-50 hover:border-gold-200'
          }`}
        >
          All Units ({units.length})
        </button>
        <button
          onClick={() => setFilter('has_homeowner')}
          className={`px-4 py-2 rounded-lg transition-all duration-premium font-medium flex items-center gap-2 shadow-sm ${
            filter === 'has_homeowner'
              ? 'bg-gold-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gold-50 hover:border-gold-200'
          }`}
        >
          <User className="w-4 h-4" />
          With Homeowner ({withHomeownerCount})
        </button>
        <button
          onClick={() => setFilter('missing_docs')}
          className={`px-4 py-2 rounded-lg transition-all duration-premium font-medium flex items-center gap-2 shadow-sm ${
            filter === 'missing_docs'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gold-50 hover:border-gold-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Missing Docs ({missingDocsCount})
        </button>
      </div>

      <DataTable
        data={filteredUnits}
        columns={columns}
        searchable={true}
        searchPlaceholder="Search by unit number, address, development..."
        emptyMessage="No units found matching your filter"
      />
    </div>
  );
}
