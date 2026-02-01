'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminSession } from '@/lib/types';
import { ArrowLeft, Users, MessageSquare, CheckCircle, Clock, Search, Filter, ChevronDown, Home, Calendar, Activity, Building2, QrCode, Download, Mail, Trash2, Archive, Square, CheckSquare } from 'lucide-react';
import { BulkActionToolbar, getCommonBulkActions } from '@/components/ui/BulkActionToolbar';

interface Unit {
  id: string;
  unit_number: string | null;
  resident_name: string | null;
  address: string | null;
  purchaser_name: string | null;
  development_id: string;
  created_at: string;
  important_docs_agreed_version: number;
  important_docs_agreed_at: string | null;
  house_type_code: string | null;
  is_social_housing?: boolean;
  housing_agency?: string | null;
  development?: {
    id: string;
    name: string;
    important_docs_version: number;
  };
}

interface Project {
  id: string;
  name: string;
  important_docs_version?: number;
}

function extractHouseNumber(address: string | null, unitNumber: string | null): number {
  if (address) {
    const match = address.match(/^(\d+)/);
    if (match) return parseInt(match[1]);
  }
  if (unitNumber) {
    const match = unitNumber.match(/\d+/);
    if (match) return parseInt(match[0]);
  }
  return 999;
}

export function HomeownersList({ 
  session, 
  homeowners,
  development,
  developmentId,
  allProjects = []
}: { 
  session: AdminSession;
  homeowners: any[];
  development?: any;
  developmentId?: string;
  allProjects?: Project[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'acknowledged' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'house' | 'name' | 'date' | 'activity'>('house');
  const [showFilters, setShowFilters] = useState(false);
  const [downloadingQR, setDownloadingQR] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Social housing filter - default to 'private' (hide social housing)
  const [housingFilter, setHousingFilter] = useState<'all' | 'private' | 'social'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('homeownersHousingFilter') as 'all' | 'private' | 'social') || 'private';
    }
    return 'private';
  });

  // Persist filter preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('homeownersHousingFilter', housingFilter);
    }
  }, [housingFilter]);
  
  // Count for filter tabs
  const privateCount = homeowners.filter(u => !u.is_social_housing).length;
  const socialCount = homeowners.filter(u => u.is_social_housing).length;

  // Selection handlers
  const toggleSelection = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredAndSorted.map(u => u.id)));
  }, []);

  // Bulk action handlers
  const handleBulkEmail = useCallback(() => {
    const ids = Array.from(selectedIds).join(',');
    router.push(`/developer/homeowners/email?ids=${ids}`);
  }, [selectedIds, router]);

  const handleBulkExport = useCallback(() => {
    console.log('Exporting', selectedIds.size, 'homeowners');
    // TODO: Implement export
  }, [selectedIds]);

  const handleBulkArchive = useCallback(() => {
    console.log('Archiving', selectedIds.size, 'homeowners');
    // TODO: Implement archive
  }, [selectedIds]);

  const bulkActions = getCommonBulkActions({
    onEmail: handleBulkEmail,
    onExport: handleBulkExport,
    onArchive: handleBulkArchive,
  });

  const handleBulkQRDownload = async () => {
    if (homeowners.length === 0) return;

    setDownloadingQR(true);
    try {
      const params = new URLSearchParams();
      if (developmentId) {
        params.set('developmentId', developmentId);
      }
      params.set('format', 'png');

      const response = await fetch(`/api/qr/bulk?${params}`);

      if (!response.ok) {
        throw new Error('Failed to generate QR codes');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-codes-${developmentId || 'all'}-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download QR codes:', error);
      alert('Failed to download QR codes. Please try again.');
    } finally {
      setDownloadingQR(false);
    }
  };

  const handleDevelopmentChange = (projectId: string) => {
    if (projectId === 'all') {
      router.push('/developer/homeowners');
    } else {
      router.push(`/developer/homeowners?developmentId=${projectId}`);
    }
  };

  // Helper function to check if a unit has acknowledged docs
  const hasUnitAcknowledged = (unit: any) => {
    const agreedVersion = unit.important_docs_agreed_version || 0;
    // Check against the unit's own development version, or use a fallback
    const devVersion = unit.development?.important_docs_version || development?.important_docs_version || 0;
    // If no version is set anywhere, check if they've acknowledged at least version 1
    if (devVersion === 0) {
      return agreedVersion >= 1;
    }
    return agreedVersion >= devVersion;
  };

  const currentVersion = development?.important_docs_version || 0;

  const filteredAndSorted = useMemo(() => {
    let result = [...homeowners];

    // Apply housing filter first
    if (housingFilter === 'private') {
      result = result.filter(unit => !unit.is_social_housing);
    } else if (housingFilter === 'social') {
      result = result.filter(unit => unit.is_social_housing);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(unit => {
        const name = (unit.purchaser_name || unit.resident_name || unit.name || '').toLowerCase();
        const address = (unit.address || '').toLowerCase();
        const unitNum = (unit.unit_number || '').toLowerCase();
        return name.includes(query) || address.includes(query) || unitNum.includes(query);
      });
    }

    if (filterStatus !== 'all') {
      result = result.filter(unit => {
        const hasAgreed = hasUnitAcknowledged(unit);
        return filterStatus === 'acknowledged' ? hasAgreed : !hasAgreed;
      });
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'house':
          return extractHouseNumber(a.address, a.unit_number) - extractHouseNumber(b.address, b.unit_number);
        case 'name':
          const nameA = (a.purchaser_name || a.resident_name || a.name || '').toLowerCase();
          const nameB = (b.purchaser_name || b.resident_name || b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'activity':
          const actA = a.important_docs_agreed_at ? new Date(a.important_docs_agreed_at).getTime() : 0;
          const actB = b.important_docs_agreed_at ? new Date(b.important_docs_agreed_at).getTime() : 0;
          return actB - actA;
        default:
          return 0;
      }
    });

    return result;
  }, [homeowners, searchQuery, filterStatus, sortBy, currentVersion, housingFilter]);

  const stats = useMemo(() => {
    const acknowledged = homeowners.filter(u => hasUnitAcknowledged(u)).length;
    
    return {
      total: homeowners.length,
      acknowledged,
      pending: homeowners.length - acknowledged
    };
  }, [homeowners, development]);

  return (
    <div className="min-h-full bg-gradient-to-br from-white via-grey-50 to-white flex flex-col">
      <div className="border-b border-gold-200/30 px-8 py-6 backdrop-blur-sm bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Link href="/developer" className="text-gold-500 hover:text-gold-600 flex items-center gap-1 mb-2">
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back to Dashboard</span>
              </Link>
              <h1 className="text-3xl font-bold text-grey-900">Homeowners</h1>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gold-500" />
                  <select
                    value={developmentId || 'all'}
                    onChange={(e) => handleDevelopmentChange(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-gold-200/50 bg-white text-grey-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-400 cursor-pointer"
                  >
                    <option value="all">All Developments</option>
                    {allProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-grey-400">|</span>
                {/* Housing Type Filter Tabs */}
                <div className="flex items-center bg-grey-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setHousingFilter('all')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      housingFilter === 'all'
                        ? 'bg-white text-grey-900 shadow-sm'
                        : 'text-grey-500 hover:text-grey-700'
                    }`}
                  >
                    All ({homeowners.length})
                  </button>
                  <button
                    onClick={() => setHousingFilter('private')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      housingFilter === 'private'
                        ? 'bg-white text-grey-900 shadow-sm'
                        : 'text-grey-500 hover:text-grey-700'
                    }`}
                  >
                    Private ({privateCount})
                  </button>
                  <button
                    onClick={() => setHousingFilter('social')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      housingFilter === 'social'
                        ? 'bg-white text-grey-900 shadow-sm'
                        : 'text-grey-500 hover:text-grey-700'
                    }`}
                  >
                    Social ({socialCount})
                  </button>
                </div>
                <span className="text-grey-400">|</span>
                <span className="text-grey-600 text-sm">{filteredAndSorted.length} residents</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {homeowners.length > 0 && (
                <button
                  onClick={handleBulkQRDownload}
                  disabled={downloadingQR}
                  className="px-4 py-2 border border-gold-300 text-gold-700 rounded-lg hover:bg-gold-50 transition flex items-center gap-2 disabled:opacity-50"
                  title="Download all QR codes as ZIP"
                >
                  {downloadingQR ? (
                    <div className="w-4 h-4 border-2 border-gold-300 border-t-gold-600 rounded-full animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Download QR Codes</span>
                  <Download className="w-3 h-3" />
                </button>
              )}
              <Link
                href="/developer/homeowners/new"
                className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition flex items-center gap-2 shadow-md"
              >
                <span>+ Add Homeowner</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gold-200/30 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gold-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-gold-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-grey-900">{stats.total}</p>
                  <p className="text-sm text-grey-600">Total Residents</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-green-200/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-grey-900">{stats.acknowledged}</p>
                  <p className="text-sm text-grey-600">Acknowledged</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-amber-200/50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-grey-900">{stats.pending}</p>
                  <p className="text-sm text-grey-600">Pending</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-grey-400" />
              <input
                type="text"
                placeholder="Search by name, address, or unit number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gold-200/50 bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-400 text-grey-900 placeholder-grey-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  filterStatus === 'all' 
                    ? 'bg-gold-500 text-white' 
                    : 'bg-white border border-gold-200/50 text-grey-600 hover:border-gold-300'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setFilterStatus('acknowledged')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                  filterStatus === 'acknowledged' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white border border-green-200/50 text-green-700 hover:border-green-300'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Acknowledged ({stats.acknowledged})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                  filterStatus === 'pending' 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-white border border-amber-200/50 text-amber-700 hover:border-amber-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Pending ({stats.pending})
              </button>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition ${
                showFilters ? 'border-gold-400 bg-gold-50 text-gold-700' : 'border-gold-200/50 bg-white text-grey-600 hover:border-gold-300'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Sort</span>
              <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 flex items-center gap-4 p-4 bg-white/80 rounded-lg border border-gold-200/30">
              <div>
                <label className="text-xs font-medium text-grey-500 mb-1 block">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 rounded-lg border border-gold-200/50 bg-white text-grey-900 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                >
                  <option value="house">House Number</option>
                  <option value="name">Name</option>
                  <option value="date">Date Added</option>
                  <option value="activity">Last Activity</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-8 flex-1">
        <div className="max-w-7xl mx-auto">
          {filteredAndSorted.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gold-200/50 p-12 text-center">
              <Users className="w-12 h-12 text-gold-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-grey-900 mb-1">
                {searchQuery || filterStatus !== 'all' ? 'No residents match your filters' : 'No residents found'}
              </p>
              <p className="text-sm text-grey-600">
                {searchQuery || filterStatus !== 'all' ? 'Try adjusting your search or filters.' : 'Add your first homeowner to get started.'}
              </p>
            </div>
          ) : (
            <>
              {/* Select All / Clear Selection */}
              {filteredAndSorted.length > 0 && (
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => setSelectedIds(new Set(filteredAndSorted.map(u => u.id)))}
                    className="text-sm text-gold-600 hover:text-gold-700 font-medium"
                  >
                    Select All ({filteredAndSorted.length})
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={clearSelection}
                      className="text-sm text-grey-500 hover:text-grey-700"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSorted.map((unit) => {
                const houseNum = extractHouseNumber(unit.address, unit.unit_number);
                const displayNum = houseNum !== 999 ? houseNum : (unit.unit_number || '?');
                const residentName = unit.purchaser_name || unit.resident_name || unit.name || 'Unassigned';

                const hasAgreed = hasUnitAcknowledged(unit);
                const houseType = unit.house_type_code || 'Not specified';
                const isSelected = selectedIds.has(unit.id);

                return (
                  <div
                    key={unit.id}
                    className={`group rounded-xl border backdrop-blur-sm bg-white hover:shadow-lg transition-all overflow-hidden relative ${
                      isSelected
                        ? 'border-gold-400 ring-2 ring-gold-200'
                        : 'border-gold-200/30 hover:border-gold-300/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={(e) => toggleSelection(unit.id, e)}
                      className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-gold-500 border-gold-500 text-white'
                          : 'bg-white border-grey-300 hover:border-gold-400'
                      }`}
                    >
                      {isSelected && <CheckCircle className="w-4 h-4" />}
                    </button>

                    <Link href={`/developer/homeowners/${unit.id}`} className="block">
                    <div className="p-5 pl-12">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 text-white flex items-center justify-center font-bold text-lg shadow-md group-hover:scale-105 transition">
                            {displayNum}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-grey-900 truncate group-hover:text-gold-600 transition">
                            {residentName}
                          </h3>
                          
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-grey-500">
                              <Home className="w-3.5 h-3.5" />
                              <span className="truncate">{houseType}</span>
                            </div>
                            {unit.address && (
                              <p className="text-xs text-grey-500 truncate">{unit.address}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          {hasAgreed ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-green-100" title="Documents acknowledged">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-xs font-medium text-green-700">Acknowledged</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-100" title="Pending acknowledgement">
                              <Clock className="w-4 h-4 text-amber-600" />
                              <span className="text-xs font-medium text-amber-700">Pending</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gold-100 flex items-center justify-between text-xs text-grey-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Added {new Date(unit.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        {unit.important_docs_agreed_at && (
                          <div className="flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </div>
                        )}
                      </div>
                    </div>
                    </Link>
                  </div>
                );
              })}
              </div>

              {/* Bulk Action Toolbar */}
              <BulkActionToolbar
                selectedCount={selectedIds.size}
                onClearSelection={clearSelection}
                actions={bulkActions}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
