# Database Migration: Neon → Supabase

This document describes how to migrate data from the legacy Neon Postgres database to the production Supabase database.

## Overview

OpenHouse AI uses two database environments:
- **Legacy (Neon)**: `LEGACY_DATABASE_URL` - Original Replit-managed Postgres
- **Production (Supabase)**: `DATABASE_URL` - New Supabase-managed Postgres

The migration script copies all data from Neon to Supabase while preserving:
- All primary keys and UUIDs
- Foreign key relationships
- Timestamps and metadata

## Prerequisites

1. **Environment Variables** (already configured in Replit Secrets):
   - `LEGACY_DATABASE_URL` - Neon connection string
   - `DATABASE_URL` - Supabase connection string

2. **Schema Sync** (already done):
   ```bash
   cd packages/db && npx drizzle-kit push
   ```

## Running the Migration

### Step 1: Dry Run (Recommended First)

See what would be migrated without making changes:

```bash
npx tsx scripts/migrate-from-legacy.ts
```

Example output:
```
================================================================================
DATABASE MIGRATION: Neon → Supabase
================================================================================
📤 SOURCE (Neon):    ep-patient-sun-xxxxx.neon.tech
📥 TARGET (Supabase): db.xxxxx.supabase.co
================================================================================

Mode: CORE
Tables to migrate: 30

🔍 DRY RUN MODE (add --confirm to actually migrate)

Tables that would be migrated:

  tenants: 6 rows (Tenant organizations)
  admins: 3 rows (Admin users)
  developments: 2 rows (Property developments)
  ...
```

### Step 2: Run the Migration

When ready, execute with the `--confirm` flag:

```bash
npx tsx scripts/migrate-from-legacy.ts --confirm
```

### Step 3: Full Mode (Optional)

To include derived/analytics tables that can be recomputed:

```bash
npx tsx scripts/migrate-from-legacy.ts --confirm --mode=full
```

## Migration Modes

| Mode | Description | Tables Included |
|------|-------------|-----------------|
| `core` (default) | Essential domain data | tenants, developments, documents, doc_chunks, etc. |
| `full` | Everything including analytics | All core + audit_log, analytics_*, api_cache, rate_limits |

## Table Migration Order

Tables are migrated in dependency order:

1. **Foundation**: tenants, admins
2. **Property Structure**: developments, house_types, units
3. **Users**: homeowners, qr_tokens
4. **Content**: documents, document_versions
5. **AI/Embeddings**: doc_chunks, rag_chunks, embedding_cache
6. **Intelligence**: floorplan_vision, unit_intelligence_profiles, intel_extractions
7. **Communication**: messages, noticeboard_posts, notice_comments
8. **Support**: tickets, issue_types, feedback
9. **Configuration**: theme_config, feature_flags
10. **Analytics** (full mode only): analytics_events, analytics_daily, audit_log

## Post-Migration Verification

### 1. Check Row Counts

```bash
# In Supabase SQL Editor:
SELECT 'tenants' as table_name, COUNT(*) as count FROM tenants
UNION ALL SELECT 'developments', COUNT(*) FROM developments
UNION ALL SELECT 'documents', COUNT(*) FROM documents
UNION ALL SELECT 'doc_chunks', COUNT(*) FROM doc_chunks;
```

### 2. Test Document Pipeline

```bash
npx tsx scripts/reprocess-all-docs.ts --limit 3
```

### 3. Verify Application

1. Start the Unified Portal
2. Navigate to the super admin dashboard
3. Verify tenants and developments appear
4. Test the chat functionality with RAG

## Troubleshooting

### Connection Errors

If you see DNS resolution errors for Supabase:
- Ensure `DATABASE_URL` uses the Supabase pooler endpoint
- Format: `postgresql://postgres.PROJECT:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

### Foreign Key Violations

The migration runs in dependency order. If you see FK errors:
1. Ensure the parent table was migrated first
2. Re-run the migration (it's idempotent)

### Duplicate Key Errors

The script uses `ON CONFLICT DO UPDATE`, so re-running is safe. Existing rows will be updated, not duplicated.

## Rollback

The migration does NOT delete data from the source database. To rollback:

1. Update `DATABASE_URL` to point back to Neon
2. Or reverse the migration by swapping source/target in a modified script

## Security Notes

- The migration script requires direct database access
- Never expose connection strings in logs or commits
- After verifying Supabase is working, keep `LEGACY_DATABASE_URL` for emergency rollback

## Related Files

- Migration script: `scripts/migrate-from-legacy.ts`
- Database client: `packages/db/client.ts`
- Schema definition: `packages/db/schema.ts`
- Drizzle config: `packages/db/drizzle.config.ts`
