'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Home, MessageCircle, BookOpen, User, Wrench } from 'lucide-react';
import { useCareApp } from './care-app-provider';

const HomeScreen = dynamic(() => import('./screens/HomeScreen'), { ssr: false, loading: () => <TabLoading /> });
const AssistantScreen = dynamic(() => import('./screens/AssistantScreen'), { ssr: false, loading: () => <TabLoading /> });
const GuidesScreen = dynamic(() => import('./screens/GuidesScreen'), { ssr: false, loading: () => <TabLoading /> });
const ProfileScreen = dynamic(() => import('./screens/ProfileScreen'), { ssr: false, loading: () => <TabLoading /> });
const ServiceScreen = dynamic(() => import('./screens/ServiceScreen'), { ssr: false, loading: () => <TabLoading /> });

/* Skeleton loading */
function TabLoading() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="h-48 bg-slate-100 rounded-2xl" />
      <div className="h-6 bg-slate-100 rounded-full w-3/4" />
      <div className="h-4 bg-slate-100 rounded-full w-1/2" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-slate-100 rounded-xl" />
        <div className="h-24 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

/* Slide-in animation for tab content */
const TAB_STYLES = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .tab-slide-in {
    animation: slideIn 200ms ease-out both;
  }
  @media (prefers-reduced-motion: reduce) {
    .tab-slide-in {
      animation: none;
    }
  }
`;

type TabType = 'assistant' | 'home' | 'guides' | 'profile' | 'service';

interface TabDef { id: TabType; label: string; icon: typeof Home }

const BASE_TABS: TabDef[] = [
  { id: 'assistant', label: 'Assistant', icon: MessageCircle },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'guides', label: 'Guides', icon: BookOpen },
  { id: 'profile', label: 'My System', icon: User },
];

const HEAT_PUMP_TABS: TabDef[] = [
  { id: 'assistant', label: 'Assistant', icon: MessageCircle },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'guides', label: 'Guides', icon: BookOpen },
  { id: 'service', label: 'Service', icon: Wrench },
  { id: 'profile', label: 'My System', icon: User },
];

export default function CareInstallationPage() {
  const params = useParams();
  const installationId = params.installationId as string;
  const { installation } = useCareApp();
  const [activeTab, setActiveTab] = useState<TabType>('assistant');
  const navRef = useRef<HTMLDivElement>(null);
  const [navWidth, setNavWidth] = useState(0);

  const isHeatPump = installation.system_category === 'heat_pump' ||
    installation.system_type === 'heat_pump';

  const tabs = useMemo(() => isHeatPump ? HEAT_PUMP_TABS : BASE_TABS, [isHeatPump]);

  const activeIndex = useMemo(() => {
    const idx = tabs.findIndex(t => t.id === activeTab);
    return idx >= 0 ? idx : 0;
  }, [tabs, activeTab]);

  const updateNavWidth = useCallback(() => {
    if (navRef.current) {
      setNavWidth(navRef.current.offsetWidth);
    }
  }, []);

  useEffect(() => {
    updateNavWidth();
    window.addEventListener('resize', updateNavWidth);
    return () => window.removeEventListener('resize', updateNavWidth);
  }, [updateNavWidth]);

  // Calculate indicator position: center of the active tab slot, offset by half indicator width (10px)
  const tabSlotWidth = navWidth / tabs.length;
  const indicatorX = activeIndex * tabSlotWidth + tabSlotWidth / 2 - 10;

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      <style>{TAB_STYLES}</style>

      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white z-50">
        <div className="flex items-center px-4 py-2.5 max-w-4xl mx-auto">
          <Image
            src="/branding/openhouse-ai-logo.png"
            alt="OpenHouse AI"
            width={156}
            height={47}
            className="h-[50px] w-auto object-contain"
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div key={activeTab} className="h-full tab-slide-in">
          {activeTab === 'assistant' && <AssistantScreen installationId={installationId} />}
          {activeTab === 'home' && <HomeScreen />}
          {activeTab === 'guides' && <GuidesScreen />}
          {activeTab === 'profile' && <ProfileScreen />}
          {activeTab === 'service' && <ServiceScreen />}
        </div>
      </main>

      {/* Bottom nav with sliding gold indicator */}
      <nav className="flex-shrink-0 border-t bg-white border-gray-200 z-50 safe-area-inset-bottom">
        <div ref={navRef} className="relative flex max-w-4xl mx-auto">
          {/* Sliding gold indicator bar -- positioned above icons */}
          {navWidth > 0 && (
            <div
              className="absolute top-0 h-[2px] rounded-[1px]"
              style={{
                width: 20,
                backgroundColor: '#D4AF37',
                transform: `translateX(${indicatorX}px)`,
                transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          )}

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 py-3 flex flex-col items-center gap-1 transition-colors duration-200 active:scale-[0.95]"
              >
                <Icon
                  className="w-5 h-5 transition-transform duration-200"
                  style={{ color: isActive ? '#D4AF37' : '#9ca3af' }}
                />
                <span
                  className={`text-xs ${isActive ? 'font-medium' : 'font-normal'}`}
                  style={{ color: isActive ? '#D4AF37' : '#9ca3af' }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
