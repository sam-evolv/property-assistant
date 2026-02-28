import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { SupportQueueClient } from './support-queue-client';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, db: { schema: 'public' } }
  );
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const assigneeGradients = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-violet-500 to-violet-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
];

function statusToDisplay(status: string): string {
  switch (status) {
    case 'open': return 'Open';
    case 'assigned': return 'Assigned';
    case 'scheduled': return 'Scheduled';
    case 'resolved': return 'Resolved';
    default: return 'Escalated';
  }
}

export default async function SupportQueuePage() {
  let session;
  try {
    session = await requireRole(['installer', 'installer_admin', 'super_admin']);
  } catch {
    return <SupportQueueClient tickets={[]} error="You do not have permission to view this page." />;
  }

  const tenantId = session.tenantId;
  const supabase = getSupabaseAdmin();

  try {
    // Fetch escalations joined with installations, ordered by priority then date
    const { data, error: fetchError } = await supabase
      .from('escalations')
      .select('*, installations(customer_name, address_line_1, city, inverter_model, system_size_kwp, job_reference)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[SupportQueue] Fetch error:', fetchError);
      return <SupportQueueClient tickets={[]} error="Failed to load support queue." />;
    }

    // Sort by priority then date
    const priorityOrder: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };
    const sorted = (data || []).sort((a: any, b: any) => {
      const pa = priorityOrder[a.priority] || 4;
      const pb = priorityOrder[b.priority] || 4;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    let gradientIdx = 0;
    const assigneeGradientMap: Record<string, string> = {};

    const tickets = sorted.map((esc: any, idx: number) => {
      let gradient: string | null = null;
      if (esc.assigned_to) {
        if (!assigneeGradientMap[esc.assigned_to]) {
          assigneeGradientMap[esc.assigned_to] = assigneeGradients[gradientIdx % assigneeGradients.length];
          gradientIdx++;
        }
        gradient = assigneeGradientMap[esc.assigned_to];
      }

      return {
        id: idx + 1,
        priority: (esc.priority || 'medium') as 'critical' | 'high' | 'medium' | 'low',
        title: esc.title || '',
        ref: esc.installations?.job_reference || '',
        customerName: esc.installations?.customer_name || 'Unknown',
        customerAddress: `${esc.installations?.address_line_1 || ''}${esc.installations?.city ? ', ' + esc.installations.city : ''}`,
        diagnosticContext: esc.description || '',
        status: statusToDisplay(esc.status || 'open') as 'Open' | 'Escalated' | 'Assigned' | 'Scheduled' | 'Resolved',
        assignee: esc.assigned_to || null,
        assigneeInitials: esc.assigned_to ? getInitials(esc.assigned_to) : null,
        assigneeGradient: gradient,
        scheduledDate: esc.scheduled_date
          ? new Date(esc.scheduled_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
          : null,
        timeAgo: timeAgo(esc.created_at),
      };
    });

    return <SupportQueueClient tickets={tickets} />;
  } catch (err: any) {
    console.error('[SupportQueue] Error:', err);
    return <SupportQueueClient tickets={[]} error="Failed to load support queue. Please refresh the page." />;
  }
}
