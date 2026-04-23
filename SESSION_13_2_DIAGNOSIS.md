# Session 13.2 Diagnosis — scheme-not-found leaked a placeholder draft

## The leak site

**NOT `draftBuyerFollowups` — it's `draftMessageSkill`.**

Both skills sit behind the `draft_message` / `draft_buyer_followups` tool
names. `draftBuyerFollowups` (the multi-recipient one) calls
`resolveSchemeName` at `agentic-skills.ts:1394` and `continue;`s past
any `not_found` / `ambiguous` / `not_assigned` target with a reason
pushed into `skipped`. That path is correct — no draft row, no
placeholder.

`draftMessageSkill` (single-recipient, `agentic-skills.ts:1049`) is the
leaky one. When the model calls `draft_message` for "Reach out to number
3, Erdon View", OpenAI's tool call includes `recipient_type='buyer'`,
`recipient_name='<model-invented-label>'`, `related_unit='3'`,
`related_scheme='Erdon View'`. The skill then:

1. **Line 1080-1085.** Runs a naive `ilike.%Erdon View%` against
   `developments.name`. Not the Session 13 alias resolver, not
   `resolveSchemeName`. The query returns no row, so `dev === null`,
   `resolvedSchemeName` stays `null`, `resolvedUnitNumber` stays `null`,
   `resolvedEmail` stays `null`, `affectedUnitId` stays `null`.
2. **Line 1103-1111.** Still assembles `unitLabel` ('') and `subject`
   ("Following up — <first 60 chars of context>").
3. **Line 1123-1137.** Builds a draft with
   `recipient.email: resolvedEmail || 'recipient@tbc.invalid'` and
   `affected_record: { kind: 'contact', id: recipientName, label:
   recipientName }`. No unit id, no development id, no real
   purchaser. Every resolved field is a placeholder.
4. **Line 1139-1144.** Returns the envelope with `drafts: [draft]`.
5. **`persistDraftsForEnvelope` (draft-store.ts:89).** Sees
   `drafts.length === 1`, inserts into `pending_drafts` with
   `recipient_id = 'recipient@tbc.invalid'`, `content_json` carrying
   the placeholder draft body.

End result: a live row in `pending_drafts` (id
`1d4df217-6bf0-4c4f-a8ab-7c5552da3c2e`) that a careless Approve tap
would send to an invalid address. The model's streaming reply then
described the draft (`"Drafted email to buyers of Erdon View Unit 3"`)
because the envelope summary said `"Drafted email to <name>"` —
nothing in the chat route stopped it from relaying the success
language.

## Why the chat route didn't catch it

The Session 6D anti-hallucination guard at `chat/route.ts:278` fires
only when a draft-producing tool was called AND `totalDraftsPersisted
=== 0`. In this case the skill DID persist a draft — a placeholder
one — so `totalDraftsPersisted === 1` and the guard didn't trip. It's
a contract-violation hole: the skill counts a placeholder draft as
success, and the guard only catches "zero drafts persisted" not
"placeholder drafts persisted".

Additionally, when `draftBuyerFollowups` DOES return an envelope with
`drafts.length === 0` and `meta.skipped.length > 0`, the chat route
currently has no injection that forces the model to relay the skipped
reasons verbatim. The model is left to summarise — and can invent.

## Fix summary shipping with this commit

1. **`draftMessageSkill` — strict scheme/unit resolution.** If
   `related_scheme` or `related_unit` is supplied, they MUST resolve
   via `resolveSchemeName` + `resolveUnitIdentifier`. Any failure
   returns the envelope with `drafts: []` + `meta.skipped: [{ ref,
   reason }]`. No fall-through to a placeholder draft when the user
   asked for a specific unit. The scheme-less
   "draft-a-message-to-a-named-contact" path (no `related_scheme`
   and no `related_unit`) is preserved — that's a legitimate
   draft-to-a-named-person flow.

2. **`persistDraftsForEnvelope` — defence-in-depth guard.** A draft
   whose recipient email is the exact placeholder
   `recipient@tbc.invalid` is refused at the persistence layer.
   Logged with `console.error('[persistDraftsForEnvelope] BLOCKED:
   placeholder recipient', …)` and the refused draft is tracked in
   the returned envelope's `meta.blocked` list so the chat route
   knows to surface the failure. `buyer@tbc.invalid` and
   `solicitor@tbc.invalid` remain allowed — those are legitimate
   "real record, email missing, fill before approving" cases
   where the unit / solicitor is resolved.

3. **Chat route post-skill system message.** When any envelope this
   turn has `drafts.length === 0` AND (`meta.skipped?.length > 0`
   OR `meta.blocked?.length > 0`), inject a system message with the
   skipped/blocked reasons verbatim and explicit "do NOT claim any
   draft was created, do NOT invent unit numbers, scheme names, or
   recipient labels" wording. Same muscle as 6D's draft-claim
   guard, applied at the resolution layer.

4. **Orphan cleanup.** `DELETE FROM pending_drafts WHERE id =
   '1d4df217-6bf0-4c4f-a8ab-7c5552da3c2e'` executed via Supabase MCP
   in this session.

## Acceptance matrix the repro tests pin

| Input | Expected outcome |
|---|---|
| "Reach out to number 3, Erdon View" | 0 rows in `pending_drafts`. Chat reply lists assigned schemes. |
| "Reach out to number 3, Ardawn View" (phonetic alias) | 1 row, real `unit_id`, real purchaser email, subject mentions kitchen. |
| "Reach out to number 3, Add-on View" (phonetic alias) | Same as above. |
| "Reach out to number 99, Ardawn View" | 0 rows. Chat reply says Unit 99 not found. |

## Out of scope

- Whisper prompt biasing
- Send-memory (Session 10 deferred)
- Revising the `buyer@tbc.invalid` convention (separate hardening pass)
- `chase_aged_contracts` uses `solicitor@tbc.invalid` intentionally —
  solicitor contact is a known gap, unit is still resolved; kept as-is.
