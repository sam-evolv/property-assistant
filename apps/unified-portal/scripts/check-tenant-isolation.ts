#!/usr/bin/env tsx
/**
 * Static tenant-isolation checker.
 *
 * Context: developer-portal API routes use a service-role Supabase client
 * (getSupabaseAdmin / SUPABASE_SERVICE_ROLE_KEY / supabaseAdmin) which bypasses
 * Postgres RLS. Tenant isolation therefore depends on each handler scoping its
 * own queries. A single unscoped query against a tenant-owned table is a
 * cross-tenant data leak.
 *
 * What this script does (deliberately a HEURISTIC, not a type-checker):
 *   1. Find every route file under app/ (app/api/, app/developer/api/, etc.).
 *   2. In each file, find `.from('<tenant table>')` calls against the
 *      tenant-scoped table list below, recording file:line.
 *   3. If a file contains at least one such call but NO recognizable scoping
 *      token anywhere in the file, flag the file.
 *   4. Compare the flagged set to scripts/tenant-isolation-allowlist.json.
 *      Exit 1 if any flagged file is NOT on the allowlist (i.e. a NEW finding).
 *
 * Recognized scoping tokens (any one present => not flagged):
 *   - `tenant_id`                          (.eq('tenant_id', ...) or insert payload)
 *   - `developer_user_id`                  (ownership: dev owns the development)
 *   - assertCanAccessDevelopment / assertCanAccessTenant   (snag-auth resource checks)
 *   - enforceDevelopmentScope / enforceTenantScope / enforceUnitDevelopmentScope
 *   - validatePurchaserToken / validatePurchaserAccess / validateQRToken   (homeowner token = scope)
 *   - getOwnedUnit                          (unit ownership chain)
 *   - authorizeDraftMutation / resolveSessionWorkspace / workspace_id   (agent workspace scope)
 *   - hasDevelopmentAccess                  (public API key dev-access check)
 *   - isInternalCaller / INTERNAL_ENRICHMENT_KEY   (internal-only service routes)
 *   - requireRole(['super_admin'])  (EXACT, no other roles — platform admin, cross-tenant by design)
 *   - the verified-ownership marker comment `// tenant-scope:`  (manual escape hatch)
 *
 * KNOWN LIMITATIONS (why the manual audit, not this script, is authoritative):
 *   - Presence of the literal `tenant_id` does NOT prove the value is the
 *     SESSION's tenant. Routes that put a CLIENT-SUPPLIED tenant_id into an
 *     insert (e.g. the unauthenticated super create routes) pass this check
 *     yet are holes. Likewise routes that fetch session.tenantId and then never
 *     use it pass.
 *   - The check is per-file, not per-handler: a file with one scoped query and
 *     one unscoped query passes.
 *   Treat a PASS as "no blatant unscoped file", not "proven safe".
 *
 * Escape hatch: add `// tenant-scope: <reason>` on/near a verified-safe query
 * to mark intent, or add the file to the allowlist with a classification.
 *
 * Usage:
 *   tsx scripts/check-tenant-isolation.ts            # report + exit code
 *   tsx scripts/check-tenant-isolation.ts --json     # machine-readable
 *   tsx scripts/check-tenant-isolation.ts --update-allowlist   # rewrite allowlist to current flagged set (review the diff!)
 */

import { promises as fs } from 'fs';
import * as path from 'path';

const APP_ROOT = path.resolve(__dirname, '..');
const ALLOWLIST_PATH = path.join(__dirname, 'tenant-isolation-allowlist.json');

// Tenant-scoped tables: any read/write must be scoped to the caller's tenant.
// (document_sections is scoped by project_id derived from a tenant-verified development.)
const TENANT_TABLES = [
  'units', 'unit_sales_pipeline', 'unit_pipeline_notes', 'issue_reports',
  'issue_report_media', 'issue_events', 'documents', 'compliance_documents',
  'compliance_document_types', 'handover_events', 'unit_systems', 'homeowners',
  'developments', 'admins', 'site_team_members', 'snagger_invitations',
  'assistant_media', 'assistant_conversation_turns', 'communication_events',
  'entity_timeline', 'pending_drafts', 'storage_connections', 'watched_folders',
  'storage_files', 'qr_tokens', 'purchaser_agreements', 'document_sections',
];

// `.from('<table>')` / `.from("<table>")` with optional whitespace.
const FROM_RE = new RegExp(
  `\\.from\\(\\s*['"](${TENANT_TABLES.join('|')})['"]\\s*\\)`,
  'g',
);

// Recognized scoping tokens. Order doesn't matter; any match clears the file.
const SCOPING_TOKENS: RegExp[] = [
  /\btenant_id\b/,
  /\bdeveloper_user_id\b/,
  /assertCanAccessDevelopment/,
  /assertCanAccessTenant/,
  /enforceDevelopmentScope/,
  /enforceTenantScope/,
  /enforceUnitDevelopmentScope/,
  /validatePurchaserToken/,
  /validatePurchaserAccess/,
  /validateQRToken/,
  /getOwnedUnit/,
  /authorizeDraftMutation/,
  /resolveSessionWorkspace/,
  /\bworkspace_id\b/,
  /hasDevelopmentAccess/,
  /isInternalCaller/,
  /INTERNAL_ENRICHMENT_KEY/,
  /\/\/\s*tenant-scope:/,
  // requireRole(['super_admin']) with NO other role — platform admin by design.
  /requireRole\(\s*\[\s*['"]super_admin['"]\s*\]\s*\)/,
];

interface FromHit { table: string; line: number; }
interface Finding { file: string; hits: FromHit[]; }

async function walk(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      await walk(full, out);
    } else if (e.isFile() && (e.name === 'route.ts' || e.name === 'route.tsx')) {
      out.push(full);
    }
  }
}

function findFromHits(source: string): FromHit[] {
  const hits: FromHit[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const re = new RegExp(FROM_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(lines[i])) !== null) {
      hits.push({ table: m[1], line: i + 1 });
    }
  }
  return hits;
}

function hasScopingToken(source: string): boolean {
  return SCOPING_TOKENS.some((re) => re.test(source));
}

async function loadAllowlist(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(ALLOWLIST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const list: Array<{ file: string }> = parsed.allow || [];
    return new Set(list.map((x) => x.file));
  } catch {
    return new Set();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const updateAllowlist = args.includes('--update-allowlist');

  const routeFiles: string[] = [];
  await walk(path.join(APP_ROOT, 'app'), routeFiles);
  routeFiles.sort();

  const findings: Finding[] = [];
  for (const file of routeFiles) {
    const source = await fs.readFile(file, 'utf8');
    const hits = findFromHits(source);
    if (hits.length === 0) continue;
    if (hasScopingToken(source)) continue;
    const rel = path.relative(APP_ROOT, file);
    findings.push({ file: rel, hits });
  }

  const flaggedSet = new Set(findings.map((f) => f.file));

  if (updateAllowlist) {
    const allow = findings.map((f) => ({
      file: f.file,
      classification: 'UNREVIEWED',
      reason: 'Auto-added by --update-allowlist; review and classify.',
    }));
    const out = {
      _README: 'See check-tenant-isolation.ts. Regenerated via --update-allowlist; review every entry.',
      allow,
    };
    await fs.writeFile(ALLOWLIST_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${allow.length} entries to ${path.relative(APP_ROOT, ALLOWLIST_PATH)}`);
    return;
  }

  const allowlist = await loadAllowlist();
  const newFindings = findings.filter((f) => !allowlist.has(f.file));
  const stale = [...allowlist].filter((f) => !flaggedSet.has(f)).sort();

  if (asJson) {
    console.log(JSON.stringify(
      {
        scanned: routeFiles.length,
        flagged: findings.length,
        allowlisted: findings.length - newFindings.length,
        newFindings,
        staleAllowlistEntries: stale,
      },
      null, 2,
    ));
  } else {
    console.log(`Tenant-isolation check: scanned ${routeFiles.length} route files.`);
    console.log(`Flagged (tenant-table query, no recognizable scoping token): ${findings.length}`);
    console.log(`  on allowlist: ${findings.length - newFindings.length}   new: ${newFindings.length}\n`);

    for (const f of findings) {
      const tag = allowlist.has(f.file) ? 'ALLOWLISTED' : 'NEW';
      console.log(`[${tag}] ${f.file}`);
      for (const h of f.hits) {
        console.log(`    ${f.file}:${h.line}  .from('${h.table}')`);
      }
    }

    if (stale.length > 0) {
      console.log(`\nStale allowlist entries (no longer flagged — consider removing):`);
      for (const s of stale) console.log(`    ${s}`);
    }

    if (newFindings.length > 0) {
      console.log(`\nFAIL: ${newFindings.length} new file(s) query a tenant-scoped table with no recognizable`);
      console.log(`scoping token and are not on the allowlist. Either scope the query (filter by the`);
      console.log(`session tenant / verify ownership), add a '// tenant-scope: <reason>' marker if it is`);
      console.log(`genuinely safe, or (last resort) add it to scripts/tenant-isolation-allowlist.json.`);
    } else {
      console.log(`\nPASS: no new findings beyond the committed allowlist.`);
    }
  }

  process.exit(newFindings.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('check-tenant-isolation failed:', err);
  process.exit(2);
});
