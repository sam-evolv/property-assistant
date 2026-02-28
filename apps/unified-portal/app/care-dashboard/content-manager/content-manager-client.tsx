'use client';

import { useState } from 'react';
import {
  Upload,
  FileText,
  Video,
  HelpCircle,
  BookOpen,
  Eye,
  Search,
  MoreHorizontal,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentItem {
  id: number;
  title: string;
  type: 'Video' | 'Document' | 'Article' | 'FAQ';
  category: string;
  systemType: string;
  status: 'Live' | 'Draft';
  views: number;
  uploadDate: string;
}

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

const categories = ['All Content', 'Video Guides', 'Documents', 'Troubleshooting', 'FAQs'];

const contentItems: ContentItem[] = [
  {
    id: 1,
    title: 'Understanding Your Inverter',
    type: 'Video',
    category: 'Video Guides',
    systemType: 'SolarEdge',
    status: 'Live',
    views: 1_842,
    uploadDate: '2025-11-15',
  },
  {
    id: 2,
    title: 'How to Read Energy Meter',
    type: 'Document',
    category: 'Documents',
    systemType: 'All Systems',
    status: 'Live',
    views: 2_310,
    uploadDate: '2025-10-22',
  },
  {
    id: 3,
    title: 'Resetting After Power Cut',
    type: 'Article',
    category: 'Troubleshooting',
    systemType: 'SolarEdge',
    status: 'Live',
    views: 3_105,
    uploadDate: '2025-09-08',
  },
  {
    id: 4,
    title: 'Installation Certificate',
    type: 'Document',
    category: 'Documents',
    systemType: 'All Systems',
    status: 'Live',
    views: 987,
    uploadDate: '2025-12-01',
  },
  {
    id: 5,
    title: 'SEAI Grant Confirmation',
    type: 'Document',
    category: 'Documents',
    systemType: 'All Systems',
    status: 'Live',
    views: 1_456,
    uploadDate: '2025-11-28',
  },
  {
    id: 6,
    title: 'SolarEdge Error Codes',
    type: 'Article',
    category: 'Troubleshooting',
    systemType: 'SolarEdge',
    status: 'Live',
    views: 4_230,
    uploadDate: '2025-08-14',
  },
  {
    id: 7,
    title: 'Maximising Solar Savings',
    type: 'Video',
    category: 'Video Guides',
    systemType: 'All Systems',
    status: 'Live',
    views: 2_780,
    uploadDate: '2025-10-05',
  },
  {
    id: 8,
    title: 'Winter Solar Performance',
    type: 'FAQ',
    category: 'FAQs',
    systemType: 'All Systems',
    status: 'Draft',
    views: 156,
    uploadDate: '2026-01-12',
  },
  {
    id: 9,
    title: 'Fronius Quick Start',
    type: 'Video',
    category: 'Video Guides',
    systemType: 'Fronius',
    status: 'Live',
    views: 1_120,
    uploadDate: '2025-11-03',
  },
  {
    id: 10,
    title: 'Panel Cleaning Guide',
    type: 'Article',
    category: 'Documents',
    systemType: 'All Systems',
    status: 'Draft',
    views: 340,
    uploadDate: '2026-02-01',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const typeConfig: Record<ContentItem['type'], { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  Video: { icon: Video, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  Document: { icon: FileText, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  Article: { icon: BookOpen, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  FAQ: { icon: HelpCircle, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentManagerClient() {
  const [activeTab, setActiveTab] = useState('All Content');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = contentItems.filter((item) => {
    const matchesTab = activeTab === 'All Content' || item.category === activeTab;
    const matchesSearch =
      searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900">
          Content Manager
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload and manage guides, videos, and documents
        </p>
      </div>

      {/* Category Tabs + Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTab(cat)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === cat
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 sm:w-64"
          />
        </div>
      </div>

      {/* Upload Area */}
      <div className="mb-6 rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center transition-colors hover:border-[#D4AF37]/60 hover:bg-amber-50/20">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
          <Upload className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-700">
          Drag and drop files here, or{' '}
          <span className="cursor-pointer text-[#D4AF37] hover:underline">browse</span>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          PDF, MP4, DOCX, PNG up to 50MB
        </p>
      </div>

      {/* Content Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Title
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Type
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  System
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Views
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Uploaded
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => {
                const typeInfo = typeConfig[item.type];
                const TypeIcon = typeInfo.icon;
                return (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-gray-50/60"
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {item.title}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeInfo.color}`}
                      >
                        <TypeIcon className="h-3 w-3" />
                        {item.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{item.category}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {item.systemType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.status === 'Live'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <span
                          className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                            item.status === 'Live' ? 'bg-emerald-500' : 'bg-gray-400'
                          }`}
                        />
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-gray-600">
                        <Eye className="h-3.5 w-3.5 text-gray-400" />
                        {item.views.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {formatDate(item.uploadDate)}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      >
                        <MoreHorizontal className="h-4 w-4" />
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
            <FileText className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No content found</p>
          </div>
        )}
      </div>
    </div>
  );
}
