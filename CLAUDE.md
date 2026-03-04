# OpenHouse — Claude Code Context

## What This Is
OpenHouse is a SaaS platform for Irish property developers. Two products:
1. **Developer Portal** (`apps/unified-portal`) — sales pipeline, SmartArchive, Data Hub, AI assistant
2. **OpenHouse Care** (`apps/unified-portal/app/care-*`) — aftercare portal for solar/heat pump installers

## Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (Postgres + RLS + Auth)
- Deployed on Vercel at `https://portal.openhouseai.ie`
- Monorepo root: `openhouse/`
- Main app: `openhouse/apps/unified-portal/`

## Key Directories
```
apps/unified-portal/
  app/developer/          # Developer-facing pages
  app/api/                # API routes
  app/care-*/             # Care vertical (installer/homeowner)
  components/             # Shared UI components
  lib/                    # Business logic
    integrations/         # Spreadsheet + CRM sync engine
    data-hub/             # Cloud storage (Google Drive / OneDrive)
    care/                 # Care vertical logic
  migrations/             # Supabase SQL migrations (run manually in Supabase SQL Editor)
```

## Database
- Supabase project — env vars in Vercel
- Run migrations manually in Supabase SQL Editor
- RLS uses `(auth.jwt()->>'tenant_id')::uuid` for tenant isolation
- Key tables: `tenants`, `developments`, `units`, `messages`, `documents`, `storage_connections`, `watched_folders`, `storage_files`

## Auth Pattern
```typescript
const session = await requireRole(['developer', 'admin', 'super_admin']);
// session.tenantId, session.id, session.role
```

## Rules
- Never store file content — metadata + URLs only (especially in Data Hub)
- Always encrypt credentials with `lib/integrations/security/token-encryption.ts`
- RLS on every new table
- Run `npm run build` and fix all TypeScript errors before committing
- Commit after every completed task: `git add -A && git commit -m "feat/fix: ..."`
- Push: `git push origin main`

## Current Priorities
1. Google Drive / OneDrive integration (Data Hub) — OAuth set up, tables live
2. SE Systems demo (OpenHouse Care) — meeting in ~2 weeks
3. Keep build passing on Vercel

## After Every Task
```bash
npm run build          # must pass
git add -A
git commit -m "..."
git push origin main
openclaw system event --text "Done: [summary]" --mode now
```
