/**
 * Compact Irish regulatory + HPI knowledge block injected into the
 * OpenHouse Intelligence system prompt (dev-app) and available to other
 * assistant surfaces. Keep this conservative and structural: the assistant
 * gives orientation and points at the right obligation/evidence, it does
 * NOT certify compliance. Anything numeric here must be a well-established
 * backstop value, not an edge-case interpretation.
 *
 * HPI facts verified against IGBC sources (Technical Manual v3.1, Nov 2025).
 */
export const IRISH_REGULATORY_KNOWLEDGE = `IRISH REGULATORY CONTEXT (orientation only — always recommend the assigned certifier / relevant professional for sign-off):

- BCAR (Building Control (Amendment) Regulations 2014, SI 9): new dwellings need a Commencement Notice, a Design Certifier and an Assigned Certifier; completion requires the Certificate of Compliance on Completion (CCC) lodged and validated on the BCMS register before opening/occupation. Ancillary certificates from contractors/specialists feed the CCC.
- Building Regulations TGDs most relevant to handover: Part L (energy — new dwellings must be NZEB; air permeability backstop 5 m³/(h·m²) at 50 Pa, tested), Part F (ventilation — systems must be commissioned and commissioning results kept), Part B (fire safety), Part M (access), Part D (materials & workmanship).
- BER: every new home needs a Building Energy Rating certificate (published on SEAI register) before sale/occupation; new builds target A-rating under NZEB.
- Structural warranty: most Irish new homes carry HomeBond or Premier Guarantee structural cover (typically 10 years); appliance and system warranties are separate and start at handover/commissioning.
- Defects/snagging practice: purchasers typically have a pre-completion snag inspection; developers usually address snags before handover, and latent defects fall to the structural warranty provider or builder depending on type and timing.
- Utilities: ESB Networks connection + MPRN per unit, Irish Water connection agreements, Eir/SIRO/Virgin broadband availability are common purchaser/solicitor queries at closing.

HOME PERFORMANCE INDEX (HPI) — Irish Green Building Council (IGBC):
- HPI is Ireland's voluntary certification for quality, sustainable new homes, assessed at design stage and as-built. Current version: Technical Manual v3.1 (Nov 2025), applying to projects registered from 20 Jan 2026; earlier registrations may stay on v3.0. Levels: Certified / Silver / Gold. From v3.1 certification is project-wide: every unit is submitted, the average score must meet the threshold and only a small share of units may miss mandatory minimums.
- Five indicator categories: Environment (EN: land use, surface water, water use, ecology, energy & carbon, embodied carbon/LCA, waste), Health & Wellbeing (HW: ventilation/indoor air quality, daylight & sunlight, acoustics, overheating), Economic (EC: space heat demand, life-cycle cost, universal design, smart monitoring), Quality Assurance (QA), and Sustainable Location (SL: transport, amenities).
- Mandatory minimums regardless of score: water efficiency, designed AND commissioned ventilation, thermal bridging evidence, enhanced airtightness, energy in use at least 10% better than NZEB, and no individual oil/gas boilers.
- Quality Assurance is the evidence-heavy part for site teams: airtightness test results per dwelling plus photographs of airtightness details (QA 1.0), thermal bridging junction schedules and psi-value calculations (QA 2.0 — IGBC publishes dedicated evidence guidance), oversight & testing records (QA 3.0), construction-stage photographic records (QA 4.0), commissioning certificates for ventilation and services (QA 6.0), post-occupancy evaluation around 12 months in (QA 7.0), and Consumer Information & Aftercare (QA 8.0).
- QA 8.0 "Consumer Information and Aftercare": every certified home is handed over with a clear, non-technical Home User Guide (how to run heating/ventilation, maintenance, warranties, contacts — IGBC publishes a template) plus a handover demonstration and aftercare arrangements. OpenHouse generates this guide per unit (Home User Guide on the unit file) and records the demo + guide issue as handover_events — exactly the evidence trail an HPI assessor asks for.
- Submission flow: evidence is assembled per indicator and submitted through "HPI Upload", IGBC's portal (built on IES TaP, mandatory route since late 2025). OpenHouse's role is upstream: capturing site evidence (per-unit tests, commissioning certs, photos, handover events) so the pack is complete before submission.
- Why developers care: the Land Development Agency has adopted HPI for its schemes, HBFI links green development finance to HPI levels, and the Home Performance Pathway (HPP, ~12 indicators) gives SME builders an entry route backed by green lending from the main banks.
- Where OpenHouse holds HPI-relevant evidence: unit_systems (make/model/serial, commissioning + warranty docs per system), handover_events (demo completed, guide issued, keys, aftercare activated — append-only), home_user_guides (versioned, issued), compliance documents per unit, and the snagging record (issue_reports).

ANSWERING REGULATORY / HPI QUESTIONS:
- Give the practical orientation above, then point at where the evidence lives in OpenHouse if relevant.
- For anything that depends on the specific design, contract or assessor judgement, say so and name who signs it off (Assigned Certifier, BER assessor, HPI assessor, warranty provider).
- Never invent thresholds, dates, or certificate states. If the developer asks "are we compliant", check the data you can see (compliance documents, handover events) and report what is present vs missing — do not declare legal compliance.`;
