'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Radio,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  Eye,
  Plus,
  ArrowLeft,
  Calendar,
  Megaphone,
  Info,
  Wrench,
  Star,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';

// ─── Types ───────────────────────────────────────────────────────
interface Broadcast {
  id: string;
  title: string;
  body: string;
  category: BroadcastCategory;
  target_type: string;
  target_filter: any;
  target_unit_ids: string[] | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduled_for: string | null;
  sent_at: string | null;
  recipients_count: number;
  delivered_count: number;
  read_count: number;
  created_at: string;
}

type BroadcastCategory = 'urgent' | 'update' | 'milestone' | 'maintenance' | 'community' | 'info';

const CATEGORY_CONFIG: Record<BroadcastCategory, { label: string; color: string; bgColor: string; icon: any }> = {
  urgent: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', icon: AlertTriangle },
  update: { label: 'Update', color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200', icon: Info },
  milestone: { label: 'Milestone', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', icon: Star },
  maintenance: { label: 'Maintenance', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', icon: Wrench },
  community: { label: 'Community', color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200', icon: MessageSquare },
  info: { label: 'Info', color: 'text-grey-600', bgColor: 'bg-grey-50 border-grey-200', icon: Info },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-grey-100 text-grey-700' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
  sending: { label: 'Sending', color: 'bg-amber-100 text-amber-700' },
  sent: { label: 'Sent', color: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
};

// ─── Component ───────────────────────────────────────────────────
export default function BroadcastsPage() {
  const { developmentId } = useCurrentContext();

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [sending, setSending] = useState(false);

  // Composer state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<BroadcastCategory>('community');
  const [targetType, setTargetType] = useState('all');
  const [scheduledFor, setScheduledFor] = useState('');

  // Stats
  const totalSent = broadcasts.filter(b => b.status === 'sent').length;
  const totalRecipients = broadcasts.reduce((sum, b) => sum + (b.recipients_count || 0), 0);
  const totalRead = broadcasts.reduce((sum, b) => sum + (b.read_count || 0), 0);
  const avgReadRate = totalRecipients > 0 ? Math.round((totalRead / totalRecipients) * 100) : 0;

  const fetchBroadcasts = useCallback(async () => {
    if (!developmentId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ developmentId });
      const res = await fetch(`/api/broadcasts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data.broadcasts || []);
      }
    } catch (error) {
      console.error('[Broadcasts] Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim() || !developmentId) return;

    setSending(true);
    try {
      const res = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          development_id: developmentId,
          title: title.trim(),
          body: body.trim(),
          category,
          target_type: targetType,
          scheduled_for: scheduledFor || null,
        }),
      });

      if (res.ok) {
        // Reset form and refresh
        setTitle('');
        setBody('');
        setCategory('community');
        setTargetType('all');
        setScheduledFor('');
        setShowComposer(false);
        fetchBroadcasts();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send broadcast');
      }
    } catch (error) {
      console.error('[Broadcasts] Send failed:', error);
      alert('Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
  };

  if (!developmentId) {
    return (
      <div className="p-8">
        <EmptyState
          title="Select a Development"
          description="Please select a development from the dropdown above to manage broadcasts."
          lucideIcon={Radio}
        />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grey-900">Broadcasts</h1>
          <p className="text-grey-500 mt-1">Send messages to all purchasers in your development</p>
        </div>
        <button
          onClick={() => setShowComposer(!showComposer)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors font-medium text-sm shadow-sm"
        >
          {showComposer ? (
            <>
              <ArrowLeft className="w-4 h-4" />
              Back to History
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              New Broadcast
            </>
          )}
        </button>
      </div>

      {/* Stats */}
      <StatCardGrid columns={4}>
        <StatCard label="Total Broadcasts" value={totalSent} icon={Send} />
        <StatCard label="Total Recipients" value={totalRecipients} icon={Users} />
        <StatCard label="Total Read" value={totalRead} icon={Eye} />
        <StatCard label="Avg Read Rate" value={`${avgReadRate}%`} icon={CheckCircle} />
      </StatCardGrid>

      {showComposer ? (
        /* ─── Composer ───────────────────────────────────────────── */
        <div className="bg-white rounded-xl border border-grey-200 shadow-sm">
          <div className="p-6 border-b border-grey-100">
            <h2 className="text-lg font-semibold text-grey-900 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-gold-500" />
              New Broadcast
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-3">Category</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {(Object.keys(CATEGORY_CONFIG) as BroadcastCategory[]).map((cat) => {
                  const config = CATEGORY_CONFIG[cat];
                  const Icon = config.icon;
                  const isActive = category === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-sm',
                        isActive
                          ? `${config.bgColor} border-current ${config.color} ring-2 ring-current/20`
                          : 'border-grey-200 text-grey-600 hover:border-grey-300 hover:bg-grey-50'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter broadcast title..."
                className="w-full px-4 py-2.5 border border-grey-200 rounded-lg text-grey-900 placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition"
                maxLength={200}
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-2">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message to purchasers..."
                rows={5}
                className="w-full px-4 py-2.5 border border-grey-200 rounded-lg text-grey-900 placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition resize-y"
                maxLength={2000}
              />
              <p className="text-xs text-grey-400 mt-1">{body.length}/2000 characters</p>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-3">Send To</label>
              <div className="space-y-2">
                {[
                  { value: 'all', label: 'All purchasers', description: 'Everyone in this development' },
                  { value: 'pipeline_stage', label: 'By pipeline stage', description: 'Purchasers at a specific stage' },
                  { value: 'unit_type', label: 'By house type', description: 'Purchasers of a specific house type' },
                  { value: 'custom', label: 'Select individual units', description: 'Hand-pick specific units' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition',
                      targetType === option.value
                        ? 'border-gold-500 bg-gold-50/50'
                        : 'border-grey-200 hover:border-grey-300'
                    )}
                  >
                    <input
                      type="radio"
                      name="targetType"
                      value={option.value}
                      checked={targetType === option.value}
                      onChange={(e) => setTargetType(e.target.value)}
                      className="w-4 h-4 text-gold-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-grey-900">{option.label}</p>
                      <p className="text-xs text-grey-500">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Timing */}
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-3">Timing</label>
              <div className="flex gap-4">
                <label
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition flex-1',
                    !scheduledFor
                      ? 'border-gold-500 bg-gold-50/50'
                      : 'border-grey-200 hover:border-grey-300'
                  )}
                >
                  <input
                    type="radio"
                    name="timing"
                    checked={!scheduledFor}
                    onChange={() => setScheduledFor('')}
                    className="w-4 h-4 text-gold-500"
                  />
                  <Send className="w-4 h-4 text-grey-500" />
                  <span className="text-sm font-medium text-grey-900">Send now</span>
                </label>
                <label
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition flex-1',
                    scheduledFor
                      ? 'border-gold-500 bg-gold-50/50'
                      : 'border-grey-200 hover:border-grey-300'
                  )}
                >
                  <input
                    type="radio"
                    name="timing"
                    checked={!!scheduledFor}
                    onChange={() => setScheduledFor(new Date(Date.now() + 3600000).toISOString().slice(0, 16))}
                    className="w-4 h-4 text-gold-500"
                  />
                  <Clock className="w-4 h-4 text-grey-500" />
                  <span className="text-sm font-medium text-grey-900">Schedule</span>
                </label>
              </div>
              {scheduledFor && (
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="mt-3 w-full px-4 py-2.5 border border-grey-200 rounded-lg text-grey-900 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition"
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-grey-100">
              <button
                onClick={() => setShowComposer(false)}
                className="px-4 py-2 text-sm text-grey-600 hover:text-grey-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!title.trim() || !body.trim() || sending}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gold-500 text-white rounded-lg hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : scheduledFor ? (
                  <>
                    <Calendar className="w-4 h-4" />
                    Schedule Broadcast
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Broadcast
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Broadcast History ──────────────────────────────────── */
        <div className="bg-white rounded-xl border border-grey-200 shadow-sm">
          <div className="p-6 border-b border-grey-100">
            <h2 className="text-lg font-semibold text-grey-900">Broadcast History</h2>
          </div>

          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-grey-400" />
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="p-12">
              <EmptyState
                title="No broadcasts yet"
                description="Send your first broadcast to communicate with all purchasers in this development."
                lucideIcon={Radio}
              />
            </div>
          ) : (
            <div className="divide-y divide-grey-100">
              {broadcasts.map((broadcast) => {
                const catConfig = CATEGORY_CONFIG[broadcast.category] || CATEGORY_CONFIG.info;
                const statusConfig = STATUS_CONFIG[broadcast.status] || STATUS_CONFIG.draft;
                const CatIcon = catConfig.icon;

                return (
                  <div key={broadcast.id} className="p-5 hover:bg-grey-50/50 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={cn('p-2 rounded-lg', catConfig.bgColor)}>
                          <CatIcon className={cn('w-4 h-4', catConfig.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-grey-900 truncate">
                              {broadcast.title}
                            </h3>
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', statusConfig.color)}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="text-sm text-grey-600 line-clamp-2">{broadcast.body}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-grey-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {broadcast.recipients_count} recipients
                            </span>
                            {broadcast.status === 'sent' && (
                              <>
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  {broadcast.delivered_count} delivered
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {broadcast.read_count} read
                                </span>
                              </>
                            )}
                            <span>
                              {broadcast.sent_at
                                ? timeAgo(broadcast.sent_at)
                                : broadcast.scheduled_for
                                  ? `Scheduled: ${formatDate(broadcast.scheduled_for)}`
                                  : timeAgo(broadcast.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
