# IGBC / HPI Demo Script — OpenHouse Demo Park

A 10–12 minute walkthrough showing how OpenHouse captures HPI QA 8.0
(Consumer Information & Aftercare) evidence as a by-product of normal site
work, and hands the assessor a complete pack. Built around the seeded
**OpenHouse Demo Park** scheme (6 units, Carrigaline, Co. Cork).

## Preconditions

- Log in as the demo developer account (the one that owns Longview Park etc. —
  `developments.developer_user_id = 780f1fe9-…`).
- `OPENAI_API_KEY` set in the environment (step 5 generates a guide live).
- Demo data fresh: seeded by migration `071_demo_openhouse_demo_park.sql`.
  Pipeline dates are relative to the seed date, so **within ~5 days of the
  meeting, reset it**: run `071_demo_openhouse_demo_park_teardown.sql` in the
  Supabase SQL editor, then re-run the seed. After a reset, Unit 3 is always
  "sale agreed 6 days ago".

## Seeded state (by design)

| Unit | Guide | Demo | Aftercare | Pipeline | Snags |
|---|---|---|---|---|---|
| 1 | ✓ | ✓ | ✓ | Handed over 2 days ago | 1 resolved |
| 2 | ✓ | ✓ | ✓ | Contracts signed | 1 open (safety: exposed wiring) |
| 3 | ✓ | ✓ | ✓ | **Sale agreed 6 days ago** | 1 open |
| 4 | ✓ | ✓ | ✓ | Deposit received | — |
| 5 | – | ✓ | – | Sale agreed 20 days ago | 1 open (homeowner-reported) |
| 6 | – | – | – | Just released | — |

So the HPI board opens at **4/6 ready** and Unit 6 is the clean unit you
evidence live on stage.

## The walkthrough

1. **Open `/dev-app/overview`** — the mobile command centre a site manager
   actually uses. Point out the "Open the full OpenHouse portal" bridge at the
   bottom (pipeline, Smart Archive, compliance live there).

2. **Units tab → tap "HPI Readiness board"** (gold card) or go straight to
   `/dev-app/hpi`. Talking point: *"This is QA 8.0 across the whole scheme —
   the exact evidence an assessor asks for at as-built stage, live, not in a
   spreadsheet."* OpenHouse Demo Park shows 4/6 ready with per-pillar counts
   (guides / demos / aftercare).

3. **Expand OpenHouse Demo Park** — the per-unit checklist. Tap **Unit 5**:
   demo logged but no guide. The unit file shows its 3 documented systems
   (Ecodan heat pump, Vent-Axia MVHR, SolarEdge PV — serials, commissioning
   dates, warranties) and its snag from the homeowner assistant.

4. **The evidence trail is append-only.** On Unit 2, show the handover event
   log: demo completed, conducted by, attended by, **acknowledgement ref** —
   and the safety snag (exposed wiring) flagged red in the snag record.

5. **Flip Unit 6 live.** Open Unit 6 → **"Generate & issue"** the Home User
   Guide (gpt-4o writes it from the unit's actual installed systems in ~15s —
   this is the QA 8.0 deliverable, the IGBC template made automatic) → **"Log
   handover demo"** → **"Activate aftercare"**. Back on the HPI board: **5/6
   ready**, the bar moves. *"That's the entire QA 8.0 evidence burden for one
   home: two taps and a generated guide."*

6. **Intelligence tab.** Ask, in order:
   - *"How many units went sale agreed across my schemes in the last week?"*
     → counts with a per-scheme breakdown and the date range it used; Unit 3
     at OpenHouse Demo Park is in it.
   - *"What's still missing for QA 8.0 at OpenHouse Demo Park?"* → it checks
     the live handover evidence and names what's absent per unit (Unit 5's
     guide — or nothing on 6 if you did step 5).
   - (Optional regulatory depth) *"What evidence does an HPI assessor need for
     airtightness?"* → grounded answer from the built-in HPI v3.1 knowledge,
     with the "assessor signs off, we hold the evidence" framing.
   - (Optional action) *"Mark units 2 and 4 as complete"* → confirmation card
     with before/after, audited write on confirm.

7. **The closer: Export evidence pack.** HPI board → expand the scheme →
   **"Export evidence pack"**. Open the ZIP: `00_Scheme_Readiness_Index.pdf`
   (the rollup), `units/Unit_1.pdf` … (per-home evidence: QA 8.0 ticks,
   handover log with acknowledgement refs, systems/commissioning/warranty
   table, the full Home User Guide), `manifest.json` (stored certificates as
   7-day signed links). *"This is what we hand the assessor — or upload
   straight into HPI Upload. Evidence collected on site, pack assembled in one
   tap."*

## Positioning notes (for the conversation after)

- OpenHouse is the **upstream evidence layer**, not a competing submission
  portal — IGBC's HPI Upload (IES TaP) is the certification route; we make the
  pack that goes into it complete and clean.
- The Home User Guide + handover demo + aftercare = QA 8.0 end to end; the
  homeowner assistant is also the natural **QA 7.0 post-occupancy** channel
  (we already talk to the occupants at month 12).
- For SME builders, the same flow maps to the **Home Performance Pathway**
  (green-finance entry route backed by AIB/BOI/HBFI).

## The HPI Evidence Command Centre (the must-have screen)

This is the upgraded `/developer/hpi` — open it in the full developer portal
(sidebar → **HPI Readiness**, under Developer Tools). It scores the *whole* HPI
evidence pack, not just QA 8.0.

1. **Top of the page** — the **ROI strip** (evidence items tracked across the
   portfolio, % auto-captured by OpenHouse, evidence trackers replaced, assessor
   review-hours saved) and the scorecards (Total Homes, **Avg HPI Readiness %**,
   QA 8.0 Ready, **Open Evidence Gaps**). The pitch line: *"every one of these
   items used to live in a spreadsheet and a chase-up email."*

2. **OpenHouse Demo Park row** shows **~74% · Certified (indicative) · gap badge**.
   Talking point: *"the scheme is evidence-ready for Certified and one item short
   of Silver — and it knows exactly which item."* (Tier is always labelled
   indicative — the assessor makes the call; we make the pack complete.)

3. **Expand the scheme** for the full breakdown:
   - **Category bars** EN / HW / EC / QA / SL — Health & Wellbeing 100%,
     Quality Assurance ~69%, Sustainable Location flagged as design-stage.
   - **Indicator grid** — BER, airtightness, ventilation commissioning, thermal
     bridging (the mandatory minimums), services commissioning, QA 8.0, and the
     supporting certs, each with per-home coverage. Note ventilation
     commissioning is **auto-captured** from the unit systems, not chased.
   - **What's outstanding** — gaps grouped by **responsible party**. Unit 6 is
     the laggard (BER + airtightness + electrical + gas + BCMS missing); Unit 5
     has a **lapsed gas cert** and Unit 2 a **BER expiring in 20 days**.

4. **The close — turn the gap list into action.** On the "Electrical Contractor"
   (or "BER Assessor") group hit **Draft request** → a pre-filled email listing
   exactly what's outstanding for that trade, ready to send. Then **Export
   chase-list** → a CSV of every gap by responsible party. *"This is the bit
   developers will pay for: the system chases the evidence for you."*

5. Tie back to the **Evidence pack** button (top of the row) — the assembled
   pack that goes into HPI Upload once the gaps are closed.

## Reset

```sql
-- Supabase SQL editor (or MCP). Re-seed within ~5 days of the meeting so the
-- dates and 'expiring' chips stay fresh.
-- 1. 072_demo_ohdemo_hpi_evidence_teardown.sql   (HPI compliance evidence)
-- 2. 071_demo_openhouse_demo_park_teardown.sql    (scheme, units, systems, guides)
-- then re-apply:
-- 3. 071_demo_openhouse_demo_park.sql
-- 4. 072_demo_ohdemo_hpi_evidence.sql
```
