# Session 13.1 Diagnosis — extract-actions crash

## Root cause (best guess, pending Vercel log access)

Session 13 did NOT modify `app/api/agent/intelligence/extract-actions/route.ts`
— git log confirms the last touch was `36342168`, the Session 4B lettings
foundation commit. No Session 13 import transitively reaches this route
either (it imports `voice-actions.ts` only, which has no external deps).

So the 500 is not a direct consequence of Session 13's additions. Three
plausible origins for the deterministic crash, in order of likelihood:

1. **Pre-existing brittleness exposed by a change elsewhere.** The
   extract-actions handler has a single top-level `try/catch` that
   returns 500 on any thrown error. A number of code paths inside
   that handler can throw and all collapse into the same opaque
   500:
   - `getSupabaseAdmin()` calls `createClient` with non-null assertions
     on `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. If
     either is missing in the preview env, the handler throws at
     `line 43` before it can do anything.
   - `buildVoiceContext` runs four Supabase queries (`developments`,
     `listings`, `agent_profiles`, `agent_letting_properties`). If
     preview uses a different Supabase project where any of those
     tables is missing or has a schema drift, the query throws.
   - `process.env.ANTHROPIC_API_KEY` validity — the route checks
     presence but not validity; an invalid key makes Anthropic return
     401, which the `!response.ok` branch turns into 502 (not 500).
     A DNS failure or network-layer error DURING the fetch, on the
     other hand, throws and lands in the outer catch → 500.

2. **Model name drift.** `CLAUDE_MODEL = 'claude-sonnet-4-6'` at
   `route.ts:14`. Anthropic API returns non-2xx for an unknown model
   — handled as 502. Not the root cause.

3. **Symptom masking.** Session 13's client-side error-wording change
   turned the opaque "Couldn't read that one. Tap the mic and try
   again?" into `"I heard 'X' but I'm not sure what you'd like me
   to do. Try again?"` when a transcript is present. The crash
   pre-dates Session 13 but the new wording makes it look like an
   intent-extraction miss rather than a server-side 500. The fix is
   still to stop the 500 — but it's worth noting the reframing here
   so we don't hunt for a Session-13-specific bug that isn't there.

## scheme-resolver.ts fallback audit

The diagnosis claim in `SESSION_13_DIAGNOSIS.md` — "Falls back to
in-memory substring match if the alias table query errors" — was
PARTIALLY true. The current code at
`lib/agent-intelligence/scheme-resolver.ts:60-70` destructures
`{ data, error }` from the Supabase query and only calls the fallback
when `error` is truthy. It does NOT wrap the `await` itself in a
try/catch, so if the Supabase client throws (e.g. table literally
missing → PostgREST 406, network error, RLS rejection), the exception
propagates up out of `resolveSchemeName`. In `draftBuyerFollowups` that
is caught by the skill-level `try/catch` at line ~1359 — so the chat
route is not the failure site. But any caller that doesn't wrap is
exposed.

No other site in the codebase currently calls `resolveSchemeName`
outside `draftBuyerFollowups`, so this hasn't produced a visible 500
yet; the hardening below is preventive.

## Preview vs production Supabase

No explicit `.env.preview` in the repo. `vercel.json` in the repo root
has no env-var overrides. That means preview deployments inherit the
Vercel project env configuration, which usually points at the same
Supabase as production. So the `development_aliases` table IS in
preview's DB. The 500 is not a missing-table failure.

## Fix

One goal: `/api/agent/intelligence/extract-actions` never returns 500.

1. **Stage the handler into labelled try/catches.** Each stage
   logs with `console.error('[extract-actions] <stage>:', error)` so
   future runtime-log reads pinpoint exactly which step fails. Stages:
   `parse_body`, `supabase_init`, `auth`, `build_context`,
   `anthropic_call`, `parse_response`.
2. **Degrade to 200.** On any failure the route returns
   `{ actions: [], transcript, degraded: true, stage: '<stage>' }`
   with status 200. The client falls through to the typed chat flow
   with the raw transcript — same behaviour as when Claude returns
   zero tool calls.
3. **Harden `scheme-resolver.resolveSchemeName`.** Wrap the
   `await supabase.from(...)` in a try/catch rather than relying on
   `{ error }` destructuring so a thrown exception falls through to
   `fallbackSubstringMatch` cleanly.
4. **Harden `captureInferredAlias`.** Wrap the count-check and the
   insert in a try/catch so any Supabase error logs + returns early
   rather than rejecting (currently the `.then(…, …)` swallow only
   covers the insert, not the count probe).
