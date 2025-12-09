'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FolderOpen, RefreshCw, Plus, ChevronRight, Home, FileText, Grid, List, Search } from 'lucide-react';
import { DocumentGrid, UploadModal } from '@/components/archive';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { DISCIPLINES, getDisciplineDisplayName, type ArchiveDocument, type DisciplineType } from '@/lib/archive-constants';

interface HouseType {
  id: string;
  house_type_code: string;
  name: string | null;
}

interface HouseTypeGroup {
  houseTypeCode: string;
  houseTypeName: string | null;
  documentCount: number;
  documents: ArchiveDocument[];
}

export default function DisciplineDetailPage() {
  const params = useParams();
  const discipline = params.discipline as string;
  const { tenantId, developmentId, isHydrated } = useSafeCurrentContext();
  
  const [allDocuments, setAllDocuments] = useState<ArchiveDocument[]>([]);
  const [houseTypes, setHouseTypes] = useState<HouseType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedHouseType, setSelectedHouseType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'folders' | 'list'>('folders');
  const [searchQuery, setSearchQuery] = useState('');

  const displayName = getDisciplineDisplayName(discipline);
  const disciplineInfo = DISCIPLINES[discipline as DisciplineType];

  const loadDocuments = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams();
      urlParams.set('tenantId', tenantId);
      urlParams.set('discipline', discipline);
      urlParams.set('pageSize', '500');
      
      if (developmentId) {
        urlParams.set('developmentId', developmentId);
      }
      
      const response = await fetch(`/api/archive/documents?${urlParams}`);
      if (response.ok) {
        const data = await response.json();
        setAllDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('[Archive] Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, developmentId, discipline]);

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

  const handleUploadComplete = () => {
    loadDocuments();
    setShowUploadModal(false);
  };

  const handleRefresh = () => {
    loadDocuments();
  };

  const groupedByHouseType = useCallback((): HouseTypeGroup[] => {
    const groups: Record<string, ArchiveDocument[]> = {};
    const noHouseType: ArchiveDocument[] = [];
    
    allDocuments.forEach(doc => {
      if (doc.house_type_code) {
        if (!groups[doc.house_type_code]) {
          groups[doc.house_type_code] = [];
        }
        groups[doc.house_type_code].push(doc);
      } else {
        noHouseType.push(doc);
      }
    });

    const result: HouseTypeGroup[] = Object.entries(groups)
      .map(([code, docs]) => {
        const houseType = houseTypes.find(ht => ht.house_type_code === code);
        return {
          houseTypeCode: code,
          houseTypeName: houseType?.name || null,
          documentCount: docs.length,
          documents: docs.sort((a, b) => (a.title || '').localeCompare(b.title || '')),
        };
      })
      .sort((a, b) => a.houseTypeCode.localeCompare(b.houseTypeCode));

    if (noHouseType.length > 0) {
      result.push({
        houseTypeCode: 'general',
        houseTypeName: 'General Documents',
        documentCount: noHouseType.length,
        documents: noHouseType.sort((a, b) => (a.title || '').localeCompare(b.title || '')),
      });
    }

    return result;
  }, [allDocuments, houseTypes]);

  const filteredDocuments = useCallback(() => {
    let docs = allDocuments;
    
    if (selectedHouseType) {
      if (selectedHouseType === 'general') {
        docs = docs.filter(d => !d.house_type_code);
      } else {
        docs = docs.filter(d => d.house_type_code === selectedHouseType);
      }
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      docs = docs.filter(d => 
        d.title?.toLowerCase().includes(query) ||
        d.file_name?.toLowerCase().includes(query)
      );
    }
    
    return docs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [allDocuments, selectedHouseType, searchQuery]);

  const groups = groupedByHouseType();
  const currentDocs = filteredDocuments();
  const selectedGroup = selectedHouseType 
    ? groups.find(g => g.houseTypeCode === selectedHouseType)
    : null;

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
                <ChevronRight className="w-3 h-3" />
                {selectedHouseType ? (
                  <>
                    <button
                      onClick={() => setSelectedHouseType(null)}
                      className="hover:text-white transition-colors"
                    >
                      {displayName}
                    </button>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-white">
                      {selectedGroup?.houseTypeCode === 'general' 
                        ? 'General Documents' 
                        : selectedGroup?.houseTypeCode}
                    </span>
                  </>
                ) : (
                  <span className="text-white">{displayName}</span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-gold-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {selectedHouseType 
                      ? (selectedGroup?.houseTypeCode === 'general' 
                          ? 'General Documents' 
                          : `${selectedGroup?.houseTypeCode}${selectedGroup?.houseTypeName ? ` - ${selectedGroup.houseTypeName}` : ''}`)
                      : displayName}
                  </h1>
                  <p className="text-gray-400 mt-0.5">
                    {selectedHouseType 
                      ? `${currentDocs.length} document${currentDocs.length !== 1 ? 's' : ''}`
                      : `${allDocuments.length} document${allDocuments.length !== 1 ? 's' : ''} in ${groups.length} folder${groups.length !== 1 ? 's' : ''}`}
                    {disciplineInfo && !selectedHouseType && ` • ${disciplineInfo.description}`}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('folders')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'folders' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Folder view"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
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

          {(selectedHouseType || viewMode === 'list') && (
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full max-w-md pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold-500 transition-colors"
              />
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
        ) : isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : viewMode === 'folders' && !selectedHouseType ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {groups.map((group) => (
              <button
                key={group.houseTypeCode}
                onClick={() => setSelectedHouseType(group.houseTypeCode)}
                className="group p-6 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gold-500/30 rounded-xl text-left transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-600/10 flex items-center justify-center group-hover:from-gold-500/30 group-hover:to-gold-600/20 transition-colors">
                    {group.houseTypeCode === 'general' ? (
                      <FileText className="w-6 h-6 text-gold-400" />
                    ) : (
                      <Home className="w-6 h-6 text-gold-400" />
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gold-400 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {group.houseTypeCode === 'general' ? 'General' : group.houseTypeCode}
                </h3>
                {group.houseTypeName && group.houseTypeCode !== 'general' && (
                  <p className="text-sm text-gray-400 mb-2 truncate">{group.houseTypeName}</p>
                )}
                <p className="text-sm text-gray-500">
                  {group.documentCount} document{group.documentCount !== 1 ? 's' : ''}
                </p>
              </button>
            ))}
            
            {groups.length === 0 && (
              <div className="col-span-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Documents Yet</h3>
                <p className="text-gray-400 mb-4">Upload your first document to get started</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 text-black font-medium hover:bg-gold-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Upload Document
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {selectedHouseType && (
              <button
                onClick={() => setSelectedHouseType(null)}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to folders
              </button>
            )}
            <DocumentGrid
              documents={currentDocs}
              isLoading={false}
              page={1}
              totalPages={1}
              totalCount={currentDocs.length}
              onPageChange={() => {}}
            />
          </>
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
