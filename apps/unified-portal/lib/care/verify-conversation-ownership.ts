/**
 * verifyConversationBelongsToInstallation
 *
 * Stopgap structural cross-check for the homeowner Care chat route.
 *
 * Background. The chat route accepts `installationId` and `conversation_id`
 * from the request body and loads history by `conversation_id` only. Without
 * verifying the conversation actually belongs to the installation, a caller
 * could pass any UUID as `conversation_id` and have another homeowner's
 * history loaded into the model context.
 *
 * Strategy. Until Batch 2 lands a proper homeowner session model, every chat
 * request that includes a `conversation_id` must pass that id through this
 * verifier. The verifier returns a discriminated result so the caller can
 * branch cleanly:
 *
 *   { status: 'ok', conversationId }
 *   { status: 'not_found' }              the conversation does not exist
 *   { status: 'cross_tenant' }           the conversation exists but is on
 *                                        a different installation
 *
 * Callers must respond 404 for BOTH not_found and cross_tenant. The two
 * cases are reported separately so the route can log the cross-tenant
 * variant as a security event without leaking the distinction to the
 * client.
 *
 * Logging contract: the caller should log every `cross_tenant` outcome with
 * the stable tag `[CARE_CROSS_TENANT_CONVERSATION]` so the line can be
 * grepped from production logs. The verifier itself does not log; that is
 * the route's job because it has the request metadata.
 *
 * This helper deliberately accepts the Supabase client by parameter rather
 * than constructing one. That lets the chat route keep its existing service-
 * role client (the homeowner side has no admin session today) and lets the
 * unit test pass a mocked client. When Batch 2 lands a homeowner session,
 * this helper folds into `requireCareSession` and goes away.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ConversationOwnershipResult =
  | { status: 'ok'; conversationId: string }
  | { status: 'not_found' }
  | { status: 'cross_tenant'; actualInstallationId: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyConversationBelongsToInstallation(
  supabase: SupabaseClient,
  conversationId: unknown,
  installationId: unknown,
): Promise<ConversationOwnershipResult> {
  if (typeof conversationId !== 'string' || !UUID_RE.test(conversationId)) {
    return { status: 'not_found' };
  }
  if (typeof installationId !== 'string' || !UUID_RE.test(installationId)) {
    return { status: 'not_found' };
  }

  const { data, error } = await supabase
    .from('care_conversations')
    .select('id, installation_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !data) {
    return { status: 'not_found' };
  }

  if (data.installation_id !== installationId) {
    return { status: 'cross_tenant', actualInstallationId: data.installation_id };
  }

  return { status: 'ok', conversationId: data.id };
}
