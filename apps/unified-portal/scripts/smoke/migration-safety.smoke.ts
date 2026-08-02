import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = resolve(__dirname, '../..');
const migration = (name: string) => readFileSync(resolve(appRoot, 'migrations', name), 'utf8');

for (const name of [
  '071_fix_unit_38_longview_baruwa.sql',
  '072_fix_units_25_50_longview_bs02_specs.sql',
]) {
  const sql = migration(name);
  assert.doesNotMatch(sql, /CREATE\s+TABLE\s+\w*backup/i, `${name} must not create a public backup table`);
  assert.doesNotMatch(sql, /DROP\s+TABLE\s+IF\s+EXISTS\s+\w*backup/i, `${name} must not destroy a first snapshot on rerun`);
  assert.match(sql, /BEGIN;/i, `${name} must retain an explicit transaction`);
  assert.match(sql, /COMMIT;/i, `${name} must retain an explicit transaction`);
}

const cleanup = migration('073_secure_purchaser_backup_tables.sql');
for (const table of [
  'units_purchaser_backup_2026_06_04',
  'usp_purchaser_backup_2026_06_04',
  'unit_38_longview_backup_2026_07_22',
  'units_25_50_longview_backup_2026_07_22',
]) {
  assert.match(cleanup, new RegExp(table), `cleanup migration must cover ${table}`);
}
assert.match(cleanup, /SET\s+SCHEMA\s+demo_backups/i);
assert.match(cleanup, /REVOKE\s+ALL\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+demo_backups/i);
assert.match(cleanup, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);

const localRunner = readFileSync(resolve(appRoot, 'scripts/run-migrations-local.ts'), 'utf8');
assert.doesNotMatch(localRunner, /\.split\(\s*['"]\s*;\s*['"]\s*\)/, 'local runner must not split SQL transactions');
assert.match(localRunner, /body:\s*JSON\.stringify\(\{\s*sql\s*\}\)/s);
assert.match(localRunner, /throw new Error\(`Migration \$\{file\} failed/);

const rootRunner = readFileSync(resolve(appRoot, '../../scripts/run-migrations.ts'), 'utf8');
assert.doesNotMatch(rootRunner, /Record as applied regardless/i);
assert.match(rootRunner, /throw new Error\(`Migration \$\{file\} failed/);

console.log('migration safety smoke: PASS');
