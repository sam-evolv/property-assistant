import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResolvedAgentContext } from './agent-context';

/**
 * Session 13 — scheme name resolution via the development_aliases table.
 *
 * The pre-13 code matched scheme names with a naive
 * `name.toLowerCase().includes(userInput.toLowerCase())`. That missed
 * every phonetic variant ("Ardawn View", "Arden View", "Add-on View"
 * for "Árdan View") and every fadá-stripped form. The alias table
 * stores curated phonetic seeds for each development plus an
 * auto-captured pool of inferred variants from user "did you mean…?"
 * corrections. This resolver joins aliases to developments, filters
 * to the agent's assigned set, and returns a structured outcome that
 * the chat surface can turn into honest error messages.
 */

export type SchemeResolution =
  | { ok: true; developmentId: string; canonicalName: string }
  | {
      ok: false;
      reason: 'not_found' | 'not_assigned' | 'ambiguous';
      /** Suggestions for the user — canonical names of their assigned schemes. */
      candidates: string[];
      /** Normalised input, so downstream can store it as a later alias. */
      normalised: string;
    };

/**
 * Strip fadas (á→a), drop non-alphanumerics (keep spaces), collapse
 * whitespace, lowercase. Idempotent: running it twice produces the
 * same result. Must match the `alias_normalised` value stored by
 * migration 051 so lookups are 1:1.
 */
export function normaliseSchemeName(raw: string): string {
  if (!raw) return '';
  // NFD decomposes "Árdan" → "Árdan" + combining mark; the regex then
  // strips the combining diacritics (U+0300–U+036F).
  const withoutFadas = raw.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lowered = withoutFadas.toLowerCase();
  const stripped = lowered.replace(/[^a-z0-9\s]/g, ' ');
  return stripped.replace(/\s+/g, ' ').trim();
}

export async function resolveSchemeName(
  supabase: SupabaseClient,
  rawSchemeName: string,
  agentContext: Pick<
    ResolvedAgentContext,
    'assignedDevelopmentIds' | 'assignedDevelopmentNames'
  >,
): Promise<SchemeResolution> {
  const normalised = normaliseSchemeName(rawSchemeName);
  const candidates = agentContext.assignedDevelopmentNames.slice();

  if (!normalised) {
    return { ok: false, reason: 'not_found', candidates, normalised };
  }

  const { data, error } = await supabase
    .from('development_aliases')
    .select('development_id, alias')
    .eq('alias_normalised', normalised);

  if (error) {
    // Degrade: if the alias table isn't available (bad connection,
    // migration not yet applied), fall back to in-memory substring
    // match so the feature still works.
    return fallbackSubstringMatch(rawSchemeName, agentContext);
  }

  const matchedDevIds = Array.from(
    new Set((data ?? []).map((r: any) => r.development_id as string).filter(Boolean)),
  );

  if (matchedDevIds.length === 0) {
    // Not a curated alias — try the in-memory substring fallback
    // before giving up. Handles brand-new schemes whose canonical
    // alias backfill hasn't run yet.
    const fallback = fallbackSubstringMatch(rawSchemeName, agentContext);
    if (fallback.ok) return fallback;
    return { ok: false, reason: 'not_found', candidates, normalised };
  }

  if (matchedDevIds.length > 1) {
    // Cross-scheme alias collision (rare with the canonical backfill;
    // possible if seeds get sloppy). Surface both.
    const { data: devs } = await supabase
      .from('developments')
      .select('id, name')
      .in('id', matchedDevIds);
    const ambiguousCandidates = (devs ?? [])
      .map((d: any) => d.name as string)
      .filter(Boolean);
    return {
      ok: false,
      reason: 'ambiguous',
      candidates: ambiguousCandidates.length ? ambiguousCandidates : candidates,
      normalised,
    };
  }

  const developmentId = matchedDevIds[0];
  const idx = agentContext.assignedDevelopmentIds.indexOf(developmentId);
  if (idx === -1) {
    return {
      ok: false,
      reason: 'not_assigned',
      candidates,
      normalised,
    };
  }

  return {
    ok: true,
    developmentId,
    canonicalName: agentContext.assignedDevelopmentNames[idx] || rawSchemeName,
  };
}

/**
 * In-memory substring match kept as a safety net. Same shape as the
 * pre-13 `matchAssignedScheme` helper in agent-context.ts, extracted
 * so the DB resolver can fall through to it when the alias table
 * isn't usable.
 */
function fallbackSubstringMatch(
  rawSchemeName: string,
  agentContext: Pick<
    ResolvedAgentContext,
    'assignedDevelopmentIds' | 'assignedDevelopmentNames'
  >,
): SchemeResolution {
  const needle = normaliseSchemeName(rawSchemeName);
  const candidates = agentContext.assignedDevelopmentNames.slice();
  if (!needle) {
    return { ok: false, reason: 'not_found', candidates, normalised: needle };
  }
  for (let i = 0; i < agentContext.assignedDevelopmentNames.length; i++) {
    const name = agentContext.assignedDevelopmentNames[i];
    if (!name) continue;
    const hay = normaliseSchemeName(name);
    if (hay === needle || hay.includes(needle) || needle.includes(hay)) {
      return {
        ok: true,
        developmentId: agentContext.assignedDevelopmentIds[i],
        canonicalName: name,
      };
    }
  }
  return { ok: false, reason: 'not_found', candidates, normalised: needle };
}

/**
 * Suggest the assigned-scheme name whose normalised form is closest
 * to the user's input. Used for "Did you mean…?" hints in the
 * not_found error message.
 */
export function suggestClosestScheme(
  rawSchemeName: string,
  agentContext: Pick<
    ResolvedAgentContext,
    'assignedDevelopmentNames'
  >,
): string | null {
  const needle = normaliseSchemeName(rawSchemeName);
  if (!needle || !agentContext.assignedDevelopmentNames.length) return null;

  let best: { name: string; distance: number } | null = null;
  for (const name of agentContext.assignedDevelopmentNames) {
    if (!name) continue;
    const distance = levenshtein(needle, normaliseSchemeName(name));
    if (best === null || distance < best.distance) {
      best = { name, distance };
    }
  }
  // Only suggest if at least somewhat close — distance <= half the
  // length of the longer string. Avoids suggesting "Longview Park"
  // when the user typed "Blackrock" (totally unrelated).
  if (!best) return null;
  const longest = Math.max(needle.length, normaliseSchemeName(best.name).length);
  if (best.distance > Math.floor(longest / 2)) return null;
  return best.name;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Standard DP — fine for short scheme names (<30 chars).
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[] = new Array(rows * cols);
  for (let i = 0; i < rows; i++) dp[i * cols] = i;
  for (let j = 0; j < cols; j++) dp[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i * cols + j] = Math.min(
        dp[(i - 1) * cols + j] + 1,
        dp[i * cols + (j - 1)] + 1,
        dp[(i - 1) * cols + (j - 1)] + cost,
      );
    }
  }
  return dp[rows * cols - 1];
}

/**
 * Insert an alias for `developmentId` with source='inferred'. Caps at
 * 50 inferred rows per development to prevent unbounded growth. No-op
 * if the alias already exists (unique index on
 * (development_id, alias_normalised) triggers ON CONFLICT DO NOTHING).
 */
export async function captureInferredAlias(
  supabase: SupabaseClient,
  developmentId: string,
  alias: string,
): Promise<void> {
  const aliasNormalised = normaliseSchemeName(alias);
  if (!aliasNormalised) return;

  const { count } = await supabase
    .from('development_aliases')
    .select('id', { count: 'exact', head: true })
    .eq('development_id', developmentId)
    .eq('source', 'inferred');

  if ((count ?? 0) >= 50) return;

  await supabase
    .from('development_aliases')
    .insert({
      development_id: developmentId,
      alias,
      alias_normalised: aliasNormalised,
      source: 'inferred',
    })
    // onConflict handled by the unique index; Supabase's default behaviour
    // is to return an error, so we wrap in upsert-semantics by catching.
    .then(
      () => {},
      () => {}, // swallow — dup alias or caps hit; we're already at 50 or it's a race
    );
}
