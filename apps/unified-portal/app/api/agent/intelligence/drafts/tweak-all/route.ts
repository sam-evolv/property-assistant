import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/intelligence/drafts/tweak-all
 *
 * BUG-13 batch operations. Rewrites every draft in `draftIds` in a single
 * LLM pass using `instruction` ("make these warmer", "add a viewing
 * offer", etc). Returns the new subject + body for each draft id and
 * persists the rewrite into `pending_drafts.content_json`.
 *
 * Body: { draftIds: string[]; instruction: string }
 * Response: { rewrites: Array<{ id, subject, body }> }
 *
 * Single OpenAI call by design — iterating per-draft would multiply cost
 * with little benefit when the instruction applies to the batch.
 *
 * TODO(BUG-04): The audit reported the drafts counter going 78 → 83 after
 * a 3-draft tweak — i.e. originals appear alongside the rewritten copies.
 * Reading this route, the loop only does .update() in place, so the row
 * count cannot grow from this code path. The mechanism behind the symptom
 * is not yet understood. The structured logs below give us the diagnostic
 * surface to figure it out the next time it reproduces — log the inputs,
 * the per-row update outcomes, and the totals at exit.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const draftIds: string[] = Array.isArray(body?.draftIds) ? body.draftIds : [];
    const instruction: string = typeof body?.instruction === 'string' ? body.instruction.trim() : '';

    if (!draftIds.length) {
      return NextResponse.json({ error: 'draftIds is required' }, { status: 400 });
    }
    if (!instruction || instruction.length < 2) {
      return NextResponse.json({ error: 'instruction is required' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[tweak-all] entry', {
      userId: user.id,
      draftIdCount: draftIds.length,
      draftIds,
      instructionLength: instruction.length,
    });

    const supabase = getSupabaseAdmin();
    const { data: rows, error: fetchErr } = await supabase
      .from('pending_drafts')
      .select('id, content_json, user_id')
      .in('id', draftIds)
      .eq('user_id', user.id);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    const drafts = (rows || []).filter((r: any) => r.content_json);
    if (!drafts.length) {
      return NextResponse.json({ error: 'No drafts found for that user' }, { status: 404 });
    }

    const llmInput = drafts.map((d: any, i: number) => ({
      index: i,
      id: d.id,
      subject: d.content_json?.subject ?? '',
      body: d.content_json?.body ?? '',
    }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You rewrite a batch of draft emails for an Irish estate agent. Apply the user instruction to every draft. Keep the recipient name, the property reference, and any factual content (dates, addresses, prices) identical. Change tone, structure, and additions only as the instruction directs. Return ONLY a JSON object of shape { "rewrites": [{ "index": number, "subject": string, "body": string }] } — one entry per input, in the same order. No prose, no markdown, no commentary.',
        },
        {
          role: 'user',
          content: `Instruction: ${instruction}\n\nDrafts:\n${JSON.stringify(llmInput, null, 2)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json({ error: 'Empty rewrite from model' }, { status: 502 });
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err: any) {
      return NextResponse.json({ error: 'Could not parse rewrite JSON' }, { status: 502 });
    }
    const rewrites = Array.isArray(parsed?.rewrites) ? parsed.rewrites : [];

    const out: Array<{ id: string; subject: string; body: string }> = [];
    const failures: Array<{ id: string; reason: string }> = [];
    for (const r of rewrites) {
      const idx = typeof r?.index === 'number' ? r.index : -1;
      if (idx < 0 || idx >= drafts.length) {
        failures.push({ id: 'unknown', reason: `bad-index:${idx}` });
        continue;
      }
      const draft = drafts[idx];
      const subject = typeof r?.subject === 'string' ? r.subject : (draft.content_json?.subject ?? '');
      const draftBody = typeof r?.body === 'string' ? r.body : (draft.content_json?.body ?? '');
      const nextContent = { ...(draft.content_json || {}), subject, body: draftBody };
      const { error: updErr, count: updCount } = await supabase
        .from('pending_drafts')
        .update({
          content_json: nextContent,
          updated_at: new Date().toISOString(),
        }, { count: 'exact' })
        .eq('id', draft.id)
        .eq('user_id', user.id);
      if (updErr) {
        console.error('[tweak-all] update failed', { id: draft.id, message: updErr.message });
        failures.push({ id: draft.id, reason: updErr.message });
        continue;
      }
      console.log('[tweak-all] update', { id: draft.id, rowCount: updCount ?? null });
      out.push({ id: draft.id, subject, body: draftBody });
    }

    console.log('[tweak-all] exit', {
      userId: user.id,
      requested: draftIds.length,
      updated: out.length,
      failed: failures.length,
      failures: failures.length ? failures : undefined,
    });

    return NextResponse.json({ rewrites: out });
  } catch (error: any) {
    console.error('[tweak-all] failed', { message: error?.message });
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
