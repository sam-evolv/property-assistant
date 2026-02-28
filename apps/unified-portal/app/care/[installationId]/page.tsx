'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { MessageCircle, Home, BookOpen, Cpu, Loader2 } from 'lucide-react';

const AssistantScreen = dynamic(
  () => import('./screens/AssistantScreen'),
  { ssr: false, loading: () => <TabLoading /> }
);

const HomeScreen = dynamic(
  () => import('./screens/HomeScreen'),
  { ssr: false, loading: () => <TabLoading /> }
);

const GuidesScreen = dynamic(
  () => import('./screens/GuidesScreen'),
  { ssr: false, loading: () => <TabLoading /> }
);

const SystemScreen = dynamic(
  () => import('./screens/SystemScreen'),
  { ssr: false, loading: () => <TabLoading /> }
);

function TabLoading() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="h-48 bg-gold-50 rounded-2xl" />
      <div className="h-6 bg-gold-50 rounded-full w-3/4" />
      <div className="h-4 bg-gold-50 rounded-full w-1/2" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-gold-50 rounded-xl" />
        <div className="h-24 bg-gold-50 rounded-xl" />
      </div>
    </div>
  );
}

type TabType = 'assistant' | 'home' | 'guides' | 'system';

const TABS: { id: TabType; label: string; icon: typeof MessageCircle }[] = [
  { id: 'assistant', label: 'Assistant', icon: MessageCircle },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'guides', label: 'Guides', icon: BookOpen },
  { id: 'system', label: 'System', icon: Cpu },
];

export default function CareInstallationPage() {
  const params = useParams();
  const installationId = params.installationId as string;
  const [activeTab, setActiveTab] = useState<TabType>('assistant');

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 border-b bg-white border-gray-200">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
              <Image src="/icon-192.png" alt="OpenHouse Care" width={36} height={36} className="w-9 h-9 object-cover rounded-xl" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">OpenHouse Care</h1>
              <p className="text-xs text-gray-500">Solar Aftercare</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'assistant' && (
          <AssistantScreen installationId={installationId} />
        )}
        {activeTab === 'home' && (
          <HomeScreen installationId={installationId} />
        )}
        {activeTab === 'guides' && (
          <GuidesScreen installationId={installationId} />
        )}
        {activeTab === 'system' && (
          <SystemScreen installationId={installationId} />
        )}
      </main>

      {/* Tab Bar */}
      <nav className="sticky bottom-0 z-50 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around max-w-4xl mx-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 py-2 px-4 transition-colors ${
                  isActive ? 'text-[#D4AF37]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <tab.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 w-8 h-0.5 rounded-full bg-[#D4AF37]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
