// loadHouseContext — assembles the structured HouseContext briefing for one home
// from the live tables, using a service-role client. Pure data assembly: it does
// not touch the request, storage, or any feature flag.
//
// Relationship notes (verified against the schema + data, not assumed):
//   - scheme_profile has NO development_id. It is keyed by its own id, which
//     equals projects.id, which equals units.project_id. So the scheme for a unit
//     is scheme_profile.id = unit.project_id. This mirrors how the homeowner chat
//     route resolves it (app/api/chat/route.ts) — developer_org_id is a tenant
//     marker used by the developer-portal write paths, not the read key here.
//   - unit_types joins via the real FK units.unit_type_id -> unit_types.id.
//   - unit_room_dimensions.house_type_id references unit_types.id.
//   - document_sections holds the home's documents; each carries a source title
//     and file_url in metadata. We distil those to one title+url per document.
//
// Every query swallows its own errors (console.warn, return null/empty) so a
// context-load failure can never break the homeowner's chat turn.

import type { SupabaseClient } from '@supabase/supabase-js';
import { enrichDemoHomeEnergy } from '@/lib/energy/home-energy-intelligence';
import type {
  HouseContext,
  HouseContextDevelopment,
  HouseContextDocument,
  HouseContextRoom,
  HouseContextScheme,
  HouseContextUnit,
  RoomDimensionSource,
} from './types';

export interface LoadHouseContextParams {
  tenantId: string;
  developmentId: string;
  unitId: string;
  supabase: SupabaseClient;
}

// Rough token cap on the serialized context (~4 chars/token). Over budget we trim
// rooms first, then drop the verbose scheme notes.
const TOKEN_BUDGET = 800;
const MAX_ROOMS = 8;

// Base used to turn a relative document path (/docs/x.pdf) into an absolute URL.
// The chat bubble only linkifies absolute http(s) URLs, so relative paths would
// render as dead text. Prefer the configured app URL; fall back to the portal.
const DOC_BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://portal.openhouseai.ie'
).replace(/\/+$/, '');

type Row = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

// Make a stored document URL absolute so the chat bubble renders it as a link.
// Already-absolute URLs pass through unchanged; relative paths get the doc base.
function absoluteDocUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${DOC_BASE_URL}/${url.replace(/^\/+/, '')}`;
}

function emptyDevelopment(): HouseContextDevelopment {
  return { name: '', address: null, project_type: null };
}

function emptyUnit(): HouseContextUnit {
  return {
    unit_number: null,
    address: null,
    eircode: null,
    bedrooms: null,
    bathrooms: null,
    floor_area_m2: null,
    property_type: null,
    handover_date: null,
    house_type_code: null,
    unit_type_name: null,
  };
}

function estimateTokens(context: HouseContext): number {
  return Math.ceil(JSON.stringify(context).length / 4);
}

function mapRooms(rows: Row[] | null, source: RoomDimensionSource): HouseContextRoom[] {
  return (rows ?? []).map((r) => ({
    name: toStr(r.room_name) ?? '',
    floor: toStr(r.floor),
    length_m: toNum(r.length_m),
    width_m: toNum(r.width_m),
    area_sqm: toNum(r.area_sqm),
    source,
  }));
}

interface UnitLoad {
  unit: HouseContextUnit;
  projectId: string | null;
  unitTypeId: string | null;
  floorPlanUrl: string | null;
  specification: unknown;
}

export async function loadHouseContext(params: LoadHouseContextParams): Promise<HouseContext> {
  const { developmentId, unitId, supabase } = params;
  // tenantId is accepted for symmetry and possible future RLS-scoped queries. The
  // lookups here are by primary key / unit id; tenant isolation was already
  // enforced upstream (resolveMediaAuth authorised this unit for the caller).

  const loadDevelopment = async (): Promise<HouseContextDevelopment> => {
    try {
      const { data, error } = await supabase
        .from('developments')
        .select('name, address, project_type')
        .eq('id', developmentId)
        .maybeSingle();
      if (error || !data) {
        if (error) console.warn('[house-context] development_load_failed reason=%s', error.message);
        return emptyDevelopment();
      }
      const row = data as Row;
      return {
        name: toStr(row.name) ?? '',
        address: toStr(row.address),
        project_type: toStr(row.project_type),
      };
    } catch (err) {
      console.warn(
        '[house-context] development_load_threw reason=%s',
        err instanceof Error ? err.message : String(err),
      );
      return emptyDevelopment();
    }
  };

  const loadUnit = async (): Promise<UnitLoad> => {
    const fallback: UnitLoad = {
      unit: emptyUnit(),
      projectId: null,
      unitTypeId: null,
      floorPlanUrl: null,
      specification: undefined,
    };
    try {
      const { data, error } = await supabase
        .from('units')
        .select(
          'unit_number, address, eircode, bedrooms, bathrooms, floor_area_m2, property_type, handover_date, house_type_code, project_id, unit_type_id, unit_types(name, floor_plan_pdf_url, specification_json)',
        )
        .eq('id', unitId)
        .maybeSingle();
      if (error || !data) {
        if (error) console.warn('[house-context] unit_load_failed reason=%s', error.message);
        return fallback;
      }
      const row = data as Row;
      // unit_types is a to-one embed; supabase-js may surface it as an object or a
      // single-element array depending on relationship detection. Handle both.
      const utRaw = row.unit_types;
      const ut = (Array.isArray(utRaw) ? utRaw[0] : utRaw) as Row | null | undefined;
      const specRaw = ut ? (ut.specification_json as unknown) : undefined;
      const specification =
        specRaw && typeof specRaw === 'object' && Object.keys(specRaw as Row).length > 0
          ? specRaw
          : undefined;
      const rawFloorPlan = ut ? toStr(ut.floor_plan_pdf_url) : null;
      return {
        unit: {
          unit_number: toStr(row.unit_number),
          address: toStr(row.address),
          eircode: toStr(row.eircode),
          bedrooms: toNum(row.bedrooms),
          bathrooms: toNum(row.bathrooms),
          floor_area_m2: toNum(row.floor_area_m2),
          property_type: toStr(row.property_type),
          handover_date: toStr(row.handover_date),
          house_type_code: toStr(row.house_type_code),
          unit_type_name: ut ? toStr(ut.name) : null,
        },
        projectId: toStr(row.project_id),
        unitTypeId: toStr(row.unit_type_id),
        floorPlanUrl: rawFloorPlan ? absoluteDocUrl(rawFloorPlan) : null,
        specification,
      };
    } catch (err) {
      console.warn(
        '[house-context] unit_load_threw reason=%s',
        err instanceof Error ? err.message : String(err),
      );
      return fallback;
    }
  };

  // Rooms recorded against this specific unit.
  const loadUnitRooms = async (): Promise<HouseContextRoom[]> => {
    try {
      const { data, error } = await supabase
        .from('unit_room_dimensions')
        .select('room_name, floor, length_m, width_m, area_sqm')
        .eq('unit_id', unitId)
        .eq('verified', true)
        .order('floor', { ascending: true })
        .order('room_name', { ascending: true });
      if (error) {
        console.warn('[house-context] unit_rooms_load_failed reason=%s', error.message);
        return [];
      }
      return mapRooms(data as Row[] | null, 'unit');
    } catch (err) {
      console.warn(
        '[house-context] unit_rooms_load_threw reason=%s',
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  };

  // House-type template rooms (unit_id IS NULL), keyed by the unit's house type.
  const loadHouseTypeRooms = async (unitTypeId: string): Promise<HouseContextRoom[]> => {
    try {
      const { data, error } = await supabase
        .from('unit_room_dimensions')
        .select('room_name, floor, length_m, width_m, area_sqm')
        .eq('house_type_id', unitTypeId)
        .eq('verified', true)
        .is('unit_id', null)
        .order('floor', { ascending: true })
        .order('room_name', { ascending: true });
      if (error) {
        console.warn('[house-context] housetype_rooms_load_failed reason=%s', error.message);
        return [];
      }
      return mapRooms(data as Row[] | null, 'house_type');
    } catch (err) {
      console.warn(
        '[house-context] housetype_rooms_load_threw reason=%s',
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  };

  const loadScheme = async (projectId: string | null): Promise<HouseContextScheme | null> => {
    if (!projectId) return null;
    try {
      const { data, error } = await supabase
        .from('scheme_profile')
        .select(
          'heating_type, heating_controls, broadband_type, water_billing, waste_setup, waste_provider, parking_type, parking_notes, bin_storage_notes, emergency_contact_phone, emergency_contact_notes, managing_agent_name',
        )
        .eq('id', projectId)
        .maybeSingle();
      if (error || !data) {
        if (error) console.warn('[house-context] scheme_load_failed reason=%s', error.message);
        return null;
      }
      const row = data as Row;
      return {
        heating_type: toStr(row.heating_type),
        heating_controls: toStr(row.heating_controls),
        broadband_type: toStr(row.broadband_type),
        water_billing: toStr(row.water_billing),
        waste_setup: toStr(row.waste_setup),
        waste_provider: toStr(row.waste_provider),
        parking_type: toStr(row.parking_type),
        parking_notes: toStr(row.parking_notes),
        bin_storage_notes: toStr(row.bin_storage_notes),
        emergency_contact_phone: toStr(row.emergency_contact_phone),
        emergency_contact_notes: toStr(row.emergency_contact_notes),
        managing_agent_name: toStr(row.managing_agent_name),
      };
    } catch (err) {
      console.warn(
        '[house-context] scheme_load_threw reason=%s',
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  };

  // The home's documents, distilled to one title+url per document from
  // document_sections (a document is chunked across many rows, so dedupe by
  // source title). URLs are made absolute so the chat bubble renders them as
  // links. Optional: an empty or failed load degrades to an omitted field.
  const loadDocuments = async (projectId: string | null): Promise<HouseContextDocument[]> => {
    if (!projectId) return [];
    try {
      const { data, error } = await supabase
        .from('document_sections')
        .select('metadata')
        .eq('project_id', projectId)
        .limit(1000);
      if (error) {
        console.warn('[house-context] documents_load_failed reason=%s', error.message);
        return [];
      }
      const seen = new Set<string>();
      const docs: HouseContextDocument[] = [];
      for (const r of (data as Row[] | null) ?? []) {
        const meta = (r.metadata as Row) || {};
        const title = toStr(meta.source);
        const fileUrl = toStr(meta.file_url);
        if (!title || !fileUrl) continue;
        if (seen.has(title)) continue;
        seen.add(title);
        docs.push({ title, url: absoluteDocUrl(fileUrl) });
      }
      docs.sort((a, b) => a.title.localeCompare(b.title));
      return docs;
    } catch (err) {
      console.warn(
        '[house-context] documents_load_threw reason=%s',
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  };

  // Stored per-home energy and systems dataset, if one has been attached to the unit
  // under units.metadata.demo_home. Optional enrichment: absent data or any failure
  // degrades to an omitted field and never breaks the turn.
  const loadEnergy = async (): Promise<unknown> => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('metadata')
        .eq('id', unitId)
        .maybeSingle();
      if (error || !data) {
        if (error) console.warn('[house-context] energy_load_failed reason=%s', error.message);
        return undefined;
      }
      const metadata = (data as Row).metadata;
      if (!metadata || typeof metadata !== 'object') return undefined;
      const demoHome = (metadata as Row).demo_home;
      return demoHome ?? undefined;
    } catch (err) {
      console.warn(
        '[house-context] energy_load_threw reason=%s',
        err instanceof Error ? err.message : String(err),
      );
      return undefined;
    }
  };

  // Wave 1 — keyed entirely on the loader inputs, so run in parallel.
  const [development, unitLoad, unitRooms, energy] = await Promise.all([
    loadDevelopment(),
    loadUnit(),
    loadUnitRooms(),
    loadEnergy(),
  ]);

  // Wave 2 — keyed on values the unit fetch returned (project_id for the scheme,
  // documents and the room fallback), so they depend on loadUnit but run in
  // parallel with each other. The house-type fallback only fires when the unit has
  // no unit-keyed verified dimensions of its own.
  const needsFallback = unitRooms.length === 0 && !!unitLoad.unitTypeId;
  const [scheme, fallbackRooms, documents] = await Promise.all([
    loadScheme(unitLoad.projectId),
    needsFallback
      ? loadHouseTypeRooms(unitLoad.unitTypeId as string)
      : Promise.resolve<HouseContextRoom[]>([]),
    loadDocuments(unitLoad.projectId),
  ]);

  const rooms = unitRooms.length > 0 ? unitRooms : fallbackRooms;

  let context: HouseContext = {
    development,
    scheme,
    unit: unitLoad.unit,
    rooms,
    floor_plan_url: unitLoad.floorPlanUrl,
  };

  // Token budget guard. Over budget: trim rooms to the first MAX_ROOMS, then (if
  // still over) drop the verbose scheme notes fields. Never throws; always returns
  // something. Truncation is logged so analytics can show whether it is firing.
  // Documents and the specification are attached after this guard so they are not
  // counted against the room/scheme trim.
  let estimated = estimateTokens(context);
  if (estimated > TOKEN_BUDGET) {
    if (context.rooms.length > MAX_ROOMS) {
      const before = context.rooms.length;
      context = { ...context, rooms: context.rooms.slice(0, MAX_ROOMS) };
      console.warn(
        '[house-context] truncated rooms %d->%d (est %d tokens > %d budget)',
        before,
        MAX_ROOMS,
        estimated,
        TOKEN_BUDGET,
      );
      estimated = estimateTokens(context);
    }
    if (estimated > TOKEN_BUDGET && context.scheme) {
      context = {
        ...context,
        scheme: {
          ...context.scheme,
          parking_notes: null,
          bin_storage_notes: null,
          emergency_contact_notes: null,
        },
      };
      console.warn(
        '[house-context] dropped scheme notes fields (est %d tokens > %d budget)',
        estimated,
        TOKEN_BUDGET,
      );
    }
  }

  // Attach the documents list, dwelling specification and stored per-home energy
  // dataset last, so they reach the model intact and do not perturb the room and
  // scheme budget trimming above. All are optional: an unset/empty field is omitted.
  if (documents.length > 0) {
    context = { ...context, documents };
  }
  if (unitLoad.specification !== undefined) {
    context = { ...context, specification: unitLoad.specification };
  }
  if (energy !== undefined) {
    context = { ...context, energy: enrichDemoHomeEnergy(energy) };
  }

  return context;
}
