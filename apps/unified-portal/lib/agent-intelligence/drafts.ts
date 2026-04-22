import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared types + helpers for the Drafts screen (Session 2).
 *
 * The draft review screen reads `pending_drafts` rows directly. Recipient
 * fields (name, email, phone) are resolved against the source table that
 * matches draft_type — today that's listings.vendor_* for vendor updates.
 * Every helper here has to be defensive: the `recipient_id` is a free-form
 * string written by the voice extractor, so it could be a listing UUID or a
 * plain address reference like "14 Oakfield".
 */

export type DraftStatus =
  | 'pending_review'
  | 'sent'
  | 'sent_external'
  | 'discarded'
  | 'undone';

export interface DraftRecipient {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: 'listing_vendor' | 'unknown';
  address?: string | null;
}

export interface DraftRecord {
  id: string;
  userId: string;
  tenantId: string | null;
  draftType: string;
  status: DraftStatus;
  sendMethod: 'email' | 'whatsapp' | 'sms' | null;
  recipient: DraftRecipient;
  subject: string;
  body: string;
  contextChips: Array<{ id: string; label: string; detail: string | null }>;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
}

export function draftTypeLabel(type: string): string {
  switch (type) {
    case 'vendor_update':
      return 'Vendor update';
    case 'landlord_statement':
      return 'Landlord statement';
    case 'buyer_followup':
      return 'Buyer follow-up';
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export async function resolveRecipient(
  supabase: SupabaseClient,
  draftType: string,
  recipientId: string | null,
): Promise<DraftRecipient> {
  if (!recipientId) {
    return { id: null, name: null, email: null, phone: null, source: 'unknown' };
  }

  if (draftType === 'vendor_update') {
    const listing = await findListingFromReference(supabase, recipientId);
    if (listing) {
      return {
        id: listing.id,
        name: listing.vendor_name || listing.address || null,
        email: listing.vendor_solicitor_email || null,
        phone: listing.vendor_phone || null,
        address: listing.address || null,
        source: 'listing_vendor',
      };
    }
  }

  // Fallback — display the raw reference so the user sees what the voice heard.
  return {
    id: recipientId,
    name: recipientId,
    email: null,
    phone: null,
    source: 'unknown',
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findListingFromReference(
  supabase: SupabaseClient,
  reference: string,
): Promise<any | null> {
  if (UUID_REGEX.test(reference)) {
    const { data } = await supabase
      .from('listings')
      .select('id, address, vendor_name, vendor_phone, vendor_solicitor_email')
      .eq('id', reference)
      .maybeSingle();
    if (data) return data;
  }

  const { data: matches } = await supabase
    .from('listings')
    .select('id, address, vendor_name, vendor_phone, vendor_solicitor_email')
    .ilike('address', `%${reference}%`)
    .limit(1);
  return matches?.[0] || null;
}

/**
 * Convert a pending_drafts row + resolved recipient into the shape the UI
 * consumes. Centralises the content_json decoding so the API route and the
 * review route stay in sync.
 */
export function toDraftRecord(row: any, recipient: DraftRecipient): DraftRecord {
  const content = row.content_json || {};
  const subject = extractSubject(content, recipient);
  const body = extractBody(content);
  const contextChips = extractContextChips(content, recipient);

  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    draftType: row.draft_type,
    status: row.status,
    sendMethod: row.send_method ?? null,
    recipient,
    subject,
    body,
    contextChips,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at ?? null,
  };
}

function extractSubject(content: any, recipient: DraftRecipient): string {
  if (typeof content.subject === 'string' && content.subject.trim()) {
    return content.subject.trim();
  }
  // Vendor updates never get a subject from the voice extractor today, so we
  // derive a sensible one that the user can edit.
  const addr = recipient.address || recipient.name || 'your property';
  return `Update on ${addr}`;
}

function extractBody(content: any): string {
  if (typeof content.body === 'string' && content.body.trim()) {
    return content.body.trim();
  }
  if (typeof content.update_summary === 'string') {
    return content.update_summary.trim();
  }
  return '';
}

function extractContextChips(
  content: any,
  recipient: DraftRecipient,
): Array<{ id: string; label: string; detail: string | null }> {
  const chips: Array<{ id: string; label: string; detail: string | null }> = [];

  if (recipient.address) {
    chips.push({
      id: 'property',
      label: recipient.address,
      detail: recipient.name && recipient.name !== recipient.address
        ? `Vendor: ${recipient.name}`
        : null,
    });
  }

  if (typeof content.source_viewing_id === 'string') {
    chips.push({
      id: 'viewing',
      label: 'From a logged viewing',
      detail: content.source_viewing_id,
    });
  }

  if (Array.isArray(content.source_facts)) {
    for (const fact of content.source_facts.slice(0, 3)) {
      chips.push({ id: `fact_${chips.length}`, label: String(fact), detail: null });
    }
  }

  return chips;
}

/**
 * Format relative timestamps for the list view. Keeps Irish peer-to-peer tone.
 */
export function relativeTimestamp(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diffMs = now - then;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) {
    const d = new Date(then);
    return `yesterday at ${d.toLocaleTimeString('en-IE', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;
  }
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}
