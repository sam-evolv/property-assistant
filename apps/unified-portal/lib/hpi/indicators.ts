// lib/hpi/indicators.ts
//
// HPI evidence-indicator registry — pure config, no DB, no React. The single
// source of truth for which Home Performance Index (HPI v3.1) evidence items
// OpenHouse tracks, how each maps to data we already hold, and how each is
// evaluated to a readiness status. Consumed by lib/hpi/evaluate.ts and, via the
// evaluator's output, by the developer HPI command centre.
//
// IMPORTANT framing: this models EVIDENCE READINESS for HPI submission. It does
// NOT compute an official IGBC assessment — the assessor judges the score. Tier
// projections downstream are always labelled "indicative".

export type HpiCategory = 'EN' | 'HW' | 'EC' | 'QA' | 'SL';
export type IndicatorScope = 'per_unit' | 'per_scheme';
export type IndicatorStatus = 'ready' | 'partial' | 'missing' | 'expiring';
export type TierBand = 'certified' | 'silver' | 'gold';

export const CATEGORY_LABELS: Record<HpiCategory, string> = {
  EN: 'Environment',
  HW: 'Health & Wellbeing',
  EC: 'Economic',
  QA: 'Quality Assurance',
  SL: 'Sustainable Location',
};

/** Normalised evidence for ONE unit, assembled by the evaluator before the
 *  indicator's evaluate() runs. Compliance is keyed by doc-type name lowercased. */
export interface IndicatorEvidence {
  guideIssued: boolean;
  demoCompleted: boolean;
  aftercareActivated: boolean;
  systems: Array<{
    system_type: string;
    commissioning_date: string | null;
    warranty_end: string | null;
    warranty_doc_id: string | null;
  }>;
  compliance: Record<string, { status: IndicatorStatus; expiry_date: string | null } | undefined>;
}

export interface HpiIndicator {
  id: string;
  category: HpiCategory;
  code: string;
  label: string;
  description: string;
  scope: IndicatorScope;
  /** IGBC "mandatory minimum regardless of score" — gates the projected tier. */
  mandatoryMinimum: boolean;
  /** Lowest tier this indicator is typically expected at. */
  tierContribution: TierBand;
  /** Trade / role accountable for producing the evidence. Drives the chase-list. */
  responsibleParty: string;
  /** What to provide / where it lives in OpenHouse. */
  evidenceHint: string;
  /** Compliance doc-type name(s) this indicator reads, if compliance-backed. */
  complianceDocTypes?: string[];
  evaluate: (e: IndicatorEvidence) => { status: IndicatorStatus; detail: string };
}

// --- evaluate() helpers -----------------------------------------------------

/** Reads a single compliance doc-type's normalised status for an indicator. */
function complianceStatus(
  e: IndicatorEvidence,
  docTypeName: string,
): { status: IndicatorStatus; expiry_date: string | null } {
  const hit = e.compliance[docTypeName.toLowerCase()];
  return hit ?? { status: 'missing', expiry_date: null };
}

function readyDetail(name: string, s: IndicatorStatus): string {
  switch (s) {
    case 'ready':
      return `${name} verified`;
    case 'partial':
      return `${name} uploaded, awaiting verification`;
    case 'expiring':
      return `${name} expiring soon — renew`;
    default:
      return `${name} not provided`;
  }
}

/** A compliance-cert-backed indicator: status is the doc-type's status. */
function certIndicator(args: {
  id: string;
  category: HpiCategory;
  code: string;
  label: string;
  description: string;
  mandatoryMinimum: boolean;
  tierContribution: TierBand;
  responsibleParty: string;
  evidenceHint: string;
  docType: string;
}): HpiIndicator {
  return {
    id: args.id,
    category: args.category,
    code: args.code,
    label: args.label,
    description: args.description,
    scope: 'per_unit',
    mandatoryMinimum: args.mandatoryMinimum,
    tierContribution: args.tierContribution,
    responsibleParty: args.responsibleParty,
    evidenceHint: args.evidenceHint,
    complianceDocTypes: [args.docType],
    evaluate: (e) => {
      const c = complianceStatus(e, args.docType);
      return { status: c.status, detail: readyDetail(args.label, c.status) };
    },
  };
}

// --- The registry -----------------------------------------------------------

export const HPI_INDICATORS: readonly HpiIndicator[] = [
  // Mandatory minimums (gate the projected tier) ----------------------------
  certIndicator({
    id: 'en_energy_ber',
    category: 'EN',
    code: 'EN · Energy',
    label: 'BER Certificate',
    description: 'Building Energy Rating evidencing NZEB / energy-in-use performance.',
    mandatoryMinimum: true,
    tierContribution: 'certified',
    responsibleParty: 'BER Assessor',
    evidenceHint: 'Upload the published BER certificate (SEAI register) per home.',
    docType: 'BER Certificate',
  }),
  certIndicator({
    id: 'en_airtightness',
    category: 'EN',
    code: 'QA 1.0',
    label: 'Airtightness Test Result',
    description: 'Per-dwelling air permeability test result (enhanced airtightness).',
    mandatoryMinimum: true,
    tierContribution: 'certified',
    responsibleParty: 'Airtightness Tester',
    evidenceHint: 'Upload the blower-door test result per home.',
    docType: 'Airtightness Test Result',
  }),
  {
    id: 'hw_ventilation_commissioning',
    category: 'HW',
    code: 'QA 6.0 · Ventilation',
    label: 'Ventilation Commissioning',
    description: 'Designed AND commissioned ventilation (MVHR) per home.',
    scope: 'per_unit',
    mandatoryMinimum: true,
    tierContribution: 'certified',
    responsibleParty: 'M&E Contractor',
    evidenceHint: 'Commission the MVHR/ventilation and record the date, or upload the commissioning certificate.',
    complianceDocTypes: ['Ventilation Commissioning Certificate'],
    evaluate: (e) => {
      const vent = e.systems.find((s) => s.system_type === 'mvhr' || s.system_type === 'ventilation');
      if (vent?.commissioning_date) {
        return { status: 'ready', detail: 'Ventilation commissioned (recorded in OpenHouse)' };
      }
      const cert = complianceStatus(e, 'Ventilation Commissioning Certificate');
      if (cert.status !== 'missing') {
        return { status: cert.status, detail: readyDetail('Ventilation commissioning certificate', cert.status) };
      }
      if (vent) return { status: 'partial', detail: 'Ventilation system recorded but not yet commissioned' };
      return { status: 'missing', detail: 'No ventilation system recorded or commissioned' };
    },
  },
  certIndicator({
    id: 'ec_thermal_bridging',
    category: 'EC',
    code: 'QA 2.0',
    label: 'Thermal Bridging Assessment',
    description: 'Junction schedule and psi-value calculations (thermal bridging evidence).',
    mandatoryMinimum: true,
    tierContribution: 'certified',
    responsibleParty: 'Thermal Modeller',
    evidenceHint: 'Upload the thermal bridging assessment for the scheme / house types.',
    docType: 'Thermal Bridging Assessment',
  }),

  // Quality Assurance — captured natively by OpenHouse ----------------------
  {
    id: 'qa6_services_commissioning',
    category: 'QA',
    code: 'QA 6.0',
    label: 'Services Commissioning',
    description: 'Heating/hot-water (heat pump) commissioning recorded per home.',
    scope: 'per_unit',
    mandatoryMinimum: false,
    tierContribution: 'certified',
    responsibleParty: 'M&E Contractor',
    evidenceHint: 'Record the heat pump commissioning date on the unit systems.',
    evaluate: (e) => {
      const hp = e.systems.find((s) => s.system_type === 'heat_pump');
      if (hp?.commissioning_date) return { status: 'ready', detail: 'Heat pump commissioned' };
      if (hp) return { status: 'partial', detail: 'Heat pump recorded but not yet commissioned' };
      return { status: 'missing', detail: 'No heating system commissioning recorded' };
    },
  },
  {
    id: 'qa8_consumer_info',
    category: 'QA',
    code: 'QA 8.0',
    label: 'Home User Guide & Demo',
    description: 'Consumer Information: Home User Guide issued and handover demonstration completed.',
    scope: 'per_unit',
    mandatoryMinimum: false,
    tierContribution: 'certified',
    responsibleParty: 'Aftercare Team',
    evidenceHint: 'Generate and issue the Home User Guide, then log the handover demonstration.',
    evaluate: (e) => {
      if (e.guideIssued && e.demoCompleted) return { status: 'ready', detail: 'Guide issued and demo completed' };
      if (e.guideIssued || e.demoCompleted) {
        return {
          status: 'partial',
          detail: e.guideIssued ? 'Guide issued; handover demo not yet logged' : 'Demo logged; Home User Guide not yet issued',
        };
      }
      return { status: 'missing', detail: 'No Home User Guide issued or demo logged' };
    },
  },
  {
    id: 'qa8_aftercare',
    category: 'QA',
    code: 'QA 8.0 · Aftercare',
    label: 'Aftercare Activated',
    description: 'Aftercare / occupant support activated for the home.',
    scope: 'per_unit',
    mandatoryMinimum: false,
    tierContribution: 'silver',
    responsibleParty: 'Aftercare Team',
    evidenceHint: 'Activate aftercare on the unit handover actions.',
    evaluate: (e) =>
      e.aftercareActivated
        ? { status: 'ready', detail: 'Aftercare activated' }
        : { status: 'missing', detail: 'Aftercare not yet activated' },
  },

  // Supporting statutory certificates ---------------------------------------
  certIndicator({
    id: 'safety_fire',
    category: 'QA',
    code: 'Supporting · Fire',
    label: 'Fire Safety Certificate',
    description: 'Statutory fire safety certificate.',
    mandatoryMinimum: false,
    tierContribution: 'certified',
    responsibleParty: 'Fire Safety Consultant',
    evidenceHint: 'Upload the fire safety certificate per home.',
    docType: 'Fire Safety Certificate',
  }),
  certIndicator({
    id: 'safety_electrical',
    category: 'QA',
    code: 'Supporting · Electrical',
    label: 'Electrical Certificate',
    description: 'Electrical completion / test certificate.',
    mandatoryMinimum: false,
    tierContribution: 'certified',
    responsibleParty: 'Electrical Contractor',
    evidenceHint: 'Upload the electrical certificate per home.',
    docType: 'Electrical Certificate',
  }),
  certIndicator({
    id: 'safety_gas',
    category: 'QA',
    code: 'Supporting · Gas',
    label: 'Gas Safety Certificate',
    description: 'Gas safety / commissioning certificate (RGI).',
    mandatoryMinimum: false,
    tierContribution: 'certified',
    responsibleParty: 'Gas (RGI) Installer',
    evidenceHint: 'Upload the gas safety certificate per home.',
    docType: 'Gas Safety Certificate',
  }),
  certIndicator({
    id: 'cert_bcms',
    category: 'QA',
    code: 'Supporting · BCMS',
    label: 'BCMS Certificate',
    description: 'Building Control (BCAR/BCMS) completion certificate.',
    mandatoryMinimum: false,
    tierContribution: 'certified',
    responsibleParty: 'Assigned Certifier',
    evidenceHint: 'Upload the BCMS / Certificate of Compliance on Completion per home.',
    docType: 'BCMS Certificate',
  }),
  certIndicator({
    id: 'reg_homebond',
    category: 'EN',
    code: 'Supporting · HomeBond',
    label: 'HomeBond Registration',
    description: 'Structural warranty scheme registration.',
    mandatoryMinimum: false,
    tierContribution: 'certified',
    responsibleParty: 'Structural Warranty Provider',
    evidenceHint: 'Upload the HomeBond (or equivalent) registration per home.',
    docType: 'HomeBond Registration',
  }),
  certIndicator({
    id: 'warranty_structural',
    category: 'EC',
    code: 'Supporting · Warranty',
    label: 'Structural Warranty',
    description: 'Structural warranty cover document.',
    mandatoryMinimum: false,
    tierContribution: 'certified',
    responsibleParty: 'Structural Warranty Provider',
    evidenceHint: 'Upload the structural warranty document per home.',
    docType: 'Structural Warranty',
  }),

  // Sustainable Location — design-stage, not tracked in OpenHouse yet --------
  {
    id: 'sl_location',
    category: 'SL',
    code: 'SL · Location',
    label: 'Sustainable Location',
    description: 'Transport links and access to amenities (assessed at design stage).',
    scope: 'per_scheme',
    mandatoryMinimum: false,
    tierContribution: 'certified',
    responsibleParty: 'Design Team',
    evidenceHint: 'Captured at design stage; not yet tracked in OpenHouse.',
    evaluate: () => ({
      status: 'missing',
      detail: 'Captured at design stage — not yet tracked in OpenHouse',
    }),
  },
];

export const INDICATORS_BY_CATEGORY: Record<HpiCategory, HpiIndicator[]> = HPI_INDICATORS.reduce(
  (acc, ind) => {
    (acc[ind.category] ||= []).push(ind);
    return acc;
  },
  {} as Record<HpiCategory, HpiIndicator[]>,
);

export const MANDATORY_MINIMUM_IDS: string[] = HPI_INDICATORS.filter((i) => i.mandatoryMinimum).map(
  (i) => i.id,
);

export const HPI_DISCLAIMER =
  'Indicative evidence-readiness only — not an official IGBC assessment.';
