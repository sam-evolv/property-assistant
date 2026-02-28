'use client';

import { useState } from 'react';
import {
  Send,
  Mail,
  FileText,
  Zap,
  Clock,
  Users,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatCard {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

interface Template {
  id: number;
  title: string;
  description: string;
  category: string;
  lastUsed: string;
  usageCount: number;
}

interface Automation {
  id: number;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  lastRun: string;
}

interface HistoryItem {
  id: number;
  recipient: string;
  subject: string;
  template: string;
  sentDate: string;
  status: 'Delivered' | 'Opened' | 'Bounced';
}

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

const tabItems = [
  { key: 'compose', label: 'Compose', icon: Send },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'automations', label: 'Automations', icon: Zap },
  { key: 'history', label: 'History', icon: Clock },
] as const;

const stats: StatCard[] = [
  {
    label: 'Messages Sent',
    value: '1,234',
    icon: Mail,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  {
    label: 'Open Rate',
    value: '78%',
    icon: Eye,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
  {
    label: 'Templates',
    value: '12',
    icon: FileText,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-500',
  },
  {
    label: 'Automations',
    value: '5',
    icon: Zap,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
  },
];

const templates: Template[] = [
  {
    id: 1,
    title: 'Seasonal Solar Tips',
    description: 'Quarterly tips for maximising solar output based on the season',
    category: 'Education',
    lastUsed: '2026-02-01',
    usageCount: 312,
  },
  {
    id: 2,
    title: 'Firmware Update',
    description: 'Notify customers about available inverter firmware updates',
    category: 'Technical',
    lastUsed: '2026-01-15',
    usageCount: 89,
  },
  {
    id: 3,
    title: 'Maintenance Window',
    description: 'Inform customers about scheduled monitoring maintenance',
    category: 'Operational',
    lastUsed: '2026-01-28',
    usageCount: 45,
  },
  {
    id: 4,
    title: 'Activation Reminder',
    description: 'Remind new customers to activate their Care portal',
    category: 'Onboarding',
    lastUsed: '2026-02-10',
    usageCount: 234,
  },
  {
    id: 5,
    title: 'Warranty Expiry Alert',
    description: 'Alert customers whose warranties are approaching expiry',
    category: 'Warranty',
    lastUsed: '2026-02-18',
    usageCount: 67,
  },
];

const automations: Automation[] = [
  {
    id: 1,
    name: 'Welcome Sequence',
    trigger: 'Portal activated',
    action: 'Send 3-email onboarding series',
    enabled: true,
    lastRun: '2026-02-27',
  },
  {
    id: 2,
    name: 'Warranty Expiry Reminder',
    trigger: '90 days before warranty expiry',
    action: 'Send warranty expiry notification',
    enabled: true,
    lastRun: '2026-02-25',
  },
  {
    id: 3,
    name: 'Annual Check-up',
    trigger: 'Installation anniversary',
    action: 'Send annual maintenance reminder',
    enabled: true,
    lastRun: '2026-02-20',
  },
  {
    id: 4,
    name: 'Low Generation Alert',
    trigger: 'System generation < 50% expected',
    action: 'Send performance alert to customer',
    enabled: false,
    lastRun: '2026-01-10',
  },
  {
    id: 5,
    name: 'Seasonal Tips',
    trigger: 'Start of each quarter',
    action: 'Send seasonal solar tips newsletter',
    enabled: true,
    lastRun: '2026-01-01',
  },
];

const historyItems: HistoryItem[] = [
  {
    id: 1,
    recipient: "P\u00e1draig O'Sullivan",
    subject: 'Your Spring Solar Tips',
    template: 'Seasonal Solar Tips',
    sentDate: '2026-02-27',
    status: 'Opened',
  },
  {
    id: 2,
    recipient: 'Mary Murphy',
    subject: 'SolarEdge Firmware Update Available',
    template: 'Firmware Update',
    sentDate: '2026-02-26',
    status: 'Delivered',
  },
  {
    id: 3,
    recipient: 'Colm Fitzgerald',
    subject: 'Welcome to SE Systems Care',
    template: 'Welcome Sequence',
    sentDate: '2026-02-25',
    status: 'Opened',
  },
  {
    id: 4,
    recipient: "Siobh\u00e1n O'Brien",
    subject: 'Warranty Expiry Notice',
    template: 'Warranty Expiry Alert',
    sentDate: '2026-02-24',
    status: 'Opened',
  },
  {
    id: 5,
    recipient: 'Brendan Daly',
    subject: 'Activate Your Care Portal',
    template: 'Activation Reminder',
    sentDate: '2026-02-23',
    status: 'Bounced',
  },
  {
    id: 6,
    recipient: 'Aoife McCarthy',
    subject: 'Scheduled Maintenance Notice',
    template: 'Maintenance Window',
    sentDate: '2026-02-22',
    status: 'Delivered',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const historyStatusConfig: Record<
  HistoryItem['status'],
  { color: string }
> = {
  Delivered: { color: 'bg-blue-50 text-blue-700' },
  Opened: { color: 'bg-emerald-50 text-emerald-700' },
  Bounced: { color: 'bg-red-50 text-red-700' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

const categoryColors: Record<string, string> = {
  Education: 'bg-blue-50 text-blue-700 border-blue-200',
  Technical: 'bg-purple-50 text-purple-700 border-purple-200',
  Operational: 'bg-gray-100 text-gray-700 border-gray-200',
  Onboarding: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Warranty: 'bg-amber-50 text-amber-700 border-amber-200',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommunicationsClient() {
  const [activeTab, setActiveTab] = useState<string>('compose');
  const [automationToggles, setAutomationToggles] = useState<Record<number, boolean>>(
    Object.fromEntries(automations.map((a) => [a.id, a.enabled]))
  );

  const toggleAutomation = (id: number) => {
    setAutomationToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900">
          Communications
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Send messages and notifications to customers
        </p>
      </div>

      {/* Stat Cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.iconBg}`}
                >
                  <Icon className={`h-[18px] w-[18px] ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight text-gray-900">
                {card.value}
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-500">
                {card.label}
              </p>
            </div>
          );
        })}
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
      {activeTab === 'compose' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Compose Message
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {/* Recipient */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Recipients
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers, groups, or enter email..."
                  className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                  All Customers (1,247)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                  Active Portals (943)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
                  Unactivated (304)
                </span>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Subject
              </label>
              <input
                type="text"
                placeholder="Enter message subject..."
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Message
              </label>
              <textarea
                rows={8}
                placeholder="Write your message here..."
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400">
                Messages are sent via email and in-portal notification
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#B8962E]"
                >
                  <Send className="h-4 w-4" />
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => {
            const catColor =
              categoryColors[tpl.category] || 'bg-gray-100 text-gray-700 border-gray-200';
            return (
              <div
                key={tpl.id}
                className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${catColor}`}
                  >
                    {tpl.category}
                  </span>
                  <button
                    type="button"
                    className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-gray-900">
                  {tpl.title}
                </h3>
                <p className="mb-4 text-xs leading-relaxed text-gray-500">
                  {tpl.description}
                </p>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="text-[11px] text-gray-400">
                    Used {tpl.usageCount} times
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Last: {formatDate(tpl.lastUsed)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'automations' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Automation Rules
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Automated messages triggered by customer events
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {automations.map((auto) => {
              const isEnabled = automationToggles[auto.id] ?? auto.enabled;
              return (
                <div
                  key={auto.id}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50/60"
                >
                  <button
                    type="button"
                    onClick={() => toggleAutomation(auto.id)}
                    className="flex-shrink-0"
                  >
                    {isEnabled ? (
                      <ToggleRight className="h-6 w-6 text-[#D4AF37]" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-gray-300" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-sm font-semibold ${
                        isEnabled ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {auto.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      <span className="font-medium">Trigger:</span>{' '}
                      {auto.trigger}
                    </p>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Action:</span>{' '}
                      {auto.action}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-400">
                      Last run: {formatDate(auto.lastRun)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Recipient
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Subject
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Template
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Sent
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historyItems.map((item) => {
                  const statusInfo = historyStatusConfig[item.status];
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {item.recipient}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {item.subject}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          {item.template}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {formatDate(item.sentDate)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.color}`}
                        >
                          {item.status === 'Opened' && (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
