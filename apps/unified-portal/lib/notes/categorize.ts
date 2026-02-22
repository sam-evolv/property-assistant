/**
 * Home Note Auto-Categorization
 *
 * Two-tier strategy:
 *   1. Fast keyword-based classification (< 1ms, always available)
 *   2. GPT-4o-mini classification (optional, higher accuracy)
 *
 * Falls back to keyword matching when AI is unavailable or slow.
 */

export type NoteCategory =
  | 'maintenance'
  | 'warranty'
  | 'utility'
  | 'appliance'
  | 'garden'
  | 'security'
  | 'general';

export const NOTE_CATEGORIES: readonly NoteCategory[] = [
  'maintenance', 'warranty', 'utility', 'appliance', 'garden', 'security', 'general',
] as const;

export const CATEGORY_META: Record<NoteCategory, { label: string; icon: string; color: string }> = {
  maintenance: { label: 'Maintenance', icon: 'Wrench',       color: '#F59E0B' },
  warranty:    { label: 'Warranty',    icon: 'Shield',       color: '#3B82F6' },
  utility:     { label: 'Utility',     icon: 'Zap',          color: '#10B981' },
  appliance:   { label: 'Appliance',   icon: 'Refrigerator', color: '#8B5CF6' },
  garden:      { label: 'Garden',      icon: 'Flower2',      color: '#22C55E' },
  security:    { label: 'Security',    icon: 'Lock',         color: '#EF4444' },
  general:     { label: 'General',     icon: 'StickyNote',   color: '#6B7280' },
};

// ─── Keyword-Based Classification ───────────────────────────────────────────

const KEYWORD_MAP: Record<NoteCategory, string[]> = {
  maintenance: [
    'fix', 'repair', 'broken', 'leak', 'crack', 'damp', 'mould', 'mold',
    'paint', 'plumber', 'plumbing', 'electrician', 'blockage', 'drain',
    'roof', 'gutter', 'seal', 'caulk', 'squeaky', 'scratch', 'stain',
    'tile', 'grout', 'snagging', 'snag', 'defect', 'damage',
  ],
  warranty: [
    'warranty', 'guarantee', 'claim', 'builder', 'developer', 'homebond',
    'defect period', 'structural', 'certificate', 'expiry', 'expires',
    'coverage', 'covered', '2 year', '10 year', 'latent',
  ],
  utility: [
    'electric', 'electricity', 'gas', 'water', 'broadband', 'internet',
    'wifi', 'bin', 'waste', 'meter', 'reading', 'bill', 'esb', 'bord gais',
    'irish water', 'eir', 'virgin', 'sky', 'provider', 'account', 'eircode',
    'mpprn', 'mprn', 'gprn',
  ],
  appliance: [
    'oven', 'hob', 'dishwasher', 'washing machine', 'dryer', 'tumble',
    'fridge', 'freezer', 'microwave', 'extractor', 'fan', 'boiler',
    'heat pump', 'thermostat', 'radiator', 'ventilation', 'mvhr',
    'alarm', 'smoke detector', 'carbon monoxide', 'appliance', 'model',
    'serial number',
  ],
  garden: [
    'garden', 'lawn', 'grass', 'hedge', 'tree', 'fence', 'patio',
    'deck', 'shed', 'outdoor', 'plant', 'soil', 'compost', 'hose',
    'mower', 'landscaping', 'driveway', 'path', 'gate',
  ],
  security: [
    'alarm', 'lock', 'key', 'fob', 'cctv', 'camera', 'security',
    'door code', 'pin', 'intercom', 'gate code', 'safe', 'deadbolt',
    'window lock', 'sensor', 'motion', 'break-in', 'insurance',
  ],
  general: [],
};

export function categorizeByKeywords(content: string): NoteCategory {
  const lower = content.toLowerCase();
  let bestCategory: NoteCategory = 'general';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    if (category === 'general') continue;
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += keyword.includes(' ') ? 2 : 1; // Multi-word matches score higher
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as NoteCategory;
    }
  }

  return bestCategory;
}

// ─── GPT-4o-mini Classification ─────────────────────────────────────────────

const CATEGORIZE_PROMPT = `You are a home note categorizer. Given a homeowner's note, classify it into exactly ONE category.

Categories:
- maintenance: Repairs, fixes, snagging, structural issues, plumbing, electrical
- warranty: Warranty claims, guarantee periods, builder defects, HomeBond
- utility: Electricity, gas, water, broadband, bin collection, meter readings
- appliance: Oven, dishwasher, boiler, heat pump, thermostat, ventilation
- garden: Lawn, fence, patio, landscaping, outdoor maintenance
- security: Alarms, locks, keys, CCTV, access codes, insurance
- general: Anything that doesn't fit the above

Respond with ONLY the category name, nothing else.`;

export async function categorizeWithAI(content: string): Promise<NoteCategory> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return categorizeByKeywords(content);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: CATEGORIZE_PROMPT },
          { role: 'user', content: content.slice(0, 500) }, // Cap input length
        ],
        max_tokens: 10,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('[Notes] AI categorization failed, falling back to keywords');
      return categorizeByKeywords(content);
    }

    const data = await res.json();
    const result = data.choices?.[0]?.message?.content?.trim()?.toLowerCase() as NoteCategory;

    if (NOTE_CATEGORIES.includes(result)) {
      return result;
    }

    // AI returned something unexpected, fall back
    return categorizeByKeywords(content);
  } catch (err) {
    console.warn('[Notes] AI categorization error, falling back to keywords:', err);
    return categorizeByKeywords(content);
  }
}

/**
 * Primary categorization function.
 * Attempts AI classification first, falls back to keyword matching.
 */
export async function categorizeNote(content: string): Promise<NoteCategory> {
  // Short notes are better handled by keywords (less context for AI)
  if (content.length < 20) {
    return categorizeByKeywords(content);
  }

  return categorizeWithAI(content);
}
