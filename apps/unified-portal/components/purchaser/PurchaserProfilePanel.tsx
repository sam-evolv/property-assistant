'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Home, 
  MapPin, 
  Maximize2, 
  FileText, 
  Download, 
  Bed, 
  Bath, 
  Leaf,
  Building2,
  User,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Calendar,
  Flame,
  Bookmark,
  Trash2
} from 'lucide-react';
import { useHomeNotes, type HomeNote, type NoteCategory } from '@/hooks/useHomeNotes';
import { getEffectiveToken } from '../../lib/purchaserSession';

interface ProfileData {
  unit: {
    id: string;
    unit_uid: string;
    unit_code?: string;
    address: string;
    eircode?: string | null;
    house_type_code: string;
    house_type_name: string;
    bedrooms: number | null;
    bathrooms: number | null;
    floor_area_sqm: number | null;
    handover_date?: string | null;
  };
  development: {
    id: string;
    name: string;
    address?: string;
  };
  purchaser: {
    name: string;
  };
  intel: {
    ber_rating: string | null;
    rooms: any;
    suppliers: any;
    heating?: any;
    hvac?: any;
  } | null;
  specifications?: any;
  documents: {
    id: string;
    title: string;
    file_url: string;
    mime_type: string;
    category: string;
  }[];
}

interface PurchaserProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  unitUid: string;
  isDarkMode: boolean;
  token?: string;
}

const BER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'A1': { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  'A2': { bg: 'bg-emerald-400', text: 'text-white', border: 'border-emerald-500' },
  'A3': { bg: 'bg-green-500', text: 'text-white', border: 'border-green-600' },
  'B1': { bg: 'bg-lime-500', text: 'text-white', border: 'border-lime-600' },
  'B2': { bg: 'bg-lime-400', text: 'text-gray-900', border: 'border-lime-500' },
  'B3': { bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-500' },
  'C1': { bg: 'bg-yellow-500', text: 'text-gray-900', border: 'border-yellow-600' },
  'C2': { bg: 'bg-amber-400', text: 'text-gray-900', border: 'border-amber-500' },
  'C3': { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600' },
  'D1': { bg: 'bg-orange-400', text: 'text-white', border: 'border-orange-500' },
  'D2': { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' },
  'E1': { bg: 'bg-red-400', text: 'text-white', border: 'border-red-500' },
  'E2': { bg: 'bg-red-500', text: 'text-white', border: 'border-red-600' },
  'F': { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' },
  'G': { bg: 'bg-red-700', text: 'text-white', border: 'border-red-800' },
};

export default function PurchaserProfilePanel({ 
  isOpen, 
  onClose, 
  unitUid, 
  isDarkMode,
  token: propToken
}: PurchaserProfilePanelProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'home' | 'documents' | 'saved'>('home');
  
  // Home Notes — saved AI answers
  const { notes: savedNotes, deleteNote: deleteSavedNote, isLoading: notesLoading } = useHomeNotes({
    unitUid,
    enabled: isOpen,
  });

  const [debugInfo, setDebugInfo] = useState<{
    propToken: string;
    storageToken: string;
    sessionToken: string;
    cookieToken: string;
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
      storageToken: storageToken !== 'NULL' ? `${storageToken.substring(0, 12)}...` : 'NULL',
      sessionToken: sessionToken !== 'NULL' ? `${sessionToken.substring(0, 12)}...` : 'NULL',
      cookieToken: cookieToken !== 'NULL' ? `${cookieToken.substring(0, 12)}...` : 'NULL',
      effectiveToken: effectiveToken ? `${effectiveToken.substring(0, 12)}...` : 'NULL',
      timestamp: new Date().toLocaleTimeString()
    });
  }, [propToken, unitUid]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = propToken || getEffectiveToken(unitUid);
      
      console.log('[Profile] fetchProfile called', {
        propToken: propToken ? `${propToken.substring(0, 8)}...` : 'undefined',
        effectiveToken: token ? `${token.substring(0, 8)}...` : 'undefined',
        unitUid,
        tokenSource: propToken ? 'prop' : 'storage',
        isAccessCode: /^[A-Z]{2}-\d{3}-[A-Z0-9]{4}$/.test(token || ''),
        isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || ''),
      });
      
      const apiUrl = `/api/purchaser/profile?unitUid=${unitUid}&token=${encodeURIComponent(token)}`;
      const res = await fetch(apiUrl);
      
      setDebugInfo(prev => prev ? {
        ...prev,
        apiStatus: res.status,
        apiOk: res.ok,
        apiUrl: apiUrl.substring(0, 50) + '...'
      } : null);
      
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        const errorText = await res.text().catch(() => 'Could not read error');
        setDebugInfo(prev => prev ? { ...prev, apiError: `${res.status}: ${errorText.substring(0, 100)}` } : null);
        setError('Failed to load profile');
      }
    } catch (err: any) {
      console.error('Profile fetch error:', err);
      setDebugInfo(prev => prev ? { ...prev, apiError: `Catch: ${err.message}` } : null);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[Profile] useEffect triggered', {
      isOpen,
      propToken: propToken ? `${propToken.substring(0, 8)}...` : 'undefined',
      unitUid
    });
    
    if (isOpen) {
      const effectiveToken = propToken || getEffectiveToken(unitUid);
      if (effectiveToken) {
        fetchProfile();
      } else {
        console.log('[Profile] No token available, skipping fetch');
      }
    }
  }, [isOpen, unitUid, propToken]);

  const handleDownload = async (doc: ProfileData['documents'][0]) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    }
  };

  const getBerStyle = (rating: string | null) => {
    if (!rating) return { bg: 'bg-gray-400', text: 'text-white', border: 'border-gray-500' };
    const upperRating = rating.toUpperCase();
    return BER_COLORS[upperRating] || { bg: 'bg-gray-400', text: 'text-white', border: 'border-gray-500' };
  };

  if (!isOpen) return null;

  const overlayClass = isDarkMode 
    ? 'bg-black/60' 
    : 'bg-black/40';

  const panelClass = isDarkMode
    ? 'bg-gray-900 border-gray-800'
    : 'bg-white border-gray-200';

  const headerGradient = isDarkMode
    ? 'from-gray-800 via-gray-900 to-gray-900'
    : 'from-slate-50 via-white to-white';

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 ${overlayClass} backdrop-blur-sm transition-opacity duration-300`}
        onClick={onClose}
      />

      {/* Panel */}
      <div 
        className={`relative w-full md:w-[480px] md:max-w-[90vw] max-h-[92vh] md:max-h-[85vh] 
          ${panelClass} md:rounded-2xl rounded-t-3xl shadow-2xl border overflow-hidden
          transform transition-all duration-300 ease-out
          animate-in slide-in-from-bottom md:slide-in-from-bottom-0 md:zoom-in-95`}
      >
        {/* Premium Header with Gold Accent */}
        <div className={`relative bg-gradient-to-br ${headerGradient} overflow-hidden`}>
          {/* Decorative gold accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400" />
          
          {/* Close button */}
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 p-2 rounded-full transition-all z-10
              ${isDarkMode 
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'
              }`}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Profile Info */}
          <div className="px-6 pt-8 pb-6">
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className={`h-6 w-48 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                <div className={`h-4 w-64 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              </div>
            ) : profile ? (
              <>
                {/* Welcome Message */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`}>
                    My Home
                  </span>
                </div>

                {/* Name */}
                <h2 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Welcome, {profile.purchaser.name}
                </h2>

                {/* Address */}
                <div className={`flex items-start gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{profile.unit.address}</p>
                    {profile.unit.eircode && (
                      <p className="text-xs opacity-75">{profile.unit.eircode}</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                  {error || 'Unable to load profile'}
                </p>
                <div style={{ 
                  padding: 16, 
                  backgroundColor: '#1a1a2e', 
                  color: 'white',
                  borderRadius: 10,
                  fontSize: 12
                }}>
                  <p style={{ color: '#D4AF37', fontWeight: 'bold', marginBottom: 8 }}>DEBUG: Profile API Response</p>
                  <p><strong>propToken:</strong> {debugInfo?.propToken || 'loading...'}</p>
                  <p><strong>effectiveToken:</strong> {debugInfo?.effectiveToken || 'loading...'}</p>
                  <p><strong>API Status:</strong> {debugInfo?.apiStatus ?? 'not called'}</p>
                  <p><strong>API OK:</strong> {debugInfo?.apiOk !== undefined ? String(debugInfo.apiOk) : 'not called'}</p>
                  <p style={{ color: '#ff6b6b' }}><strong>API Error:</strong> {debugInfo?.apiError || 'none'}</p>
                  <p><strong>API URL:</strong> {debugInfo?.apiUrl || 'not called'}</p>
                  <p><strong>Time:</strong> {debugInfo?.timestamp || 'loading...'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Section Tabs */}
          <div className="px-6 flex gap-2">
            <button
              onClick={() => setActiveSection('home')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all
                ${activeSection === 'home'
                  ? (isDarkMode 
                      ? 'bg-gray-900 text-gold-400 shadow-lg' 
                      : 'bg-white text-gold-600 shadow-lg')
                  : (isDarkMode 
                      ? 'bg-gray-800/50 text-gray-400 hover:text-gray-300' 
                      : 'bg-gray-100/50 text-gray-500 hover:text-gray-700')
                }`}
            >
              <Home className="w-4 h-4" />
              <span>Property Details</span>
            </button>
            <button
              onClick={() => setActiveSection('documents')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all
                ${activeSection === 'documents'
                  ? (isDarkMode 
                      ? 'bg-gray-900 text-gold-400 shadow-lg' 
                      : 'bg-white text-gold-600 shadow-lg')
                  : (isDarkMode 
                      ? 'bg-gray-800/50 text-gray-400 hover:text-gray-300' 
                      : 'bg-gray-100/50 text-gray-500 hover:text-gray-700')
                }`}
            >
              <FileText className="w-4 h-4" />
              <span>My Documents</span>
              {profile && profile.documents.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold
                  ${activeSection === 'documents'
                    ? (isDarkMode ? 'bg-gold-500/20 text-gold-400' : 'bg-gold-100 text-gold-700')
                    : (isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')
                  }`}>
                  {profile.documents.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSection('saved')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all
                ${activeSection === 'saved'
                  ? (isDarkMode 
                      ? 'bg-gray-900 text-gold-400 shadow-lg' 
                      : 'bg-white text-gold-600 shadow-lg')
                  : (isDarkMode 
                      ? 'bg-gray-800/50 text-gray-400 hover:text-gray-300' 
                      : 'bg-gray-100/50 text-gray-500 hover:text-gray-700')
                }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Saved</span>
              {savedNotes.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold
                  ${activeSection === 'saved'
                    ? (isDarkMode ? 'bg-gold-500/20 text-gold-400' : 'bg-gold-100 text-gold-700')
                    : (isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')
                  }`}>
                  {savedNotes.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`overflow-y-auto ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`} 
          style={{ maxHeight: 'calc(85vh - 220px)' }}>
          
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-20 rounded-xl animate-pulse ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
              ))}
            </div>
          ) : profile ? (
            activeSection === 'home' ? (
              <div className="p-6 space-y-4">
                {/* House Type Card */}
                <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                      <Building2 className={`w-5 h-5 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        House Type
                      </p>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {profile.unit.house_type_code || profile.unit.house_type_name || 'House'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="space-y-3 mt-4">
                    {/* Bedrooms and Bathrooms Row - Always show */}
                    <div className={`grid grid-cols-2 gap-3 ${profile.unit.floor_area_sqm ? 'mb-3' : ''}`}>
                      <div className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
                        ${isDarkMode 
                          ? 'bg-gray-800/30 border-gray-700 hover:border-gold-500/50' 
                          : 'bg-white border-gray-200 hover:border-gold-300'
                        }`}>
                        <Bed className={`w-6 h-6 mb-2 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {profile.unit.bedrooms ?? '-'}
                        </p>
                        <p className={`text-xs font-medium uppercase tracking-wider mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Bedrooms
                        </p>
                      </div>
                      <div className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
                        ${isDarkMode 
                          ? 'bg-gray-800/30 border-gray-700 hover:border-gold-500/50' 
                          : 'bg-white border-gray-200 hover:border-gold-300'
                        }`}>
                        <Bath className={`w-6 h-6 mb-2 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {profile.unit.bathrooms ?? '-'}
                        </p>
                        <p className={`text-xs font-medium uppercase tracking-wider mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Bathrooms
                        </p>
                      </div>
                    </div>

                    {/* Floor Area */}
                    {profile.unit.floor_area_sqm && (
                      <div className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
                        ${isDarkMode 
                          ? 'bg-gray-800/30 border-gray-700 hover:border-gold-500/50' 
                          : 'bg-white border-gray-200 hover:border-gold-300'
                        }`}>
                        <Maximize2 className={`w-6 h-6 mb-2 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {Math.round(profile.unit.floor_area_sqm)}
                        </p>
                        <p className={`text-xs font-medium uppercase tracking-wider mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Square Feet
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* BER Rating Card */}
                {profile.intel?.ber_rating && (
                  <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                          <Leaf className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                        </div>
                        <div>
                          <p className={`text-xs uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            BER Rating
                          </p>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            Building Energy Rating
                          </p>
                        </div>
                      </div>
                      <div 
                        className={`px-4 py-2 rounded-lg font-bold text-lg border-2 ${getBerStyle(profile.intel.ber_rating).bg} ${getBerStyle(profile.intel.ber_rating).text} ${getBerStyle(profile.intel.ber_rating).border}`}
                      >
                        {profile.intel.ber_rating.toUpperCase()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Handover Date Card */}
                {profile.unit.handover_date && (
                  <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                        <Calendar className={`w-5 h-5 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                      </div>
                      <div>
                        <p className={`text-xs uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          Handover Date
                        </p>
                        <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {new Date(profile.unit.handover_date).toLocaleDateString('en-IE', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Heating Info Card */}
                {profile.intel?.heating && (
                  <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                        <Flame className={`w-5 h-5 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                      </div>
                      <div>
                        <p className={`text-xs uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          Heating System
                        </p>
                        <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {typeof profile.intel.heating === 'string' 
                            ? profile.intel.heating 
                            : profile.intel.heating?.type || 'Heat Pump System'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Development Info */}
                <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                      <Building2 className={`w-5 h-5 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Development
                      </p>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {profile.development.name}
                      </p>
                      {profile.development.address && (
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {profile.development.address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeSection === 'saved' ? (
              /* Saved Answers Section */
              <SavedAnswersSection
                notes={savedNotes}
                onDelete={deleteSavedNote}
                isDarkMode={isDarkMode}
                isLoading={notesLoading}
              />
            ) : (
              /* Documents Section */
              <div className="p-6">
                {profile.documents.length === 0 ? (
                  <div className="text-center py-12">
                    <div className={`p-4 rounded-full mx-auto w-16 h-16 flex items-center justify-center mb-4
                      ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <FileText className={`w-8 h-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                    </div>
                    <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      No Documents Yet
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Floor plans and elevations for your specific unit will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profile.documents.map(doc => (
                      <button
                        key={doc.id}
                        onClick={() => handleDownload(doc)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all
                          ${isDarkMode 
                            ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gold-500/50' 
                            : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-gold-300 hover:shadow-md'
                          }`}
                      >
                        <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                          <FileText className={`w-5 h-5 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {doc.title}
                          </p>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {doc.category}
                          </p>
                        </div>
                        <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gold-500/10' : 'bg-gold-50'}`}>
                          <Download className={`w-4 h-4 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="p-6 text-center">
              <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {error || 'Unable to load profile data'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Saved Answers Section ──────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  maintenance: 'Maintenance',
  warranty: 'Warranty',
  utility: 'Utility',
  appliance: 'Appliance',
  garden: 'Garden',
  security: 'Security',
  general: 'General',
};

function SavedAnswersSection({
  notes,
  onDelete,
  isDarkMode,
  isLoading,
}: {
  notes: HomeNote[];
  onDelete: (id: string) => Promise<boolean>;
  isDarkMode: boolean;
  isLoading: boolean;
}) {
  const [filter, setFilter] = useState<NoteCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter === 'all' ? notes : notes.filter(n => n.category === filter);
  const availableCategories = ['all', ...Array.from(new Set(notes.map(n => n.category)))];

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-20 rounded-xl animate-pulse ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className={`p-4 rounded-full mx-auto w-16 h-16 flex items-center justify-center mb-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <Bookmark className={`w-8 h-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
        </div>
        <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          No Saved Answers Yet
        </h3>
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Save answers from the AI assistant using the bookmark icon on any response.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Category filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {availableCategories.map(cat => {
          const active = filter === cat;
          const count = cat === 'all' ? notes.length : notes.filter(n => n.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat as NoteCategory | 'all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                active
                  ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30'
                  : isDarkMode
                    ? 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                active
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                  : isDarkMode
                    ? 'bg-gray-700 text-gray-500'
                    : 'bg-gray-200 text-gray-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Saved answer cards */}
      <div className="space-y-2">
        {filtered.map(note => {
          const expanded = expandedId === note.id;
          return (
            <div
              key={note.id}
              className={`rounded-xl border overflow-hidden transition-all duration-200 ${
                expanded
                  ? isDarkMode
                    ? 'border-[#D4AF37]/30 bg-gray-800/50'
                    : 'border-gold-200 bg-white shadow-sm'
                  : isDarkMode
                    ? 'border-gray-700 bg-gray-800/30'
                    : 'border-gray-200 bg-white'
              }`}
            >
              <button
                onClick={() => setExpandedId(expanded ? null : note.id)}
                className="w-full text-left p-3.5 flex items-start gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-[#D4AF37] mt-1.5 flex-shrink-0 opacity-70" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {note.title || note.content.substring(0, 50)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${
                      isDarkMode
                        ? 'bg-[#D4AF37]/15 text-[#D4AF37]'
                        : 'bg-gold-50 text-gold-700'
                    }`}>
                      {CATEGORY_LABELS[note.category] || note.category}
                    </span>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(note.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 mt-1 transition-transform duration-200 ${
                    expanded ? 'rotate-180' : ''
                  } ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                />
              </button>

              {expanded && (
                <div className="px-3.5 pb-3.5 pl-9 animate-fade-in">
                  {note.source_query && (
                    <p className={`text-xs italic mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      &ldquo;{note.source_query}&rdquo;
                    </p>
                  )}
                  <p className={`text-sm leading-relaxed whitespace-pre-line ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {note.content}
                  </p>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(note.id);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isDarkMode
                          ? 'bg-gray-700 text-gray-400 hover:text-red-400 border border-gray-600'
                          : 'bg-gray-100 text-gray-500 hover:text-red-500 border border-gray-200'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && notes.length > 0 && (
          <div className="text-center py-8">
            <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              No saved answers in this category
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
