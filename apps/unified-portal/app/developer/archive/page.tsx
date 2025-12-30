'use client';

import { useState, useEffect, useCallback } from 'react';
import { FolderArchive, Plus, RefreshCw, Search, BarChart3, Sparkles, Loader2, Database, Zap, Star, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { DisciplineGrid, UploadModal, DevelopmentSelector, SchemeSelectionModal } from '@/components/archive';
import { InsightsTab } from '@/components/archive/InsightsTab';
import { ImportantDocsTab } from '@/components/archive/ImportantDocsTab';
import { CreateFolderModal } from '@/components/archive/CreateFolderModal';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { isAllSchemes, getSchemeId, createSchemeScope, createAllSchemesScope, scopeToString } from '@/lib/archive-scope';
import type { DisciplineSummary } from '@/lib/archive-constants';
import type { CustomDisciplineFolder } from '@/components/archive/DisciplineGrid';

interface HouseType {
  id: string;
  house_type_code: string;
  name: string | null;
}

interface Development {
  id: string;
  name: string;
}

interface EmbeddingStats {
  totalDocuments: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
  pending: number;
  processing: number;
  errors: number;
}

type TabType = 'archive' | 'important' | 'insights';

export default function SmartArchivePage() {
  const { tenantId, archiveScope, setArchiveScope, isHydrated } = useSafeCurrentContext();
  const developmentId = getSchemeId(archiveScope);
  const isViewingAllSchemes = isAllSchemes(archiveScope);
  
  const [disciplines, setDisciplines] = useState<DisciplineSummary[]>([]);
  const [customFolders, setCustomFolders] = useState<CustomDisciplineFolder[]>([]);
  const [houseTypes, setHouseTypes] = useState<HouseType[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSchemeSelectionModal, setShowSchemeSelectionModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<CustomDisciplineFolder | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('archive');
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState<string | null>(null);
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState<string | null>(null);
  const [selectedUploadSchemeId, setSelectedUploadSchemeId] = useState<string | null>(null);

  const loadDevelopments = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const response = await fetch('/api/developer/developments');
      if (response.ok) {
        const data = await response.json();
        setDevelopments(data.developments || []);
      }
    } catch (error) {
      console.error('[Archive] Failed to load developments:', error);
    }
  }, [tenantId]);

  const loadDisciplines = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const queryPayload = {
        tenantId,
        mode: isViewingAllSchemes ? 'ALL_SCHEMES' : 'SCHEME',
        schemeId: developmentId
      };
      console.log('[Archive] Outgoing archive query payload:', queryPayload);
      
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      params.set('mode', isViewingAllSchemes ? 'ALL_SCHEMES' : 'SCHEME');
      if (developmentId) {
        params.set('schemeId', developmentId);
      }
      
      const response = await fetch(`/api/archive/disciplines?${params}`);
      console.log('[Archive] Backend response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        setDisciplines(data.disciplines || []);
      }
    } catch (error) {
      console.error('[Archive] Failed to load disciplines:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, developmentId, isViewingAllSchemes]);

  const loadHouseTypes = useCallback(async () => {
    if (!tenantId || !developmentId) {
      setHouseTypes([]);
      return;
    }
    
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

  const checkUnclassified = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      if (developmentId) {
        params.set('developmentId', developmentId);
      }
      
      const response = await fetch(`/developer/api/archive/bulk-classify?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUnclassifiedCount(data.unclassifiedCount || 0);
      }
    } catch (error) {
      console.error('[Archive] Failed to check unclassified:', error);
    }
  }, [tenantId, developmentId]);

  const loadEmbeddingStats = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      if (developmentId) {
        params.set('developmentId', developmentId);
      }
      
      const response = await fetch(`/developer/api/archive/reprocess-all?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEmbeddingStats(data);
      }
    } catch (error) {
      console.error('[Archive] Failed to load embedding stats:', error);
    }
  }, [tenantId, developmentId]);

  const loadCustomFolders = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      if (developmentId) {
        params.set('developmentId', developmentId);
      }
      params.set('discipline', '__root__');
      
      const response = await fetch(`/api/archive/folders?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCustomFolders(data.folders || []);
      }
    } catch (error) {
      console.error('[Archive] Failed to load custom folders:', error);
    }
  }, [tenantId, developmentId]);

  const handleReprocessAll = async () => {
    if (!tenantId || isReprocessing) return;
    
    setIsReprocessing(true);
    setReprocessProgress('Starting embedding generation...');
    
    try {
      const response = await fetch('/developer/api/archive/reprocess-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          developmentId,
          limit: 20
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setReprocessProgress(`Processed ${data.successful} of ${data.processed} documents (${data.totalChunks} chunks created)`);
        
        setTimeout(() => {
          setReprocessProgress(null);
          loadEmbeddingStats();
        }, 3000);
      } else {
        const error = await response.json();
        setReprocessProgress(`Error: ${error.error || 'Reprocessing failed'}`);
        setTimeout(() => setReprocessProgress(null), 5000);
      }
    } catch (error) {
      console.error('[Archive] Reprocess failed:', error);
      setReprocessProgress('Reprocessing failed');
      setTimeout(() => setReprocessProgress(null), 3000);
    } finally {
      setIsReprocessing(false);
    }
  };

  useEffect(() => {
    if (!isHydrated || !tenantId) return;
    loadDevelopments();
    loadDisciplines();
    loadHouseTypes();
    checkUnclassified();
    loadEmbeddingStats();
    loadCustomFolders();
  }, [tenantId, developmentId, isHydrated, loadDevelopments, loadDisciplines, loadHouseTypes, checkUnclassified, loadEmbeddingStats, loadCustomFolders]);

  const handleUploadClick = () => {
    if (isViewingAllSchemes) {
      setShowSchemeSelectionModal(true);
    } else {
      setShowUploadModal(true);
    }
  };

  const handleSchemeSelected = (schemeId: string) => {
    setSelectedUploadSchemeId(schemeId);
    setShowSchemeSelectionModal(false);
    setShowUploadModal(true);
  };

  const handleUploadComplete = () => {
    loadDisciplines();
    checkUnclassified();
    loadEmbeddingStats();
    setShowUploadModal(false);
    setSelectedUploadSchemeId(null);
  };

  const handleUploadModalClose = () => {
    setShowUploadModal(false);
    setSelectedUploadSchemeId(null);
  };

  const handleRefresh = () => {
    loadDevelopments();
    loadDisciplines();
    loadHouseTypes();
    checkUnclassified();
    loadEmbeddingStats();
    loadCustomFolders();
  };

  const handleCreateFolder = () => {
    setEditingFolder(null);
    setShowCreateFolderModal(true);
  };

  const handleEditFolder = (folder: CustomDisciplineFolder) => {
    setEditingFolder(folder);
    setShowCreateFolderModal(true);
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folder = customFolders.find(f => f.id === folderId);
    if (!folder || !tenantId) return;
    
    try {
      const response = await fetch('/api/archive/folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: folderId,
          tenantId,
          developmentId,
          discipline: '__root__',
        }),
      });
      
      if (response.ok) {
        setCustomFolders(prev => prev.filter(f => f.id !== folderId));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('[Archive] Failed to delete folder:', error);
    }
  };

  const handleFolderCreated = () => {
    setShowCreateFolderModal(false);
    setEditingFolder(null);
    loadCustomFolders();
  };

  const handleBulkClassify = async () => {
    if (!tenantId || isClassifying) return;
    
    setIsClassifying(true);
    setClassifyProgress('Starting AI classification...');
    
    try {
      const response = await fetch('/developer/api/archive/bulk-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          developmentId,
          limit: 50
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setClassifyProgress(`Classified ${data.successCount} documents`);
        
        setTimeout(() => {
          setClassifyProgress(null);
          loadDisciplines();
          checkUnclassified();
        }, 2000);
      } else {
        setClassifyProgress('Classification failed');
        setTimeout(() => setClassifyProgress(null), 3000);
      }
    } catch (error) {
      console.error('[Archive] Bulk classify failed:', error);
      setClassifyProgress('Classification failed');
      setTimeout(() => setClassifyProgress(null), 3000);
    } finally {
      setIsClassifying(false);
    }
  };

  const setDevelopmentId = (id: string | null) => {
    const newScope = id ? createSchemeScope(id) : createAllSchemesScope();
    console.log('[Archive] Scope change:', scopeToString(newScope));
    setArchiveScope(newScope);
  };

  const totalDocuments = disciplines.reduce((sum, d) => sum + d.fileCount, 0);
  const showClassifyBanner = unclassifiedCount > 0;
  const showEmbeddingBanner = embeddingStats && embeddingStats.withoutEmbeddings > 0;
  const hasSchemes = developments.length > 0;
  const hasDocuments = totalDocuments > 0;
  const uploadSchemeId = selectedUploadSchemeId || developmentId;
  
  console.log('[Archive] Render state:', { 
    schemes: developments.length, 
    documents: totalDocuments, 
    scope: scopeToString(archiveScope),
    isLoading
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
      <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center">
                <FolderArchive className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Smart Archive</h1>
                <p className="text-gray-400 mt-0.5">
                  {isViewingAllSchemes 
                    ? `${totalDocuments} documents across all schemes`
                    : `${totalDocuments} documents organised by discipline`
                  }
                </p>
              </div>
            </div>
            
            <DevelopmentSelector
              tenantId={tenantId}
              archiveScope={archiveScope}
              onScopeChange={setArchiveScope}
              selectedDevelopmentId={developmentId}
              onDevelopmentChange={setDevelopmentId}
            />
            
            <div className="flex items-center gap-3">
              <Link
                href="/developer/archive/search"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <Search className="w-5 h-5" />
                <span>Search</span>
              </Link>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleUploadClick}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
              >
                <Plus className="w-5 h-5" />
                <span>Upload</span>
              </button>
            </div>
          </div>
          
          <div className="flex gap-1 mt-6">
            <button
              onClick={() => setActiveTab('archive')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'archive'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              <span>Documents</span>
            </button>
            <button
              onClick={() => setActiveTab('important')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'important'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Star className="w-4 h-4" />
              <span>Must-Read</span>
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'insights'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Insights</span>
            </button>
          </div>
        </div>
      </div>

      {isViewingAllSchemes && (hasDocuments || isLoading) && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-gradient-to-r from-emerald-900/30 to-teal-800/20 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <FolderArchive className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-medium">Viewing All Schemes</p>
              <p className="text-gray-400 text-sm">
                {totalDocuments} documents across all schemes are shown below
              </p>
            </div>
          </div>
        </div>
      )}

      {showClassifyBanner && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-gradient-to-r from-purple-900/30 to-purple-800/20 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-white font-medium">
                  {unclassifiedCount} document{unclassifiedCount !== 1 ? 's' : ''} need{unclassifiedCount === 1 ? 's' : ''} classification
                </p>
                <p className="text-gray-400 text-sm">
                  Use AI to automatically organise documents into disciplines
                </p>
              </div>
            </div>
            <button
              onClick={handleBulkClassify}
              disabled={isClassifying}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white font-medium hover:bg-purple-400 transition-colors disabled:opacity-50"
            >
              {isClassifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{classifyProgress || 'Classifying...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Classify All</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showEmbeddingBanner && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-gradient-to-r from-blue-900/30 to-cyan-800/20 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium">
                  {embeddingStats.withoutEmbeddings} document{embeddingStats.withoutEmbeddings !== 1 ? 's' : ''} not indexed for AI search
                </p>
                <p className="text-gray-400 text-sm">
                  Indexed: {embeddingStats.withEmbeddings} of {embeddingStats.totalDocuments} documents
                  {embeddingStats.errors > 0 && (
                    <span className="text-red-400 ml-2">({embeddingStats.errors} errors)</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleReprocessAll}
              disabled={isReprocessing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-400 transition-colors disabled:opacity-50"
            >
              {isReprocessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{reprocessProgress || 'Processing...'}</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Index All Documents</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {embeddingStats && !showEmbeddingBanner && embeddingStats.totalDocuments > 0 && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-gradient-to-r from-green-900/30 to-emerald-800/20 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-white font-medium">All documents indexed for AI search</p>
              <p className="text-gray-400 text-sm">
                {embeddingStats.withEmbeddings} of {embeddingStats.totalDocuments} documents ready for the assistant
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'archive' ? (
          !hasSchemes && !hasDocuments && !isLoading ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Schemes Found</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                No schemes have been created for your organisation yet. Create a scheme to start uploading documents.
              </p>
            </div>
          ) : !hasDocuments && !isLoading ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <FolderArchive className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Documents Yet</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                Upload your first documents to get started with the Smart Archive.
              </p>
            </div>
          ) : (
            <DisciplineGrid 
              disciplines={disciplines} 
              customFolders={customFolders}
              isLoading={isLoading}
              showNewFolderButton={!isViewingAllSchemes}
              onCreateFolder={handleCreateFolder}
              onEditFolder={handleEditFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          )
        ) : activeTab === 'important' ? (
          <ImportantDocsTab onRefresh={handleRefresh} />
        ) : (
          <InsightsTab />
        )}
      </div>

      {tenantId && uploadSchemeId && (
        <UploadModal
          isOpen={showUploadModal}
          onClose={handleUploadModalClose}
          onUploadComplete={handleUploadComplete}
          tenantId={tenantId}
          developmentId={uploadSchemeId}
          houseTypes={houseTypes}
        />
      )}

      {tenantId && (
        <SchemeSelectionModal
          isOpen={showSchemeSelectionModal}
          onClose={() => setShowSchemeSelectionModal(false)}
          onSchemeSelected={handleSchemeSelected}
          developments={developments}
          title="Choose Scheme for Upload"
          description="Select which scheme to upload documents into"
        />
      )}

      {tenantId && developmentId && (
        <CreateFolderModal
          isOpen={showCreateFolderModal}
          onClose={() => {
            setShowCreateFolderModal(false);
            setEditingFolder(null);
          }}
          onFolderCreated={handleFolderCreated}
          tenantId={tenantId}
          developmentId={developmentId}
          discipline="__root__"
          editFolder={editingFolder ? {
            id: editingFolder.id,
            name: editingFolder.name,
            color: editingFolder.color,
          } : undefined}
        />
      )}
    </div>
  );
}
