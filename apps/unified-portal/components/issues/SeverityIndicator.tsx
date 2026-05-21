/**
 * Coloured 4px vertical bar shown on the left of each issue list row.
 * Severity colour mapping is fixed per spec section 6.4.
 */

import { IssueSeverity, severityBarClass } from './types';

interface SeverityIndicatorProps {
  severity: IssueSeverity | null;
}

export function SeverityIndicator({ severity }: SeverityIndicatorProps) {
  return (
    <span
      aria-hidden
      className={`block w-1 self-stretch flex-shrink-0 ${severityBarClass(severity)}`}
    />
  );
}
