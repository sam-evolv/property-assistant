# Agent Task: Developer Onboarding — Database & Setup

Make the project bulletproof for a new developer joining tomorrow. Fix docs, create a unified migration runner, clean up security issues, and write a proper setup guide.

Work from the repo root (`/home/sam/.openclaw/workspace-forge/openhouse/`) unless otherwise specified.

---

## CHANGE 1: Remove hardcoded credentials from DEPLOY_TO_SUPABASE.md

File: `DEPLOY_TO_SUPABASE.md`

There's a hardcoded production connection string with a real password in this file:
```
postgresql://postgres:Munsterman99$evolv@db.qgkyuaagcrrynnkipbad.supabase.co:5432/postgres
```

Replace it with a placeholder:
```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

Remove any other hardcoded credentials or project refs (like `qgkyuaagcrrynnkipbad`) throughout this file — replace with `[YOUR-PROJECT-REF]`.

---

## CHANGE 2: Create a unified migration runner script

Create `scripts/run-migrations.ts`:

```ts
#!/usr/bin/env tsx
/**
 * OpenHouse AI — Unified Migration Runner
 *
 * Applies all SQL migrations from apps/unified-portal/migrations/
 * in numeric order to a Supabase/PostgreSQL database.
 *
 * Usage:
 *   npx tsx scripts/run-migrations.ts
 *
 * Required env vars:
 *   SUPABASE_DB_URL or DATABASE_URL
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../apps/unified-portal/migrations');

async function runMigrations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('   Set these in your .env.local file');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Create migrations tracking table
  const { error: createErr } = await supabase.rpc('exec_sql', {
    sql: `CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );`
  }).catch(() => ({ error: null }));

  // Get list of migration files in order
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  console.log(`\n📦 Found ${files.length} migration files\n`);

  // Check which are already applied
  const { data: applied } = await supabase
    .from('_migrations')
    .select('filename');
  const appliedSet = new Set((applied || []).map((r: any) => r.filename));

  let ran = 0;
  let skipped = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏭️  ${file} (already applied)`);
      skipped++;
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`  ⚡ Applying ${file}...`);

    // Execute migration via Supabase SQL editor API
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!res.ok) {
      const err = await res.text();
      // Many migrations use IF NOT EXISTS — log warning but don't fail
      console.warn(`  ⚠️  ${file}: ${err.substring(0, 120)}`);
    }

    // Record as applied regardless (IF NOT EXISTS means re-running is safe)
    await supabase.from('_migrations').upsert({ filename: file });
    ran++;
    console.log(`  ✅ ${file}`);
  }

  console.log(`\n✨ Done — ${ran} applied, ${skipped} skipped\n`);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

Add this script to the root `package.json` scripts section:
```json
"db:migrate:care": "tsx scripts/run-migrations.ts"
```

---

## CHANGE 3: Write a comprehensive SETUP.md

Create `SETUP.md` at the repo root. This replaces the outdated README as the definitive onboarding doc:

```markdown
# OpenHouse AI — Developer Setup Guide

Get up and running in under 10 minutes.

## What This Is

OpenHouse AI is a multi-tenant SaaS platform with two main products:

- **Property Assistant** — AI chat assistant for property developers and purchasers
- **OpenHouse Care** — Homeowner aftercare portal for renewable energy installers (solar, heat pumps, EV chargers)

Both products live in `apps/unified-portal` (Next.js 14, TypeScript, Supabase).

---

## Prerequisites

- Node.js 18+
- A Supabase project ([create one free](https://supabase.com))
- An OpenAI API key ([get one here](https://platform.openai.com))

---

## 1. Clone & Install

```bash
git clone https://github.com/sam-evolv/property-assistant.git
cd property-assistant
npm install
```

---

## 2. Configure Environment

```bash
cp apps/unified-portal/.env.example apps/unified-portal/.env.local
```

Open `apps/unified-portal/.env.local` and fill in:

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |

Everything else (B2, Slack, etc.) is optional and only needed for production backup/monitoring.

---

## 3. Set Up the Database

Run all migrations against your Supabase project:

```bash
cd apps/unified-portal
npm run db:migrate
```

This applies all SQL files from `apps/unified-portal/migrations/` in order. Each file is idempotent (uses `IF NOT EXISTS`) so it's safe to re-run.

**Migration order:**
| File | What it does |
|------|-------------|
| `001_multi_tenant_hardening.sql` | Core multi-tenant schema, RLS |
| `002_audit_events.sql` | Audit logging |
| `003_messages_unit_required.sql` | Message schema updates |
| `004_developments_rls_and_tenant.sql` | Development-level RLS |
| `005_home_notes_saved_answers.sql` | Home notes and saved answers |
| `006_care_tables.sql` | **Care vertical** — installations, conversations, messages |
| `007_telemetry_tables.sql` | **Care vertical** — telemetry, alerts, SolarEdge integration |
| `027_developer_app_tables.sql` | Developer app intelligence + snag tracking |

> **Note on gap 007→027:** Files 008–026 were applied directly to production during development. All their changes are included in the existing tables — 001–007 + 027 is the complete schema.

---

## 4. Seed Demo Data (Optional)

For local development, seed realistic demo data:

```bash
# Seed Care installations (Cork solar + heat pump installs)
npx tsx scripts/seed-care-installations.ts

# Seed Property Assistant development data
npx tsx scripts/seed-demo-openhouse-park.ts
```

---

## 5. Start Development Server

```bash
npm run dev
# App runs at http://localhost:5000
```

---

## Key Routes

### Property Assistant
| Route | What it is |
|-------|-----------|
| `/` | Landing / login |
| `/developer` | Developer dashboard |
| `/purchaser` | Purchaser portal |
| `/admin` | Admin dashboard |

### OpenHouse Care
| Route | What it is |
|-------|-----------|
| `/care` | Homeowner access code entry |
| `/care/[installationId]` | Homeowner care portal (mobile PWA) |
| `/care-dashboard` | Installer dashboard |
| `/care-dashboard/installations` | All installations list |
| `/care-dashboard/installations/new` | Create new installation (generates homeowner access code) |

---

## Architecture Overview

```
apps/unified-portal/          # Main Next.js app
  app/                        # Next.js App Router pages
    care/                     # Homeowner portal (mobile-first PWA)
    care-dashboard/           # Installer/admin dashboard
    developer/                # Property developer portal
    purchaser/                # Property purchaser portal
    admin/                    # Internal admin
    api/                      # API routes
      care/                   # Care API (chat, installations, telemetry)
  lib/
    care/                     # Care domain logic
      solarEdgeApi.ts         # SolarEdge integration + realistic mock
      solarTroubleshooting.ts # Solar fault knowledge base
      heatPumpTroubleshooting.ts
      care-knowledge.ts       # General homeowner knowledge base
  migrations/                 # SQL migrations (apply in order)
  
packages/
  db/                         # Drizzle ORM schema (Property Assistant)
  api/                        # Shared API utilities
  auth/                       # Shared auth helpers
```

---

## Telemetry & SolarEdge

The Care portal supports live solar data via the SolarEdge Monitoring API.

To enable for an installation:
1. Go to Care Dashboard → Installations → New Installation
2. Fill in the "Telemetry Integration" section with the SolarEdge Site ID and API Key
3. The homeowner portal will automatically show live generation data

Without credentials, the system uses a realistic seasonal mock (Irish climate, correct seasonal variation) — this is the default for all demo/dev installs.

---

## Deployment

The app deploys automatically to Vercel on push to `main`.

Required Vercel environment variables (same as `.env.local` above):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

---

## Common Issues

**"Installation not found" on care portal**
→ Run the migrations and seed data. The `installations` table needs to exist.

**Chat returns errors**
→ Check `OPENAI_API_KEY` is set correctly.

**Build fails with TypeScript errors about `bcryptjs`**
→ Known pre-existing issue, doesn't affect runtime. Run `npm install @types/bcryptjs` to resolve.

---

## Getting Help

- Check existing issues on GitHub
- The codebase uses consistent patterns throughout — if you see how one thing works, others follow the same approach
```

---

## CHANGE 4: Add a db:migrate script to apps/unified-portal/package.json

File: `apps/unified-portal/package.json`

Add this to the scripts section:
```json
"db:migrate": "npx tsx scripts/run-migrations-local.ts"
```

Then create `apps/unified-portal/scripts/run-migrations-local.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Apply all migrations in apps/unified-portal/migrations/ to Supabase.
 * Uses the Supabase client with service role key.
 *
 * Usage: npm run db:migrate
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
config({ path: resolve(__dirname, '../.env.local') });

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('\n❌ Missing environment variables.');
    console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local\n');
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  console.log(`\n🗄️  OpenHouse AI — Database Migration`);
  console.log(`📦 ${files.length} migration files found\n`);

  let applied = 0;
  let failed = 0;

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    process.stdout.write(`  ⚡ ${file} ... `);

    // Split by semicolons and execute statements individually
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let fileOk = true;
    for (const statement of statements) {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ sql: statement + ';' }),
      });

      if (!res.ok) {
        const err = await res.text();
        // IF NOT EXISTS errors are fine
        if (!err.includes('already exists') && !err.includes('does not exist')) {
          console.log(`⚠️`);
          console.log(`     ${err.substring(0, 200)}`);
          fileOk = false;
          failed++;
          break;
        }
      }
    }

    if (fileOk) {
      console.log(`✅`);
      applied++;
    }
  }

  console.log(`\n${failed === 0 ? '✨' : '⚠️ '} Done — ${applied} applied${failed > 0 ? `, ${failed} had warnings` : ''}`);
  console.log(`\nYour database is ready. Start the dev server with: npm run dev\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

---

## CHANGE 5: Update the root README.md

Replace the entire contents of `README.md` with a short, accurate overview that points to SETUP.md:

```markdown
# OpenHouse AI

AI-powered property management and homeowner aftercare platform.

**→ [Developer Setup Guide](./SETUP.md)**

## Products

- **Property Assistant** — AI chat for property developers and purchasers
- **OpenHouse Care** — Homeowner aftercare portal for renewable energy installers

## Quick Start

```bash
git clone https://github.com/sam-evolv/property-assistant.git
cd property-assistant
npm install
cp apps/unified-portal/.env.example apps/unified-portal/.env.local
# Fill in your Supabase and OpenAI keys in .env.local
npm run dev
```

See [SETUP.md](./SETUP.md) for the full guide including database setup, migrations, and deployment.

## Tech Stack

- **Framework**: Next.js 14 (App Router), TypeScript
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
```

---

## After all changes:

1. Check the SETUP.md renders correctly (no broken markdown).
2. `git add -A && git commit -m 'docs: developer onboarding - SETUP.md, unified migration runner, clean README, remove hardcoded creds'`
3. `openclaw system event --text "Done: Developer onboarding docs complete" --mode now`
