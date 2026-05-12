/**
 * Regression test for the Care chat conversation cross-tenant bleed.
 *
 * Audit finding C002: the chat route loaded conversation history by
 * conversation_id alone, with no link to the installationId in the request
 * body. A caller could pass any conversation_id and have another homeowner's
 * history injected into the model context. The verifier below is the
 * structural cross-check that closes that path.
 *
 * The homeowner Care app has no admin session today (QR-code entry per
 * middleware.ts:37), so a full end-to-end test with two authenticated
 * tenants is not possible without first building the homeowner session
 * model (Batch 2). Per the task spec, the minimum acceptable test is a
 * unit test that exercises the helper with mismatched IDs and verifies the
 * cross_tenant outcome.
 *
 * This test runs against a mocked Supabase client. It does NOT exercise the
 * full route. The full-route end-to-end test will land alongside Batch 2.
 */

import { verifyConversationBelongsToInstallation } from '@/lib/care/verify-conversation-ownership';
import type { SupabaseClient } from '@supabase/supabase-js';

type MockRow = { id: string; installation_id: string } | null;

function makeSupabase(row: MockRow, error: { message: string } | null = null): SupabaseClient {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error }),
  };
  return {
    from: jest.fn().mockReturnValue(builder),
  } as unknown as SupabaseClient;
}

const installA = '11111111-1111-1111-1111-111111111111';
const installB = '22222222-2222-2222-2222-222222222222';
const convoOnA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('verifyConversationBelongsToInstallation', () => {
  it('returns ok when conversation belongs to the requested installation', async () => {
    const supabase = makeSupabase({ id: convoOnA, installation_id: installA });
    const result = await verifyConversationBelongsToInstallation(
      supabase,
      convoOnA,
      installA,
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.conversationId).toBe(convoOnA);
    }
  });

  it('returns cross_tenant when conversation exists on a different installation (THE REGRESSION)', async () => {
    // Conversation lives on installation A. Caller authenticates as
    // installation B and passes installation A's conversation_id. The
    // verifier must report cross_tenant so the route returns 404 and does
    // not load installation A's history.
    const supabase = makeSupabase({ id: convoOnA, installation_id: installA });
    const result = await verifyConversationBelongsToInstallation(
      supabase,
      convoOnA,
      installB,
    );
    expect(result.status).toBe('cross_tenant');
    if (result.status === 'cross_tenant') {
      expect(result.actualInstallationId).toBe(installA);
    }
  });

  it('returns cross_tenant in the reverse direction too', async () => {
    // Symmetry check: conversation on B, request claims to be on A.
    const supabase = makeSupabase({ id: convoOnA, installation_id: installB });
    const result = await verifyConversationBelongsToInstallation(
      supabase,
      convoOnA,
      installA,
    );
    expect(result.status).toBe('cross_tenant');
  });

  it('returns not_found when the conversation does not exist', async () => {
    const supabase = makeSupabase(null);
    const result = await verifyConversationBelongsToInstallation(
      supabase,
      convoOnA,
      installA,
    );
    expect(result.status).toBe('not_found');
  });

  it('returns not_found when supabase reports an error', async () => {
    const supabase = makeSupabase(null, { message: 'db down' });
    const result = await verifyConversationBelongsToInstallation(
      supabase,
      convoOnA,
      installA,
    );
    expect(result.status).toBe('not_found');
  });

  it('returns not_found for a malformed conversation_id', async () => {
    const supabase = makeSupabase({ id: convoOnA, installation_id: installA });
    const result = await verifyConversationBelongsToInstallation(
      supabase,
      'not-a-uuid',
      installA,
    );
    expect(result.status).toBe('not_found');
    // The DB should not be queried at all for a malformed input.
    expect((supabase.from as jest.Mock)).not.toHaveBeenCalled();
  });

  it('returns not_found for a malformed installationId', async () => {
    const supabase = makeSupabase({ id: convoOnA, installation_id: installA });
    const result = await verifyConversationBelongsToInstallation(
      supabase,
      convoOnA,
      'not-a-uuid',
    );
    expect(result.status).toBe('not_found');
    expect((supabase.from as jest.Mock)).not.toHaveBeenCalled();
  });

  it('returns not_found when conversation_id is not a string', async () => {
    const supabase = makeSupabase({ id: convoOnA, installation_id: installA });
    const result = await verifyConversationBelongsToInstallation(
      supabase,
      123 as unknown as string,
      installA,
    );
    expect(result.status).toBe('not_found');
  });
});
