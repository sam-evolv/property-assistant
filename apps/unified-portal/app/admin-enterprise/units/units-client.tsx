'use client';

import { useEffect, useState } from 'react';
import { Home, AlertTriangle, CheckCircle, XCircle, FileText, User, MapPin, Phone, Mail, Download } from 'lucide-react';
import { InsightCard } from '@/components/admin-enterprise/InsightCard';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import { TableSkeleton } from '@/components/admin-enterprise/LoadingSkeleton';
import { DataTable, Column } from '@/components/admin-enterprise/DataTable';

interface Unit {
  id: string;
  unit_number: string;
  unit_uid: string;
  address: string;
  house_type_code: string;
  property_type: string | null;
  bedrooms: number | null;
  development_name: string;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  homeowner: { name: string; email: string; onboarded: boolean } | null;
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

  const exportToCSV = () => {
    const headers = ['Unit Number', 'Address', 'Type', 'Bedrooms', 'Development', 'Purchaser Name', 'Purchaser Email', 'Purchaser Phone', 'Onboarded'];
    const rows = units.map(u => [
      u.unit_number,
      u.address,
      u.house_type_code,
      u.bedrooms || '',
      u.development_name,
      u.purchaser_name || '',
      u.purchaser_email || '',
      u.purchaser_phone || '',
      u.homeowner?.onboarded ? 'Yes' : 'No'
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `units_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

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
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {item.address}
          </p>
        </div>
      ),
    },
    {
      key: 'house_type_code',
      label: 'Type',
      sortable: true,
      render: (item) => (
        <div>
          <span className="px-2 py-1 bg-gold-100 text-gold-700 rounded text-xs font-medium">
            {item.house_type_code}
          </span>
          {item.bedrooms && (
            <p className="text-xs text-gray-500 mt-1">{item.bedrooms} bed</p>
          )}
        </div>
      ),
    },
    {
      key: 'development_name',
      label: 'Development',
      sortable: true,
      render: (item) => <span className="text-gray-700 font-medium">{item.development_name}</span>,
    },
    {
      key: 'homeowner',
      label: 'Homeowner',
      sortable: false,
      render: (item) =>
        item.homeowner ? (
          <div className="flex items-start gap-2">
            <div className={`p-1 rounded-full ${item.homeowner.onboarded ? 'bg-green-100' : 'bg-amber-100'}`}>
              <User className={`w-4 h-4 ${item.homeowner.onboarded ? 'text-green-600' : 'text-amber-600'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{item.homeowner.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {item.homeowner.email}
              </p>
              {item.purchaser_phone && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {item.purchaser_phone}
                </p>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${
                item.homeowner.onboarded 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {item.homeowner.onboarded ? 'Onboarded' : 'Pending'}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-gray-400 text-sm italic">No purchaser assigned</span>
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

      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-3">
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
        
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
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
