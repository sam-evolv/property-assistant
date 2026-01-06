'use client';

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { FileText, Download, Folder, File, FileImage, FileSpreadsheet, Search, Home, Wrench, Shield, Truck, AlertTriangle, MapPin, FileCheck, Flame, RefreshCw, Loader2 } from 'lucide-react';
import SessionExpiredModal from './SessionExpiredModal';

const PURCHASER_VIDEOS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_VIDEOS_PURCHASER === 'true' || process.env.NEXT_PUBLIC_FEATURE_VIDEOS === 'true';
const LazyPurchaserVideosSection = lazy(() => import('./PurchaserVideosSection'));
import { 
  getCachedDocuments, 
  setCachedDocuments, 
  invalidateDocumentCache,
  getInFlightRequest,
  setInFlightRequest
} from '../../lib/documentCache';

interface Document {
  id: string;
  title: string;
  file_url?: string;
  file_type?: string;
  created_at: string;
  metadata?: any;
  is_house_specific?: boolean;
  is_important?: boolean;
  important_rank?: number | null;
  must_read?: boolean;
  source?: 'drizzle' | 'supabase';
}

interface DocsApiResponse {
  documents: Document[];
  requestId?: string;
  message?: string;
  error?: string;
}

interface PurchaserDocumentsTabProps {
  unitUid: string;
  houseType: string;
  isDarkMode: boolean;
  selectedLanguage: string;
}

interface CategoryInfo {
  id: string;
  label: string;
  icon: React.ReactNode;
  keywords: string[];
}

const CATEGORIES: CategoryInfo[] = [
  { id: 'all', label: 'All', icon: <Folder className="w-5 h-5" />, keywords: [] },
  { id: 'mustread', label: 'Must Read', icon: <AlertTriangle className="w-5 h-5" />, keywords: [] },
  { id: 'important', label: 'Important', icon: <AlertTriangle className="w-5 h-5" />, keywords: [] },
  { id: 'floorplans', label: 'Floorplans', icon: <FileImage className="w-5 h-5" />, keywords: [] },
  { id: 'fire', label: 'Fire Safety', icon: <Flame className="w-5 h-5" />, keywords: [] },
  { id: 'parking', label: 'Parking', icon: <MapPin className="w-5 h-5" />, keywords: [] },
  { id: 'handover', label: 'Handover', icon: <FileCheck className="w-5 h-5" />, keywords: [] },
  { id: 'snagging', label: 'Snagging', icon: <Wrench className="w-5 h-5" />, keywords: [] },
  { id: 'warranties', label: 'Warranties', icon: <Shield className="w-5 h-5" />, keywords: [] },
  { id: 'specifications', label: 'Specifications', icon: <FileText className="w-5 h-5" />, keywords: [] },
  { id: 'general', label: 'General', icon: <File className="w-5 h-5" />, keywords: [] },
];

export default function PurchaserDocumentsTab({
  unitUid,
  houseType,
  isDarkMode,
  selectedLanguage,
}: PurchaserDocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sessionExpired, setSessionExpired] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const doFetch = useCallback(async (token: string, signal: AbortSignal): Promise<{ docs: Document[]; requestId?: string; message?: string }> => {
    const res = await fetch(
      `/api/purchaser/docs-list?unitUid=${unitUid}&token=${encodeURIComponent(token)}`,
      { signal }
    );

    if (res.status === 401) {
      invalidateDocumentCache(unitUid);
      throw new Error('SESSION_EXPIRED');
    }

    const data: DocsApiResponse = await res.json().catch(() => ({ documents: [], error: 'Unknown error' }));

    if (!res.ok) {
      const errorMsg = data.error || `Failed to load documents (${res.status})`;
      const err = new Error(errorMsg);
      (err as any).requestId = data.requestId;
      throw err;
    }

    const docs = data.documents || [];
    setCachedDocuments(unitUid, token, docs);
    return { docs, requestId: data.requestId, message: data.message };
  }, [unitUid]);

  const fetchDocuments = useCallback(async (forceRefresh = false) => {
    const storedToken = sessionStorage.getItem(`house_token_${unitUid}`);
    const token = storedToken || unitUid;
    
    const { data: cached, isStale } = getCachedDocuments<Document[]>(unitUid, token);
    
    if (!forceRefresh && cached) {
      setDocuments(cached);
      setLoading(false);
      
      if (isStale && !getInFlightRequest<{ docs: Document[]; requestId?: string; message?: string }>(unitUid, token)) {
        const controller = new AbortController();
        const promise = doFetch(token, controller.signal)
          .then(result => {
            setDocuments(result.docs);
            if (result.requestId) setRequestId(result.requestId);
            if (result.message) setEmptyMessage(result.message);
            return result;
          })
          .catch(err => {
            if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
              setSessionExpired(true);
            }
            throw err;
          });
        setInFlightRequest(unitUid, token, promise, () => controller.abort());
      }
      return;
    }
    
    const existingRequest = getInFlightRequest<{ docs: Document[]; requestId?: string; message?: string }>(unitUid, token);
    if (!forceRefresh && existingRequest) {
      setLoading(true);
      try {
        const result = await existingRequest;
        setDocuments(result.docs);
        if (result.requestId) setRequestId(result.requestId);
        if (result.message) setEmptyMessage(result.message);
      } catch (err) {
        if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
          setSessionExpired(true);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setRequestId(null);
    setEmptyMessage(null);
    setSessionExpired(false);

    const promise = doFetch(token, controller.signal);
    setInFlightRequest(unitUid, token, promise, () => controller.abort());

    try {
      const result = await promise;
      setDocuments(result.docs);
      if (result.requestId) setRequestId(result.requestId);
      if (result.message) setEmptyMessage(result.message);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') return;
        if (err.message === 'SESSION_EXPIRED') {
          setSessionExpired(true);
          return;
        }
        setError(err.message);
        if ((err as any).requestId) setRequestId((err as any).requestId);
      } else {
        setError('Failed to connect to server');
      }
    } finally {
      setLoading(false);
    }
  }, [unitUid, doFetch]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      fetchDocuments();
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [unitUid, houseType]);

  const handleDownload = async (doc: Document) => {
    try {
      // For Supabase documents with direct file_url, open in new tab
      if (doc.source === 'supabase' && doc.file_url) {
        window.open(doc.file_url, '_blank');
        return;
      }
      
      // For Drizzle documents, use the download API
      const storedToken = sessionStorage.getItem(`house_token_${unitUid}`);
      const token = storedToken || unitUid;

      const downloadUrl = `/api/purchaser/docs-list/download?unitUid=${unitUid}&token=${encodeURIComponent(token)}&docId=${doc.id}`;
      
      // First check if the download will succeed
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        // Try to get error details
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        const errorMessage = errorData.details || errorData.error || 'Failed to download document';
        alert(errorMessage);
        return;
      }
      
      // If successful, download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download document:', error);
      alert('Failed to download document. Please try again or contact your development administrator.');
    }
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <File className="w-5 h-5 text-gray-500" />;
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-gold-600" />;
    if (fileType.includes('doc') || fileType.includes('word')) 
      return <FileText className="w-5 h-5 text-gold-500" />;
    if (fileType.includes('image') || fileType.includes('jpg') || fileType.includes('png')) 
      return <FileImage className="w-5 h-5 text-gray-600" />;
    if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv')) 
      return <FileSpreadsheet className="w-5 h-5 text-gray-700" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const filterDocuments = () => {
    let filtered = documents;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory === 'mustread') {
      filtered = filtered.filter(doc => doc.must_read);
    } else if (selectedCategory === 'important') {
      filtered = filtered.filter(doc => doc.is_important);
    } else if (selectedCategory !== 'all') {
      filtered = filtered.filter(doc => {
        const docCategory = doc.metadata?.category?.toLowerCase() || 'general';
        const categoryLabel = CATEGORIES.find(c => c.id === selectedCategory)?.label.toLowerCase() || '';
        return docCategory === categoryLabel;
      });
    }

    // Sort: must_read first, then is_important, then by created_at (newest first)
    filtered = [...filtered].sort((a, b) => {
      // Must read documents first
      if (a.must_read && !b.must_read) return -1;
      if (!a.must_read && b.must_read) return 1;
      
      // Then important documents
      if (a.is_important && !b.is_important) return -1;
      if (!a.is_important && b.is_important) return 1;
      
      // Then by created_at (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return filtered;
  };

  const filteredDocs = filterDocuments();

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300';

  if (sessionExpired) {
    return (
      <div className={`flex flex-col h-full ${bgColor}`}>
        <SessionExpiredModal
          isOpen={true}
          isDarkMode={isDarkMode}
          selectedLanguage={selectedLanguage}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${bgColor}`}>
        <div className={`animate-pulse ${subtextColor}`}>Loading documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-full ${bgColor} p-6`}>
        <div className="p-4 bg-red-100 rounded-full mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
          Unable to Load Documents
        </h3>
        <p className={`${subtextColor} text-sm text-center mb-4 max-w-md`}>
          {error || 'Unable to retrieve your documents. Please try again.'}
        </p>
        {requestId && (
          <p className={`text-xs ${subtextColor} mb-4`}>
            Request ID: {requestId}
          </p>
        )}
        <button
          onClick={() => fetchDocuments(true)}
          className="px-4 py-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-lg hover:from-gold-600 hover:to-gold-700 transition-all font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Get document counts per category
  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return documents.length;
    if (categoryId === 'mustread') return documents.filter(doc => doc.must_read).length;
    if (categoryId === 'important') return documents.filter(doc => doc.is_important).length;
    
    const categoryLabel = CATEGORIES.find(c => c.id === categoryId)?.label.toLowerCase() || '';
    return documents.filter(doc => {
      const docCategory = doc.metadata?.category?.toLowerCase() || 'general';
      return docCategory === categoryLabel;
    }).length;
  };

  return (
    <div className={`flex flex-col h-full ${bgColor}`}>
      {/* Search Bar */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3`}>
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 ${inputBg} border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 ${isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3 overflow-x-auto`}>
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map(cat => {
            const count = getCategoryCount(cat.id);
            const isMustRead = cat.id === 'mustread';
            const isImportant = cat.id === 'important';
            
            let buttonStyle = '';
            if (selectedCategory === cat.id) {
              buttonStyle = isMustRead 
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md'
                : 'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-md';
            } else if (isMustRead) {
              buttonStyle = isDarkMode
                ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30 border border-red-500/30'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200';
            } else if (isImportant) {
              buttonStyle = isDarkMode
                ? 'bg-gold-900/20 text-gold-400 hover:bg-gold-900/30 border border-gold-500/30'
                : 'bg-gold-50 text-gold-700 hover:bg-gold-100 border border-gold-200';
            } else {
              buttonStyle = isDarkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
            }
            
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${buttonStyle}`}
              >
                {cat.icon}
                <span>{cat.label}</span>
                {count > 0 && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${selectedCategory === cat.id ? 'bg-white/20' : (isDarkMode ? 'bg-gray-600' : 'bg-gray-200')}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Videos Section */}
      {PURCHASER_VIDEOS_ENABLED && (
        <div className="px-4 pt-4">
          <Suspense fallback={<div className="flex items-center gap-2 p-4"><Loader2 className="w-4 h-4 animate-spin text-gold-500" /><span className="text-sm text-grey-400">Loading videos...</span></div>}>
            <LazyPurchaserVideosSection unitUid={unitUid} isDarkMode={isDarkMode} />
          </Suspense>
        </div>
      )}

      {/* Documents Grid */}
      {filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="p-4 bg-gradient-to-br from-gold-100 to-gold-200 rounded-full mb-4">
            <Folder className="w-8 h-8 text-gold-700" />
          </div>
          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
            {searchQuery || selectedCategory !== 'all' ? 'No Matching Documents' : 'No Documents Yet'}
          </h3>
          <p className={`${subtextColor} max-w-md text-sm`}>
            {searchQuery || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filter criteria.' 
              : emptyMessage || 'No documents available for this unit yet.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => {
              const hasBadge = doc.must_read || doc.is_important;
              const cardStyle = doc.must_read 
                ? (isDarkMode ? 'bg-red-900/10 border-red-500/30' : 'bg-red-50 border-red-200')
                : doc.is_important 
                  ? (isDarkMode ? 'bg-gold-900/10 border-gold-500/30' : 'bg-gold-50 border-gold-200')
                  : cardBg;
              const iconBg = doc.must_read
                ? 'bg-gradient-to-br from-red-200 to-red-300'
                : doc.is_important 
                  ? 'bg-gradient-to-br from-gold-200 to-gold-300' 
                  : 'bg-gradient-to-br from-gold-100 to-gold-200';
              
              return (
                <div
                  key={doc.id}
                  className={`${cardStyle} border rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group relative`}
                  onClick={() => handleDownload(doc)}
                >
                  {hasBadge && (
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {doc.must_read && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white shadow-sm">
                          MUST READ
                        </span>
                      )}
                      {doc.is_important && !doc.must_read && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gold-500 text-white shadow-sm">
                          IMPORTANT
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 ${iconBg} rounded-lg flex-shrink-0`}>
                      {getFileIcon(doc.file_type)}
                    </div>
                    <div className="flex-1 min-w-0 pr-20">
                      <h3 className={`text-sm font-semibold ${textColor} line-clamp-2 group-hover:text-gold-600 transition-colors`}>
                        {doc.title}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(doc);
                      }}
                      className="p-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-white hover:from-gold-600 hover:to-gold-700 transition-all"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
