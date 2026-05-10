/**
 * Deterministic parser for free-form applicant lists pasted into the
 * Intelligence chat. No LLM calls — regex + light heuristics over Irish
 * formats and the common English shapes the agents actually paste.
 *
 * Supported shapes (one entry per line unless explicitly comma-separated):
 *   "Jack Murphy"
 *   "Jack Murphy, jack@example.ie, 0871234567"
 *   "Jack Murphy <jack@example.ie>"
 *   "Jack Murphy (087 123 4567)"
 *   "Jack Murphy | jack@example.ie | +353871234567"
 *   "Jack Murphy - jack@example.ie"
 *   table-like rows separated by tabs / two-or-more spaces
 *
 * Lines without a parseable name are dropped silently. A name is "parseable"
 * if it has at least two tokens and contains only letters / spaces / common
 * Irish-name punctuation (apostrophe, hyphen, dot, accents).
 */

export interface ParsedApplicant {
  full_name: string;
  email: string | null;
  phone: string | null;
}

const EMAIL_RE = /([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/i;

// Irish + international phone shapes:
//   +353 87 123 4567, 0871234567, 021 4901234, (021) 490 1234
const PHONE_RE = /(\+?353[\s\-]?\d[\d\s\-]{6,12}\d|\b0\d[\d\s\-]{6,12}\d\b|\(\s*\+?\d{2,4}\s*\)\s*[\d\s\-]{6,})/;

const NAME_TOKEN_RE = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-\.]*$/;

function cleanName(raw: string): string | null {
  const stripped = raw
    .replace(/[<>(){}\[\]"']{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return null;
  const tokens = stripped.split(' ').filter(Boolean);
  if (tokens.length < 2) return null;
  for (const t of tokens) {
    if (!NAME_TOKEN_RE.test(t)) return null;
  }
  return tokens.join(' ');
}

function normalisePhone(raw: string): string {
  const compact = raw.replace(/[\s\-()]/g, '');
  if (compact.startsWith('00')) return '+' + compact.slice(2);
  if (compact.startsWith('353')) return '+' + compact;
  if (compact.startsWith('+')) return compact;
  return compact;
}

function splitRow(line: string): string[] {
  // Try in priority order: pipe, tab, comma, two-or-more spaces, dash with spaces.
  if (line.includes('|')) return line.split('|').map((s) => s.trim()).filter(Boolean);
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim()).filter(Boolean);
  // Two-or-more spaces (table-like)
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (line.includes(',')) return line.split(',').map((s) => s.trim()).filter(Boolean);
  // " - " divider (must be surrounded by spaces to avoid hitting hyphenated names)
  if (/\s-\s/.test(line)) return line.split(/\s-\s/).map((s) => s.trim()).filter(Boolean);
  return [line.trim()];
}

function parseSingleLine(line: string): ParsedApplicant | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Strip "Name <email>" wrapper first so the email + name fall out cleanly.
  let nameSource = trimmed;
  let email: string | null = null;
  let phone: string | null = null;

  const angle = trimmed.match(/^([^<]+)<\s*([^>]+?)\s*>(.*)$/);
  if (angle) {
    nameSource = angle[1].trim();
    if (EMAIL_RE.test(angle[2])) email = angle[2].trim();
    const rest = angle[3].trim();
    const restPhone = rest.match(PHONE_RE);
    if (restPhone) phone = normalisePhone(restPhone[1]);
  }

  // "Name (phone)" wrapper.
  if (!phone) {
    const paren = nameSource.match(/^(.+?)\(\s*([^)]+?)\s*\)\s*$/);
    if (paren) {
      const candidate = paren[2];
      if (PHONE_RE.test(candidate)) {
        phone = normalisePhone(candidate.match(PHONE_RE)![1]);
        nameSource = paren[1].trim();
      }
    }
  }

  // Now split the line on common separators and pull the first segment as name.
  const segments = splitRow(nameSource);
  let name: string | null = null;
  for (const seg of segments) {
    const candidate = cleanName(seg);
    if (candidate) {
      name = candidate;
      break;
    }
  }
  if (!name) return null;

  // Sweep remaining segments for an email and a phone if not already captured.
  const rest = segments.filter((s) => cleanName(s) !== name);
  for (const seg of rest) {
    if (!email) {
      const m = seg.match(EMAIL_RE);
      if (m) email = m[1].trim();
    }
    if (!phone) {
      const m = seg.match(PHONE_RE);
      if (m) phone = normalisePhone(m[1]);
    }
  }

  // Last resort: scan the whole line for an email/phone if still missing.
  if (!email) {
    const m = trimmed.match(EMAIL_RE);
    if (m) email = m[1].trim();
  }
  if (!phone) {
    const m = trimmed.match(PHONE_RE);
    if (m) phone = normalisePhone(m[1]);
  }

  return { full_name: name, email, phone };
}

export function parseBulkApplicants(text: string): ParsedApplicant[] {
  if (!text || typeof text !== 'string') return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ParsedApplicant[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const parsed = parseSingleLine(line);
    if (!parsed) continue;
    const key = `${parsed.full_name.toLowerCase()}|${(parsed.email ?? '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }
  return out;
}
