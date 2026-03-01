'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Home, MessageCircle, BookOpen, Settings } from 'lucide-react';

const HomeScreen = dynamic(
  () => import('./screens/HomeScreen'),
  { ssr: false, loading: () => <TabLoading /> }
);

const AssistantScreen = dynamic(
  () => import('./screens/AssistantScreen'),
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

type TabType = 'home' | 'assistant' | 'guides' | 'system';

const TABS: { id: TabType; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'assistant', label: 'Assistant', icon: MessageCircle },
  { id: 'guides', label: 'Guides', icon: BookOpen },
  { id: 'system', label: 'System', icon: Settings },
];

export default function CareInstallationPage() {
  const params = useParams();
  const installationId = params.installationId as string;
  const [activeTab, setActiveTab] = useState<TabType>('home');

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b bg-white/95 backdrop-blur-lg border-gray-200 z-50">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Image
              src="/branding/openhouse-care-logo.png"
              alt="OpenHouse AI"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-semibold text-[#D4AF37]">OpenHouse</span>
                <span className="text-base font-semibold text-gray-900">Care</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content — takes remaining space between header and tab bar */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div key={activeTab} className="h-full animate-fade-in">
          {activeTab === 'home' && <HomeScreen />}
          {activeTab === 'assistant' && (
            <AssistantScreen installationId={installationId} />
          )}
          {activeTab === 'guides' && <GuidesScreen />}
          {activeTab === 'system' && <SystemScreen />}
        </div>
      </main>

      {/* Bottom Tab Bar — always visible, never hidden */}
      <nav className="flex-shrink-0 border-t bg-white border-gray-200 pb-[env(safe-area-inset-bottom)] z-50">
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
                    ? 'text-[#D4AF37]'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <div className={`flex flex-col items-center gap-1 transition-all duration-200 ${isActive ? 'bg-[#D4AF37]/12 rounded-2xl px-4 py-1' : 'px-4 py-1'}`}>
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-xs font-medium">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
