'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdminSession } from '@/lib/types';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  Home, 
  User, 
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  ArrowUpDown,
  Building2,
  QrCode,
  ArrowLeft
} from 'lucide-react';

interface Homeowner {
  id: string;
  name: string;
  email: string;
  house_type: string | null;
  address: string | null;
  unique_qr_token: string;
  development_id: string;
  created_at: string;
  development?: {
    id: string;
    name: string;
  };
  has_acknowledged?: boolean;
  message_count?: number;
  last_activity?: string;
}

interface Development {
  id: string;
  name: string;
}

type SortOption = 'name' | 'created_at' | 'last_activity' | 'messages';
type FilterStatus = 'all' | 'acknowledged' | 'pending';

export function HomeownersListClient({ session }: { session: AdminSession }) {
  const searchParams = useSearchParams();
  const developmentIdParam = searchParams.get('developmentId');
  
  const [homeowners, setHomeowners] = useState<Homeowner[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevelopment, setSelectedDevelopment] = useState<string>(developmentIdParam || 'all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchHomeowners();
    fetchDevelopments();
  }, []);

  async function fetchHomeowners() {
    try {
      const response = await fetch('/api/homeowners?includeStats=true');
      if (response.ok) {
        const data = await response.json();
        setHomeowners(data.homeowners || []);
      } else {
        setError('Failed to load homeowners');
      }
    } catch (error) {
      console.error('Failed to fetch homeowners:', error);
      setError('An error occurred while loading homeowners');
    } finally {
      setLoading(false);
    }
  }

  async function fetchDevelopments() {
    try {
      const response = await fetch('/api/developments');
      if (response.ok) {
        const data = await response.json();
        setDevelopments(data.developments || []);
      }
    } catch (error) {
      console.error('Failed to fetch developments:', error);
    }
  }

  const filteredAndSortedHomeowners = useMemo(() => {
    let result = [...homeowners];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(h => 
        h.name.toLowerCase().includes(query) ||
        h.address?.toLowerCase().includes(query) ||
        h.house_type?.toLowerCase().includes(query)
      );
    }

    if (selectedDevelopment !== 'all') {
      result = result.filter(h => h.development_id === selectedDevelopment);
    }

    if (filterStatus === 'acknowledged') {
      result = result.filter(h => h.has_acknowledged);
    } else if (filterStatus === 'pending') {
      result = result.filter(h => !h.has_acknowledged);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'last_activity':
          const aActivity = a.last_activity ? new Date(a.last_activity).getTime() : 0;
          const bActivity = b.last_activity ? new Date(b.last_activity).getTime() : 0;
          comparison = aActivity - bActivity;
          break;
        case 'messages':
          comparison = (a.message_count || 0) - (b.message_count || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [homeowners, searchQuery, selectedDevelopment, filterStatus, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const total = homeowners.length;
    const acknowledged = homeowners.filter(h => h.has_acknowledged).length;
    const pending = total - acknowledged;
    const activeThisWeek = homeowners.filter(h => {
      if (!h.last_activity) return false;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(h.last_activity) >= weekAgo;
    }).length;
    return { total, acknowledged, pending, activeThisWeek };
  }, [homeowners]);

  function toggleSort(option: SortOption) {
    if (sortBy === option) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortOrder('asc');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading homeowners...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Link href="/developer" className="text-gold-500 hover:text-gold-600 flex items-center gap-1 mb-2 text-sm">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Homeowners</h1>
              <p className="text-gray-600 mt-1 text-sm">
                Manage and view all registered homeowners
              </p>
            </div>
            <Link
              href="/developer/homeowners/new"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-lg hover:from-gold-600 hover:to-gold-700 transition-all shadow-md hover:shadow-lg font-medium"
            >
              + Add Homeowner
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <User className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500">Total Homeowners</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.acknowledged}</p>
                <p className="text-xs text-gray-500">Docs Acknowledged</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                <p className="text-xs text-gray-500">Pending Acknowledgement</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.activeThisWeek}</p>
                <p className="text-xs text-gray-500">Active This Week</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, address, or house type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              />
            </div>

            {/* Filter Toggle (Mobile) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Filters (Desktop always visible, Mobile toggleable) */}
            <div className={`flex flex-col sm:flex-row gap-3 ${showFilters ? 'block' : 'hidden lg:flex'}`}>
              {/* Development Filter */}
              <select
                value={selectedDevelopment}
                onChange={(e) => setSelectedDevelopment(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white min-w-[180px]"
              >
                <option value="all">All Developments</option>
                {developments.map(dev => (
                  <option key={dev.id} value={dev.id}>{dev.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white min-w-[180px]"
              >
                <option value="all">All Status</option>
                <option value="acknowledged">Docs Acknowledged</option>
                <option value="pending">Pending Acknowledgement</option>
              </select>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white"
                >
                  <option value="name">Sort by Name</option>
                  <option value="created_at">Sort by Date Added</option>
                  <option value="last_activity">Sort by Last Activity</option>
                  <option value="messages">Sort by Messages</option>
                </select>
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  <ArrowUpDown className={`w-4 h-4 text-gray-600 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold">{filteredAndSortedHomeowners.length}</span> of {homeowners.length} homeowners
          </p>
        </div>

        {/* Homeowners Grid */}
        {filteredAndSortedHomeowners.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-600">No homeowners found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAndSortedHomeowners.map((homeowner) => (
              <HomeownerCard key={homeowner.id} homeowner={homeowner} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeownerCard({ homeowner }: { homeowner: Homeowner }) {
  const hasActivity = homeowner.message_count && homeowner.message_count > 0;
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-gold-300 group">
      {/* Card Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-gold-600 transition-colors">
              {homeowner.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-500 truncate">
                {homeowner.development?.name || 'No Development'}
              </span>
            </div>
          </div>
          
          {/* Status Badge */}
          {homeowner.has_acknowledged ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full flex-shrink-0">
              <CheckCircle2 className="w-3 h-3" />
              Acknowledged
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full flex-shrink-0">
              <Clock className="w-3 h-3" />
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 space-y-3">
        {/* House Type */}
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {homeowner.house_type || 'No house type specified'}
          </span>
        </div>

        {/* Address */}
        {homeowner.address && (
          <div className="flex items-start gap-2">
            <QrCode className="w-4 h-4 text-gray-400 mt-0.5" />
            <span className="text-sm text-gray-600">{homeowner.address}</span>
          </div>
        )}

        {/* Activity Stats */}
        <div className="flex items-center gap-4 pt-2">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">
              {homeowner.message_count || 0} messages
            </span>
          </div>
          {homeowner.last_activity && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">
                Last active {formatRelativeTime(homeowner.last_activity)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Added {new Date(homeowner.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <Link
            href={`/developer/homeowners/${homeowner.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-600 hover:text-gold-700 transition-colors"
          >
            <Eye className="w-4 h-4" />
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
