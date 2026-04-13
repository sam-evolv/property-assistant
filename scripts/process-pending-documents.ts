/**
 * Process Pending Documents
 *
 * Calls POST /api/ingest/process-pending on the running app to find all
 * documents with processing_status = 'pending' and push them through the
 * document processor (text extraction → chunking → embeddings).
 *
 * Usage (from monorepo root):
 *   INGEST_SECRET=<secret> \
 *   NEXT_PUBLIC_APP_URL=https://portal.openhouseai.ie \
 *   npx ts-node scripts/process-pending-documents.ts [--limit N]
 *
 * Options:
 *   --limit N   Max documents per run (default 50, server cap 200)
 */

const INGEST_SECRET = process.env.INGEST_SECRET;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

if (!INGEST_SECRET) {
  console.error('ERROR: INGEST_SECRET environment variable is required');
  process.exit(1);
}

if (!APP_URL) {
  console.error('ERROR: NEXT_PUBLIC_APP_URL environment variable is required');
  process.exit(1);
}

interface DocumentResult {
  id: string;
  fileName: string;
  status: 'success' | 'error' | 'skipped';
  chunksCreated?: number;
  visionExtracted?: boolean;
  error?: string;
}

interface ApiResponse {
  message?: string;
  processed: number;
  failed: number;
  skipped: number;
  total: number;
  results: DocumentResult[];
}

function parseArgs(): { limit: number } {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit =
    limitIndex !== -1 && args[limitIndex + 1]
      ? parseInt(args[limitIndex + 1], 10)
      : 50;
  return { limit };
}

async function main(): Promise<void> {
  const { limit } = parseArgs();
  const endpoint = `${APP_URL}/api/ingest/process-pending`;

  console.log('\n' + '='.repeat(70));
  console.log('PROCESS PENDING DOCUMENTS');
  console.log('='.repeat(70));
  console.log(`Endpoint : ${endpoint}`);
  console.log(`Limit    : ${limit}`);
  console.log('');

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INGEST_SECRET}`,
      },
      body: JSON.stringify({ limit }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Network error reaching ${endpoint}: ${msg}`);
    process.exit(1);
  }

  if (response.status === 401) {
    console.error('ERROR: Unauthorized — check that INGEST_SECRET matches the server value');
    process.exit(1);
  }

  if (!response.ok) {
    const text = await response.text();
    console.error(`API error ${response.status}: ${text}`);
    process.exit(1);
  }

  const data: ApiResponse = await response.json();

  if (data.total === 0) {
    console.log('No pending documents found — nothing to do.');
    console.log('');
    process.exit(0);
  }

  console.log(`Found ${data.total} pending document(s)\n`);
  console.log('-'.repeat(70));

  for (const r of data.results) {
    const icon =
      r.status === 'success' ? '[OK]  ' : r.status === 'error' ? '[FAIL]' : '[SKIP]';

    let line = `${icon} ${r.fileName}`;
    if (r.status === 'success') {
      line += ` — ${r.chunksCreated ?? 0} chunk(s)`;
      if (r.visionExtracted) line += ' + vision';
    } else if (r.error) {
      line += ` — ${r.error}`;
    }
    console.log(line);
  }

  console.log('-'.repeat(70));
  console.log('');
  console.log('Summary:');
  console.log(`  Processed : ${data.processed}`);
  console.log(`  Failed    : ${data.failed}`);
  console.log(`  Skipped   : ${data.skipped}`);
  console.log(`  Total     : ${data.total}`);
  console.log('');

  if (data.failed > 0) {
    console.error(`${data.failed} document(s) failed — see above for details`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
