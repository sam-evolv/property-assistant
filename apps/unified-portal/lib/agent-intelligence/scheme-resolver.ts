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
      /**
       * Session 14 — populated on not_found only, when EXACTLY one assigned
       * scheme is within Levenshtein distance ≤ 3 of the normalised input
       * AND no other assigned scheme is within that distance. The chat
       * route uses it to turn a plain refusal into an interactive "Did you
       * mean X? (yes/no)" prompt and to seed an alias on confirmation.
       */
      top_candidate?: {
        name: string;
        developmentId: string;
        distance: number;
      };
    };

/** Session 14 — Levenshtein threshold for the yes/no disambiguation hook. */
const TOP_CANDIDATE_MAX_DISTANCE = 3;

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

  const topCandidate = findUniqueTopCandidate(normalised, agentContext);

  // Session 13.1 — wrap the Supabase call in try/catch. The pre-13.1
  // version destructured { data, error } and only fell back on the
  // error branch; if the client itself throws (network, cold start,
  // missing table propagated as an exception rather than a
  // PostgREST error object), the exception escapes the resolver and
  // crashes the caller. We now catch the throw too and degrade to
  // the in-memory substring match.
  let data: Array<{ development_id: string; alias: string }> | null = null;
  try {
    const res = await supabase
      .from('development_aliases')
      .select('development_id, alias')
      .eq('alias_normalised', normalised);
    if (res.error) {
      console.error('[scheme-resolver] alias lookup error:', res.error.message);
      return fallbackSubstringMatch(rawSchemeName, agentContext);
    }
    data = (res.data || []) as Array<{ development_id: string; alias: string }>;
  } catch (err: any) {
    console.error('[scheme-resolver] alias lookup threw:', err?.message || err);
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
    return {
      ok: false,
      reason: 'not_found',
      candidates,
      normalised,
      ...(topCandidate ? { top_candidate: topCandidate } : {}),
    };
  }

  if (matchedDevIds.length > 1) {
    // Cross-scheme alias collision (rare with the canonical backfill;
    // possible if seeds get sloppy). Surface both.
    let ambiguousCandidates: string[] = [];
    try {
      const res = await supabase
        .from('developments')
        .select('id, name')
        .in('id', matchedDevIds);
      ambiguousCandidates = (res.data ?? [])
        .map((d: any) => d.name as string)
        .filter(Boolean);
    } catch (err: any) {
      console.error('[scheme-resolver] ambiguous lookup threw:', err?.message || err);
    }
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
  const topCandidate = findUniqueTopCandidate(needle, agentContext);
  return {
    ok: false,
    reason: 'not_found',
    candidates,
    normalised: needle,
    ...(topCandidate ? { top_candidate: topCandidate } : {}),
  };
}

/**
 * Session 14 — pick a single phonetic-neighbour candidate for the yes/no
 * disambiguation prompt. Returns the assigned scheme whose normalised name
 * is within Levenshtein distance ≤ TOP_CANDIDATE_MAX_DISTANCE of the input
 * — but only when EXACTLY ONE scheme sits inside that radius. If two or
 * more schemes are close (or none are), we suppress the candidate: the
 * user's input is either ambiguous or unrelated, and asking "Did you mean
 * X?" would be a guess. The chat route falls back to the standard "not
 * found, here are your assigned schemes" refusal in that case.
 *
 * Input is the already-normalised needle. Levenshtein runs on the
 * normalised canonical names so "Erdon View" vs "Árdan View" is a pure
 * letter-distance comparison on "erdon view" vs "ardan view" = 2.
 */
function findUniqueTopCandidate(
  normalisedNeedle: string,
  agentContext: Pick<
    ResolvedAgentContext,
    'assignedDevelopmentIds' | 'assignedDevelopmentNames'
  >,
): { name: string; developmentId: string; distance: number } | null {
  if (!normalisedNeedle) return null;
  const inRadius: Array<{ name: string; developmentId: string; distance: number }> = [];
  for (let i = 0; i < agentContext.assignedDevelopmentNames.length; i++) {
    const name = agentContext.assignedDevelopmentNames[i];
    const id = agentContext.assignedDevelopmentIds[i];
    if (!name || !id) continue;
    const distance = levenshtein(normalisedNeedle, normaliseSchemeName(name));
    if (distance <= TOP_CANDIDATE_MAX_DISTANCE) {
      inRadius.push({ name, developmentId: id, distance });
    }
  }
  if (inRadius.length !== 1) return null;
  return inRadius[0];
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

  // Session 13.1 — wrap BOTH the count probe and the insert in
  // try/catch. The previous version only swallowed insert failures
  // via a `.then(resolve, reject)` pair; the count probe could throw
  // (missing table, RLS issue) and crash the caller. This function is
  // called fire-and-forget from the chat route, but any exception
  // still shows up in the Next.js error stream.
  try {
    const countRes = await supabase
      .from('development_aliases')
      .select('id', { count: 'exact', head: true })
      .eq('development_id', developmentId)
      .eq('source', 'inferred');
    if (countRes.error) {
      console.error(
        '[scheme-resolver] captureInferredAlias count error:',
        countRes.error.message,
      );
      return;
    }
    if ((countRes.count ?? 0) >= 50) return;
  } catch (err: any) {
    console.error(
      '[scheme-resolver] captureInferredAlias count threw:',
      err?.message || err,
    );
    return;
  }

  try {
    const insertRes = await supabase
      .from('development_aliases')
      .insert({
        development_id: developmentId,
        alias,
        alias_normalised: aliasNormalised,
        source: 'inferred',
      });
    if (insertRes.error) {
      // Dup alias on the unique index is expected; not a real error.
      const msg = insertRes.error.message || '';
      if (!/duplicate|unique/i.test(msg)) {
        console.error('[scheme-resolver] captureInferredAlias insert error:', msg);
      }
    }
  } catch (err: any) {
    console.error(
      '[scheme-resolver] captureInferredAlias insert threw:',
      err?.message || err,
    );
  }
}
