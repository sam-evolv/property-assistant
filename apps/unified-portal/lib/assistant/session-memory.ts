/**
 * Session-Scoped Memory for Purchaser Assistant
 * 
 * This provides in-memory, session-scoped context for the assistant.
 * Memory does NOT persist across sessions and is isolated per tenant/scheme/unit.
 * 
 * CONSTRAINTS:
 * - Per-conversation/session only
 * - No permanent storage
 * - No cross-tenant/scheme/unit leakage
 * - Auto-expires after TTL
 */

export interface SessionMemory {
  unit_uid: string;
  tenant_id: string;
  scheme_id: string;
  block: string | null;
  house_type: string | null;
  room: string | null;
  issue: string | null;
  appliance: string | null;
  last_intent: string | null;
  last_followup_topic: string | null;
  updated_at: number;
  created_at: number;
}

interface MemoryEntry {
  memory: SessionMemory;
  expiresAt: number;
}

const SESSION_MEMORY_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // Clean up every 15 minutes

const memoryStore: Map<string, MemoryEntry> = new Map();

let cleanupIntervalId: NodeJS.Timeout | null = null;

function generateSessionKey(tenant_id: string, scheme_id: string, unit_uid: string): string {
  return `${tenant_id}:${scheme_id}:${unit_uid}`;
}

function startCleanupInterval(): void {
  if (cleanupIntervalId) return;
  
  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    let expiredCount = 0;
    
    const entries = Array.from(memoryStore.entries());
    for (const [key, entry] of entries) {
      if (entry.expiresAt < now) {
        memoryStore.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      console.log(`[SessionMemory] Cleaned up ${expiredCount} expired sessions`);
    }
  }, CLEANUP_INTERVAL_MS);
}

export function isSessionMemoryEnabled(): boolean {
  return process.env.ASSISTANT_SESSION_MEMORY === 'true';
}

export function getSessionMemory(
  tenant_id: string,
  scheme_id: string,
  unit_uid: string
): SessionMemory | null {
  if (!isSessionMemoryEnabled()) return null;
  
  const key = generateSessionKey(tenant_id, scheme_id, unit_uid);
  const entry = memoryStore.get(key);
  
  if (!entry) return null;
  
  // Lazy eviction on read
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  
  return entry.memory;
}

export function setSessionMemory(
  tenant_id: string,
  scheme_id: string,
  unit_uid: string,
  updates: Partial<Omit<SessionMemory, 'unit_uid' | 'tenant_id' | 'scheme_id' | 'updated_at' | 'created_at'>>
): SessionMemory {
  const key = generateSessionKey(tenant_id, scheme_id, unit_uid);
  const now = Date.now();
  
  const existing = memoryStore.get(key);
  const existingMemory = existing?.memory;
  
  const memory: SessionMemory = {
    unit_uid,
    tenant_id,
    scheme_id,
    block: updates.block !== undefined ? updates.block : (existingMemory?.block || null),
    house_type: updates.house_type !== undefined ? updates.house_type : (existingMemory?.house_type || null),
    room: updates.room !== undefined ? updates.room : (existingMemory?.room || null),
    issue: updates.issue !== undefined ? updates.issue : (existingMemory?.issue || null),
    appliance: updates.appliance !== undefined ? updates.appliance : (existingMemory?.appliance || null),
    last_intent: updates.last_intent !== undefined ? updates.last_intent : (existingMemory?.last_intent || null),
    last_followup_topic: updates.last_followup_topic !== undefined ? updates.last_followup_topic : (existingMemory?.last_followup_topic || null),
    updated_at: now,
    created_at: existingMemory?.created_at || now,
  };
  
  memoryStore.set(key, {
    memory,
    expiresAt: now + SESSION_MEMORY_TTL_MS,
  });
  
  // Start cleanup interval if not running
  startCleanupInterval();
  
  return memory;
}

export function clearSessionMemory(
  tenant_id: string,
  scheme_id: string,
  unit_uid: string
): boolean {
  const key = generateSessionKey(tenant_id, scheme_id, unit_uid);
  return memoryStore.delete(key);
}

export function touchSessionMemory(
  tenant_id: string,
  scheme_id: string,
  unit_uid: string
): void {
  const key = generateSessionKey(tenant_id, scheme_id, unit_uid);
  const entry = memoryStore.get(key);
  
  if (entry) {
    entry.memory.updated_at = Date.now();
    entry.expiresAt = Date.now() + SESSION_MEMORY_TTL_MS;
  }
}

// ============================================================================
// MEMORY EXTRACTION PATTERNS
// ============================================================================

const BLOCK_PATTERNS = [
  /\b(?:i'?m\s+in\s+)?block\s+([A-Za-z0-9]+)\b/i,
  /\bblock:\s*([A-Za-z0-9]+)\b/i,
  /\bmy\s+block\s+is\s+([A-Za-z0-9]+)\b/i,
  /\bin\s+block\s+([A-Za-z0-9]+)\b/i,
];

const HOUSE_TYPE_PATTERNS = [
  /\b(?:i\s+have\s+(?:a|an|the)\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:house\s+)?type\b/i,
  /\bhouse\s+type:?\s*([A-Za-z0-9\s]+)\b/i,
  /\btype:?\s*([A-Za-z0-9]+)\b/i,
  /\bmy\s+home\s+is\s+(?:a|an|the)\s+([A-Za-z]+)\b/i,
];

const ROOM_PATTERNS = [
  /\b(?:in\s+(?:the|my)\s+)?(utility\s+room|hot\s+press|airing\s+cupboard|kitchen|bathroom|ensuite|en-suite|bedroom|living\s+room|sitting\s+room|attic|garage|hall|hallway|landing|downstairs\s+toilet|cloakroom|porch)\b/i,
  /\bthe\s+(utility\s+room|hot\s+press|airing\s+cupboard|kitchen|bathroom|ensuite|en-suite|bedroom|living\s+room|sitting\s+room|attic|garage|hall|hallway|landing|downstairs\s+toilet|cloakroom|porch)\b/i,
];

const APPLIANCE_PATTERNS = [
  /\b(boiler|heat\s*pump|air\s+to\s+water|air-to-water|heating\s+system|radiator|thermostat|immersion|water\s+heater|washing\s+machine|dishwasher|dryer|tumble\s+dryer|oven|hob|cooker|extractor|cooker\s+hood|fridge|freezer|microwave)\b/i,
];

const ISSUE_PATTERNS = [
  /\b(leak(?:ing)?|drip(?:ping)?|noise|noisy|loud|trip(?:ping)?|won'?t\s+(?:start|work|turn\s+on)|broken|not\s+working|fault(?:y)?|problem|issue|crack(?:ed)?|damp|mould|mold|blocked|clogged|smells?|smell(?:ing)?|cold|hot|overheating|condensation|draft|draught)\b/i,
  /\bmaking\s+(?:a\s+)?(?:strange\s+)?(?:noise|sound)\b/i,
  /\bwon'?t\s+heat\b/i,
  /\bno\s+(?:hot\s+)?water\b/i,
  /\bno\s+heat(?:ing)?\b/i,
];

export interface ExtractedMemory {
  block: string | null;
  house_type: string | null;
  room: string | null;
  appliance: string | null;
  issue: string | null;
  extractedKeys: string[];
}

export function extractMemoryFromMessage(message: string): ExtractedMemory {
  const result: ExtractedMemory = {
    block: null,
    house_type: null,
    room: null,
    appliance: null,
    issue: null,
    extractedKeys: [],
  };
  
  // Extract block
  for (const pattern of BLOCK_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      result.block = match[1].toUpperCase();
      result.extractedKeys.push('block');
      break;
    }
  }
  
  // Extract house type
  for (const pattern of HOUSE_TYPE_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      result.house_type = match[1].trim();
      result.extractedKeys.push('house_type');
      break;
    }
  }
  
  // Extract room
  for (const pattern of ROOM_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      result.room = match[1].toLowerCase().trim();
      result.extractedKeys.push('room');
      break;
    }
  }
  
  // Extract appliance
  for (const pattern of APPLIANCE_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      result.appliance = match[1].toLowerCase().replace(/\s+/g, ' ').trim();
      result.extractedKeys.push('appliance');
      break;
    }
  }
  
  // Extract issue
  for (const pattern of ISSUE_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      // For issues, we want to capture more context
      result.issue = match[0].toLowerCase().trim();
      result.extractedKeys.push('issue');
      break;
    }
  }
  
  return result;
}

export function updateSessionFromMessage(
  tenant_id: string,
  scheme_id: string,
  unit_uid: string,
  message: string,
  intent?: string | null,
  followup_topic?: string | null
): { memory: SessionMemory; updatedKeys: string[] } {
  const extracted = extractMemoryFromMessage(message);
  const updatedKeys = [...extracted.extractedKeys];
  
  const updates: Partial<Omit<SessionMemory, 'unit_uid' | 'tenant_id' | 'scheme_id' | 'updated_at' | 'created_at'>> = {};
  
  if (extracted.block) updates.block = extracted.block;
  if (extracted.house_type) updates.house_type = extracted.house_type;
  if (extracted.room) updates.room = extracted.room;
  if (extracted.appliance) updates.appliance = extracted.appliance;
  if (extracted.issue) updates.issue = extracted.issue;
  
  if (intent) {
    updates.last_intent = intent;
    updatedKeys.push('last_intent');
  }
  
  if (followup_topic) {
    updates.last_followup_topic = followup_topic;
    updatedKeys.push('last_followup_topic');
  }
  
  const memory = setSessionMemory(tenant_id, scheme_id, unit_uid, updates);
  
  return { memory, updatedKeys };
}

// ============================================================================
// MEMORY CONTEXT HELPERS
// ============================================================================

export function getMemoryContext(memory: SessionMemory | null): string {
  if (!memory) return '';
  
  const parts: string[] = [];
  
  if (memory.block) {
    parts.push(`The user is in Block ${memory.block}.`);
  }
  
  if (memory.house_type) {
    parts.push(`Their house type is ${memory.house_type}.`);
  }
  
  if (memory.room) {
    parts.push(`They previously mentioned the ${memory.room}.`);
  }
  
  if (memory.appliance) {
    parts.push(`They've been asking about their ${memory.appliance}.`);
  }
  
  if (memory.issue) {
    parts.push(`They reported an issue: ${memory.issue}.`);
  }
  
  if (parts.length === 0) return '';
  
  return `SESSION CONTEXT (from earlier in this conversation):\n${parts.join('\n')}`;
}

export function hasRelevantMemory(memory: SessionMemory | null): boolean {
  if (!memory) return false;
  
  return !!(
    memory.block ||
    memory.house_type ||
    memory.room ||
    memory.appliance ||
    memory.issue
  );
}

// ============================================================================
// DEBUG / OBSERVABILITY
// ============================================================================

export interface MemoryDebugInfo {
  enabled: boolean;
  memory_used: boolean;
  memory_updated_keys: string[];
  memory_state: {
    block: string | null;
    house_type: string | null;
    room: string | null;
    appliance: string | null;
    issue: string | null;
    last_intent: string | null;
  } | null;
  session_age_ms: number | null;
}

export function getMemoryDebugInfo(
  memory: SessionMemory | null,
  updatedKeys: string[]
): MemoryDebugInfo {
  const enabled = isSessionMemoryEnabled();
  
  if (!memory) {
    return {
      enabled,
      memory_used: false,
      memory_updated_keys: updatedKeys,
      memory_state: null,
      session_age_ms: null,
    };
  }
  
  return {
    enabled,
    memory_used: hasRelevantMemory(memory),
    memory_updated_keys: updatedKeys,
    memory_state: {
      block: memory.block,
      house_type: memory.house_type,
      room: memory.room,
      appliance: memory.appliance,
      issue: memory.issue,
      last_intent: memory.last_intent,
    },
    session_age_ms: Date.now() - memory.created_at,
  };
}

// ============================================================================
// STATS (for monitoring)
// ============================================================================

export function getSessionMemoryStats(): { activeCount: number; oldestSessionMs: number | null } {
  const now = Date.now();
  let oldestCreatedAt: number | null = null;
  
  const values = Array.from(memoryStore.values());
  for (const entry of values) {
    if (oldestCreatedAt === null || entry.memory.created_at < oldestCreatedAt) {
      oldestCreatedAt = entry.memory.created_at;
    }
  }
  
  return {
    activeCount: memoryStore.size,
    oldestSessionMs: oldestCreatedAt ? now - oldestCreatedAt : null,
  };
}
