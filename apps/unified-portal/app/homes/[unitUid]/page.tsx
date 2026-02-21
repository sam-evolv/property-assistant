'use client';

import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import * as Tabs from '@radix-ui/react-tabs';
import { MessageCircle, Map, Bell, FileText, ChevronDown, Moon, Sun, User } from 'lucide-react';
import IntroAnimation from '@/components/purchaser/IntroAnimation';
import MobileTabBar from '@/components/mobile/MobileTabBar';
import PurchaserProfilePanel from '@/components/purchaser/PurchaserProfilePanel';
import { PreHandoverPortal } from '@/components/pre-handover';
import type { MilestoneDates, ContactInfo, FAQ, Document } from '@/components/pre-handover/types';
import { storeToken, getToken, clearToken } from '@/lib/purchaserSession';

const PurchaserChatTab = dynamic(
  () => import('@/components/purchaser/PurchaserChatTab'),
  { ssr: false, loading: () => <div className="h-96 flex items-center justify-center"><div className="animate-pulse text-gray-400">Loading chat...</div></div> }
);

const PurchaserMapsTab = dynamic(
  () => import('@/components/purchaser/OptimizedMapsTab'),
  { ssr: false, loading: () => <div className="h-48 md:h-96 flex items-center justify-center bg-gray-100 rounded-lg"><div className="animate-pulse text-gray-400">Loading map...</div></div> }
);

const PurchaserNoticeboardTab = dynamic(
  () => import('@/components/purchaser/PurchaserNoticeboardTab'),
  { ssr: false, loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" /> }
);

const PurchaserDocumentsTab = dynamic(
  () => import('@/components/purchaser/PurchaserDocumentsTab'),
  { ssr: false, loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" /> }
);

interface HouseContext {
  unit_id: string;
  development_id: string;
  development_code: string;
  development_name: string;
  development_logo_url?: string | null;
  development_system_instructions: string;
  purchaser_name: string;
  house_type: string;
  bedrooms: number;
  address: string;
  eircode: string;
  mrpn: string;
  electricity_account: string;
  esb_eirgrid_number: string;
  latitude: number | null;
  longitude: number | null;
  tenant_id: string;
  user_id?: string | null;
  project_id?: string | null;
  floor_plan_pdf_url?: string | null;
  // Pre-handover portal fields
  handover_complete?: boolean;
  current_milestone?: string;
  milestone_dates?: MilestoneDates;
  est_snagging_date?: string | null;
  est_handover_date?: string | null;
  prehandover_config?: {
    contacts?: ContactInfo;
    faqs?: FAQ[];
  } | null;
}

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ga', name: 'Gaeilge', flag: '🇮🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'lv', name: 'Latviešu', flag: '🇱🇻' },
  { code: 'lt', name: 'Lietuvių', flag: '🇱🇹' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
];

export default function HomeResidentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { unitUid } = params as { unitUid: string };
  const token = searchParams.get('token');

  const [house, setHouse] = useState<HouseContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showIntro, setShowIntro] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);

  const [validatedToken, setValidatedToken] = useState<string | null>(null);
  
  // Important docs consent state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [importantDocs, setImportantDocs] = useState<any[]>([]);
  const [consentRequired, setConsentRequired] = useState(false);
  const [agreeingToDocs, setAgreeingToDocs] = useState(false);
  
  // Manual handover override (when user switches to assistant before pipeline is updated)
  const [handoverOverride, setHandoverOverride] = useState(false);
  
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  useEffect(() => {
    // Load saved preferences
    const savedLang = localStorage.getItem('purchaser_language');
    if (savedLang) setSelectedLanguage(savedLang);

    const savedTheme = localStorage.getItem('purchaser_theme');
    if (savedTheme === 'dark') setIsDarkMode(true);
    
    // Check for manual handover override
    const override = localStorage.getItem(`handover_override_${unitUid}`);
    if (override === 'true') setHandoverOverride(true);
  }, [unitUid]);

  useEffect(() => {
    const fetchHouse = async (attempt: number = 0) => {
      try {
        // Get the QR token from query param or stored session (for drawing access)
        const qrToken = token || getToken(unitUid);

        // Call resolve endpoint with the unitUid from URL path
        // The resolve endpoint needs just the UUID, not the full token
        const validateRes = await fetch('/api/houses/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: unitUid }),
        });
        
        if (!validateRes.ok) {
          // Check if this is a retryable error (503 = service temporarily unavailable)
          // MAX_RETRIES = 3 means attempts 1, 2, 3 (not 0-indexed for user display)
          if (validateRes.status === 503 && attempt + 1 < MAX_RETRIES) {
            const nextAttempt = attempt + 1;
            console.log(`[Home] Service temporarily unavailable, retrying in ${RETRY_DELAY_MS}ms (attempt ${nextAttempt + 1}/${MAX_RETRIES})`);
            setIsRetrying(true);
            setRetryCount(nextAttempt + 1);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return fetchHouse(nextAttempt);
          }
          
          clearToken(unitUid);
          sessionStorage.removeItem(`intro_seen_${unitUid}`);
          
          // Show a friendlier error for temporary unavailability
          if (validateRes.status === 503) {
            setError('The service is temporarily busy. Please wait a moment and try again.');
          } else {
            setError('Invalid or expired QR code. Please scan again.');
          }
          setLoading(false);
          setIsRetrying(false);
          return;
        }

        setIsRetrying(false);
        const data = await validateRes.json();

        // Handle API response formats (unit_id is canonical)
        const unitId = data.unit_id || data.unitId || data.house_id;
        
        if (unitId) {
          // Store the full QR token for drawing access using cross-platform utility
          // Use qrToken if available, otherwise use unitUid as fallback
          const effectiveToken = qrToken || unitUid;
          storeToken(unitUid, effectiveToken);
          setValidatedToken(effectiveToken);
          
          console.log('[Parent] Token validated and set', {
            qrToken: qrToken ? `${qrToken.substring(0, 8)}...` : 'undefined',
            effectiveToken: effectiveToken ? `${effectiveToken.substring(0, 8)}...` : 'undefined',
            unitUid,
            tokenSource: qrToken ? 'qrToken' : 'unitUid fallback',
            isAccessCode: /^[A-Z]{2}-\d{3}-[A-Z0-9]{4}$/.test(effectiveToken || ''),
            isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveToken || ''),
          });
          
          // Map response format to HouseContext
          const houseData: HouseContext = {
            unit_id: unitId,
            development_id: data.development_id || data.project_id || '',
            development_code: data.development_code || '',
            development_name: data.development_name || 'Longview Park',
            development_logo_url: data.development_logo_url,
            development_system_instructions: data.development_system_instructions || '',
            purchaser_name: data.purchaserName || data.purchaser_name || 'Homeowner',
            house_type: data.house_type || '',
            bedrooms: data.bedrooms || 0,
            address: data.address || '',
            eircode: data.eircode || '',
            mrpn: data.mrpn || '',
            electricity_account: data.electricity_account || '',
            esb_eirgrid_number: data.esb_eirgrid_number || '',
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            tenant_id: data.tenant_id || '',
            user_id: data.user_id,
            project_id: data.project_id,
            floor_plan_pdf_url: data.floorPlanUrl || data.floor_plan_pdf_url,
            // Pre-handover portal fields
            handover_complete: data.handover_complete || false,
            current_milestone: data.current_milestone || 'sale_agreed',
            milestone_dates: data.milestone_dates || {},
            est_snagging_date: data.est_snagging_date || null,
            est_handover_date: data.est_handover_date || null,
            prehandover_config: data.prehandover_config || null,
          };

          setHouse(houseData);

          // Fire qr_scan analytics event (fire-and-forget, log failures loudly)
          fetch('/api/analytics/qr-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              unit_id: unitId,
              development_id: houseData.development_id,
              tenant_id: houseData.tenant_id,
            }),
          }).then((res) => {
            if (!res.ok) {
              console.error('[ANALYTICS CRITICAL] qr_scan API returned non-OK status:', res.status);
            }
          }).catch((err) => {
            console.error('[ANALYTICS CRITICAL] Failed to emit qr_scan event:', err);
          });

          // Check important docs consent status
          checkImportantDocsConsent(unitId, qrToken || unitUid);

          const hasSeenIntro = sessionStorage.getItem(`intro_seen_${unitUid}`);
          if (!hasSeenIntro) {
            setShowIntro(true);
          }
        } else {
          setError('Home not found.');
        }
      } catch (error) {
        console.error('Failed to fetch house:', error);
        setError('Failed to load your home. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchHouse();
  }, [unitUid, token]);

  const handleIntroComplete = () => {
    sessionStorage.setItem(`intro_seen_${unitUid}`, 'true');
    setShowIntro(false);
  };

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    localStorage.setItem('purchaser_language', langCode);
    setShowLanguageDropdown(false);
  };

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('purchaser_theme', newMode ? 'dark' : 'light');
  };

  const checkImportantDocsConsent = async (houseId: string, authToken: string) => {
    try {
      const res = await fetch(
        `/api/purchaser/important-docs-status?unitUid=${unitUid}&token=${encodeURIComponent(authToken)}`
      );
      
      if (res.ok) {
        const data = await res.json();
        console.log('[Purchaser] Important Docs Response:', {
          requiresConsent: data.requiresConsent,
          importantDocsCount: data.importantDocuments?.length || 0,
          importantDocs: data.importantDocuments?.map((d: any) => ({ id: d.id, title: d.title })),
        });
        setConsentRequired(data.requiresConsent);
        setImportantDocs(data.importantDocuments || []);
        
        if (data.requiresConsent && data.importantDocuments && data.importantDocuments.length > 0) {
          console.log('[Purchaser] SHOWING CONSENT MODAL');
          setShowConsentModal(true);
        } else {
          console.log('[Purchaser] NOT showing modal - requiresConsent:', data.requiresConsent, 'docsLength:', data.importantDocuments?.length);
        }
      } else {
        console.error('[Purchaser] API returned non-OK status:', res.status);
      }
    } catch (error) {
      console.error('Failed to check important docs consent:', error);
    }
  };

  const handleAgreeToImportantDocs = async () => {
    if (!house || !validatedToken) return;
    
    setAgreeingToDocs(true);
    try {
      const res = await fetch('/api/purchaser/important-docs-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitUid: unitUid,
          token: validatedToken,
        }),
      });

      if (res.ok) {
        setShowConsentModal(false);
        setConsentRequired(false);
      } else {
        alert('Failed to record agreement. Please try again.');
      }
    } catch (error) {
      console.error('Failed to agree to important docs:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setAgreeingToDocs(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="text-xl animate-pulse text-gray-600">
            {isRetrying ? `Connecting... (attempt ${retryCount}/${MAX_RETRIES})` : 'Loading your home...'}
          </div>
          {isRetrying && (
            <div className="text-sm text-gray-500 mt-2">
              The service is momentarily busy. Please wait...
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    const isTemporaryError = error.includes('temporarily') || error.includes('busy');
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="text-6xl mb-4 text-gray-300">{isTemporaryError ? '' : ''}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {isTemporaryError ? 'Just a Moment' : 'Access Error'}
          </h2>
          <p className="text-gray-700 mb-6">{error}</p>
          {isTemporaryError && (
            <button
              onClick={() => window.location.reload()}
              className="mb-4 px-6 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition font-medium"
            >
              Try Again
            </button>
          )}
          <p className="text-sm text-gray-500">
            If you continue to have issues, please contact support.
          </p>
        </div>
      </div>
    );
  }

  if (!house) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Home Not Found</h2>
          <p className="text-gray-600">Unit ID: {unitUid}</p>
        </div>
      </div>
    );
  }

  // Show intro animation first if needed
  if (showIntro && house) {
    return (
      <IntroAnimation
        developmentName={house.development_name}
        purchaserName={house.purchaser_name}
        address={house.address}
        logoUrl={house.development_logo_url}
        handoverComplete={house.handover_complete || handoverOverride}
        onComplete={handleIntroComplete}
      />
    );
  }

  // PRE-HANDOVER PORTAL: Show for purchasers before handover is complete
  // This takes precedence over the main Property Assistant view
  // Unless user has manually switched to assistant via handoverOverride
  if (house && !house.handover_complete && !handoverOverride) {
    // Fetch documents for this unit (we'll do this in a separate effect or inline)
    return (
      <PreHandoverPortal
        unitId={house.unit_id}
        propertyName={house.address || `Unit ${house.unit_id}`}
        propertyType={`${house.bedrooms || 3} Bed`}
        houseType={house.house_type || 'House'}
        purchaserName={house.purchaser_name}
        developmentName={house.development_name}
        developmentLogoUrl={house.development_logo_url || null}
        handoverComplete={house.handover_complete || false}
        currentMilestone={house.current_milestone || 'sale_agreed'}
        milestoneDates={house.milestone_dates || {}}
        estSnaggingDate={house.est_snagging_date || null}
        estHandoverDate={house.est_handover_date || null}
        documents={[]} // Documents will be fetched by the portal component
        contacts={house.prehandover_config?.contacts || {}}
        faqs={house.prehandover_config?.faqs || []}
      />
    );
  }

  // HARD GATE: Important Documents Consent - show AFTER intro
  if (consentRequired && importantDocs.length > 0) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-gold-500 to-gold-600 px-8 py-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="text-2xl font-bold">Important Documents Agreement Required</h2>
              </div>
              <p className="text-gold-50 text-sm">
                Please review and agree to the following important documents before accessing your home portal.
              </p>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <p className="text-gray-700 mb-4 text-sm">
                Your developer has marked the following documents as important must-reads. Please take a moment to review them:
              </p>
              
              <div className="space-y-3">
                {importantDocs.map((doc, index) => (
                  <div key={doc.id} className="flex items-start gap-3 p-4 bg-gold-50 border border-gold-200 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{doc.original_file_name}</p>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gold-600 hover:text-gold-700 font-medium mt-2 inline-flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Document
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gold-50 border border-gold-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gold-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-gold-800">
                    <strong>Important:</strong> By clicking "I Agree" below, you acknowledge that you have read and understood these important documents. 
                    This agreement is required to access your home portal.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-gray-200 px-8 py-4 bg-gray-50">
              <button
                onClick={handleAgreeToImportantDocs}
                disabled={agreeingToDocs}
                className="w-full bg-gold-500 hover:bg-gold-600 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {agreeingToDocs ? 'Recording Agreement...' : 'I Agree - Continue to Portal'}
              </button>
              <p className="text-center text-xs text-gray-500 mt-3">
                You must agree to continue. If you have questions, please contact your developer.
              </p>
            </div>
          </div>
        </div>
    );
  }

  const initialMessage = `Good evening ${house.purchaser_name || 'there'}, welcome to ${
    house.development_name
  }. How can I help with your home at ${house.address}?`;

  const bgColor = isDarkMode ? 'bg-[#0F0F0F]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const borderColor = isDarkMode ? 'border-[#2A2A2A]' : 'border-gray-200';

  // Main app render - consent already handled above
  return (
    <>
      {/* Landscape Warning Overlay - shown on mobile landscape */}
      <div className={`landscape-warning fixed inset-0 z-[100] items-center justify-center ${
        isDarkMode ? 'bg-[#0F0F0F]' : 'bg-white'
      }`}>
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <svg 
            className={`w-16 h-16 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Please Rotate Your Device
          </h2>
          <p className={`text-sm max-w-xs ${isDarkMode ? 'text-[#A0A0A0]' : 'text-gray-600'}`}>
            This app works best in portrait mode. Please rotate your phone to continue.
          </p>
        </div>
      </div>

      <div className={`flex flex-col h-[100dvh] overflow-hidden landscape-hide ${bgColor}`}>
        {/* Premium Top Bar with Blur - Logo Left, Language/Theme Right */}
        <header 
          className={`sticky top-0 z-20 border-b px-4 flex items-center justify-between ${
            isDarkMode 
              ? 'border-white/5 bg-[#0F0F0F]/80 backdrop-blur-xl'
              : 'border-black/5 bg-white/80 backdrop-blur-xl'
          }`}
          style={{
            paddingTop: 'calc(12px + var(--safe-top, env(safe-area-inset-top, 0px)))',
            paddingBottom: '12px',
          }}
        >
        {/* Left: Development Logo */}
        <div className="flex items-center gap-3">
          <div className="flex w-auto items-center justify-center h-[68px]">
            {house?.development_logo_url ? (
              <img
                src={house.development_logo_url}
                alt={`${house.development_name || 'Development'} logo`}
                width={225}
                height={68}
                className={`h-full w-auto object-contain transition-all ${isDarkMode ? 'brightness-0 invert' : ''}`}
              />
            ) : (
              <span className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>
                {house?.development_name || 'Home'}
              </span>
            )}
          </div>
        </div>

        {/* Right: Language Selector + Dark/Light Mode Toggle */}
        <div className="flex items-center gap-2 header-actions">
          {/* Language Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition ${
                isDarkMode
                  ? 'border-[#2A2A2A] bg-[#1A1A1A]/80 text-[#C0C0C0] hover:bg-[#252525]'
                  : 'border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {LANGUAGES.find(l => l.code === selectedLanguage)?.flag && (
                <span>{LANGUAGES.find(l => l.code === selectedLanguage)?.flag}</span>
              )}
              <span>{LANGUAGES.find(l => l.code === selectedLanguage)?.code.toUpperCase()}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showLanguageDropdown && (
              <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg border py-1 z-50 ${
                isDarkMode ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'
              }`}>
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors text-sm ${
                      selectedLanguage === lang.code 
                        ? (isDarkMode ? 'bg-gold-900/30 text-gold-400' : 'bg-gold-50 text-gold-700')
                        : (isDarkMode ? 'text-[#C0C0C0] hover:bg-[#252525]' : 'text-gray-700 hover:bg-gray-100')
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dark/Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition ${
              isDarkMode
                ? 'border-[#2A2A2A] bg-[#1A1A1A]/80 text-gold-400 hover:bg-[#252525]'
                : 'border-slate-200 bg-white/80 text-slate-500 hover:bg-slate-50'
            }`}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Profile Button */}
          <button
            onClick={() => setShowProfilePanel(true)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition
              bg-gradient-to-br from-gold-400 to-gold-600 border-gold-500 text-white
              hover:from-gold-500 hover:to-gold-700 hover:shadow-md hover:shadow-gold-500/30`}
            aria-label="View profile"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </header>

      <Tabs.Root
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="flex-1 min-h-0 overflow-hidden">
          <Tabs.Content value="chat" className="h-full min-h-0 overflow-hidden">
            <div style={{ animation: 'fadeIn 200ms ease-out' }}>
            <PurchaserChatTab
              houseId={house.unit_id}
              developmentId={house.development_id}
              initialMessage={initialMessage}
              purchaserName={house.purchaser_name}
              developmentName={house.development_name}
              developmentLogoUrl={house.development_logo_url || null}
              unitUid={house.unit_id}
              token={validatedToken || ''}
              selectedLanguage={selectedLanguage}
              isDarkMode={isDarkMode}
              userId={house.user_id}
            />
            </div>
          </Tabs.Content>

          <Tabs.Content value="maps" className="h-full">
            <div style={{ animation: 'fadeIn 200ms ease-out' }}>
            <PurchaserMapsTab
              address={house.address}
              eircode={house.eircode}
              developmentName={house.development_name}
              latitude={house.latitude}
              longitude={house.longitude}
              isDarkMode={isDarkMode}
              selectedLanguage={selectedLanguage}
            />
            </div>
          </Tabs.Content>

          <Tabs.Content value="noticeboard" className="h-full">
            <div style={{ animation: 'fadeIn 200ms ease-out' }}>
            <PurchaserNoticeboardTab
              unitUid={house.unit_id}
              isDarkMode={isDarkMode}
              selectedLanguage={selectedLanguage}
              token={validatedToken || undefined}
            />
            </div>
          </Tabs.Content>

          <Tabs.Content value="documents" className="h-full">
            <div style={{ animation: 'fadeIn 200ms ease-out' }}>
            <PurchaserDocumentsTab
              unitUid={house.unit_id}
              houseType={house.house_type}
              isDarkMode={isDarkMode}
              selectedLanguage={selectedLanguage}
              token={validatedToken || undefined}
            />
            </div>
          </Tabs.Content>
        </div>

      </Tabs.Root>

      {/* Mobile Bottom Tab Bar - Frosted Glass Native Feel */}
      <MobileTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isDarkMode={isDarkMode}
        selectedLanguage={selectedLanguage}
      />
      </div>

      {/* Profile Panel */}
      <PurchaserProfilePanel
        isOpen={showProfilePanel}
        onClose={() => setShowProfilePanel(false)}
        unitUid={house.unit_id}
        isDarkMode={isDarkMode}
        token={validatedToken || undefined}
      />
    </>
  );
}
