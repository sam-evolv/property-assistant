# OpenHouse North Star — One Home, One Conversation

> The test: a developer says "I want this on my sites." The answer is:
> **"Sign up. You're live before the kettle boils."**

This document is the product's constitution. Every feature, page, and setting
must justify itself against it. It was written after a full audit of the
codebase (June 2026) and it is deliberately opinionated: it says what the
product *is*, which means it also says what the product *is not*.

---

## 1. The diagnosis

What the audit found:

| Symptom | Reality today |
|---|---|
| Routes a developer can land on | **60** (48 under `/developer`, plus dev-app, onboarding, tools) |
| Sidebar | **8 sections, ~25 items**, 7 feature flags deciding what appears |
| AI assistants | **5 separate ones** (agent intelligence, scheme intelligence, homeowner chat, builder, care) — and the developer-facing one is single-shot Q&A while the 20+ agentic tools live in a different portal |
| Snag systems | **3 overlapping** (`snag_items`, `issue_reports`, `tickets`) — convergence onto `issue_reports` has begun |
| Time to go live | **Days, and a human.** Super-admin provisions the tenant → developer fills a form → admin manually creates the development → CSV import → doc upload |

And the good news: **the data model underneath is genuinely strong.** Units
with full lifecycle, `handover_events` (QA 8.0 evidence trail), `unit_systems`
(heat pumps, MVHR, PV per home), AI document classification, RAG chunks,
contractor scorecards, integration sync. The complexity is almost entirely in
the chrome, not the engine. That means we can simplify ruthlessly **without
losing a single capability** — the Jobs/Ive move: remove everything from the
inside of the product that doesn't earn its place, and gain function by doing it.

## 2. The principle

**The unit of the product is the Home.**

Everything OpenHouse does is a statement about a home: *it went sale agreed; its
fire cert was filed; it has three open snags, two with photos; its buyer asked
about the heat pump last night; its handover demo is booked Friday.* A scheme is
a set of homes. A purchaser is a person attached to a home. A compliance pack is
a set of documents proven against a home. A snag is an event in a home's life.

So the product is two things, and only two things:

1. **A timeline of homes** — every home's whole life, sale to aftercare, one thread.
2. **A conversation that can read and write that timeline** — OpenHouse Intelligence.

Every screen is just a saved view of the timeline. Every action is something the
conversation could also do. When a screen and the conversation disagree about
what's possible, the screen is wrong.

## 3. The five surfaces

The 25-item sidebar becomes **five words**:

| Surface | What it is | What it absorbs |
|---|---|---|
| **Today** | The daily brief. One sentence of status, at most three things that need you, and the ask bar. If nothing needs you, it says so — beautifully. | Overview, Analytics (headline), AI Insights (surfaced as brief items) |
| **Homes** | Every unit through its whole life: pipeline stage, buyer, selections, snags, documents, handover evidence, aftercare — one timeline per home. | Sales Pipeline, Homeowners, Kitchen Selections, BTR units, pre-handover milestones |
| **Documents** | One drop zone. The AI files everything — drawings by discipline, certs to units, manuals to house types. Coverage rings show what's missing, per scheme and per home. | Smart Archive, Data Hub, Compliance, Agreements, Knowledge Base, Room Dimensions (extracted, not entered) |
| **Snags** | Every snag from every source — site crew, professional snagger, homeowner chat — text and photos in one canonical pipeline, with contractor scorecards and cross-scheme insight. | Issues, Snagging, Snag Team |
| **Intelligence** | The conversation. Ask anything, *do* anything. The other four surfaces are views of what it knows. | Scheme Intelligence, assistant gaps/tests, and ultimately Broadcasts/Communications (sending a message is a verb, not a place) |

Everything else lives under one quiet **More** group until it is absorbed or
deleted. Nothing is removed from the product on day one; it is removed from
*attention*.

### The fold map (all 48 `/developer` routes)

- **Become Today**: `/overview`, `/insights`, `/analytics` (headline KPIs)
- **Become Homes**: `/pipeline*`, `/homeowners*`, `/kitchen-selections*`, `/btr/*`, `/pre-handover-settings` (milestones)
- **Become Documents**: `/archive*`, `/data-hub`, `/compliance`, `/agreements`, `/knowledge-base`, `/room-dimensions`
- **Become Snags**: `/issues*`, `/snagging`, `/snaggers`
- **Become Intelligence**: `/scheme-intelligence`, `/schemes/*/assistant-gaps`, `/schemes/*/assistant-tests`
- **Become verbs inside Intelligence/Homes**: `/broadcasts`, `/communications`, `/noticeboard`, `/moderation`
- **Become settings (one screen, shown once)**: `/integrations`, `/settings/notifications`, `/scheme-setup`
- **Delete when absorbed**: `/errors` (becomes an alert), `/schedule` (a Today item), `/handover` (already a redirect)

## 4. Live in minutes — the onboarding contract

Onboarding is not a wizard. **Onboarding is the empty state of Today.**
A new developer sees one screen with three steps, and the AI does the work in
each one:

1. **Name your scheme.** One field plus county. (Exists: `developments`,
   scheme-setup, Places lookup.)
2. **Drop your spreadsheet.** Any shape, any column names — the AI maps columns
   to units, house types, purchasers, prices, dates, and shows you what it
   understood before committing. Every purchaser row becomes a profile with an
   access code, past and present. (Exists: `import-units` parser with header
   normalisation. Gap: LLM column-mapper for arbitrary spreadsheets + preview.)
3. **Drop your files — or connect your Drive.** Drawings, compliance docs,
   manuals, BERs. The AI classifies each one (already built:
   `classify-suggest`, `ai_classified`, `mapping_confidence`, Data Hub sync)
   and files it to the right scheme / house type / home. Anything below
   confidence threshold goes in a five-second "confirm" tray, not a form.

Then: **"You're live."** Homeowner QR pack generated per home. The assistant
already answers from the docs. Stakeholders invited by email address alone.

### Engineering gaps to close (in order)

1. **Self-serve tenant creation** — signup creates tenant + admin + first
   development in one transaction. Kill the super-admin provisioning step
   (`/api/auth/provision-developer` stays for enterprise, stops being the front door).
2. **AI column mapper** — one LLM call over the header row + 5 sample rows →
   field mapping with confidence; reuse the existing import pipeline beneath it.
3. **Auto-file pipeline** — `classify-suggest` runs on every upload and Data Hub
   sync event, writes discipline/doc_kind/unit mapping, queues low-confidence
   items to the confirm tray.
4. **Go-live state machine** — one query: scheme exists → homes imported →
   docs filed → purchasers invited. Today renders it until complete.

## 5. Intelligence becomes the product

Today there are five assistants; the one developers see can only answer.
The agent portal already has the hard part — a **20+ tool registry with a
streaming agentic loop** (read pipeline, draft batch follow-ups, log
communications, rank buyers, query compliance). The merge:

- **One assistant, one tool registry, role-scoped.** Developer, site crew, and
  homeowner get the same brain with different permissions, not different brains.
- Scheme Intelligence's chat keeps its identity but gains hands: *"Import this
  spreadsheet." "Chase the six buyers with overdue contracts." "What's blocking
  BCMS sign-off on Phase 2?" "Book the handover demos for the week after the
  fire certs land."*
- Every answer that cites live data offers the action that follows from it.
  Approval-first for anything outward-facing (drafts, never silent sends).
- The ask bar is everywhere (it already routes from Today via `?q=`), and ⌘K
  is the same bar.

## 6. Compliance autopilot (HPI · BCMS · Homebond · BCAR)

Compliance isn't a section. **It's a ring that fills itself.**

- Requirement schemas as data: each programme (HPI, BCMS, Homebond, BCAR QA 8.0)
  is a checklist definition — required evidence types per scheme and per home.
  (Schema exists: `compliance_document_types` / `compliance_documents`.)
- Evidence auto-matches: every classified document and `handover_event` fills
  the matching requirement. The ring on Documents and on each Home shows
  exactly what's missing, and the assistant says it in English: *"Phase 2 is
  BCMS-ready except ventilation commissioning certs for 4 homes — they're due
  from the contractor who's also sitting on 11 open snags."*
- One-tap evidence pack: export the full pack for an assessor, per home or per
  scheme, generated from what's already filed.

## 7. Snag intelligence

One canonical pipeline (`issue_reports` — convergence already underway), every
source (site app, uploaded report, homeowner chat — text *and* photos),
AI dedup, SLA clocks, contractor scorecards. Then the insight layer nobody in
Ireland has: *"Ensuite leaks cluster in house type B3 across both schemes —
plumbing first-fix, contractor X, weeks 3–7. Inspect the 9 unclosed B3s before
handover."* Snags stop being a list and become how a developer improves the
next scheme before it's built.

## 8. The Apple test (how we keep ourselves honest)

- **Five words in the sidebar.** A new item must replace an existing one or it
  doesn't ship.
- **Onboarding is an empty state, not a flow.** If a step can be inferred from
  a file the developer already has, we infer it.
- **Settings are defaults until proven otherwise.** Every toggle is a design
  decision we refused to make.
- **Every number ends in an action.** If tapping a stat doesn't let you act on
  it, the stat is decoration — cut it.
- **The assistant can do everything the UI can do.** When that stops being
  true, we've shipped a screen we didn't need.

## 9. Phasing

| Phase | Ship | Status |
|---|---|---|
| 1 | Five-word navigation, Today (brief + ask bar + go-live empty state), ask routing into Intelligence | **This commit** |
| 2 | Self-serve go-live: signup→tenant, AI spreadsheet mapping, auto-file with confirm tray | next |
| 3 | One assistant: tool registry behind scheme-intelligence chat, approval-first actions | next |
| 4 | Home timeline view (one page per home, whole life), compliance rings | then |
| 5 | Cut the dead weight: delete absorbed routes, one snag system end-to-end, retire the flags | then |

---

*Simplicity is not the absence of capability. It is capability with nothing in
the way.*
