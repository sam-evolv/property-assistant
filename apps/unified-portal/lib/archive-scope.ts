export type ArchiveQuery =
  | { mode: 'ALL_SCHEMES' }
  | { mode: 'SCHEME'; schemeId: string };

export type ArchiveScope = ArchiveQuery;

export function isAllSchemes(scope: ArchiveScope): scope is { mode: 'ALL_SCHEMES' } {
  return scope.mode === 'ALL_SCHEMES';
}

export function isScheme(scope: ArchiveScope): scope is { mode: 'SCHEME'; schemeId: string } {
  return scope.mode === 'SCHEME';
}

export function getSchemeId(scope: ArchiveScope): string | null {
  return scope.mode === 'SCHEME' ? scope.schemeId : null;
}

export function createAllSchemesScope(): ArchiveScope {
  return { mode: 'ALL_SCHEMES' };
}

export function createSchemeScope(schemeId: string): ArchiveScope {
  return { mode: 'SCHEME', schemeId };
}

export function scopeToString(scope: ArchiveScope): string {
  return scope.mode === 'ALL_SCHEMES' ? 'ALL_SCHEMES' : `SCHEME:${scope.schemeId}`;
}

export function stringToScope(value: string | null): ArchiveScope {
  if (!value || value === 'ALL_SCHEMES') {
    return { mode: 'ALL_SCHEMES' };
  }
  if (value.startsWith('SCHEME:')) {
    return { mode: 'SCHEME', schemeId: value.slice(7) };
  }
  return { mode: 'SCHEME', schemeId: value };
}

export function scopeEquals(a: ArchiveScope, b: ArchiveScope): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === 'ALL_SCHEMES') return true;
  return a.schemeId === (b as { mode: 'SCHEME'; schemeId: string }).schemeId;
}

export function scopeToQueryPayload(scope: ArchiveScope): ArchiveQuery {
  return scope;
}
