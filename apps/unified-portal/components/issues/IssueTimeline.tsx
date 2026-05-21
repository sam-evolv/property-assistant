'use client';

/**
 * Timeline of issue_events. Spec section 6.5.
 *
 * Events to render:
 *   - snag_logged: "Logged by [actor]"
 *   - analysis_completed: "AI assessment completed"
 *   - flagged: "Flagged by [developer name]"
 *   - unflagged: "Flag removed"
 *   - note_added: "Note added by [actor]"
 *   - status_changed: "Status changed from X to Y by [actor]"
 *
 * Events arrive ordered ascending; we render newest-first to mirror
 * the notes list.
 */

import {
  Flag,
  FlagOff,
  MessageSquarePlus,
  PenLine,
  Sparkles,
  ArrowRight,
  CircleDot,
} from 'lucide-react';
import { IssueEvent } from './types';

interface IssueTimelineProps {
  events: IssueEvent[];
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function actorDisplay(event: IssueEvent): string {
  if (event.actor_email) return event.actor_email;
  if (event.actor_type) return event.actor_type.replace('_', ' ');
  return 'system';
}

function describe(event: IssueEvent): { icon: typeof Flag; text: string } {
  const actor = actorDisplay(event);
  switch (event.event_type) {
    case 'snag_logged':
      return { icon: PenLine, text: `Logged by ${actor}` };
    case 'analysis_completed':
      return { icon: Sparkles, text: 'AI assessment completed' };
    case 'flagged':
      return { icon: Flag, text: `Flagged by ${actor}` };
    case 'unflagged':
      return { icon: FlagOff, text: 'Flag removed' };
    case 'note_added':
      return { icon: MessageSquarePlus, text: `Note added by ${actor}` };
    case 'status_changed': {
      const meta = event.metadata ?? {};
      const from = typeof meta.from === 'string' ? meta.from : 'previous';
      const to = typeof meta.to === 'string' ? meta.to : 'new';
      return { icon: ArrowRight, text: `Status changed from ${from} to ${to} by ${actor}` };
    }
    default:
      return { icon: CircleDot, text: event.event_type.replace('_', ' ') };
  }
}

export function IssueTimeline({ events }: IssueTimelineProps) {
  if (events.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="text-body-sm font-semibold text-neutral-900">Timeline</h3>
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-body-sm text-neutral-500">
          No activity yet.
        </div>
      </section>
    );
  }

  const ordered = [...events].reverse();

  return (
    <section className="space-y-3">
      <h3 className="text-body-sm font-semibold text-neutral-900">Timeline</h3>
      <ol className="space-y-2">
        {ordered.map((event) => {
          const { icon: Icon, text } = describe(event);
          return (
            <li key={event.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm text-neutral-900">{text}</div>
                <div className="text-caption text-neutral-500">
                  {formatTimestamp(event.created_at)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
