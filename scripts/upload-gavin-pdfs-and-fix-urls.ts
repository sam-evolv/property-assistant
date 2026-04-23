import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

dotenv.config({ path: path.resolve(__dirname, '../apps/unified-portal/.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const BUCKET = 'development_docs';
const ARCHIVE_SUBDIR = path.join('Architectural-Drawings---MHL', 'Architectural');

const DEFAULT_ZIP_PATH = path.join(os.homedir(), 'Downloads', 'Longview-Ballyvolane_-_Drawings__2_.zip');
const ZIP_PATH = process.argv[2] || process.env.GAVIN_ZIP_PATH || DEFAULT_ZIP_PATH;

const FILENAME_TO_DOC_ID: Record<string, string> = {
  '281-MHL-BT01-ZZ-DR-A-0120-House-Type-BT01---Ground-Floor-Rev.C03.pdf':
    'eda825a5-becc-4c64-9c2b-76f5aeefd144',
  '281-MHL-BT01-ZZ-DR-A-0121-House-Type-BT01---First-Floor-Rev.C04.pdf':
    '88cf2913-e659-4087-a92c-3b8bfebc7e6a',
  '281-MHL-BT01-ZZ-DR-A-0122-House-Type-BT01---Back-and-Front-Elevations-Rev.C03.pdf':
    '970fea75-4d45-4a62-9bdc-f4d93e079c42',
  '281-MHL-BT01-ZZ-DR-A-0123-House-Type-BT01---Sections-1,-3-and-Elevations-1,-2-Rev.C02.pdf':
    '1eed2752-e938-4102-8047-192ee20cd95d',
  '281-MHL-BT01-ZZ-DR-A-0124-House-Type-BT01---Sections-2-and-4-Rev.C01.pdf':
    '15138873-26ea-4db0-9afe-5a725ea68b28',
  '281-MHL-BT01-ZZ-DR-A-0125-House-Type-BT01---Foundation-and-House-Pad-Rev.C01.pdf':
    'd780671f-cd14-4c5f-94a5-d695927546cf',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_');
}

function unzipTo(zipPath: string, destDir: string) {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Zip not found at ${zipPath}. Pass the path as argv[2] or set GAVIN_ZIP_PATH.`);
  }
  console.log(`Unzipping ${zipPath} → ${destDir}`);
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', destDir], { stdio: 'inherit' });
}

function resolvePdfPath(baseDir: string, fileName: string): string {
  const direct = path.join(baseDir, ARCHIVE_SUBDIR, fileName);
  if (fs.existsSync(direct)) return direct;

  let found: string | null = null;
  const walk = (dir: string) => {
    if (found) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === fileName) {
        found = full;
        return;
      }
    }
  };
  walk(baseDir);
  if (!found) throw new Error(`Could not find ${fileName} under ${baseDir}`);
  return found;
}

async function uploadOne(fileName: string, documentId: string, sourcePath: string) {
  console.log(`\n— ${fileName} (${documentId})`);

  const buffer = fs.readFileSync(sourcePath);
  const timestamp = Date.now();
  const storageKey = `${PROJECT_ID}/${timestamp}-${safeFilename(fileName)}`;

  console.log(`  upload → ${BUCKET}/${storageKey} (${buffer.length} bytes)`);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });
  if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storageKey);
  const publicUrl = pub.publicUrl;
  console.log(`  public URL: ${publicUrl}`);

  const { error: docErr } = await supabase
    .from('documents')
    .update({
      storage_path: storageKey,
      file_url: publicUrl,
      storage_url: publicUrl,
    })
    .eq('id', documentId);
  if (docErr) throw new Error(`documents update failed: ${docErr.message}`);
  console.log(`  documents row updated`);

  const { data: rows, error: selErr } = await supabase
    .from('document_sections')
    .select('id, metadata')
    .filter('metadata->>document_id', 'eq', documentId);
  if (selErr) throw new Error(`sections select failed: ${selErr.message}`);

  for (const row of rows ?? []) {
    const nextMeta = { ...(row.metadata as Record<string, unknown>), file_url: publicUrl };
    const { error: updErr } = await supabase
      .from('document_sections')
      .update({ metadata: nextMeta })
      .eq('id', row.id);
    if (updErr) throw new Error(`section ${row.id} update failed: ${updErr.message}`);
  }
  console.log(`  document_sections.metadata.file_url updated for ${rows?.length ?? 0} rows`);
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gavin-bt01-'));
  try {
    unzipTo(ZIP_PATH, tmpDir);

    const entries = Object.entries(FILENAME_TO_DOC_ID);
    let done = 0;
    for (const [fileName, documentId] of entries) {
      const pdfPath = resolvePdfPath(tmpDir, fileName);
      await uploadOne(fileName, documentId, pdfPath);
      done++;
    }
    console.log(`\nDone. Uploaded ${done}/${entries.length} PDFs.`);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
