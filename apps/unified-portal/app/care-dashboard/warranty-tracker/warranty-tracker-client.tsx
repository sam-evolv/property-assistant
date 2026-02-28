'use client';

import { useState } from 'react';
import {
  Shield,
  AlertTriangle,
  Bell,
  Search,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WarrantyItem {
  id: number;
  customer: string;
  address: string;
  product: string;
  warrantyStart: string;
  warrantyExpiry: string;
  daysRemaining: number;
  status: 'Active' | 'Expiring Soon' | 'Expired';
  category: 'Solar Panels' | 'Inverters' | 'Workmanship' | 'Batteries';
}

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

const tabs = ['Solar Panels', 'Inverters', 'Workmanship', 'Batteries'] as const;

const warrantyItems: WarrantyItem[] = [
  {
    id: 1,
    customer: "P\u00e1draig O'Sullivan",
    address: '14 Meadow Lane, Ballincollig, Cork',
    product: 'JA Solar 410W (x12)',
    warrantyStart: '2023-03-15',
    warrantyExpiry: '2048-03-15',
    daysRemaining: 8_050,
    status: 'Active',
    category: 'Solar Panels',
  },
  {
    id: 2,
    customer: 'Mary Murphy',
    address: '7 Oak Drive, Carrigaline, Cork',
    product: 'Trina Vertex S 405W (x10)',
    warrantyStart: '2023-06-20',
    warrantyExpiry: '2048-06-20',
    daysRemaining: 8_147,
    status: 'Active',
    category: 'Solar Panels',
  },
  {
    id: 3,
    customer: 'Colm Fitzgerald',
    address: '22 Castle View, Midleton, Cork',
    product: 'SolarEdge SE5000H',
    warrantyStart: '2023-04-10',
    warrantyExpiry: '2035-04-10',
    daysRemaining: 3_328,
    status: 'Active',
    category: 'Inverters',
  },
  {
    id: 4,
    customer: "Siobh\u00e1n O'Brien",
    address: '3 River Walk, Fermoy, Cork',
    product: 'Fronius Primo GEN24 5.0',
    warrantyStart: '2022-11-05',
    warrantyExpiry: '2026-05-05',
    daysRemaining: 66,
    status: 'Expiring Soon',
    category: 'Inverters',
  },
  {
    id: 5,
    customer: 'Brendan Daly',
    address: '9 Hilltop Crescent, Cobh, Cork',
    product: 'SolarEdge SE3680H',
    warrantyStart: '2023-01-18',
    warrantyExpiry: '2026-04-18',
    daysRemaining: 49,
    status: 'Expiring Soon',
    category: 'Inverters',
  },
  {
    id: 6,
    customer: 'Aoife McCarthy',
    address: '31 Parklands, Mallow, Cork',
    product: 'SE Systems Workmanship',
    warrantyStart: '2023-05-22',
    warrantyExpiry: '2028-05-22',
    daysRemaining: 814,
    status: 'Active',
    category: 'Workmanship',
  },
  {
    id: 7,
    customer: 'Niamh Kelleher',
    address: '5 Sunset Terrace, Kinsale, Cork',
    product: 'SE Systems Workmanship',
    warrantyStart: '2022-09-14',
    warrantyExpiry: '2027-09-14',
    daysRemaining: 564,
    status: 'Active',
    category: 'Workmanship',
  },
  {
    id: 8,
    customer: 'Declan Walsh',
    address: '18 Harbour View, Youghal, Cork',
    product: 'SE Systems Workmanship',
    warrantyStart: '2021-07-08',
    warrantyExpiry: '2026-01-08',
    daysRemaining: -51,
    status: 'Expired',
    category: 'Workmanship',
  },
  {
    id: 9,
    customer: "Eoin O'Connell",
    address: '12 Lakeview, Macroom, Cork',
    product: 'BYD HVS 5.1 Battery',
    warrantyStart: '2023-08-30',
    warrantyExpiry: '2033-08-30',
    daysRemaining: 2_740,
    status: 'Active',
    category: 'Batteries',
  },
  {
    id: 10,
    customer: 'Sarah Cronin',
    address: '27 Ashwood Park, Bandon, Cork',
    product: 'Huawei LUNA2000-5kWh',
    warrantyStart: '2023-02-11',
    warrantyExpiry: '2033-02-11',
    daysRemaining: 2_540,
    status: 'Active',
    category: 'Batteries',
  },
  {
    id: 11,
    customer: 'Liam Hennessy',
    address: '4 College Road, Bantry, Cork',
    product: 'Fronius Symo GEN24 8.0',
    warrantyStart: '2022-06-01',
    warrantyExpiry: '2026-06-01',
    daysRemaining: 93,
    status: 'Expiring Soon',
    category: 'Inverters',
  },
  {
    id: 12,
    customer: "Rois\u00edn O'Mahony",
    address: '16 Greenfield Estate, Clonakilty, Cork',
    product: 'SolarEdge SE4000H',
    warrantyStart: '2021-12-15',
    warrantyExpiry: '2025-12-15',
    daysRemaining: -75,
    status: 'Expired',
    category: 'Inverters',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusConfig: Record<WarrantyItem['status'], { dot: string; badge: string }> = {
  Active: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700',
  },
  'Expiring Soon': {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700',
  },
  Expired: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700',
  },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WarrantyTrackerClient() {
  const [activeTab, setActiveTab] = useState<string>('Inverters');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = warrantyItems.filter((item) => {
    const matchesTab = item.category === activeTab;
    const matchesSearch =
      searchQuery === '' ||
      item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const expiringInverters = warrantyItems.filter(
    (w) => w.category === 'Inverters' && w.status === 'Expiring Soon'
  ).length;

  return (
    <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900">
            Warranty Tracker
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor warranty status across all installations
          </p>
        </div>
        <div className="flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search customer or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 sm:w-72"
            />
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
              <AlertTriangle className="h-[18px] w-[18px] text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                47 inverter warranties expiring in 90 days
              </p>
              <p className="text-xs text-amber-600">
                {expiringInverters} shown below matching current filters
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            <Bell className="h-4 w-4" />
            Send Reminders
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {tabs.map((tab) => {
          const count = warrantyItems.filter((w) => w.category === tab).length;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {tab}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeTab === tab
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Warranty Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Address
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Product
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Warranty Start
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Warranty Expiry
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Days Remaining
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => {
                const config = statusConfig[item.status];
                return (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-gray-50/60"
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {item.customer}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 max-w-[200px] truncate">
                      {item.address}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">{item.product}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {formatDate(item.warrantyStart)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {formatDate(item.warrantyExpiry)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`font-semibold ${
                          item.daysRemaining < 0
                            ? 'text-red-600'
                            : item.daysRemaining <= 90
                            ? 'text-amber-600'
                            : 'text-gray-700'
                        }`}
                      >
                        {item.daysRemaining < 0
                          ? `${Math.abs(item.daysRemaining)}d overdue`
                          : `${item.daysRemaining.toLocaleString()}d`}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.badge}`}
                      >
                        <span
                          className={`mr-1.5 h-1.5 w-1.5 rounded-full ${config.dot}`}
                        />
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Shield className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No warranty records found</p>
          </div>
        )}
      </div>
    </div>
  );
}
