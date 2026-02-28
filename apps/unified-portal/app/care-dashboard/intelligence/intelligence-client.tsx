'use client';

import { useState } from 'react';
import {
  Brain,
  MessageSquare,
  BookOpen,
  Database,
  Send,
  Plus,
  Edit3,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface QAOverride {
  id: number;
  question: string;
  answer: string;
  status: 'Active' | 'Draft';
  lastUpdated: string;
}

interface KnowledgeDoc {
  id: number;
  title: string;
  type: string;
  indexedDate: string;
  status: 'Indexed' | 'Processing' | 'Failed';
  chunks: number;
}

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

const tabItems = [
  { key: 'test', label: 'Test Assistant', icon: MessageSquare },
  { key: 'qa', label: 'Custom Q&As', icon: BookOpen },
  { key: 'knowledge', label: 'Knowledge Base', icon: Database },
] as const;

const demoChatMessages: ChatMessage[] = [
  {
    role: 'user',
    content: 'My inverter has an orange flashing light, what does it mean?',
  },
  {
    role: 'assistant',
    content:
      'An orange flashing light on your SolarEdge inverter typically indicates a communication issue between the inverter and the SolarEdge monitoring platform. This does not affect power generation.\n\nHere are the steps to resolve it:\n1. Check your internet connection is active\n2. Verify the ethernet cable (if wired) is securely connected\n3. If using Wi-Fi, check signal strength near the inverter\n4. Restart the inverter by switching it off at the AC isolator for 30 seconds\n\nIf the light persists after these steps, please contact SE Systems for further assistance.',
  },
  {
    role: 'user',
    content: 'Thanks! How do I check the Wi-Fi signal near the inverter?',
  },
  {
    role: 'assistant',
    content:
      'You can check Wi-Fi signal strength near your inverter using your phone:\n\n1. Stand next to the inverter with your smartphone\n2. Open your Wi-Fi settings and check signal bars\n3. If signal is weak (1-2 bars), consider a Wi-Fi extender\n\nSE Systems recommends a minimum of 3 bars for reliable monitoring connectivity. If your router is far from the inverter, a powerline adapter with Wi-Fi can be a cost-effective solution.',
  },
];

const qaOverrides: QAOverride[] = [
  {
    id: 1,
    question: 'What is the emergency shutdown procedure for my solar system?',
    answer:
      'In an emergency, locate the AC isolator switch (red switch near your meter board) and turn it to the OFF position. Then switch off the DC isolator on the inverter. Contact SE Systems immediately on 021-XXXXXXX.',
    status: 'Active',
    lastUpdated: '2026-02-15',
  },
  {
    id: 2,
    question: 'How long does the SEAI grant process take?',
    answer:
      'The SEAI grant process typically takes 4-6 weeks from application to approval. SE Systems handles the entire application process on your behalf. Once approved, the grant amount is deducted from your final invoice.',
    status: 'Active',
    lastUpdated: '2026-01-28',
  },
  {
    id: 3,
    question: 'Can I add a battery to my existing solar installation?',
    answer:
      'Yes, most SE Systems installations are battery-ready. The SolarEdge inverters we install are hybrid-compatible, meaning a battery can be added without replacing the inverter. Contact us for a site assessment and quote.',
    status: 'Draft',
    lastUpdated: '2026-02-20',
  },
];

const knowledgeDocs: KnowledgeDoc[] = [
  {
    id: 1,
    title: 'SolarEdge SE3680H-SE6000H Installation Guide',
    type: 'PDF',
    indexedDate: '2026-01-10',
    status: 'Indexed',
    chunks: 124,
  },
  {
    id: 2,
    title: 'Fronius GEN24 Troubleshooting Manual',
    type: 'PDF',
    indexedDate: '2026-01-10',
    status: 'Indexed',
    chunks: 89,
  },
  {
    id: 3,
    title: 'SE Systems Customer FAQ Database',
    type: 'CSV',
    indexedDate: '2026-02-01',
    status: 'Indexed',
    chunks: 256,
  },
  {
    id: 4,
    title: 'SEAI Solar PV Grant Scheme Guidelines 2026',
    type: 'PDF',
    indexedDate: '2026-02-15',
    status: 'Indexed',
    chunks: 45,
  },
  {
    id: 5,
    title: 'BYD HVS Battery System Manual',
    type: 'PDF',
    indexedDate: '2026-02-20',
    status: 'Processing',
    chunks: 0,
  },
  {
    id: 6,
    title: 'JA Solar Panel Specifications Sheet',
    type: 'PDF',
    indexedDate: '2026-02-22',
    status: 'Failed',
    chunks: 0,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const docStatusConfig: Record<
  KnowledgeDoc['status'],
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  Indexed: { icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700' },
  Processing: { icon: Clock, color: 'bg-blue-50 text-blue-700' },
  Failed: { icon: AlertCircle, color: 'bg-red-50 text-red-700' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CareIntelligenceClient() {
  const [activeTab, setActiveTab] = useState<string>('test');
  const [testInput, setTestInput] = useState('');

  return (
    <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8962E] shadow-sm">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900">
              OpenHouse Intelligence
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Train and manage your AI assistant&apos;s knowledge base
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'test' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Test Your Assistant
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Preview how your AI assistant responds to customer questions
            </p>
          </div>

          {/* Chat Messages */}
          <div className="max-h-[480px] overflow-y-auto p-5 space-y-4">
            {demoChatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-200 bg-gray-50 text-gray-700'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Brain className="h-3.5 w-3.5 text-[#D4AF37]" />
                      <span className="text-xs font-semibold text-[#D4AF37]">
                        OpenHouse AI
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Type a test question..."
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
              />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'qa' && (
        <div>
          {/* Add Button */}
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#B8962E]"
            >
              <Plus className="h-4 w-4" />
              Add Custom Q&A
            </button>
          </div>

          {/* Q&A List */}
          <div className="space-y-4">
            {qaOverrides.map((qa) => (
              <div
                key={qa.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          qa.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {qa.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        Updated {formatDate(qa.lastUpdated)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Q: {qa.question}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="flex-shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm leading-relaxed text-gray-600">
                    A: {qa.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div>
          {/* Upload Button */}
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#B8962E]"
            >
              <Plus className="h-4 w-4" />
              Upload Document
            </button>
          </div>

          {/* Knowledge Base Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Document
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Type
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Indexed
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Chunks
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {knowledgeDocs.map((doc) => {
                    const statusInfo = docStatusConfig[doc.status];
                    const StatusIcon = statusInfo.icon;
                    return (
                      <tr
                        key={doc.id}
                        className="transition-colors hover:bg-gray-50/60"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {doc.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            {doc.type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {formatDate(doc.indexedDate)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">
                          {doc.chunks > 0 ? doc.chunks : '--'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.color}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {doc.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <Info className="h-4 w-4 flex-shrink-0 text-gray-400" />
        <p className="text-xs text-gray-500">
          Intelligence is trained on your installer content and system
          documentation. Responses are generated using your knowledge base and
          custom Q&A overrides.
        </p>
      </div>
    </div>
  );
}
