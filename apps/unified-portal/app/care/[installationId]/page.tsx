'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Home, MessageCircle, BookOpen, User } from 'lucide-react';

const HomeScreen = dynamic(() => import('./screens/HomeScreen'), { ssr: false, loading: () => <TabLoading /> });
const AssistantScreen = dynamic(() => import('./screens/AssistantScreen'), { ssr: false, loading: () => <TabLoading /> });
const GuidesScreen = dynamic(() => import('./screens/GuidesScreen'), { ssr: false, loading: () => <TabLoading /> });
const ProfileScreen = dynamic(() => import('./screens/ProfileScreen'), { ssr: false, loading: () => <TabLoading /> });

/* Skeleton loading — verbatim from Property portal purchaser/app/page.tsx */
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

type TabType = 'assistant' | 'home' | 'guides' | 'profile';

const TABS: { id: TabType; label: string; icon: typeof Home }[] = [
  { id: 'assistant', label: 'Assistant', icon: MessageCircle },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'guides', label: 'Guides', icon: BookOpen },
  { id: 'profile', label: 'My System', icon: User },
];

export default function CareInstallationPage() {
  const params = useParams();
  const installationId = params.installationId as string;
  const [activeTab, setActiveTab] = useState<TabType>('assistant');

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      {/* Header — Property portal style: logo left, clean line */}
      <header className="flex-shrink-0 border-b border-grey-200 bg-white z-50">
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

      {/* Content — animate-fade-in on tab switch matches Property portal */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div key={activeTab} className="h-full animate-fade-in">
          {activeTab === 'assistant' && <AssistantScreen installationId={installationId} />}
          {activeTab === 'home' && <HomeScreen />}
          {activeTab === 'guides' && <GuidesScreen />}
          {activeTab === 'profile' && <ProfileScreen />}
        </div>
      </main>

      {/* Bottom nav — EXACT copy of Property purchaser/app/page.tsx nav styling */}
      <nav className="flex-shrink-0 border-t bg-white border-grey-200 z-50 safe-area-inset-bottom">
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
