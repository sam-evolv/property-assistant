# Session 11 Diagnosis — honest chips, logo, quieter drafts banner

1. **Chip library.** Static 21-phrase array at
   `lib/agent-intelligence/capability-chips.ts:16-47`, exported as
   `CAPABILITY_CHIPS` and consumed once-per-mount by
   `app/agent/_components/CapabilityChipsCarousel.tsx:53-58`
   (`shuffleChips(pool)`). No tie to the agent's real data — Maple
   Court, 14 Oakfield, "the O'Sheas", "those three units" are all
   literal strings with no provenance.

2. **Logo disappearance.** `git log --oneline -- app/agent/intelligence/page.tsx`:
   Session 7 (`8036656` / merged as `f70af6d`) deleted the
   `<Image src="/oh-logo.png" width={168} …/>` that sat above the
   gold "OpenHouse Intelligence" label in the quiet-hero rebuild.
   Session 8 attempted a restore (`d67e143`) but was never merged —
   main still sits at `f70af6d`. Session 9 (`7f5d965`) only touched
   the skill layer. Current `page.tsx` at line 677–693 jumps straight
   from the 40px breathing-room spacer to the "What can I help with"
   `<h1>`. `/public/oh-logo.png` is still on disk, so the restore is
   a one-line JSX addition.

3. **Drafts banner.** `app/agent/intelligence/page.tsx:713-760`. A
   fixed-width 360px card with gold tint, bold heading "You've got N
   drafts from earlier.", and a gradient "Review drafts" pill. The
   container reserves `min-height: 76; marginTop: 32` whenever
   `!draftsReady || pendingDraftsCount > 0` and fades to zero once
   count resolves to zero. For a user with 30 drafts the card
   dominates the landing — exactly the complaint.

4. **Real-data sources.** The agent context exposes these via the
   service-role APIs we already have:
   - `agent_scheme_assignments` + `developments` → scheme names (pulled
     in `lib/agent-intelligence/agent-context.ts`, returned by the
     resolver as `assignedDevelopmentNames`).
   - `agent_letting_properties` → letting addresses
     (`context.ts:446-466`, queried in `getLettingsSummary`).
   - `agent_tenancies` → tenancies (`context.ts:493`+).
   - `agent_viewings` → sales/rental viewings (`context.ts:573`+).
   - `agent_applicants` → applicants (`app/api/agent/applicants/route.ts`).
   Every table is scoped by `agent_id = agent_profiles.id`.

5. **Agent access at render time.** `lib/agent/AgentContext.tsx`
   already exposes `developments` + `developmentIds` + scheme names
   via `useAgent()` and is mounted above the Intelligence page. For
   letting/applicant/viewing counts we need a dedicated endpoint
   because the existing `useAgent` hook only carries sales data —
   this commit adds `GET /api/agent/intelligence/capability-chips`
   which returns a pre-composed list of chip phrases based on real
   counts, keeping the client thin.

## Fix summary shipping with this commit

- New `GET /api/agent/intelligence/capability-chips` route. Pulls
  assigned developments, a sample of letting-property addresses,
  and count-only probes for applicants / rental viewings / drafts.
  Composes chip phrases against real data only. Returns
  `{ chips: string[] }`. Safe to fail to an always-context-free
  fallback list when queries error.
- `lib/agent-intelligence/capability-chips.ts` — static library
  collapsed to a small always-safe context-free fallback set (no
  scheme names, no made-up buyers). Removed: "Maple Court",
  "14 Oakfield", "O'Sheas", "those three units", "Árdan View",
  "Rathárd Park", any scheme-specific phrase.
- `CapabilityChipsCarousel` now takes a `chips` prop and no longer
  imports the static list. The Intelligence landing fetches live
  chips on mount and passes them in; while the fetch is in flight the
  fallback set is used (four safe phrases) so first paint is stable.
- Logo restored: `<Image src="/oh-logo.png" width={48} height={48}>`
  directly above the "What can I help with, {firstName}?" hero,
  always rendered regardless of drafts-count state.
- Drafts banner deleted. Replaced with a single muted `<button>` that
  reads "N drafts waiting in your inbox" under the helper line. Only
  renders when `draftsReady && draftsCount > 0`. The container
  reserves `min-height: 20` so the chip carousel below doesn't shift
  when the text link appears.
