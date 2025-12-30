export type ArchiveScope =
  | { type: 'ALL_SCHEMES' }
  | { type: 'SCHEME'; schemeId: string };

export function isAllSchemes(scope: ArchiveScope): scope is { type: 'ALL_SCHEMES' } {
  return scope.type === 'ALL_SCHEMES';
}

export function isScheme(scope: ArchiveScope): scope is { type: 'SCHEME'; schemeId: string } {
  return scope.type === 'SCHEME';
}

export function getSchemeId(scope: ArchiveScope): string | null {
  return scope.type === 'SCHEME' ? scope.schemeId : null;
}

export function createAllSchemesScope(): ArchiveScope {
  return { type: 'ALL_SCHEMES' };
}

export function createSchemeScope(schemeId: string): ArchiveScope {
  return { type: 'SCHEME', schemeId };
}

export function scopeToString(scope: ArchiveScope): string {
  return scope.type === 'ALL_SCHEMES' ? 'ALL_SCHEMES' : scope.schemeId;
}

export function stringToScope(value: string | null): ArchiveScope {
  if (!value || value === 'ALL_SCHEMES') {
    return { type: 'ALL_SCHEMES' };
  }
  return { type: 'SCHEME', schemeId: value };
}

export function scopeEquals(a: ArchiveScope, b: ArchiveScope): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'ALL_SCHEMES') return true;
  return a.schemeId === (b as { type: 'SCHEME'; schemeId: string }).schemeId;
}
