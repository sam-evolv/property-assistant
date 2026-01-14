'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { usePurchaserSession } from '@/contexts/PurchaserContext';
import { MessageCircle, Map, Newspaper, FileText, LogOut, Loader2, Menu, X } from 'lucide-react';

const PurchaserChatTab = dynamic(
  () => import('@/components/purchaser/PurchaserChatTab'),
  { ssr: false, loading: () => <TabLoading message="Loading chat..." /> }
);

const PurchaserMapsTab = dynamic(
  () => import('@/components/purchaser/OptimizedMapsTab'),
  { ssr: false, loading: () => <TabLoading message="Loading map..." /> }
);

const PurchaserNoticeboardTab = dynamic(
  () => import('@/components/purchaser/PurchaserNoticeboardTab'),
  { ssr: false, loading: () => <TabLoading message="Loading news..." /> }
);

const PurchaserDocumentsTab = dynamic(
  () => import('@/components/purchaser/PurchaserDocumentsTab'),
  { ssr: false, loading: () => <TabLoading message="Loading documents..." /> }
);

function TabLoading({ message }: { message: string }) {
  return (
    <div className="h-96 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-2" />
        <p className="text-grey-400 text-sm">{message}</p>
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
      <header className={`sticky top-0 z-50 px-4 py-3 border-b ${isDarkMode ? 'bg-black border-grey-800' : 'bg-white border-grey-200'}`}>
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            {session.developmentLogoUrl ? (
              <Image
                src={session.developmentLogoUrl}
                alt={session.developmentName}
                width={48}
                height={48}
                className="h-12 w-auto object-contain"
              />
            ) : (
              <Image
                src="/branding/openhouse-logo.png"
                alt="OpenHouse AI"
                width={120}
                height={36}
                className="h-10 w-auto object-contain"
              />
            )}
            <div className="hidden sm:block">
              <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-grey-900'}`}>
                {session.developmentName}
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-grey-400' : 'text-grey-500'}`}>
                {session.address || session.purchaserName}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-grey-800' : 'hover:bg-grey-100'}`}
          >
            {showMenu ? (
              <X className={`w-5 h-5 ${isDarkMode ? 'text-grey-400' : 'text-grey-600'}`} />
            ) : (
              <Menu className={`w-5 h-5 ${isDarkMode ? 'text-grey-400' : 'text-grey-600'}`} />
            )}
          </button>
        </div>

        {showMenu && (
          <div className={`absolute top-full right-0 mt-2 mr-4 w-48 rounded-xl shadow-lg border ${isDarkMode ? 'bg-grey-900 border-grey-800' : 'bg-white border-grey-200'}`}>
            <button
              onClick={() => {
                setIsDarkMode(!isDarkMode);
                setShowMenu(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm ${isDarkMode ? 'text-grey-300 hover:bg-grey-800' : 'text-grey-700 hover:bg-grey-50'} rounded-t-xl`}
            >
              {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </button>
            <button
              onClick={handleLogout}
              className={`w-full px-4 py-3 text-left text-sm flex items-center gap-2 ${isDarkMode ? 'text-red-400 hover:bg-grey-800' : 'text-red-600 hover:bg-grey-50'} rounded-b-xl border-t ${isDarkMode ? 'border-grey-800' : 'border-grey-200'}`}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto">
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
      </main>

      <nav className={`sticky bottom-0 border-t safe-area-inset-bottom ${isDarkMode ? 'bg-black border-grey-800' : 'bg-white border-grey-200'}`}>
        <div className="flex max-w-4xl mx-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                  isActive
                    ? 'text-gold-500'
                    : isDarkMode
                    ? 'text-grey-500 hover:text-grey-400'
                    : 'text-grey-400 hover:text-grey-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
