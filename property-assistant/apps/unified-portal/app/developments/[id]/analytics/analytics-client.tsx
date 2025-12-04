'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { OverviewTab } from '@/app/super/analytics/tabs/overview';
import { QuestionsTab } from '@/app/super/analytics/tabs/questions';
import { TrendsTab } from '@/app/super/analytics/tabs/trends';
import { KnowledgeTab } from '@/app/super/analytics/tabs/knowledge';
import { RAGTab } from '@/app/super/analytics/tabs/rag';
import { DocumentsTab } from '@/app/super/analytics/tabs/documents';
import { EngagementTab } from '@/app/super/analytics/tabs/engagement';
import { UnitsTab } from '@/app/super/analytics/tabs/units';

interface DevelopmentAnalyticsClientProps {
  tenantId: string;
  developmentId: string;
  developmentName: string;
}

type TabId = 'overview' | 'questions' | 'trends' | 'gaps' | 'rag' | 'documents' | 'engagement' | 'units';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'questions', label: 'Questions' },
  { id: 'trends', label: 'Trends' },
  { id: 'gaps', label: 'Knowledge Gaps' },
  { id: 'rag', label: 'RAG Performance' },
  { id: 'documents', label: 'Documents' },
  { id: 'engagement', label: 'Homeowners' },
  { id: 'units', label: 'Units' },
];

export default function DevelopmentAnalyticsClient({
  tenantId,
  developmentId,
  developmentName,
}: DevelopmentAnalyticsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [days, setDays] = useState(30);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-900 to-black text-white py-8 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <Link
            href={`/developments/${developmentId}`}
            className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Development
          </Link>
          <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-gray-300 text-lg">{developmentName}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Analytics Scope</h2>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white text-gray-900"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>

          <div className="flex gap-2 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="animate-fadeIn">
          {activeTab === 'overview' && (
            <OverviewTab tenantId={tenantId} developmentId={developmentId} days={days} />
          )}
          {activeTab === 'questions' && (
            <QuestionsTab tenantId={tenantId} developmentId={developmentId} days={days} />
          )}
          {activeTab === 'trends' && (
            <TrendsTab tenantId={tenantId} developmentId={developmentId} days={days} />
          )}
          {activeTab === 'gaps' && (
            <KnowledgeTab tenantId={tenantId} developmentId={developmentId} days={days} />
          )}
          {activeTab === 'rag' && (
            <RAGTab tenantId={tenantId} developmentId={developmentId} days={days} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab tenantId={tenantId} developmentId={developmentId} days={days} />
          )}
          {activeTab === 'engagement' && (
            <EngagementTab tenantId={tenantId} developmentId={developmentId} days={days} />
          )}
          {activeTab === 'units' && (
            <UnitsTab tenantId={tenantId} developmentId={developmentId} days={days} />
          )}
        </div>
      </div>
    </div>
  );
}
