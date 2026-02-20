'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { FolderArchive, Plus, RefreshCw, Search, BarChart3, Sparkles, Loader2, Database, Zap, Star, AlertCircle, Video, AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import Link from 'next/link';
import { DisciplineGrid, UploadModal, DevelopmentSelector, SchemeSelectionModal } from '@/components/archive';
import { InsightsTab } from '@/components/archive/InsightsTab';
import { ImportantDocsTab } from '@/components/archive/ImportantDocsTab';
import { CreateFolderModal } from '@/components/archive/CreateFolderModal';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { isAllSchemes, getSchemeId, createSchemeScope, createAllSchemesScope, scopeToString } from '@/lib/archive-scope';
import type { DisciplineSummary } from '@/lib/archive-constants';
import type { CustomDisciplineFolder } from '@/components/archive/DisciplineGrid';

const LazyVideosTab = lazy(() => import('@/components/archive/VideosTab').then(m => ({ default: m.VideosTab })));
const VIDEOS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_VIDEOS === 'true';

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

type TabType = 'archive' | 'important' | 'insights' | 'gaps' | 'videos';

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
  const [knowledgeGaps, setKnowledgeGaps] = useState<any[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);

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

  const loadKnowledgeGaps = useCallback(async () => {
    if (!tenantId) return;
    setGapsLoading(true);
    try {
      const schemeId = developmentId || '';
      const url = schemeId
        ? `/api/archive/knowledge-gaps?schemeId=${schemeId}&tenantId=${tenantId}`
        : `/api/archive/knowledge-gaps?tenantId=${tenantId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setKnowledgeGaps(data.gaps || []);
      }
    } catch (e) {
      console.error('[Gaps] Failed:', e);
    } finally {
      setGapsLoading(false);
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

  useEffect(() => {
    if (activeTab === 'gaps') {
      loadKnowledgeGaps();
    }
  }, [activeTab, loadKnowledgeGaps]);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.discipline) {
        // Pre-select discipline in upload modal (stored for future use)
      }
      setShowUploadModal(true);
    };
    window.addEventListener('archive:open-upload', handler as EventListener);
    return () => window.removeEventListener('archive:open-upload', handler as EventListener);
  }, []);

  const handleUploadClick = () => {
    if (isViewingAllSchemes) {
      if (developments.length === 0) {
        alert('No schemes available. Please create a scheme first.');
        return;
      }
      setShowSchemeSelectionModal(true);
    } else if (!developmentId) {
      alert('Select a scheme before uploading documents.');
      return;
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
  const hasDocuments = totalDocuments > 0;
  const uploadSchemeId = selectedUploadSchemeId || developmentId;
  
  console.log('[Archive] Render state:', { 
    documents: totalDocuments, 
    scope: scopeToString(archiveScope),
    isLoading
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center">
                <FolderArchive className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Smart Archive</h1>
                <p className="text-gray-500 mt-0.5">
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
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-colors"
              >
                <Search className="w-5 h-5" />
                <span>Search</span>
              </Link>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors disabled:opacity-50"
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
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              <span>Documents</span>
            </button>
            <button
              onClick={() => setActiveTab('important')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'important'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Star className="w-4 h-4" />
              <span>Must-Read</span>
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'insights'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Insights</span>
            </button>
            <button
              onClick={() => setActiveTab('gaps')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'gaps'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Knowledge Gaps</span>
              {knowledgeGaps.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  {knowledgeGaps.length}
                </span>
              )}
            </button>
            {VIDEOS_ENABLED && (
              <button
                onClick={() => setActiveTab('videos')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'videos'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Videos</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isViewingAllSchemes && (hasDocuments || isLoading) && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <FolderArchive className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-gray-900 font-medium">Viewing All Schemes</p>
              <p className="text-gray-500 text-sm">
                {totalDocuments} documents across all schemes are shown below
              </p>
            </div>
          </div>
        </div>
      )}

      {showClassifyBanner && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-gray-900 font-medium">
                    {unclassifiedCount} document{unclassifiedCount !== 1 ? 's' : ''} need{unclassifiedCount === 1 ? 's' : ''} classification
                  </p>
                  <p className="text-gray-500 text-sm">
                    Use AI to automatically organise documents into disciplines
                  </p>
                </div>
              </div>
              <button
                onClick={handleBulkClassify}
                disabled={isClassifying}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
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
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Classification progress</span>
                <span>{totalDocuments - unclassifiedCount} / {totalDocuments} classified</span>
              </div>
              <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                  style={{ width: totalDocuments > 0 ? `${((totalDocuments - unclassifiedCount) / totalDocuments) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmbeddingBanner && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-gray-900 font-medium">
                  {embeddingStats.withoutEmbeddings} document{embeddingStats.withoutEmbeddings !== 1 ? 's' : ''} not indexed for AI search
                </p>
                <p className="text-gray-500 text-sm">
                  Indexed: {embeddingStats.withEmbeddings} of {embeddingStats.totalDocuments} documents
                  {embeddingStats.errors > 0 && (
                    <span className="text-red-500 ml-2">({embeddingStats.errors} errors)</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleReprocessAll}
              disabled={isReprocessing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
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
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Database className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-gray-900 font-medium">All documents indexed for AI search</p>
              <p className="text-gray-500 text-sm">
                {embeddingStats.withEmbeddings} of {embeddingStats.totalDocuments} documents ready for the assistant
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'archive' ? (
          <>
            {console.assert(disciplines !== undefined, 'Smart Archive rendered without documents')}
            {!hasDocuments && !isLoading && !isViewingAllSchemes && (
              <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-3">
                <FolderArchive className="w-5 h-5 text-gray-400" />
                <p className="text-gray-500 text-sm">
                  No documents uploaded yet for this scheme. Upload documents to populate the categories below.
                </p>
              </div>
            )}
            <DisciplineGrid 
              disciplines={disciplines} 
              customFolders={customFolders}
              isLoading={isLoading}
              showNewFolderButton={!isViewingAllSchemes}
              onCreateFolder={handleCreateFolder}
              onEditFolder={handleEditFolder}
              onDeleteFolder={handleDeleteFolder}
              alwaysShowCategories={true}
            />
          </>
        ) : activeTab === 'important' ? (
          <ImportantDocsTab onRefresh={handleRefresh} />
        ) : activeTab === 'videos' && VIDEOS_ENABLED ? (
          <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-gold-500 animate-spin" /></div>}>
            <LazyVideosTab />
          </Suspense>
        ) : activeTab === 'gaps' ? (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Knowledge Gaps</h2>
              <p className="text-sm text-gray-500 mt-1">
                Questions homeowners asked that the AI couldn't answer from your documents. Upload content to fill these gaps.
              </p>
            </div>

            {gapsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : knowledgeGaps.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">No knowledge gaps detected</p>
                <p className="text-xs text-gray-500 mt-1">Your AI assistant is answering all questions from documents</p>
              </div>
            ) : (
              <div className="space-y-3">
                {knowledgeGaps.map((gap, i) => (
                  <div key={i} className="bg-white border border-red-100 rounded-2xl p-4 flex items-start justify-between gap-4 hover:border-red-200 transition-colors">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">"{gap.user_question}"</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">
                            Asked <span className="font-semibold text-red-600">{gap.count}×</span>
                          </span>
                          {gap.intent_type && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{gap.intent_type}</span>
                          )}
                          {gap.last_asked && (
                            <span className="text-xs text-gray-400">
                              Last: {new Date(gap.last_asked).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('archive');
                        setShowUploadModal(true);
                      }}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-white rounded-xl transition-all hover:opacity-90 flex items-center gap-1.5"
                      style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #b8962e 100%)' }}
                    >
                      <Upload className="w-3 h-3" />
                      Upload Fix
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
