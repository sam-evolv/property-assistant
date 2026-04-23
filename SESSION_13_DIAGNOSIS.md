# Session 13 Diagnosis — phonetic aliases + honest error wording

1. **Origin of "Couldn't read that one. Tap the mic and try again?"**
   Single literal site: `app/agent/intelligence/page.tsx:356`, inside the
   `catch` of `handleVoiceTranscript`. It fires when
   `POST /api/agent/intelligence/extract-actions` throws or returns
   non-2xx. The message only references the mic because the branch
   only runs on the voice path — the text path (`handleSend` →
   `/api/agent-intelligence/chat`) has its own "Something went wrong
   connecting to Intelligence" generic error at line 280. Neither
   message tells the user which word failed to resolve, and neither
   points them at the list of schemes the agent actually has.

2. **Same message for voice + text resolver failures.**
   Technically different sites, but from the user's perspective
   identical — because the "no actions extracted" branch at
   `page.tsx:330-337` falls through to `handleSend(transcript)`, so a
   voice transcript that Claude can't turn into a tool call is re-run
   as a chat query. The chat query then gets a generic error if
   anything downstream fails. Net effect: the mic-flavoured message
   dominates the experience even for text-ish input.

3. **Scheme-name matching lives in two places.**
   - `lib/agent-intelligence/agent-context.ts:208` —
     `matchAssignedScheme(ctx, requestedName)` does case-insensitive
     substring matching over `assignedDevelopmentNames`.
   - `lib/agent-intelligence/tools/agentic-skills.ts:1374` —
     `schemeIdForName(name)` inside `draftBuyerFollowups`, same
     substring shape.
   Both walk the agent's assigned name list with a simple
   `toLowerCase().includes()`. Neither considers fadá-stripped forms
   ("ardan" vs "Árdan"), vowel-phonetic variants ("ardawn", "arden"),
   or word-split variants ("add on"). Session 9's `unit-resolver.ts`
   is downstream of scheme name matching — it resolves unit
   identifiers within an already-resolved scheme. So this session
   adds a new layer in front.

4. **Alias table shape.** Adopt the exact shape from the brief:
   `development_aliases(development_id, alias, alias_normalised,
   source, created_at)` with a unique index on
   `(development_id, alias_normalised)`. `source` is a CHECK enum
   (`'canonical' | 'phonetic_seed' | 'manual' | 'inferred'`).
   Normalisation: lowercase, strip fadas (á → a, é → e, í → i, ó → o,
   ú → u), strip anything that isn't alphanumeric or whitespace,
   collapse runs of whitespace to one space. That lets "Ardan View",
   "ÁRDAN VIEW", "Árdan  View!", "ardan-view" all normalise to the
   same key.

5. **Migration numbering.** The brief calls it "Migration 047" but
   migrations 047-050 are already taken by the homeowner-portal data
   integrity series that landed in PR #29 sequel. This session ships
   as **migration 051** instead — no collision, next free number.

6. **Whisper config.** `app/api/agent/intelligence/transcribe/route.ts:109`
   sends `model=whisper-1` to OpenAI with no `prompt` parameter.
   Adding a vocabulary prompt (`prompt: 'Árdan View, Rathárd Park,
   Rathárd Lawn, Harbour View Apartments, Longview Park, Orla
   Hennessy'`) is the cleanest way to improve transcription accuracy
   for Irish placenames. Out of scope this session — flagged for a
   follow-up once real voice recordings are available to tune
   against. The phonetic-alias approach catches the post-transcription
   case (whatever Whisper outputs maps to the right scheme).

## Fix summary shipping with this commit

- **Migration 051.** New `development_aliases` table + backfill of
  canonical aliases for every existing development + phonetic seed
  rows for each of Orla's 5 schemes (Árdan View, Rathárd Park,
  Rathárd Lawn, Harbour View Apartments, Longview Park).
- **`lib/agent-intelligence/scheme-resolver.ts`** (new) — exports
  `normaliseSchemeName(raw)` (fadá strip + punct strip + whitespace
  collapse) and `resolveSchemeName(supabase, rawName, agentContext)`
  returning `{ ok: true, developmentId, canonicalName }` or
  `{ ok: false, reason, candidates? }`.
- **Wire-through.** `agentic-skills.ts` + `agent-context.ts`
  `matchAssignedScheme` now prefer the DB-backed resolver; the old
  in-memory substring match stays as a fallback for when the alias
  lookup returns nothing and for unit tests that don't mock the
  alias table.
- **Context-aware error messages.** `intelligence/page.tsx` splits
  the catch branches: Whisper/Deepgram transcript failure keeps the
  mic-flavoured message; extract-actions succeeded-but-empty stays
  on the transcript-surfacing fallback; chat route's
  `handleSend` error distinguishes scheme-not-found from a generic
  failure using a new `errorKind` response field.
- **Self-healing capture.** Chat route tracks the last `not_found`
  scheme name per session (keyed on the conversation). When the
  next user message from that session resolves cleanly to a scheme,
  the previous miss is inserted as a new alias with
  `source='inferred'`. Capped at 50 inferred rows per development
  so unbounded growth is impossible.
- **Tests.** `tests/agent-intelligence/scheme-resolver.test.ts`
  covers the full matrix: Ardawn / Arden / Adan / Add-on → Árdan
  View; case-insensitive; fadá-stripped; non-assigned scheme
  returns `not_assigned`; nonexistent returns `not_found` with
  candidates; ambiguous flagged.
