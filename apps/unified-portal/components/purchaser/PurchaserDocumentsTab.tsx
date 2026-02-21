'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FileText, Download, Folder, File, FileImage, FileSpreadsheet, Search, Wrench, Shield, AlertTriangle, MapPin, FileCheck, Flame, Video, Play, X, ExternalLink, Loader2 } from 'lucide-react';
import SessionExpiredModal from './SessionExpiredModal';
import {
  getCachedDocuments,
  setCachedDocuments,
  invalidateDocumentCache,
  getInFlightRequest,
  setInFlightRequest
} from '../../lib/documentCache';
import { getTranslations } from '../../lib/translations';
import { getEffectiveToken } from '../../lib/purchaserSession';

const PURCHASER_VIDEOS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_VIDEOS_PURCHASER === 'true' || process.env.NEXT_PUBLIC_FEATURE_VIDEOS === 'true';

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

interface VideoResource {
  id: string;
  title: string;
  description?: string;
  provider: string;
  embed_url: string;
  thumbnail_url?: string;
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
  token?: string;
}

interface CategoryInfo {
  id: string;
  label: string;
  icon: React.ReactNode;
  keywords: string[];
  isVideo?: boolean;
}

// Category icons defined separately for use in dynamic categories
const CATEGORY_ICONS = {
  all: <Folder className="w-5 h-5" />,
  mustread: <AlertTriangle className="w-5 h-5" />,
  important: <AlertTriangle className="w-5 h-5" />,
  floorplans: <FileImage className="w-5 h-5" />,
  fire: <Flame className="w-5 h-5" />,
  parking: <MapPin className="w-5 h-5" />,
  handover: <FileCheck className="w-5 h-5" />,
  snagging: <Wrench className="w-5 h-5" />,
  warranties: <Shield className="w-5 h-5" />,
  specifications: <FileText className="w-5 h-5" />,
  general: <File className="w-5 h-5" />,
  videos: <Video className="w-5 h-5" />,
};

// Function to get translated categories
const getTranslatedCategories = (docTranslations: any): CategoryInfo[] => [
  { id: 'all', label: docTranslations.categories.all, icon: CATEGORY_ICONS.all, keywords: [] },
  { id: 'mustread', label: docTranslations.categories.mustRead, icon: CATEGORY_ICONS.mustread, keywords: [] },
  { id: 'important', label: docTranslations.categories.important, icon: CATEGORY_ICONS.important, keywords: [] },
  { id: 'floorplans', label: docTranslations.categories.floorplans, icon: CATEGORY_ICONS.floorplans, keywords: [] },
  { id: 'fire', label: docTranslations.categories.fireSafety, icon: CATEGORY_ICONS.fire, keywords: [] },
  { id: 'parking', label: docTranslations.categories.parking, icon: CATEGORY_ICONS.parking, keywords: [] },
  { id: 'handover', label: docTranslations.categories.handover, icon: CATEGORY_ICONS.handover, keywords: [] },
  { id: 'snagging', label: docTranslations.categories.snagging, icon: CATEGORY_ICONS.snagging, keywords: [] },
  { id: 'warranties', label: docTranslations.categories.warranties, icon: CATEGORY_ICONS.warranties, keywords: [] },
  { id: 'specifications', label: docTranslations.categories.specifications, icon: CATEGORY_ICONS.specifications, keywords: [] },
  { id: 'general', label: docTranslations.categories.general, icon: CATEGORY_ICONS.general, keywords: [] },
];

const getVideosCategory = (docTranslations: any): CategoryInfo => ({
  id: 'videos',
  label: docTranslations.categories.videos,
  icon: CATEGORY_ICONS.videos,
  keywords: [],
  isVideo: true
});

export default function PurchaserDocumentsTab({
  unitUid,
  houseType,
  isDarkMode,
  selectedLanguage,
  token: propToken,
}: PurchaserDocumentsTabProps) {
  // Get translations based on selected language
  const t = useMemo(() => getTranslations(selectedLanguage), [selectedLanguage]);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sessionExpired, setSessionExpired] = useState(false);
  
  const [debugInfo, setDebugInfo] = useState<{
    propToken: string;
    propTokenType: string;
    storageToken: string;
    sessionToken: string;
    cookieToken: string;
    inMemoryToken: string;
    effectiveToken: string;
    timestamp: string;
    apiStatus?: number;
    apiOk?: boolean;
    apiError?: string;
    apiUrl?: string;
  } | null>(null);
  
  useEffect(() => {
    let storageToken = 'NULL';
    let sessionToken = 'NULL';
    let cookieToken = 'NULL';
    
    try {
      storageToken = localStorage.getItem(`house_token_${unitUid}`) || 'NULL';
    } catch (e: any) {
      storageToken = 'ERROR: ' + e.message;
    }
    
    try {
      sessionToken = sessionStorage.getItem(`house_token_${unitUid}`) || 'NULL';
    } catch (e: any) {
      sessionToken = 'ERROR: ' + e.message;
    }
    
    try {
      const match = document.cookie.split('; ').find(c => c.startsWith(`house_token_${unitUid}=`));
      cookieToken = match ? decodeURIComponent(match.split('=')[1]) : 'NULL';
    } catch (e: any) {
      cookieToken = 'ERROR: ' + e.message;
    }
    
    const effectiveToken = propToken || getEffectiveToken(unitUid);
    
    setDebugInfo({
      propToken: propToken ? `${propToken.substring(0, 12)}...` : 'NULL',
      propTokenType: typeof propToken,
      storageToken: storageToken !== 'NULL' ? `${storageToken.substring(0, 12)}...` : 'NULL',
      sessionToken: sessionToken !== 'NULL' ? `${sessionToken.substring(0, 12)}...` : 'NULL',
      cookieToken: cookieToken !== 'NULL' ? `${cookieToken.substring(0, 12)}...` : 'NULL',
      inMemoryToken: 'check getEffectiveToken',
      effectiveToken: effectiveToken ? `${effectiveToken.substring(0, 12)}...` : 'NULL',
      timestamp: new Date().toLocaleTimeString()
    });
  }, [propToken, unitUid]);
  
  const [videos, setVideos] = useState<VideoResource[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosFetched, setVideosFetched] = useState(false);
  const [hasVideos, setHasVideos] = useState(false);
  const [videosCountFetched, setVideosCountFetched] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<VideoResource | null>(null);
  const [embedError, setEmbedError] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const doFetch = useCallback(async (token: string, signal: AbortSignal): Promise<{ docs: Document[]; requestId?: string; message?: string }> => {
    const apiUrl = `/api/purchaser/docs-list?unitUid=${unitUid}&token=${encodeURIComponent(token)}`;
    const res = await fetch(apiUrl, { signal });
    
    setDebugInfo(prev => prev ? {
      ...prev,
      apiStatus: res.status,
      apiOk: res.ok,
      apiUrl: apiUrl.substring(0, 50) + '...'
    } : null);

    if (res.status === 401) {
      const errorText = await res.text().catch(() => 'Could not read error');
      setDebugInfo(prev => prev ? { ...prev, apiError: `401: ${errorText.substring(0, 100)}` } : null);
      invalidateDocumentCache(unitUid);
      throw new Error('SESSION_EXPIRED');
    }

    const data: DocsApiResponse = await res.json().catch(() => ({ documents: [], error: 'Unknown error' }));

    if (!res.ok) {
      const errorMsg = data.error || `Failed to load documents (${res.status})`;
      setDebugInfo(prev => prev ? { ...prev, apiError: `${res.status}: ${errorMsg}` } : null);
      const err = new Error(errorMsg);
      (err as any).requestId = data.requestId;
      throw err;
    }

    const docs = data.documents || [];
    setCachedDocuments(unitUid, token, docs);
    return { docs, requestId: data.requestId, message: data.message };
  }, [unitUid]);

  const fetchDocuments = useCallback(async (forceRefresh = false) => {
    const token = propToken || getEffectiveToken(unitUid);
    
    console.log('[DocsTab] fetchDocuments called', {
      propToken: propToken ? `${propToken.substring(0, 8)}...` : 'undefined',
      effectiveToken: token ? `${token.substring(0, 8)}...` : 'undefined',
      unitUid,
      forceRefresh,
      tokenSource: propToken ? 'prop' : 'storage',
      isAccessCode: /^[A-Z]{2}-\d{3}-[A-Z0-9]{4}$/.test(token || ''),
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || ''),
    });
    
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
  }, [unitUid, doFetch, propToken]);

  const doVideosCountFetch = useCallback(async (currentUnitUid: string) => {
    if (!PURCHASER_VIDEOS_ENABLED) return;
    
    try {
      const token = propToken || getEffectiveToken(currentUnitUid);

      const res = await fetch(
        `/api/purchaser/videos/count?unitUid=${currentUnitUid}&token=${encodeURIComponent(token)}`
      );

      if (res.ok) {
        const data = await res.json();
        setHasVideos(data.hasVideos === true);
      } else {
        setHasVideos(false);
      }
    } catch (err) {
      console.error('[PurchaserDocumentsTab] Videos count fetch error:', err);
      setHasVideos(false);
    } finally {
      setVideosCountFetched(true);
    }
  }, [propToken]);

  const doVideosFetch = useCallback(async (currentUnitUid: string) => {
    if (!PURCHASER_VIDEOS_ENABLED || videosFetched) return;
    
    setVideosLoading(true);
    try {
      const token = propToken || getEffectiveToken(currentUnitUid);

      const res = await fetch(
        `/api/purchaser/videos?unitUid=${currentUnitUid}&token=${encodeURIComponent(token)}`
      );

      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      } else {
        setVideos([]);
      }
    } catch (err) {
      console.error('[PurchaserDocumentsTab] Videos fetch error:', err);
      setVideos([]);
    } finally {
      setVideosLoading(false);
      setVideosFetched(true);
    }
  }, [videosFetched, propToken]);

  useEffect(() => {
    setVideos([]);
    setVideosFetched(false);
    setVideosLoading(false);
    setHasVideos(false);
    setVideosCountFetched(false);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    const currentUnitUid = unitUid;
    
    debounceTimerRef.current = setTimeout(async () => {
      await fetchDocuments();
      if (PURCHASER_VIDEOS_ENABLED) {
        doVideosCountFetch(currentUnitUid);
      }
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [unitUid, houseType, fetchDocuments, doVideosCountFetch]);

  useEffect(() => {
    if (selectedCategory === 'videos' && hasVideos && !videosFetched && !videosLoading) {
      doVideosFetch(unitUid);
    }
  }, [selectedCategory, hasVideos, videosFetched, videosLoading, doVideosFetch, unitUid]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && playingVideo) {
        setPlayingVideo(null);
        setEmbedError(false);
      }
    };

    if (playingVideo) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [playingVideo]);

  const handleDownload = async (doc: Document) => {
    try {
      if (doc.source === 'supabase' && doc.file_url) {
        window.open(doc.file_url, '_blank');
        return;
      }
      
      const token = propToken || getEffectiveToken(unitUid);

      const downloadUrl = `/api/purchaser/docs-list/download?unitUid=${unitUid}&token=${encodeURIComponent(token)}&docId=${doc.id}`;
      
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        const errorMessage = errorData.details || errorData.error || 'Failed to download document';
        alert(errorMessage);
        return;
      }
      
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

  const getProviderBadge = (provider: string) => {
    const p = provider.toLowerCase();
    if (p === 'youtube') return { label: 'YouTube', color: 'bg-red-600' };
    if (p === 'vimeo') return { label: 'Vimeo', color: 'bg-blue-500' };
    return { label: provider, color: 'bg-gray-600' };
  };

  const getOriginalUrl = (video: VideoResource) => {
    const embedUrl = video.embed_url;
    if (embedUrl.includes('youtube.com/embed/')) {
      const videoId = embedUrl.split('/embed/')[1]?.split('?')[0];
      return `https://www.youtube.com/watch?v=${videoId}`;
    } else if (embedUrl.includes('player.vimeo.com/video/')) {
      const videoId = embedUrl.split('/video/')[1]?.split('?')[0];
      return `https://vimeo.com/${videoId}`;
    }
    return embedUrl;
  };

  const filterDocuments = () => {
    let filtered = documents;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(query)
      );
    }

    // Map category IDs to English labels for filtering (document metadata uses English)
    const categoryIdToEnglish: Record<string, string> = {
      floorplans: 'floorplans',
      fire: 'fire safety',
      parking: 'parking',
      handover: 'handover',
      snagging: 'snagging',
      warranties: 'warranties',
      specifications: 'specifications',
      general: 'general',
    };

    if (selectedCategory === 'mustread') {
      filtered = filtered.filter(doc => doc.must_read);
    } else if (selectedCategory === 'important') {
      filtered = filtered.filter(doc => doc.is_important);
    } else if (selectedCategory !== 'all' && selectedCategory !== 'videos') {
      filtered = filtered.filter(doc => {
        const docCategory = doc.metadata?.category?.toLowerCase() || 'general';
        const categoryLabel = categoryIdToEnglish[selectedCategory] || '';
        return docCategory === categoryLabel;
      });
    }

    filtered = [...filtered].sort((a, b) => {
      if (a.must_read && !b.must_read) return -1;
      if (!a.must_read && b.must_read) return 1;
      if (a.is_important && !b.is_important) return -1;
      if (!a.is_important && b.is_important) return 1;
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

  // Get translated categories based on current language
  const baseCategories = useMemo(() => getTranslatedCategories(t.documents), [t.documents]);
  const videosCategory = useMemo(() => getVideosCategory(t.documents), [t.documents]);

  const categories = PURCHASER_VIDEOS_ENABLED && hasVideos
    ? [...baseCategories.slice(0, 3), videosCategory, ...baseCategories.slice(3)]
    : baseCategories;

  // Map category IDs to English labels for filtering (document metadata uses English)
  const CATEGORY_ID_TO_ENGLISH: Record<string, string> = {
    all: 'all',
    mustread: 'must read',
    important: 'important',
    floorplans: 'floorplans',
    fire: 'fire safety',
    parking: 'parking',
    handover: 'handover',
    snagging: 'snagging',
    warranties: 'warranties',
    specifications: 'specifications',
    general: 'general',
    videos: 'videos',
  };

  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'videos') return videos.length;
    if (categoryId === 'all') return documents.length;
    if (categoryId === 'mustread') return documents.filter(doc => doc.must_read).length;
    if (categoryId === 'important') return documents.filter(doc => doc.is_important).length;

    const categoryLabel = CATEGORY_ID_TO_ENGLISH[categoryId] || '';
    return documents.filter(doc => {
      const docCategory = doc.metadata?.category?.toLowerCase() || 'general';
      return docCategory === categoryLabel;
    }).length;
  };

  if (sessionExpired) {
    return (
      <div className={`flex flex-col h-full ${bgColor} p-4`}>
        <div style={{ 
          padding: 20, 
          backgroundColor: '#1a1a2e', 
          color: 'white',
          margin: 10,
          borderRadius: 10,
          fontSize: 14
        }}>
          <h3 style={{ color: '#D4AF37', marginBottom: 12 }}>DEBUG: Session Expired - API Response</h3>
          <p><strong>propToken:</strong> {debugInfo?.propToken || 'loading...'}</p>
          <p><strong>effectiveToken:</strong> {debugInfo?.effectiveToken || 'loading...'}</p>
          <p><strong>API Status:</strong> {debugInfo?.apiStatus ?? 'not called'}</p>
          <p><strong>API OK:</strong> {debugInfo?.apiOk !== undefined ? String(debugInfo.apiOk) : 'not called'}</p>
          <p style={{ color: '#ff6b6b' }}><strong>API Error:</strong> {debugInfo?.apiError || 'none'}</p>
          <p><strong>API URL:</strong> {debugInfo?.apiUrl || 'not called'}</p>
          <p><strong>Time:</strong> {debugInfo?.timestamp || 'loading...'}</p>
        </div>
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
        <div className={`animate-pulse ${subtextColor}`}>{t.documents.loadingDocuments}</div>
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
          {t.common.error}
        </h3>
        <p className={`${subtextColor} text-sm text-center mb-4 max-w-md`}>
          {error || t.documents.noDocuments}
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
          {t.common.retry}
        </button>
      </div>
    );
  }

  const isVideosTab = selectedCategory === 'videos';

  const cardBaseClasses = `${cardBg} border rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group relative`;
  const iconBgBase = 'bg-gradient-to-br from-gold-100 to-gold-200';

  return (
    <div className={`flex flex-col h-full ${bgColor}`}>
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3`}>
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t.documents.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 ${inputBg} border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 ${isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
          />
        </div>
      </div>

      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3 overflow-x-auto`}>
        <div className="flex gap-2 min-w-max">
          {categories.map(cat => {
            const count = getCategoryCount(cat.id);
            const isMustRead = cat.id === 'mustread';
            const isImportant = cat.id === 'important';
            const isVideo = cat.id === 'videos';
            
            let buttonStyle = '';
            if (selectedCategory === cat.id) {
              buttonStyle = isMustRead 
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md'
                : isVideo
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md'
                  : 'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-md';
            } else if (isMustRead) {
              buttonStyle = isDarkMode
                ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30 border border-red-500/30'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200';
            } else if (isImportant) {
              buttonStyle = isDarkMode
                ? 'bg-gold-900/20 text-gold-400 hover:bg-gold-900/30 border border-gold-500/30'
                : 'bg-gold-50 text-gold-700 hover:bg-gold-100 border border-gold-200';
            } else if (isVideo) {
              buttonStyle = isDarkMode
                ? 'bg-purple-900/20 text-purple-400 hover:bg-purple-900/30 border border-purple-500/30'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200';
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

      {isVideosTab ? (
        videosLoading ? (
          <div className={`flex items-center justify-center flex-1 ${bgColor}`}>
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-gold-500" />
              <span className={subtextColor}>{t.documents.loadingVideos}</span>
            </div>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
            <div className="p-4 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full mb-4">
              <Video className="w-8 h-8 text-purple-700" />
            </div>
            <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
              {t.documents.noVideosAvailable}
            </h3>
            <p className={`${subtextColor} max-w-md text-sm`}>
              {t.documents.noVideosDescription}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 pb-24">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos
                .filter(v => !searchQuery.trim() || v.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((video) => {
                  const badge = getProviderBadge(video.provider);
                  return (
                    <div
                      key={video.id}
                      className={cardBaseClasses}
                      onClick={() => {
                        console.log('[Videos Analytics] video_started', { videoId: video.id, provider: video.provider });
                        setPlayingVideo(video);
                        setEmbedError(false);
                      }}
                    >
                      <div className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-bold rounded ${badge.color} text-white shadow-sm`}>
                        {badge.label}
                      </div>
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`p-2 ${iconBgBase} rounded-lg flex-shrink-0 relative`}>
                          <Video className="w-5 h-5 text-gold-600" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gold-500 rounded-full flex items-center justify-center">
                            <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pr-16">
                          <h3 className={`text-sm font-semibold ${textColor} line-clamp-2 group-hover:text-gold-600 transition-colors`}>
                            {video.title}
                          </h3>
                          {video.description && (
                            <p className={`text-xs ${subtextColor} line-clamp-1 mt-1`}>
                              {video.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${subtextColor}`}>
                          {t.documents.handoverVideo}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayingVideo(video);
                            setEmbedError(false);
                          }}
                          className="p-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-white hover:from-gold-600 hover:to-gold-700 transition-all"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="p-4 bg-gradient-to-br from-gold-100 to-gold-200 rounded-full mb-4">
            <Folder className="w-8 h-8 text-gold-700" />
          </div>
          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
            {searchQuery || selectedCategory !== 'all' ? t.documents.noMatchingDocuments : t.documents.noDocuments}
          </h3>
          <p className={`${subtextColor} max-w-md text-sm`}>
            {searchQuery || selectedCategory !== 'all'
              ? t.documents.tryAdjustingFilters
              : emptyMessage || t.documents.noDocuments}
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
                  : iconBgBase;
              
              return (
                <div
                  key={doc.id}
                  className={`${cardStyle} border rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group relative`}
                  onClick={() => handleDownload(doc)}
                >
                  {hasBadge && (
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {doc.must_read && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white shadow-sm uppercase">
                          {t.documents.mustReadBadge}
                        </span>
                      )}
                      {doc.is_important && !doc.must_read && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gold-500 text-white shadow-sm uppercase">
                          {t.documents.importantBadge}
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
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
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

      {playingVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => {
            setPlayingVideo(null);
            setEmbedError(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-modal-title"
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setPlayingVideo(null);
                setEmbedError(false);
              }}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gold-500 transition-colors rounded-lg hover:bg-white/10"
              aria-label="Close video"
            >
              <X className="w-6 h-6" />
            </button>

            {!embedError ? (
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black shadow-2xl">
                <iframe
                  src={playingVideo.embed_url}
                  title={playingVideo.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  loading="eager"
                  onError={() => setEmbedError(true)}
                />
              </div>
            ) : (
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
                <Video className="w-16 h-16 text-gray-600 mb-4" />
                <p className="text-white text-lg font-medium mb-2">{t.documents.unableToLoadVideo}</p>
                <p className="text-gray-300 text-sm mb-4">{t.common.error}</p>
                <a
                  href={getOriginalUrl(playingVideo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500 text-black font-medium rounded-lg hover:bg-gold-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t.documents.openInBrowser}
                </a>
              </div>
            )}

            <div className="mt-4">
              <h3 id="video-modal-title" className="text-white text-lg font-semibold">
                {playingVideo.title}
              </h3>
              {playingVideo.description && (
                <p className="text-gray-300 text-sm mt-2 line-clamp-3">
                  {playingVideo.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-3">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getProviderBadge(playingVideo.provider).color} text-white`}>
                  {getProviderBadge(playingVideo.provider).label}
                </span>
                <a
                  href={getOriginalUrl(playingVideo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-300 hover:text-gold-500 transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in new tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
