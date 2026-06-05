// lib/dev-app/unit-systems.ts
// Types, vocab and HPI helpers for the unit's installed systems and its handover
// evidence trail (migration 068). These feed the one-click unit file and the
// (coming) auto-generated Home User Guide.

export const UNIT_SYSTEM_TYPES = [
  'heat_pump',
  'mvhr',
  'ventilation',
  'solar_pv',
  'battery',
  'ev_charger',
  'hot_water',
  'heating_controls',
  'windows',
  'smart_home',
  'other',
] as const;
export type UnitSystemType = (typeof UNIT_SYSTEM_TYPES)[number];

export const HANDOVER_EVENT_TYPES = [
  'demo_completed',
  'guide_issued',
  'keys_handed',
  'aftercare_activated',
  'inspection',
  'other',
] as const;
export type HandoverEventType = (typeof HANDOVER_EVENT_TYPES)[number];

export interface UnitSystem {
  id: string;
  tenant_id: string;
  unit_id: string;
  system_type: UnitSystemType;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  key_settings: Record<string, unknown>;
  commissioning_date: string | null;
  commissioning_doc_id: string | null;
  warranty_start: string | null;
  warranty_end: string | null;
  warranty_doc_id: string | null;
  maintenance_interval_months: number | null;
  manufacturer_guide_doc_id: string | null;
  knowledge_refs: unknown[];
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface HandoverEvent {
  id: string;
  tenant_id: string;
  unit_id: string;
  event_type: HandoverEventType;
  occurred_at: string;
  conducted_by: string | null;
  conducted_by_name: string | null;
  attended_by: string | null;
  acknowledgement_ref: string | null;
  home_user_guide_version: number | null;
  media_refs: unknown[];
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface HpiQa8Evidence {
  guide_issued: boolean;
  demo_completed: boolean;
  aftercare_activated: boolean;
  systems_documented: number;
  systems_with_warranty: number;
  /** The two mandatory QA 8.0 touchpoints (guide issued + demo done) are evidenced. */
  qa8_ready: boolean;
}

export function isUnitSystemType(v: unknown): v is UnitSystemType {
  return typeof v === 'string' && (UNIT_SYSTEM_TYPES as readonly string[]).includes(v);
}

export function isHandoverEventType(v: unknown): v is HandoverEventType {
  return typeof v === 'string' && (HANDOVER_EVENT_TYPES as readonly string[]).includes(v);
}

/**
 * Rolls a unit's systems + handover events into the HPI QA 8.0
 * (Consumer Information & Aftercare) evidence summary surfaced on the unit file.
 * `systems` and `events` are raw DB rows.
 */
export function summariseHpiQa8(systems: any[], events: any[]): HpiQa8Evidence {
  const hasEvent = (t: HandoverEventType) => events.some((e) => e.event_type === t);
  const guideIssued =
    hasEvent('guide_issued') || events.some((e) => e.home_user_guide_version != null);
  const systemsWithWarranty = systems.filter(
    (s) => s.warranty_end || s.warranty_doc_id,
  ).length;

  return {
    guide_issued: guideIssued,
    demo_completed: hasEvent('demo_completed'),
    aftercare_activated: hasEvent('aftercare_activated'),
    systems_documented: systems.length,
    systems_with_warranty: systemsWithWarranty,
    qa8_ready: guideIssued && hasEvent('demo_completed'),
  };
}
