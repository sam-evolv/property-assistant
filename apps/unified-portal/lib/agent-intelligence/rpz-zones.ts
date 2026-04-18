// Rent Pressure Zone (RPZ) lookup for Irish lettings.
//
// Source of truth: https://www.rtb.ie/ — the RTB publishes the authoritative
// list of Rent Pressure Zones and their boundaries. The hardcoded list below
// covers the Cork-area LEAs and towns where this agent's letting portfolio
// sits; it is NOT a national list. Review this table periodically (at minimum
// once per year, or whenever the RTB updates designations) to keep it in sync
// with rtb.ie. When adding support for a new letting region, extend this list
// rather than branching at the call site.

const RPZ_AREAS = new Set<string>([
  'cork city',
  'ballincollig',
  'bishopstown',
  'douglas',
  'rochestown',
  'glanmire',
  'ballyvolane',
  'mayfield',
]);

export function isInRPZ(city: string | null | undefined): boolean {
  if (!city) return false;
  return RPZ_AREAS.has(city.trim().toLowerCase());
}

export function rpzUpliftCap(): number {
  // 2% annual cap under the 2021 reforms. Codified as a constant so callers
  // don't hardcode the number ad-hoc.
  return 0.02;
}
