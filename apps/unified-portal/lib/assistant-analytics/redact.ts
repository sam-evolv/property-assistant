/**
 * Best-effort PII redaction for the free-text columns of the anonymous
 * assistant analytics table.
 *
 * LIMITATIONS — read before relying on this:
 *   - This is a REGEX pass, not a guarantee. It catches common, well-formed
 *     emails, Irish phone numbers and Eircodes, plus the user's own name when
 *     that name is known. It will MISS: obfuscated contact details
 *     ("sam at evolv dot ie"), foreign phone formats, addresses, names of
 *     OTHER people, dates of birth, free-text descriptions that happen to
 *     identify someone, and anything the model echoes back in an unusual form.
 *   - It can also OVER-redact: the Eircode pattern (letter + 2 digits + 4
 *     alphanumerics) is loose and may clip unrelated tokens. That is the safe
 *     direction for a privacy pass.
 *   - It does not normalise unicode or homoglyphs.
 *
 * The analytics table is internal and the source text is already low-risk
 * (home/DIY questions), so this is a defence-in-depth measure on top of the
 * "store no identifiers" design, not the only safeguard. Do not treat redacted
 * text as fully anonymised for onward sharing without a human review.
 */

const REDACTED = '[redacted]';

// Standard email shape. Intentionally simple; covers the common case.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Irish international format: +353 then 8-10 digits, spaces/dashes allowed
// between digits (e.g. "+353 87 123 4567"). Run BEFORE the 08x pattern so the
// leading +353 is consumed first.
const PHONE_INTL_RE = /\+353[\s-]?(?:\d[\s-]?){8,10}/g;

// Irish mobile prefixes 083/085/086/087/089 then 7 digits, spaces/dashes
// allowed (e.g. "087 123 4567", "086-1234567").
const PHONE_MOBILE_RE = /\b0(?:83|85|86|87|89)[\s-]?(?:\d[\s-]?){7}\b/g;

// Eircode: one letter, two digits, optional space, four alphanumerics
// (e.g. "T12 ABCD", "D02X285"). Loose by design.
const EIRCODE_RE = /\b[A-Za-z]\d{2}\s?[A-Za-z0-9]{4}\b/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip likely PII from `text`. If `userName` is supplied, exact (whole-string,
 * case-insensitive) matches of it are also removed. Returns the text with each
 * match replaced by "[redacted]". Returns '' for nullish input.
 */
export function redactPII(text: string | null | undefined, userName?: string | null): string {
  if (!text) return '';

  let out = text
    .replace(EMAIL_RE, REDACTED)
    .replace(PHONE_INTL_RE, REDACTED)
    .replace(PHONE_MOBILE_RE, REDACTED)
    .replace(EIRCODE_RE, REDACTED);

  const name = userName?.trim();
  if (name) {
    // Escape regex metacharacters so a name like "O'Brien (Jr.)" can't break or
    // widen the pattern. Case-insensitive, global.
    out = out.replace(new RegExp(escapeRegExp(name), 'gi'), REDACTED);
  }

  return out;
}
