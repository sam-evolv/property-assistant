'use client';

import { useState } from 'react';
import {
  AlertCircle,
  MessageCircle,
  CheckCircle,
  Clock,
  Search,
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
  detail?: string;
}

type TicketStatus = 'Open' | 'Escalated' | 'Assigned' | 'Scheduled' | 'Resolved';
type TicketPriority = 'critical' | 'high' | 'medium' | 'low';
type FilterPill = 'All Tickets' | TicketStatus;

interface Ticket {
  id: number;
  priority: TicketPriority;
  title: string;
  ref: string;
  customerName: string;
  customerAddress: string;
  diagnosticContext: string;
  status: TicketStatus;
  assignee: string | null;
  assigneeInitials: string | null;
  assigneeGradient: string | null;
  scheduledDate: string | null;
  timeAgo: string;
}

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

const statCards: StatCard[] = [
  {
    label: 'Open Escalations',
    value: '3',
    icon: AlertCircle,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
  },
  {
    label: 'Queries Today',
    value: '41',
    icon: MessageCircle,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  {
    label: 'Resolution Rate',
    value: '89%',
    icon: CheckCircle,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    detail: 'AI-resolved',
  },
  {
    label: 'Avg Response Time',
    value: '< 30s',
    icon: Clock,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
    detail: 'AI assistant',
  },
];

const filterPills: FilterPill[] = [
  'All Tickets',
  'Open',
  'Escalated',
  'Assigned',
  'Scheduled',
  'Resolved',
];

const tickets: Ticket[] = [
  {
    id: 412,
    priority: 'critical',
    title: 'Inverter not restarting after power cut',
    ref: 'SE-2025-1198',
    customerName: 'Siobhán Kelleher',
    customerAddress: '3 Riverside Walk, Ballincollig',
    diagnosticContext:
      'Customer completed visual diagnostic flow. AC isolator confirmed ON. Restart attempted — inverter remained on red fault light after 5 min wait. SolarEdge SE3680H, installed Nov 2025.',
    status: 'Open',
    assignee: null,
    assigneeInitials: null,
    assigneeGradient: null,
    scheduledDate: null,
    timeAgo: '1 hour ago',
  },
  {
    id: 411,
    priority: 'critical',
    title: 'No generation for 48 hours',
    ref: 'SE-2025-1142',
    customerName: 'Dermot Crowley',
    customerAddress: '22 Hazel Park, Carrigaline',
    diagnosticContext:
      'System showing 0 kWh for 48+ hours despite clear weather. Visual check — no error lights. AC isolator restart — no change. Monitoring app shows offline. SolarEdge SE5000H.',
    status: 'Assigned',
    assignee: 'David Kelly',
    assigneeInitials: 'DK',
    assigneeGradient: 'from-blue-500 to-blue-600',
    scheduledDate: null,
    timeAgo: '2 hours ago',
  },
  {
    id: 409,
    priority: 'high',
    title: 'Unusual buzzing noise from inverter',
    ref: 'SE-2025-1089',
    customerName: 'Aoife Brennan',
    customerAddress: '7 Birch Lane, Douglas',
    diagnosticContext:
      'Customer reports intermittent buzzing during peak hours. Visual check — no visible damage. Noise occurs during 11am-2pm peak generation. SolarEdge SE3680H.',
    status: 'Scheduled',
    assignee: 'Mark Lynch',
    assigneeInitials: 'ML',
    assigneeGradient: 'from-emerald-500 to-emerald-600',
    scheduledDate: 'Mar 3, 2026',
    timeAgo: '1 day ago',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusStyles: Record<TicketStatus, { bg: string; text: string }> = {
  Open: { bg: 'bg-red-50', text: 'text-red-800' },
  Escalated: { bg: 'bg-orange-50', text: 'text-orange-800' },
  Assigned: { bg: 'bg-blue-50', text: 'text-blue-800' },
  Scheduled: { bg: 'bg-amber-50', text: 'text-amber-800' },
  Resolved: { bg: 'bg-emerald-50', text: 'text-emerald-800' },
};

const priorityDotStyles: Record<TicketPriority, { color: string; glow: boolean }> = {
  critical: { color: 'bg-red-500', glow: true },
  high: { color: 'bg-amber-500', glow: false },
  medium: { color: 'bg-yellow-400', glow: false },
  low: { color: 'bg-gray-400', glow: false },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SupportQueueClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterPill>('All Tickets');

  // Filter tickets based on search query and active pill
  const filteredTickets = tickets.filter((ticket) => {
    // Filter by pill
    if (activeFilter !== 'All Tickets' && ticket.status !== activeFilter) {
      return false;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        ticket.customerName.toLowerCase().includes(query) ||
        ticket.customerAddress.toLowerCase().includes(query) ||
        ticket.title.toLowerCase().includes(query) ||
        ticket.ref.toLowerCase().includes(query) ||
        ticket.diagnosticContext.toLowerCase().includes(query)
      );
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
      {/* ----------------------------------------------------------------- */}
      {/* Page Header                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900">
          Support Queue
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track and manage customer support tickets and escalations
        </p>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Stat Cards                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
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
              {card.detail && (
                <p className="mt-1 text-[11px] text-gray-400">{card.detail}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Search Bar                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by customer name, address, or issue..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-colors focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Filter Pills                                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 flex flex-wrap gap-2">
        {filterPills.map((pill) => {
          const isActive = activeFilter === pill;
          return (
            <button
              key={pill}
              type="button"
              onClick={() => setActiveFilter(pill)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[#FDF8E8] border-[#EED07C] text-[#8B6428]'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {pill}
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Ticket List                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-2">
        {filteredTickets.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">
              No tickets match your current filters.
            </p>
          </div>
        )}

        {filteredTickets.map((ticket) => {
          const dot = priorityDotStyles[ticket.priority];
          const status = statusStyles[ticket.status];

          return (
            <div
              key={ticket.id}
              className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-[#D4AF37] hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                {/* Priority Dot */}
                <div className="flex-shrink-0 pt-1.5">
                  <span
                    className={`block h-2.5 w-2.5 rounded-full ${dot.color}`}
                    style={
                      dot.glow
                        ? {
                            boxShadow: `0 0 6px 2px ${
                              ticket.priority === 'critical'
                                ? 'rgba(239, 68, 68, 0.4)'
                                : 'rgba(245, 158, 11, 0.4)'
                            }`,
                          }
                        : undefined
                    }
                    aria-label={`${ticket.priority} priority`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">
                          #{ticket.id} &mdash; {ticket.title}
                        </h3>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-gray-400">
                        {ticket.ref}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        {ticket.customerName}, {ticket.customerAddress}
                      </p>

                      {/* Diagnostic Context Block */}
                      <div className="mt-1.5 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 leading-relaxed border-l-2 border-[#D4AF37]">
                        <b className="font-semibold text-gray-900">
                          Diagnostic context:
                        </b>{' '}
                        {ticket.diagnosticContext}
                      </div>
                    </div>

                    {/* Right side: status, assignee, time */}
                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.bg} ${status.text}`}
                      >
                        {ticket.status}
                      </span>

                      {/* Assignee Avatar */}
                      {ticket.assigneeInitials ? (
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${ticket.assigneeGradient} text-[10px] font-bold text-white`}
                          title={ticket.assignee ?? undefined}
                        >
                          {ticket.assigneeInitials}
                        </div>
                      ) : (
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400"
                          title="Unassigned"
                        >
                          <span className="text-xs font-bold">?</span>
                        </div>
                      )}

                      {/* Scheduled Date */}
                      {ticket.scheduledDate && (
                        <span className="text-[11px] text-gray-400">
                          {ticket.scheduledDate}
                        </span>
                      )}

                      {/* Time Ago */}
                      <span className="text-[11px] text-gray-400">
                        {ticket.timeAgo}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
