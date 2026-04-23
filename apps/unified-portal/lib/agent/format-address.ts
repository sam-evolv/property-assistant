/**
 * Session 12 — canonical address renderer.
 *
 * Agent-facing surfaces (chips, drafts, applicant lists, viewing rows)
 * used to ad-hoc-concatenate address fields and, in at least one place,
 * silently drop the "Apt" prefix by comma-splitting the denormalised
 * `address` column. That produced chips like "Log a rental viewing for
 * 12 Grand Parade" when the real record was "Apt 12, Grand Parade,
 * Cork" — the data WAS real, the rendering was misleading.
 *
 * Rule for this helper: no field is dropped, no prefix is stripped. A
 * short render keeps only address_line_1 + address_line_2; a full
 * render adds city + eircode. If the caller only has the legacy single
 * `address` column, we return it verbatim — never try to parse or
 * trim it.
 */

export interface AddressParts {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  eircode?: string | null;
  /** Legacy single-column fallback. Used as-is when no structured
   *  line fields are populated. */
  address?: string | null;
}

export type AddressFormat = 'short' | 'full';

export function formatAgentAddress(parts: AddressParts, format: AddressFormat = 'short'): string {
  const line1 = cleanSegment(parts.address_line_1);
  const line2 = cleanSegment(parts.address_line_2);

  // Structured fields win when at least one line is present.
  if (line1 || line2) {
    const segments: string[] = [];
    if (line1) segments.push(line1);
    if (line2) segments.push(line2);
    if (format === 'full') {
      const city = cleanSegment(parts.city);
      const eircode = cleanSegment(parts.eircode);
      if (city) segments.push(city);
      if (eircode) segments.push(eircode);
    }
    return segments.join(', ');
  }

  // Fallback: the legacy single `address` column. Use verbatim —
  // splitting on commas is what caused the "Apt 12" prefix loss in the
  // first place.
  const legacy = cleanSegment(parts.address);
  if (legacy) {
    if (format === 'full') {
      const city = cleanSegment(parts.city);
      const eircode = cleanSegment(parts.eircode);
      if (city && !legacy.toLowerCase().includes(city.toLowerCase())) {
        const parts2: string[] = [legacy, city];
        if (eircode) parts2.push(eircode);
        return parts2.join(', ');
      }
      if (eircode && !legacy.toLowerCase().includes(eircode.toLowerCase())) {
        return `${legacy}, ${eircode}`;
      }
    }
    return legacy;
  }

  return '';
}

function cleanSegment(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Truncate an already-composed address so it fits on a single chip
 * without dropping segments silently. If the full string would overflow
 * the character cap, we append a trailing ellipsis and keep the
 * leading characters intact.
 */
export function truncateForChip(composed: string, maxChars = 42): string {
  if (composed.length <= maxChars) return composed;
  return `${composed.slice(0, maxChars - 1).trimEnd()}…`;
}
