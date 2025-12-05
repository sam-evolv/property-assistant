'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FolderOpen, RefreshCw, Plus, Filter, Star, AlertTriangle, Sparkles } from 'lucide-react';
import { DocumentGrid, UploadModal } from '@/components/archive';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { DISCIPLINES, getDisciplineDisplayName } from '@/lib/archive';
import type { ArchiveDocument, DisciplineType } from '@/lib/archive';

interface HouseType {
  id: string;
  house_type_code: string;
  name: string | null;
}

export default function DisciplineDetailPage() {
  const params = useParams();
  const discipline = params.discipline as string;
  const { tenantId, developmentId, isHydrated } = useSafeCurrentContext();
  
  const [documents, setDocuments] = useState<ArchiveDocument[]>([]);
  const [houseTypes, setHouseTypes] = useState<HouseType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  const [filterHouseType, setFilterHouseType] = useState<string>('');
  const [filterImportant, setFilterImportant] = useState(false);
  const [filterMustRead, setFilterMustRead] = useState(false);
  const [filterAiClassified, setFilterAiClassified] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const displayName = getDisciplineDisplayName(discipline);
  const disciplineInfo = DISCIPLINES[discipline as DisciplineType];

  const loadDocuments = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams();
      urlParams.set('tenantId', tenantId);
      urlParams.set('discipline', discipline);
      urlParams.set('page', page.toString());
      urlParams.set('pageSize', '20');
      
      if (developmentId) {
        urlParams.set('developmentId', developmentId);
      }
      if (filterHouseType) {
        urlParams.set('houseTypeCode', filterHouseType);
      }
      if (filterImportant) {
        urlParams.set('important', 'true');
      }
      if (filterMustRead) {
        urlParams.set('mustRead', 'true');
      }
      if (filterAiClassified) {
        urlParams.set('aiClassified', 'true');
      }
      
      const response = await fetch(`/api/archive/documents?${urlParams}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
      }
    } catch (error) {
      console.error('[Archive] Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, developmentId, discipline, page, filterHouseType, filterImportant, filterMustRead, filterAiClassified]);

  const loadHouseTypes = useCallback(async () => {
    if (!tenantId || !developmentId) return;
    
    try {
      const response = await fetch(`/api/developments/${developmentId}/houses`);
      if (response.ok) {
        const data = await response.json();
        setHouseTypes(data.houseTypes || []);
      }
    } catch (error) {
      console.error('[Archive] Failed to load house types:', error);
    }
  }, [tenantId, developmentId]);

  useEffect(() => {
    if (!isHydrated || !tenantId) return;
    loadDocuments();
    loadHouseTypes();
  }, [isHydrated, tenantId, developmentId, loadDocuments, loadHouseTypes]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploadComplete = () => {
    loadDocuments();
    setShowUploadModal(false);
  };

  const handleRefresh = () => {
    loadDocuments();
  };

  const clearFilters = () => {
    setFilterHouseType('');
    setFilterImportant(false);
    setFilterMustRead(false);
    setFilterAiClassified(false);
    setPage(1);
  };

  const hasActiveFilters = filterHouseType || filterImportant || filterMustRead || filterAiClassified;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
      <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                <Link 
                  href="/developer/archive" 
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Smart Archive
                </Link>
                <span>/</span>
                <span className="text-white">{displayName}</span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-gold-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{displayName}</h1>
                  <p className="text-gray-400 mt-0.5">
                    {totalCount} document{totalCount !== 1 ? 's' : ''}
                    {disciplineInfo && ` • ${disciplineInfo.description}`}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2.5 rounded-xl transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
                title="Filters"
              >
                <Filter className="w-5 h-5" />
              </button>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {developmentId && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
                >
                  <Plus className="w-5 h-5" />
                  <span>Upload</span>
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex flex-wrap items-center gap-4">
                <select
                  value={filterHouseType}
                  onChange={(e) => { setFilterHouseType(e.target.value); setPage(1); }}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gold-500"
                >
                  <option value="">All House Types</option>
                  {houseTypes.map(ht => (
                    <option key={ht.id} value={ht.house_type_code}>
                      {ht.house_type_code} {ht.name ? `- ${ht.name}` : ''}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterImportant}
                    onChange={(e) => { setFilterImportant(e.target.checked); setPage(1); }}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-gold-500 focus:ring-gold-500"
                  />
                  <Star className="w-4 h-4 text-gold-400" />
                  <span className="text-sm text-gray-300">Important</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterMustRead}
                    onChange={(e) => { setFilterMustRead(e.target.checked); setPage(1); }}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500"
                  />
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-gray-300">Must Read</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterAiClassified}
                    onChange={(e) => { setFilterAiClassified(e.target.checked); setPage(1); }}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                  />
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-300">AI Classified</span>
                </label>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!developmentId ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Select a Development</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Choose a development from the sidebar to view documents.
            </p>
          </div>
        ) : (
          <DocumentGrid
            documents={documents}
            isLoading={isLoading}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {tenantId && developmentId && (
        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={handleUploadComplete}
          tenantId={tenantId}
          developmentId={developmentId}
          houseTypes={houseTypes}
        />
      )}
    </div>
  );
}
