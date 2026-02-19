import { PillDefinition, PillSector, PILL_DEFINITIONS } from './registry';

// Sectors shown in preferred order — always pick one from each until count reached
// LOCAL_LIFE first so weather/transport/amenity pills appear regularly
const SECTOR_PRIORITY: PillSector[] = [
  PillSector.LOCAL_LIFE,
  PillSector.MAINTENANCE_OWNERSHIP,
  PillSector.ENERGY_TECHNOLOGY,
  PillSector.HOME_LAYOUT,
  PillSector.SERVICES_SETUP,
  PillSector.AREA_PLANNING,
  PillSector.GARDEN_EXTERIOR,
  PillSector.INSURANCE,
];

function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function shuffleWithSeed<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export interface SelectionOptions {
  sessionId?: string;
  count?: number;
  excludePillIds?: string[];
}

/**
 * Select pills for a session — GUARANTEED to be from different categories.
 *
 * Strategy:
 * 1. Group all pills by sector
 * 2. For each sector (in priority order), randomly pick one pill from it
 * 3. Shuffle the sector order using the session seed so variety differs each session
 * 4. Take the first `count` — one per sector, always unique categories
 */
export function selectPillsForSession(options: SelectionOptions = {}): PillDefinition[] {
  const { sessionId = Date.now().toString(), count = 4, excludePillIds = [] } = options;

  const seed = hashString(sessionId);
  const random = seededRandom(seed);

  const availablePills = PILL_DEFINITIONS.filter(p => !excludePillIds.includes(p.id));

  // Group pills by sector
  const pillsBySector = new Map<PillSector, PillDefinition[]>();
  for (const pill of availablePills) {
    const existing = pillsBySector.get(pill.sector) || [];
    existing.push(pill);
    pillsBySector.set(pill.sector, existing);
  }

  // Shuffle the priority order — keeps LOCAL_LIFE near top but varies the rest
  // We split: first sector is always LOCAL_LIFE (guaranteed feature discovery),
  // remaining sectors are shuffled so every session has a different mix
  const [firstSector, ...restSectors] = SECTOR_PRIORITY;
  const shuffledRest = shuffleWithSeed(restSectors, random);
  const orderedSectors = [firstSector, ...shuffledRest];

  // Pick exactly one pill from each sector — guaranteed unique categories
  const selected: PillDefinition[] = [];

  for (const sector of orderedSectors) {
    if (selected.length >= count) break;

    const sectorPills = pillsBySector.get(sector) || [];
    if (sectorPills.length === 0) continue;

    // Pick a random pill from this sector
    const shuffledPills = shuffleWithSeed(sectorPills, random);
    selected.push(shuffledPills[0]);
  }

  return selected.slice(0, count);
}

export function generateSessionId(): string {
  const date = new Date().toISOString().split('T')[0];
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${date}-${randomPart}`;
}

export function validateSectorDiversity(pills: PillDefinition[]): boolean {
  const sectors = pills.map(p => p.sector);
  const uniqueSectors = new Set(sectors);
  return uniqueSectors.size === sectors.length;
}
