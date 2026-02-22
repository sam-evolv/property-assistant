'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { usePurchaserSession } from '@/contexts/PurchaserContext';
import { MessageCircle, Map, Newspaper, FileText, LogOut, Loader2, Menu, X, Bookmark } from 'lucide-react';
import { useHomeNotes } from '@/hooks/useHomeNotes';

const PurchaserChatTab = dynamic(
  () => import('@/components/purchaser/PurchaserChatTab'),
  { ssr: false, loading: () => <TabLoading /> }
);

const PurchaserMapsTab = dynamic(
  () => import('@/components/purchaser/OptimizedMapsTab'),
  { ssr: false, loading: () => <TabLoading /> }
);

const PurchaserNoticeboardTab = dynamic(
  () => import('@/components/purchaser/PurchaserNoticeboardTab'),
  { ssr: false, loading: () => <TabLoading /> }
);

const PurchaserDocumentsTab = dynamic(
  () => import('@/components/purchaser/PurchaserDocumentsTab'),
  { ssr: false, loading: () => <TabLoading /> }
);

/* Upgrade 4: Skeleton loading screen */
function TabLoading() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="h-48 bg-slate-100 dark:bg-[#1A1A1A] rounded-2xl" />
      <div className="h-6 bg-slate-100 dark:bg-[#1A1A1A] rounded-full w-3/4" />
      <div className="h-4 bg-slate-100 dark:bg-[#1A1A1A] rounded-full w-1/2" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-slate-100 dark:bg-[#1A1A1A] rounded-xl" />
        <div className="h-24 bg-slate-100 dark:bg-[#1A1A1A] rounded-xl" />
      </div>
    </div>
  );
}

type TabType = 'chat' | 'map' | 'news' | 'docs';

const TABS: { id: TabType; label: string; icon: typeof MessageCircle }[] = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'docs', label: 'Docs', icon: FileText },
];

export default function PurchaserAppPage() {
  const router = useRouter();
  const { session, isLoading, logout } = usePurchaserSession();
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  // Saved answers count for header badge
  const { count: savedCount } = useHomeNotes({
    unitUid: session?.unitUid || '',
    enabled: !!session,
  });

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/purchaser');
    }
  }, [isLoading, session, router]);

  const handleLogout = () => {
    logout();
    router.replace('/purchaser');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-[#0F0F0F]' : 'bg-white'}`}>
      {/* Upgrade 1: Fixed dark mode neutral colors */}
      <header className={`sticky top-0 z-50 px-4 py-3 border-b ${isDarkMode ? 'bg-[#0F0F0F] border-[#2A2A2A]' : 'bg-white border-grey-200'}`}>
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            {session.developmentLogoUrl ? (
              <Image
                src={session.developmentLogoUrl}
                alt={session.developmentName}
                width={40}
                height={40}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <Image
                src="/branding/openhouse-logo.png"
                alt="OpenHouse AI"
                width={100}
                height={30}
                className="h-8 w-auto object-contain"
              />
            )}
            <div className="hidden sm:block">
              <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-grey-900'}`}>
                {session.developmentName}
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-[#A0A0A0]' : 'text-grey-500'}`}>
                {session.address || session.purchaserName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Saved Answers header icon */}
            <button
              onClick={() => setActiveTab('docs')}
              className={`relative p-2 rounded-lg ${isDarkMode ? 'hover:bg-[#252525]' : 'hover:bg-grey-100'}`}
              title="Saved Answers"
            >
              <Bookmark className={`w-5 h-5 ${isDarkMode ? 'text-[#A0A0A0]' : 'text-grey-600'}`} />
              {savedCount > 0 && (
                <div
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D4AF37]"
                  style={{ border: `1.5px solid ${isDarkMode ? '#0F0F0F' : '#ffffff'}` }}
                />
              )}
            </button>

            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-[#252525]' : 'hover:bg-grey-100'}`}
            >
            {showMenu ? (
              <X className={`w-5 h-5 ${isDarkMode ? 'text-[#A0A0A0]' : 'text-grey-600'}`} />
            ) : (
              <Menu className={`w-5 h-5 ${isDarkMode ? 'text-[#A0A0A0]' : 'text-grey-600'}`} />
            )}
          </button>
          </div>
        </div>

        {showMenu && (
          <div className={`absolute top-full right-0 mt-2 mr-4 w-48 rounded-xl shadow-lg border ${isDarkMode ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-grey-200'}`}>
            <button
              onClick={() => {
                setIsDarkMode(!isDarkMode);
                setShowMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm ${isDarkMode ? 'text-[#C0C0C0] hover:bg-[#252525]' : 'text-grey-700 hover:bg-grey-50'} rounded-t-xl`}
            >
              {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </button>
            <button
              onClick={handleLogout}
              className={`w-full px-4 py-3 text-left text-sm flex items-center gap-2 ${isDarkMode ? 'text-red-400 hover:bg-[#252525]' : 'text-red-600 hover:bg-grey-50'} rounded-b-xl border-t ${isDarkMode ? 'border-[#2A2A2A]' : 'border-grey-200'}`}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Upgrade 3: Tab content fade-in transition */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div key={activeTab} className="animate-fade-in">
            {activeTab === 'chat' && (
              <PurchaserChatTab
                houseId={session.unitId}
                developmentId={session.developmentId}
                unitUid={session.unitUid}
                token={session.token}
                initialMessage=""
                developmentName={session.developmentName}
                purchaserName={session.purchaserName}
                isDarkMode={isDarkMode}
                selectedLanguage="en"
              />
            )}
            {activeTab === 'map' && (
              <PurchaserMapsTab
                address={session.address}
                developmentName={session.developmentName}
                latitude={session.latitude}
                longitude={session.longitude}
                isDarkMode={isDarkMode}
                selectedLanguage="en"
              />
            )}
            {activeTab === 'news' && (
              <PurchaserNoticeboardTab
                unitUid={session.unitUid}
                isDarkMode={isDarkMode}
                selectedLanguage="en"
              />
            )}
            {activeTab === 'docs' && (
              <PurchaserDocumentsTab
                unitUid={session.unitUid}
                houseType={session.houseType}
                isDarkMode={isDarkMode}
                selectedLanguage="en"
              />
            )}
          </div>
        </div>
      </main>

      {/* Upgrade 2: Bottom nav with active state pill */}
      <nav className={`sticky bottom-0 border-t safe-area-inset-bottom ${isDarkMode ? 'bg-[#0F0F0F] border-[#2A2A2A]' : 'bg-white border-grey-200'}`}>
        <div className="flex max-w-4xl mx-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all duration-200 active:scale-[0.95] ${
                  isActive
                    ? 'text-gold-500'
                    : isDarkMode
                    ? 'text-[#808080] hover:text-[#A0A0A0]'
                    : 'text-grey-400 hover:text-grey-600'
                }`}
              >
                <div className={`flex flex-col items-center gap-1 ${isActive ? 'bg-[#D4AF37]/12 rounded-2xl px-4 py-1' : ''}`}>
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                  <span className="text-xs font-medium">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
