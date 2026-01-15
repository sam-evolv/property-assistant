# Multi-Tenant Operations Runbook

> Last Updated: 2026-01-15  
> Status: Enterprise Security Complete (v3)

## Overview

This runbook documents how to safely create, manage, and recover multi-tenant data in the OpenHouse AI Unified Portal. It covers the hardening measures implemented to prevent cross-tenant data contamination.

---

## Backup Schedule

| Type | Schedule | Retention | Location |
|------|----------|-----------|----------|
| Daily | 2 AM UTC | 30 days | Backblaze B2 |
| Weekly | Sunday 2 AM UTC | 12 weeks | Backblaze B2 |
| Monthly | 1st of month | 12 months | Backblaze B2 |

### Backup Commands

```bash
# Manual backup
npx tsx scripts/backup/backup-nightly.ts

# Dry run (no upload)
npx tsx scripts/backup/backup-nightly.ts --dry-run

# View backup manifests
ls -la backups/encrypted/*.manifest.json
```

### Restore Drill

```bash
# Dry run restore
npx tsx scripts/backup/restore-drill.ts --dry-run

# Full restore to staging
STAGING_DATABASE_URL="..." npx tsx scripts/backup/restore-drill.ts
```

---

## Key Rotation

### Backup Encryption Key

1. Generate new key: `openssl rand -hex 32`
2. Update `BACKUP_ENCRYPTION_KEY` in environment secrets
3. Old backups remain readable with old key
4. Document rotation in audit log

### Supabase Service Role Key

1. Regenerate in Supabase Dashboard > Project Settings > API
2. Update `SUPABASE_SERVICE_ROLE_KEY` in all environments
3. Restart all services
4. Verify TenantScopedClient still works

---

## Prerequisites

**IMPORTANT**: Before using any hardening scripts, you must apply SQL migrations:

```sql
-- Run in Supabase SQL Editor:
-- Copy contents of: apps/unified-portal/migrations/001_multi_tenant_hardening.sql
```

This migration creates:
- Tenant isolation trigger (STRICT mode - rejects invalid unit_id)
- RLS policies with proper tenant scoping
- Transactional development creation function
- recovery_map and demo_seed_log tables

## Quick Reference

| Task | Command |
|------|---------|
| Create new development | `ALLOW_DEMO_SEED=true npx tsx scripts/hardening/create-development-safe.ts seed.json` |
| Analyze orphaned messages | `npx tsx scripts/hardening/recover-orphaned-messages.ts --dry-run` |
| Apply message recovery | `npx tsx scripts/hardening/recover-orphaned-messages.ts --apply` |
| Run isolation tests | `npx tsx scripts/hardening/test-tenant-isolation.ts` |
| Check orphaned data | `SELECT * FROM orphaned_data_summary;` |

---

## 1. Creating a New Development Safely

### Prerequisites

1. Prepare a seed configuration file (JSON)
2. Ensure `ALLOW_DEMO_SEED=true` for demo/test developments
3. Have Supabase service role credentials

### Seed File Format

```json
{
  "seed_identifier": "unique-seed-id-001",
  "is_demo": false,
  "tenant": {
    "name": "ABC Developments",
    "slug": "abc-developments",
    "logo_url": "https://..."
  },
  "development": {
    "code": "ABC-PARK",
    "name": "ABC Park",
    "slug": "abc-park",
    "address": "123 Main Street, City",
    "latitude": 51.8985,
    "longitude": -8.4756
  },
  "house_types": [
    {
      "code": "A01",
      "name": "Type A - 3 Bed Semi",
      "bedrooms": 3,
      "bathrooms": 2,
      "floor_area_sqm": 110
    }
  ],
  "units": [
    {
      "unit_number": "1",
      "house_type_code": "A01",
      "address_line_1": "1 ABC Park, City",
      "purchaser_name": "John Smith"
    }
  ]
}
```

### Steps

1. **Create seed file**:
   ```bash
   cat > seed-abc-park.json << 'EOF'
   {
     "seed_identifier": "abc-park-production-001",
     "is_demo": false,
     ...
   }
   EOF
   ```

2. **Run creation script**:
   ```bash
   # For demo/test developments:
   ALLOW_DEMO_SEED=true npx tsx scripts/hardening/create-development-safe.ts seed-abc-park.json
   
   # For production developments (is_demo: false):
   npx tsx scripts/hardening/create-development-safe.ts seed-abc-park.json
   ```

3. **Verify creation**:
   - Check `demo_seed_log` table for status
   - Query new development in Supabase
   - Test unit codes work in portal

### Rollback

If creation fails mid-way:

1. Check `demo_seed_log` for error details:
   ```sql
   SELECT * FROM demo_seed_log 
   WHERE seed_identifier = 'abc-park-production-001';
   ```

2. The script is idempotent - simply fix the issue and re-run.

3. If manual cleanup needed:
   ```sql
   -- Be very careful! Only delete if you're sure
   DELETE FROM units WHERE project_id = '<development_id>';
   DELETE FROM house_types WHERE development_id = '<development_id>';
   DELETE FROM developments WHERE id = '<development_id>';
   -- Only delete tenant if no other developments use it
   ```

---

## 2. Recovering Orphaned Messages

### When to Use

- After a failed seed operation
- When chat messages have `unit_id IS NULL`
- During data quality audits

### Steps

1. **Analyze orphaned messages** (read-only):
   ```bash
   npx tsx scripts/hardening/recover-orphaned-messages.ts --dry-run
   ```

2. **Review proposed fixes**:
   ```sql
   SELECT entity_id, match_method, match_confidence, proposed_fix
   FROM recovery_map
   WHERE status = 'pending'
   ORDER BY match_confidence DESC;
   ```

3. **Apply fixes**:
   ```bash
   npx tsx scripts/hardening/recover-orphaned-messages.ts --apply
   ```

4. **Verify results**:
   ```sql
   SELECT * FROM orphaned_data_summary;
   
   -- Check recovery results
   SELECT status, COUNT(*) 
   FROM recovery_map 
   GROUP BY status;
   ```

### Recovery Methods

The script attempts recovery in this order:

| Priority | Method | Confidence |
|----------|--------|------------|
| 1 | `metadata.unitUid` lookup | 100% |
| 2 | `metadata.unit_uid` lookup | 100% |
| 3 | `metadata.schemeId` lookup | 50% |
| 4 | `metadata.address` lookup | 80% |

### Manual Recovery

For messages that can't be automatically recovered:

```sql
-- Find the orphaned message
SELECT id, metadata, created_at
FROM messages
WHERE unit_id IS NULL AND house_id IS NULL;

-- Manually identify the correct unit
SELECT id, unit_uid, address
FROM units
WHERE address ILIKE '%search term%';

-- Apply fix
UPDATE messages
SET unit_id = '<unit_id>', development_id = '<dev_id>'
WHERE id = '<message_id>';
```

---

## 3. Monitoring Data Quality

### Daily Checks

```sql
-- Check for orphaned data
SELECT * FROM orphaned_data_summary;

-- Recent messages without unit context
SELECT COUNT(*) 
FROM messages 
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND unit_id IS NULL 
  AND house_id IS NULL;
```

### Tenant Isolation Verification

```sql
-- Verify no cross-tenant data
SELECT m.id, m.tenant_id as msg_tenant, u.tenant_id as unit_tenant
FROM messages m
JOIN units u ON m.unit_id = u.id
WHERE m.tenant_id != u.tenant_id;
-- Should return 0 rows
```

---

## 4. Emergency Procedures

### If Demo Seed Corrupts Data

1. **Stop the bleeding**: Disable demo seeding
   ```bash
   unset ALLOW_DEMO_SEED
   ```

2. **Identify affected data**:
   ```sql
   SELECT * FROM demo_seed_log 
   WHERE status = 'failed' 
   ORDER BY created_at DESC;
   ```

3. **Run recovery**:
   ```bash
   npx tsx scripts/hardening/recover-orphaned-messages.ts
   ```

4. **Clean up demo data if needed**:
   ```sql
   -- Get the failed seed's created entities
   SELECT created_entities FROM demo_seed_log 
   WHERE seed_identifier = '<failed_seed>';
   
   -- Carefully delete (in order)
   DELETE FROM messages WHERE unit_id IN (...);
   DELETE FROM units WHERE id IN (...);
   DELETE FROM house_types WHERE id IN (...);
   -- etc.
   ```

### If Production Messages Are Orphaned

1. **Assess scope**:
   ```sql
   SELECT COUNT(*), DATE(created_at) as date
   FROM messages
   WHERE unit_id IS NULL AND house_id IS NULL
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

2. **Run automated recovery**:
   ```bash
   npx tsx scripts/hardening/recover-orphaned-messages.ts --apply
   ```

3. **Report remaining issues**:
   ```sql
   SELECT id, metadata, created_at
   FROM messages
   WHERE unit_id IS NULL AND house_id IS NULL
   ORDER BY created_at DESC;
   ```

---

## 5. Database Hardening Summary

### Constraints Added

| Table | Constraint | Type |
|-------|-----------|------|
| messages | tenant_id NOT NULL | Column |
| messages | tenant_isolation_trigger | Trigger |
| developments | tenant_id NOT NULL | Column |
| units | tenant_id NOT NULL, development_id NOT NULL | Column |
| documents | tenant_id NOT NULL | Column |

### RLS Policies

All tenant-scoped tables have RLS enabled with service role bypass.

### Indexes Added

- `messages(tenant_id, development_id, unit_id, created_at DESC)`
- `documents(tenant_id, development_id, document_type)`
- `analytics_events(tenant_id, development_id, created_at DESC)`
- `units(tenant_id, development_id, unit_uid)`

### New Tables

- `recovery_map` - Audit trail for data recovery operations
- `demo_seed_log` - Tracking for idempotent seeding operations

---

## 6. Testing

Run the isolation test suite:

```bash
npx tsx scripts/hardening/test-tenant-isolation.ts
```

Expected output:
```
MULTI-TENANT ISOLATION TESTS
============================================================
  ✓ PASS: Messages reject null tenant_id
  ✓ PASS: Cross-tenant message insert blocked
  ✓ PASS: Messages with valid context accepted
  ✓ PASS: Orphaned data view exists
  ✓ PASS: Recovery map table exists
  ✓ PASS: Demo seed log table exists
  ✓ PASS: Query performance acceptable
  ✓ PASS: RLS enabled on tenant tables
============================================================
TEST SUMMARY
  Passed: 8
  Failed: 0
============================================================
```

---

## Contact

For escalation:
- Platform Issues: Check HARDENING.md
- Database Issues: Check migration files
- Recovery Issues: Check recovery_map table
