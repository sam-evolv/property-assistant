// House context types — the structured briefing of a homeowner's actual home
// that the OpenHouse Assistant reasons against.
//
// Loaded by ./loader.ts from the live tables (developments, units, unit_types,
// unit_room_dimensions, scheme_profile, document_sections) and serialized verbatim
// into the agent's HOUSE CONTEXT system message. The prompt
// (docs/prompts/openhouse-assistant-v1.md, v1.2) describes this shape
// field-for-field, so keep the two in step.

/**
 * Where a room's dimensions came from. 'unit' = recorded for this specific home;
 * 'house_type' = a template for the unit type, which may vary slightly in this
 * particular home. The prompt is told to phrase 'house_type' rooms as typical
 * rather than exact.
 */
export type RoomDimensionSource = 'unit' | 'house_type';

export interface HouseContextRoom {
  name: string;
  floor: string | null;
  length_m: number | null;
  width_m: number | null;
  area_sqm: number | null;
  source: RoomDimensionSource;
}

export interface HouseContextDevelopment {
  name: string;
  address: string | null;
  project_type: string | null;
}

export interface HouseContextScheme {
  heating_type: string | null;
  heating_controls: string | null;
  broadband_type: string | null;
  water_billing: string | null;
  waste_setup: string | null;
  waste_provider: string | null;
  parking_type: string | null;
  parking_notes: string | null;
  bin_storage_notes: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_notes: string | null;
  managing_agent_name: string | null;
}

export interface HouseContextUnit {
  unit_number: string | null;
  address: string | null;
  eircode: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area_m2: number | null;
  property_type: string | null;
  /** ISO date (YYYY-MM-DD) or null. */
  handover_date: string | null;
  house_type_code: string | null;
  unit_type_name: string | null;
}

/**
 * A document available to this homeowner, with a title and a directly openable
 * URL. The agent surfaces the matching one as a link when asked to find or show
 * a document (BER cert, warranties, manuals, drawings, etc.).
 */
export interface HouseContextDocument {
  title: string;
  url: string;
}

export interface HouseContext {
  development: HouseContextDevelopment;
  scheme: HouseContextScheme | null;
  unit: HouseContextUnit;
  rooms: HouseContextRoom[];
  /** From unit_types.floor_plan_pdf_url for this unit's type. */
  floor_plan_url: string | null;
  /**
   * The dwelling specification for this unit's type, from
   * unit_types.specification_json. Free-form key/value detail about fixtures and
   * finishes: lighting and bulb types, sockets, paint, flooring, internal doors,
   * worktop, appliances, sanitaryware and heating/hot water. Optional: absent for
   * unit types that have no specification recorded.
   */
  specification?: unknown;
  /**
   * The documents available to this home (title + openable URL), distilled from
   * document_sections for the unit's project. Lets the agent point the homeowner
   * to the right document when asked. Optional and may be empty.
   */
  documents?: HouseContextDocument[];
  /** A stored per-home energy and systems dataset, optional. */
  energy?: unknown;
}
