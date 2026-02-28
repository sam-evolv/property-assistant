'use client';

import { useState } from 'react';
import {
  Sparkles,
  Search,
  Archive,
  FileText,
  BookOpen,
  MessageSquare,
  Wrench,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  iconBg: string;
  iconColor: string;
}

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

const recentSearches = [
  'SolarEdge error code 18xB1',
  'SEAI grant application',
  'inverter warranty terms',
  'panel cleaning schedule',
  'firmware update process',
  'BYD battery installation',
];

const documentCategories: DocumentCategory[] = [
  {
    id: 'installation',
    title: 'Installation Records',
    description: 'BER certs, installation photos, commissioning reports',
    icon: FileText,
    count: 1_247,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  {
    id: 'documentation',
    title: 'System Documentation',
    description: 'Inverter manuals, panel specs, wiring diagrams',
    icon: BookOpen,
    count: 342,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-500',
  },
  {
    id: 'communications',
    title: 'Customer Communications',
    description: 'Emails, support tickets, chat transcripts',
    icon: MessageSquare,
    count: 5_891,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
  {
    id: 'guides',
    title: 'Technical Guides',
    description: 'Troubleshooting guides, how-tos, best practices',
    icon: Wrench,
    count: 89,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CareArchiveClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setHasSearched(true);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setHasSearched(false);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8962E] shadow-sm">
            <Archive className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900">
              Smart Archive
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              AI-powered search across all installer content and records
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Sparkles className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D4AF37]" />
          <input
            type="text"
            placeholder="Search across all documents, records, and communications..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) setHasSearched(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            className="w-full rounded-xl border border-gray-200 bg-white py-4 pl-12 pr-24 text-base text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {searchQuery && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleSearch}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#B8962E]"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Recent Searches */}
      {!hasSearched && (
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Recent Searches
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search) => (
              <button
                key={search}
                type="button"
                onClick={() => {
                  setSearchQuery(search);
                  setHasSearched(true);
                }}
                className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm transition-all hover:-translate-y-px hover:border-[#D4AF37]/40 hover:bg-amber-50/30 hover:text-gray-900 hover:shadow-md"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results or Empty State */}
      {hasSearched ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <Sparkles className="h-8 w-8 text-[#D4AF37]" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-gray-900">
            Searching across all records...
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            AI-powered search is analysing 7,569 documents for &quot;{searchQuery}&quot;
          </p>
          <div className="mx-auto max-w-xs">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: '65%',
                  background: 'linear-gradient(90deg, #D4AF37, #e8c94b)',
                }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              This is a demo - full search coming soon
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <Archive className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-gray-900">
            Search your entire archive
          </h3>
          <p className="text-sm text-gray-500">
            Use natural language to find installation records, technical documents,
            customer communications, and more
          </p>
        </div>
      )}

      {/* Document Categories */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          Browse by Category
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {documentCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${cat.iconBg}`}
                  >
                    <Icon className={`h-5 w-5 ${cat.iconColor}`} />
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="mb-0.5 text-sm font-semibold text-gray-900">
                  {cat.title}
                </h3>
                <p className="mb-3 text-xs leading-relaxed text-gray-500">
                  {cat.description}
                </p>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="text-xs font-semibold text-gray-700">
                    {cat.count.toLocaleString()} records
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#D4AF37] transition-colors hover:text-[#B8962E]"
                  >
                    Browse
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
