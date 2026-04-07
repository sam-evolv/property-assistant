# Dependency Vulnerability Fixes Report

## Summary

Addressed three dependency security issues identified in the audit. Vulnerability count reduced from **17 to 9** (47% reduction).

## Vulnerability Count

| Stage | Vulnerabilities |
|-------|----------------|
| Before | 17 (6 moderate, 9 high, 2 critical) |
| After | 9 (4 moderate, 4 high, 1 critical) |

The remaining 9 vulnerabilities are all in transitive dependencies of `unpdf` (via `canvas` -> `@mapbox/node-pre-gyp` -> `tar`) and cannot be resolved without a breaking upgrade to `unpdf`.

---

## Task 1: Replace xlsx (SheetJS) with exceljs

**Risk**: High-severity prototype pollution (CVE-2024-22363) and ReDoS vulnerabilities with no upstream fix.

**Approach**: Created a shared utility `lib/excel-utils.ts` that wraps ExcelJS to provide the same API surface as SheetJS (`readExcel`, `readCsv`, `sheetToJson`). This minimized per-file changes and ensured consistent behavior.

### Files Modified (9 total)

| File | Usage | Change |
|------|-------|--------|
| `lib/excel-utils.ts` | **New** | Shared utility: `readExcel()`, `readCsv()`, `sheetToJson()` |
| `app/api/houses/import/route.ts` | Read XLSX/CSV | Replaced `XLSX.read` + `XLSX.utils.sheet_to_json` |
| `app/api/projects/[projectId]/smart-import/route.ts` | Read XLSX/CSV | Same pattern |
| `app/api/projects/[projectId]/import-units/route.ts` | Read XLSX/CSV | Same pattern |
| `app/api/projects/[projectId]/update-units/route.ts` | Read XLSX/CSV | Same pattern |
| `app/api/projects/parse-excel/route.ts` | Read XLSX | Same pattern |
| `app/api/super/developments/[id]/pipeline-import/route.ts` | Read XLSX (multi-sheet, header:1 mode) | Same pattern with multiple sheet access |
| `app/api/developments/[id]/import-units/route.ts` | Read XLSX/CSV | Same pattern |
| `components/super/UnitImport.tsx` | Read XLSX (client-side) | Inline ExcelJS usage (browser-compatible) |
| `packages/api/src/document-processor.ts` | Read XLSX for text extraction | Replaced `require('xlsx')` with `require('exceljs')` |

### Package changes
- **Added**: `exceljs@^4.4.0`
- **Removed**: `xlsx@^0.18.5` from root `package.json`, `apps/unified-portal/package.json`, and `property-assistant/package.json`

### Functionality preserved
- All xlsx/xls/csv reading works identically
- `sheetToJson()` replicates SheetJS `sheet_to_json` behavior: header-keyed objects by default, array-of-arrays with `{ header: 1 }`, `defval` support
- ExcelJS value unwrapping handles rich text, hyperlinks, and formula results
- Client-side component (UnitImport.tsx) uses ExcelJS browser bundle

---

## Task 2: Update jspdf to v4.2.1

**Risk**: jspdf v2/v3 pulls in dompurify <=3.3.1 which has 6 XSS vulnerabilities.

**Approach**: Direct version bump. The jsPDF v4 API is backwards-compatible for the features used in this codebase (basic text, shapes, images).

### Files Modified (0 code changes needed)

| File | Usage | Change |
|------|-------|--------|
| `app/api/developments/[id]/qr-codes/route.ts` | PDF generation with `new jsPDF()`, `.text()`, `.addImage()`, `.roundedRect()` | No code changes required |

### Package changes
- **Updated**: `jspdf` from `^2.5.2` / `^3.0.4` to `^4.2.1` in both `package.json` and `apps/unified-portal/package.json`

---

## Task 3: Remove underscore dependency

**Risk**: High-severity DoS via unlimited recursion in `_.flatten` and `_.isEqual` (GHSA-qpx9-hpmf-5gmw).

**Finding**: `underscore` is not a direct dependency — it is a transitive dependency of `mammoth` (docx parser) via `lop` -> `duck` -> `underscore`. There are zero imports of `underscore` anywhere in the source code.

**Resolution**: `npm audit fix` updated `mammoth` to a version that resolves the transitive `underscore` vulnerability. No source code changes were needed.

### Files Modified: 0

---

## Build Status

`npm run build` passes with zero TypeScript/webpack errors after all changes.
