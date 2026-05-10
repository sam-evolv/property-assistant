/**
 * Loose-match a free-text property hint against an agent's assigned
 * developments. Used by create_viewing and schedule_viewings when the
 * user names a scheme in plain English ("Lakeside", "Lakeside Manor
 * Show House") rather than picking from a list.
 *
 * Strategy: lowercase both sides, strip common Irish-letting suffixes
 * from the hint (show house / showhome / apartment / apt / house),
 * then accept exact, hint-in-name, or name-in-hint matches.
 */

export interface Development {
  id: string;
  name: string;
}

export type MatchResult =
  | { type: 'unique'; development: Development }
  | { type: 'ambiguous'; candidates: Development[] }
  | { type: 'no_match' };

function normaliseHint(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/\bshow\s*house\b/g, ' ');
  s = s.replace(/\bshow\s*home\b/g, ' ');
  s = s.replace(/\bapartments\b/g, ' ');
  s = s.replace(/\bapartment\b/g, ' ');
  s = s.replace(/\bapts\b/g, ' ');
  s = s.replace(/\bapt\b/g, ' ');
  s = s.replace(/\bhouse\b/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function normaliseName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchDevelopment(
  hint: string,
  developments: Development[],
): MatchResult {
  const trimmed = (hint || '').trim();
  if (!trimmed) return { type: 'no_match' };
  const normHint = normaliseHint(trimmed);
  if (!normHint) return { type: 'no_match' };

  const matches: Development[] = [];
  for (const dev of developments) {
    if (!dev || !dev.name) continue;
    const normDev = normaliseName(dev.name);
    if (!normDev) continue;
    if (
      normHint === normDev ||
      normDev.includes(normHint) ||
      normHint.includes(normDev)
    ) {
      matches.push(dev);
    }
  }

  if (matches.length === 1) return { type: 'unique', development: matches[0] };
  if (matches.length > 1) return { type: 'ambiguous', candidates: matches };
  return { type: 'no_match' };
}
