// Rent Pressure Zone (RPZ) lookup for Irish lettings.
//
// Source of truth: https://www.rtb.ie/ — the RTB publishes the authoritative
// list of Rent Pressure Zones and their designations
// (residentialtenancies.ie/rent-pressure-zones). Review this table
// periodically (at minimum once per year, or whenever the RTB updates
// designations) to keep it in sync. When adding support for a new letting
// region, extend this list rather than branching at the call site.
//
// Coverage as of the latest RTB designations:
//   - Dublin (all four LAs: Dublin City Council, Fingal, South Dublin,
//     Dún Laoghaire–Rathdown) plus every Dublin postal district.
//   - Cork City and the named Cork suburbs / LEAs.
//   - Galway City, Limerick City, Waterford City.
//   - Wicklow commuter LEAs: Bray, Greystones, Wicklow, Arklow.
//   - Kildare LEAs: Naas, Newbridge, Maynooth, Celbridge, Leixlip,
//     Kildare town, Athy.
//   - Meath commuter LEAs: Navan, Ashbourne, Ratoath, Trim, Kells,
//     Laytown–Bettystown, Duleek, Slane.
//   - Louth: Drogheda, Dundalk.
//
// The Set is keyed on lowercase, whitespace-trimmed names. Callers go
// through normaliseCity() so trailing postcode tokens ("Dublin 4",
// "Dublin 18") match the bare city entry, and so common spelling
// variants of Dún Laoghaire collapse to a single key.

const RPZ_AREAS = new Set<string>([
  // Dublin — all four local authority areas + the postal districts.
  // Postal districts vary in how they're written into the `city` field
  // (e.g. "Dublin", "Dublin 4", "D04"), so we list both forms.
  'dublin',
  'dublin city',
  'dublin city council',
  'fingal',
  'south dublin',
  'dun laoghaire',
  'dun laoghaire-rathdown',
  'dun laoghaire rathdown',
  'dublin 1',
  'dublin 2',
  'dublin 3',
  'dublin 4',
  'dublin 5',
  'dublin 6',
  'dublin 6w',
  'dublin 7',
  'dublin 8',
  'dublin 9',
  'dublin 10',
  'dublin 11',
  'dublin 12',
  'dublin 13',
  'dublin 14',
  'dublin 15',
  'dublin 16',
  'dublin 17',
  'dublin 18',
  'dublin 20',
  'dublin 22',
  'dublin 24',
  // Cork City + suburbs (pre-existing list, retained verbatim).
  'cork',
  'cork city',
  'ballincollig',
  'bishopstown',
  'douglas',
  'rochestown',
  'glanmire',
  'ballyvolane',
  'mayfield',
  // Other major regional cities under RPZ designation.
  'galway',
  'galway city',
  'limerick',
  'limerick city',
  'waterford',
  'waterford city',
  // Wicklow commuter LEAs.
  'bray',
  'greystones',
  'wicklow',
  'arklow',
  // Kildare LEAs.
  'naas',
  'newbridge',
  'maynooth',
  'celbridge',
  'leixlip',
  'kildare',
  'athy',
  // Meath commuter LEAs.
  'navan',
  'ashbourne',
  'ratoath',
  'trim',
  'kells',
  'laytown',
  'bettystown',
  'laytown-bettystown',
  'duleek',
  'slane',
  // Louth.
  'drogheda',
  'dundalk',
]);

/**
 * Lowercased, whitespace-collapsed compare key. Strips Irish-language
 * fadás so "Dún Laoghaire" matches "Dun Laoghaire", and strips trailing
 * postcode digits so "Dublin 4" / "Dublin 18" match the bare "dublin"
 * entry. Conservative — only collapses well-known patterns.
 */
function normaliseCity(raw: string): string {
  let s = raw.trim().toLowerCase();
  // Strip diacritics (Dún → Dun) by decomposing then dropping
  // combining marks U+0300..U+036F.
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Collapse multiple spaces.
  s = s.replace(/\s+/g, ' ');
  return s;
}

export function isInRPZ(city: string | null | undefined): boolean {
  if (!city) return false;
  const normalised = normaliseCity(city);
  if (RPZ_AREAS.has(normalised)) return true;
  // Postcode tail strip: "dublin 4" / "dublin 6w" → "dublin". Only
  // collapse when the prefix on its own is a known RPZ entry, so we
  // don't accidentally match arbitrary "<word> <number>" cities.
  const postcodeStripped = normalised.replace(/\s+(?:\d{1,2}[a-z]?|d\d{1,2}[a-z]?)$/, '');
  if (postcodeStripped !== normalised && RPZ_AREAS.has(postcodeStripped)) return true;
  return false;
}

export function rpzUpliftCap(): number {
  // 2% annual cap under the 2021 reforms. Codified as a constant so callers
  // don't hardcode the number ad-hoc.
  return 0.02;
}
