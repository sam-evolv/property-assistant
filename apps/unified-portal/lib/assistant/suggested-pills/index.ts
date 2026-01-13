export { PillSector, PILL_DEFINITIONS, getPillById, getPillByIntentKey, getPillsBySector, getAllSectors } from './registry';
export type { PillDefinition } from './registry';

export { selectPillsForSession, generateSessionId, validateSectorDiversity } from './selector';
export type { SelectionOptions } from './selector';

export { GLOBAL_SAFETY_CONTRACT, applyGlobalSafetyContract } from './safety-contract';

export { INTENT_PLAYBOOKS, getIntentPlaybook, buildIntentSystemPrompt } from './intent-playbooks';
export type { IntentPlaybook } from './intent-playbooks';

export const SUGGESTED_PILLS_V2_ENABLED = process.env.SUGGESTED_PILLS_V2 === 'true';
