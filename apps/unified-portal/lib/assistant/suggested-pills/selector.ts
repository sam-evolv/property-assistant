import { PillDefinition, PillSector, PILL_DEFINITIONS, getPillsBySector } from './registry';

const PRIORITY_SECTORS = [
  PillSector.HOME_LAYOUT,
  PillSector.MAINTENANCE_OWNERSHIP
];

const SECONDARY_SECTORS = [
  PillSector.ENERGY_TECHNOLOGY,
  PillSector.SERVICES_SETUP,
  PillSector.AREA_PLANNING
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

export function selectPillsForSession(options: SelectionOptions = {}): PillDefinition[] {
  const { sessionId = Date.now().toString(), count = 4, excludePillIds = [] } = options;
  
  const seed = hashString(sessionId);
  const random = seededRandom(seed);
  
  const availablePills = PILL_DEFINITIONS.filter(p => !excludePillIds.includes(p.id));
  
  const pillsBySector = new Map<PillSector, PillDefinition[]>();
  for (const pill of availablePills) {
    const existing = pillsBySector.get(pill.sector) || [];
    existing.push(pill);
    pillsBySector.set(pill.sector, existing);
  }
  
  const selected: PillDefinition[] = [];
  const usedSectors = new Set<PillSector>();
  
  const shuffledPriority = shuffleWithSeed([...PRIORITY_SECTORS], random);
  for (const sector of shuffledPriority) {
    if (selected.length >= count) break;
    if (usedSectors.has(sector)) continue;
    
    const sectorPills = pillsBySector.get(sector) || [];
    if (sectorPills.length > 0) {
      const shuffledPills = shuffleWithSeed(sectorPills, random);
      selected.push(shuffledPills[0]);
      usedSectors.add(sector);
    }
  }
  
  const shuffledSecondary = shuffleWithSeed([...SECONDARY_SECTORS], random);
  for (const sector of shuffledSecondary) {
    if (selected.length >= count) break;
    if (usedSectors.has(sector)) continue;
    
    const sectorPills = pillsBySector.get(sector) || [];
    if (sectorPills.length > 0) {
      const shuffledPills = shuffleWithSeed(sectorPills, random);
      selected.push(shuffledPills[0]);
      usedSectors.add(sector);
    }
  }
  
  const remainingSectors = Object.values(PillSector).filter(s => !usedSectors.has(s));
  const shuffledRemaining = shuffleWithSeed(remainingSectors, random);
  
  for (const sector of shuffledRemaining) {
    if (selected.length >= count) break;
    
    const sectorPills = pillsBySector.get(sector) || [];
    if (sectorPills.length > 0) {
      const shuffledPills = shuffleWithSeed(sectorPills, random);
      selected.push(shuffledPills[0]);
      usedSectors.add(sector);
    }
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
