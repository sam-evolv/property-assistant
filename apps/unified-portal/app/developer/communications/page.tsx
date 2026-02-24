'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Users,
  Mail,
  MessageSquare,
  Bell,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  Search,
  Plus,
  FileText,
  Calendar,
  ChevronRight,
  MoreHorizontal,
  UserPlus,
  Edit3,
  Trash2,
  Eye,
  Copy,
  Sparkles,
} from 'lucide-react';

import { DataTable, Column } from '@/components/ui/DataTable';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert } from '@/components/ui/ProactiveAlerts';
import { ActivityFeedWidget } from '@/components/ui/ActivityFeed';
import type { Activity } from '@/components/ui/ActivityFeed';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';

// Types
type MessageStatus = 'draft' | 'scheduled' | 'sent' | 'delivered' | 'failed';
type MessageType = 'email' | 'sms' | 'push' | 'in-app';
type TeamRole = 'admin' | 'sales' | 'customer-service' | 'contractor';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatar?: string;
  lastActive: Date;
  status: 'online' | 'offline' | 'away';
  messagesHandled: number;
}

interface MessageTemplate {
  id: string;
  name: string;
  subject?: string;
  content: string;
  type: MessageType;
  category: string;
  usageCount: number;
  lastUsed?: Date;
}

interface CommunicationLog {
  id: string;
  recipient: string;
  recipientEmail: string;
  subject: string;
  type: MessageType;
  status: MessageStatus;
  sentAt?: Date;
  scheduledFor?: Date;
  sentBy: string;
  openRate?: number;
  clickRate?: number;
}

// Mock Data
const mockTeamMembers: TeamMember[] = [
  { id: '1', name: 'John Murphy', email: 'j.murphy@openhouse.ie', role: 'admin', status: 'online', lastActive: new Date(), messagesHandled: 156 },
  { id: '2', name: 'Sarah Walsh', email: 's.walsh@openhouse.ie', role: 'sales', status: 'online', lastActive: new Date(), messagesHandled: 89 },
  { id: '3', name: 'Kevin O\'Brien', email: 'k.obrien@openhouse.ie', role: 'customer-service', status: 'away', lastActive: new Date(Date.now() - 30 * 60 * 1000), messagesHandled: 203 },
  { id: '4', name: 'Lisa Dolan', email: 'l.dolan@openhouse.ie', role: 'sales', status: 'offline', lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), messagesHandled: 67 },
  { id: '5', name: 'ABC Kitchens', email: 'contact@abckitchens.ie', role: 'contractor', status: 'offline', lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000), messagesHandled: 12 },
];

const mockTemplates: MessageTemplate[] = [
  { id: '1', name: 'Welcome Email', subject: 'Welcome to Your New Home', content: 'Dear [Name], Welcome to...', type: 'email', category: 'Onboarding', usageCount: 45, lastUsed: new Date() },
  { id: '2', name: 'Kitchen Selection Reminder', subject: 'Action Required: Kitchen Selections', content: 'Hi [Name], Your kitchen selection deadline is approaching...', type: 'email', category: 'Selections', usageCount: 28, lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
  { id: '3', name: 'Snag Resolution Update', subject: 'Your Snag Has Been Resolved', content: 'Dear [Name], We\'re pleased to inform you...', type: 'email', category: 'Snagging', usageCount: 67, lastUsed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
  { id: '4', name: 'Document Upload Notification', subject: 'New Document Available', content: 'Hi [Name], A new document has been uploaded...', type: 'email', category: 'Documents', usageCount: 112, lastUsed: new Date() },
  { id: '5', name: 'Completion Congratulations', subject: 'Congratulations on Your New Home!', content: 'Dear [Name], Congratulations on completing...', type: 'email', category: 'Handover', usageCount: 23 },
];

const mockCommunicationLogs: CommunicationLog[] = [
  { id: '1', recipient: 'A. Murphy', recipientEmail: 'a.murphy@email.com', subject: 'Kitchen Selection Reminder', type: 'email', status: 'delivered', sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000), sentBy: 'John Murphy', openRate: 100 },
  { id: '2', recipient: 'S. Walsh', recipientEmail: 's.walsh@email.com', subject: 'Welcome to Your New Home', type: 'email', status: 'delivered', sentAt: new Date(Date.now() - 4 * 60 * 60 * 1000), sentBy: 'Sarah Walsh', openRate: 100, clickRate: 50 },
  { id: '3', recipient: 'P. Burke', recipientEmail: 'p.burke@email.com', subject: 'Document Upload Notification', type: 'email', status: 'sent', sentAt: new Date(Date.now() - 1 * 60 * 60 * 1000), sentBy: 'System' },
  { id: '4', recipient: 'All Homeowners (Unit 30-50)', recipientEmail: 'bulk', subject: 'Important Update', type: 'email', status: 'scheduled', scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), sentBy: 'John Murphy' },
  { id: '5', recipient: 'J. O\'Connor', recipientEmail: 'j.oconnor@email.com', subject: 'Snag Resolution Update', type: 'email', status: 'failed', sentAt: new Date(Date.now() - 30 * 60 * 1000), sentBy: 'Kevin O\'Brien' },
];

const roleConfig: Record<TeamRole, { label: string; color: string; bgColor: string }> = {
  admin: { label: 'Admin', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  sales: { label: 'Sales', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'customer-service': { label: 'Customer Service', color: 'text-green-600', bgColor: 'bg-green-50' },
  contractor: { label: 'Contractor', color: 'text-amber-600', bgColor: 'bg-amber-50' },
};

const statusConfig: Record<MessageStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  draft: { label: 'Draft', color: 'text-gray-500', icon: Edit3 },
  scheduled: { label: 'Scheduled', color: 'text-blue-500', icon: Clock },
  sent: { label: 'Sent', color: 'text-amber-500', icon: Send },
  delivered: { label: 'Delivered', color: 'text-green-500', icon: CheckCircle },
  failed: { label: 'Failed', color: 'text-red-500', icon: AlertCircle },
};

// Team Member Card
function TeamMemberCard({ member }: { member: TeamMember }) {
  const role = roleConfig[member.role];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {member.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                member.status === 'online' ? 'bg-green-500' :
                member.status === 'away' ? 'bg-amber-500' : 'bg-gray-400'
              )}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{member.name}</p>
            <p className="text-xs text-gray-500">{member.email}</p>
          </div>
        </div>
        <button className="p-1 hover:bg-gray-100 rounded transition-colors">
          <MoreHorizontal className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="outline" size="sm" className={cn(role.bgColor, role.color)}>
          {role.label}
        </Badge>
        <span className="text-xs text-gray-500">
          {member.messagesHandled} messages
        </span>
      </div>
    </div>
  );
}

// Template Card
function TemplateCard({
  template,
  onUse,
  onEdit,
}: {
  template: MessageTemplate;
  onUse: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gray-100">
            <Mail className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{template.name}</p>
            <Badge variant="outline" size="sm" className="mt-1">
              {template.category}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={onUse}
            className="p-1.5 hover:bg-gold-50 rounded transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-gold-500" />
          </button>
        </div>
      </div>

      {template.subject && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-1">
          Subject: {template.subject}
        </p>
      )}

      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{template.content}</p>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Used {template.usageCount} times</span>
        {template.lastUsed && (
          <span>
            Last: {template.lastUsed.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  );
}

// Main Communications Hub Page
export default function CommunicationsHubPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'templates' | 'history'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);

  // Stats
  const stats = useMemo(() => ({
    totalSent: mockCommunicationLogs.filter(l => l.status === 'sent' || l.status === 'delivered').length,
    scheduled: mockCommunicationLogs.filter(l => l.status === 'scheduled').length,
    failed: mockCommunicationLogs.filter(l => l.status === 'failed').length,
    teamMembers: mockTeamMembers.length,
    onlineMembers: mockTeamMembers.filter(m => m.status === 'online').length,
    avgOpenRate: 78,
  }), []);

  // Alerts
  const alerts: Alert[] = useMemo(() => {
    const alerts: Alert[] = [];

    if (stats.failed > 0) {
      alerts.push({
        id: 'failed-messages',
        title: `${stats.failed} message(s) failed to send`,
        description: 'Review and retry failed communications',
        priority: 'warning',
        count: stats.failed,
      });
    }

    if (stats.scheduled > 0) {
      alerts.push({
        id: 'scheduled',
        title: `${stats.scheduled} message(s) scheduled`,
        description: 'Upcoming automated communications',
        priority: 'info',
        count: stats.scheduled,
      });
    }

    return alerts;
  }, [stats]);

  // Recent Activity
  const recentActivity: Activity[] = useMemo(() => {
    return mockCommunicationLogs
      .filter(l => l.sentAt)
      .sort((a, b) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0))
      .slice(0, 5)
      .map(log => ({
        id: log.id,
        type: 'email',
        title: `${log.subject}`,
        description: `Sent to ${log.recipient}`,
        timestamp: log.sentAt!,
        link: '#',
      }));
  }, []);

  // Communication Log Columns
  const logColumns: Column<CommunicationLog>[] = [
    {
      id: 'recipient',
      header: 'Recipient',
      accessor: 'recipient',
      sortable: true,
      cell: (_, row) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{row.recipient}</p>
          <p className="text-xs text-gray-500">{row.recipientEmail !== 'bulk' ? row.recipientEmail : 'Bulk Send'}</p>
        </div>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      accessor: 'subject',
      sortable: true,
      cell: (value) => (
        <span className="text-sm text-gray-900 line-clamp-1">{value as string}</span>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      accessor: 'type',
      sortable: true,
      cell: (value) => (
        <Badge variant="outline" size="sm">
          {(value as string).toUpperCase()}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (value) => {
        const config = statusConfig[value as MessageStatus];
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-1.5">
            <Icon className={cn('w-4 h-4', config.color)} />
            <span className={cn('text-sm', config.color)}>{config.label}</span>
          </div>
        );
      },
    },
    {
      id: 'sentAt',
      header: 'Date',
      accessor: (row) => (row.sentAt || row.scheduledFor)?.toLocaleDateString() || '',
      sortable: true,
      cell: (_, row) => {
        const date = row.sentAt || row.scheduledFor;
        return (
          <span className="text-sm text-gray-600">
            {date?.toLocaleDateString('en-IE', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        );
      },
    },
    {
      id: 'sentBy',
      header: 'Sent By',
      accessor: 'sentBy',
    },
  ];

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Communications Hub</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage team communications and homeowner messaging
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <UserPlus className="w-4 h-4" />
                Add Team Member
              </button>
              <button
                onClick={() => setShowComposeModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors"
              >
                <Send className="w-4 h-4" />
                Compose Message
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: Sparkles },
              { id: 'team', label: 'Team', icon: Users },
              { id: 'templates', label: 'Templates', icon: FileText },
              { id: 'history', label: 'History', icon: Clock },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.id
                    ? 'text-gold-600 border-gold-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats */}
              <StatCardGrid columns={5}>
                <StatCard
                  label="Messages Sent"
                  value={stats.totalSent}
                  icon={Send}
                  iconColor="text-green-500"
                  description="This month"
                />
                <StatCard
                  label="Scheduled"
                  value={stats.scheduled}
                  icon={Clock}
                  iconColor="text-blue-500"
                />
                <StatCard
                  label="Failed"
                  value={stats.failed}
                  icon={AlertCircle}
                  iconColor="text-red-500"
                />
                <StatCard
                  label="Team Members"
                  value={stats.teamMembers}
                  suffix={` (${stats.onlineMembers} online)`}
                  icon={Users}
                  iconColor="text-purple-500"
                />
                <StatCard
                  label="Avg Open Rate"
                  value={stats.avgOpenRate}
                  suffix="%"
                  icon={Eye}
                  iconColor="text-gold-500"
                />
              </StatCardGrid>

              {/* Alerts */}
              {alerts.length > 0 && <ProactiveAlertsWidget alerts={alerts} />}

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div className="lg:col-span-2">
                  <ActivityFeedWidget
                    activities={recentActivity}
                    title="Recent Communications"
                    maxItems={5}
                  />
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowComposeModal(true)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="p-2 rounded-lg bg-gold-50">
                        <Mail className="w-4 h-4 text-gold-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Send Email</p>
                        <p className="text-xs text-gray-500">Compose a new message</p>
                      </div>
                    </button>
                    <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <div className="p-2 rounded-lg bg-blue-50">
                        <Bell className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Send Notification</p>
                        <p className="text-xs text-gray-500">Push notification to app</p>
                      </div>
                    </button>
                    <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <div className="p-2 rounded-lg bg-purple-50">
                        <MessageSquare className="w-4 h-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Bulk Message</p>
                        <p className="text-xs text-gray-500">Message multiple homeowners</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Communications Table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Communications</h3>
                <DataTable
                  data={mockCommunicationLogs}
                  columns={logColumns}
                  pageSize={5}
                />
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search team members..."
                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
                  />
                </div>
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockTeamMembers
                  .filter(m =>
                    !searchQuery ||
                    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    m.email.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((member) => (
                    <TeamMemberCard key={member.id} member={member} />
                  ))}
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
                  />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors">
                  <Plus className="w-4 h-4" />
                  Create Template
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockTemplates
                  .filter(t =>
                    !searchQuery ||
                    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.category.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onUse={() => {
                        setSelectedTemplate(template);
                        setShowComposeModal(true);
                      }}
                      onEdit={() => console.log('Edit template:', template.id)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <DataTable
              data={mockCommunicationLogs}
              columns={logColumns}
              selectable
              bulkActions={[
                {
                  label: 'Resend',
                  icon: Send,
                  onClick: (ids) => console.log('Resend to', ids),
                },
                {
                  label: 'Delete',
                  icon: Trash2,
                  onClick: (ids) => console.log('Delete', ids),
                  variant: 'danger',
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Compose Modal */}
      <SlideOver
        open={showComposeModal}
        onClose={() => {
          setShowComposeModal(false);
          setSelectedTemplate(null);
        }}
        title="Compose Message"
        subtitle={selectedTemplate ? `Using template: ${selectedTemplate.name}` : undefined}
        width="lg"
        footer={
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Clock className="w-4 h-4" />
              Schedule
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowComposeModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors">
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="text"
              placeholder="Search homeowners or enter email..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              defaultValue={selectedTemplate?.subject || ''}
              placeholder="Enter subject..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
            />
          </div>

          {/* Message Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              rows={12}
              defaultValue={selectedTemplate?.content || ''}
              placeholder="Write your message..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 resize-none"
            />
          </div>

          {/* Template Variables */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-600 mb-2">Available Variables</p>
            <div className="flex flex-wrap gap-2">
              {['[Name]', '[Unit]', '[Development]', '[Date]', '[Link]'].map((v) => (
                <button
                  key={v}
                  className="px-2 py-1 text-xs font-mono text-gold-600 bg-gold-50 rounded hover:bg-gold-100 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
