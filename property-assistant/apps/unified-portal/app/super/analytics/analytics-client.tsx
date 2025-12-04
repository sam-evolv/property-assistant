'use client';

import { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Database,
  FileText,
  Home,
  Users,
  Target,
  MessageSquare,
} from 'lucide-react';
import { OverviewTab } from './tabs/overview';
import { TrendsTab } from './tabs/trends';
import { KnowledgeTab } from './tabs/knowledge';
import { RAGTab } from './tabs/rag';
import { DocumentsTab } from './tabs/documents';
import { EngagementTab } from './tabs/engagement';
import { UnitsTab } from './tabs/units';
import { QuestionsTab } from './tabs/questions';

type TabId = 'overview' | 'questions' | 'trends' | 'knowledge-gaps' | 'rag-performance' | 'documents' | 'homeowners' | 'units';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: Target },
  { id: 'questions', label: 'Questions', icon: MessageSquare },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'knowledge-gaps', label: 'Knowledge Gaps', icon: Activity },
  { id: 'rag-performance', label: 'RAG Performance', icon: Database },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'homeowners', label: 'Homeowners', icon: Users },
  { id: 'units', label: 'Units', icon: Home },
];

interface AnalyticsClientProps {
  tenantId: string;
}

export default function AnalyticsClient({ tenantId }: AnalyticsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabProps = { 
    tenantId, 
    days: 30 
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white border-b border-gold-500/30 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-gradient-to-br from-gold-400 via-gold-500 to-gold-600 rounded-xl shadow-lg">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Enterprise Analytics Dashboard</h1>
              <p className="text-gray-300 text-base mt-1">
                Performance, engagement, RAG intelligence, and operational metrics across all developments
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Tab Navigation */}
        <div className="sticky top-0 z-40 bg-gray-900 border-t border-gray-800 shadow-md">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all whitespace-nowrap
                      border-b-2 hover:bg-gray-800
                      ${isActive 
                        ? 'border-gold-400 text-white bg-gray-800' 
                        : 'border-transparent text-gray-400 hover:text-white'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && <OverviewTab {...tabProps} />}
        {activeTab === 'questions' && <QuestionsTab {...tabProps} />}
        {activeTab === 'trends' && <TrendsTab {...tabProps} />}
        {activeTab === 'knowledge-gaps' && <KnowledgeTab {...tabProps} />}
        {activeTab === 'rag-performance' && <RAGTab {...tabProps} />}
        {activeTab === 'documents' && <DocumentsTab {...tabProps} />}
        {activeTab === 'homeowners' && <EngagementTab {...tabProps} />}
        {activeTab === 'units' && <UnitsTab {...tabProps} />}
      </div>
    </div>
  );
}
