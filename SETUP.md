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
