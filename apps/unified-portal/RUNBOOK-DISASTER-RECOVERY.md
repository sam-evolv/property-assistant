# Disaster Recovery Runbook

## Overview

This runbook covers recovery procedures for major incidents affecting the OpenHouse AI Unified Portal.

---

## Incident Types

1. [Migration Went Wrong](#1-migration-went-wrong)
2. [Missing Messages](#2-missing-messages)
3. [Suspected Compromise](#3-suspected-compromise)
4. [Restore Production Safely](#4-restore-production-safely)

---

## 1. Migration Went Wrong

### Symptoms
- Application errors after deployment
- Database constraint violations
- Missing or corrupted data

### Immediate Actions

```bash
# 1. Check migration status
npx tsx scripts/hardening/status-check.ts

# 2. Review recent changes
git log --oneline -10

# 3. Check for orphaned data
npx tsx scripts/monitoring/canary-checks.ts
```

### Recovery Options

**Option A: Roll back migration (if simple)**
```sql
-- Revert specific constraint
ALTER TABLE messages ALTER COLUMN unit_id DROP NOT NULL;
```

**Option B: Restore from backup (if data loss)**
```bash
# 1. Find latest backup
ls -la backups/encrypted/

# 2. Dry-run restore
npx tsx scripts/backup/restore-drill.ts --dry-run

# 3. Restore to staging first
STAGING_DATABASE_URL=<staging_url> npx tsx scripts/backup/restore-drill.ts
```

**Option C: Use Replit checkpoint rollback**
- Contact user to initiate rollback via Replit UI
- This restores code, database, and chat history

---

## 2. Missing Messages

### Symptoms
- Users report messages not appearing
- Message count discrepancy
- unit_id or tenant_id null in logs

### Investigation

```bash
# Check for orphaned messages
npx tsx scripts/monitoring/canary-checks.ts

# Query for null unit_id
psql $DATABASE_URL -c "SELECT COUNT(*) FROM messages WHERE unit_id IS NULL"

# Check audit log for deletes
psql $DATABASE_URL -c "SELECT * FROM audit_events WHERE table_name = 'messages' AND operation = 'DELETE' ORDER BY created_at DESC LIMIT 20"
```

### Recovery

```bash
# If messages exist but have null unit_id:
npx tsx scripts/hardening/recover-orphaned-messages.ts

# If messages were deleted (visible in audit_events):
# 1. Identify affected messages from audit_events.before_state
# 2. Re-insert from backup or audit log
```

---

## 3. Suspected Compromise

### Symptoms
- Unexpected data access patterns
- Audit events from unknown actors
- Cross-tenant data visible

### Immediate Actions

**STEP 1: Assess scope**
```bash
# Check for cross-tenant access
npx tsx scripts/monitoring/canary-checks.ts

# Review recent audit events
psql $DATABASE_URL -c "SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 50"
```

**STEP 2: Rotate credentials**
```bash
# Generate new encryption key
openssl rand -hex 32

# Update in Supabase dashboard:
# - Service role key (regenerate)
# - JWT secrets
# - Database password
```

**STEP 3: Notify stakeholders**
- Post to incident Slack channel
- Document timeline in incident report

**STEP 4: Forensics**
```bash
# Export audit log for analysis
psql $DATABASE_URL -c "\\COPY (SELECT * FROM audit_events WHERE created_at > NOW() - INTERVAL '7 days') TO 'audit_export.csv' CSV HEADER"
```

---

## 4. Restore Production Safely

### Golden Rule
**Never restore directly to production. Always restore to staging first.**

### Step-by-Step Procedure

**Step 1: Prepare staging environment**
```bash
# Option A: Local Docker
docker run -d --name restore-staging \
  -e POSTGRES_PASSWORD=staging \
  -p 5434:5432 \
  postgres:15

# Option B: Use staging Supabase project
export STAGING_DATABASE_URL="postgresql://..."
```

**Step 2: Identify backup to restore**
```bash
# List available backups
ls -la backups/encrypted/

# Check manifest
cat backups/encrypted/backup-daily-2025-01-15T02-00-00-000Z.manifest.json
```

**Step 3: Restore to staging**
```bash
# Set staging URL
export STAGING_DATABASE_URL="postgresql://postgres:staging@localhost:5434/postgres"

# Run restore
npx tsx scripts/backup/restore-drill.ts
```

**Step 4: Validate restored data**
```bash
# Run invariant checks against staging
NEXT_PUBLIC_SUPABASE_URL=<staging> npx tsx scripts/hardening/status-check.ts

# Spot-check critical data
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM units"
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM messages"
```

**Step 5: Promote to production**
```bash
# Only after validation passes!
# Option A: Export/import via pg_dump
pg_dump $STAGING_DATABASE_URL > staging_export.sql
psql $PRODUCTION_DATABASE_URL < staging_export.sql

# Option B: Use Supabase migration tooling
```

---

## Key Contacts

| Role | Contact |
|------|---------|
| On-call Engineer | Slack: #ops-oncall |
| Database Admin | Slack: #db-admin |
| Security Team | Slack: #security |

---

## Backup Schedule

| Type | Schedule | Retention |
|------|----------|-----------|
| Daily | 2 AM UTC | 30 days |
| Weekly | Sunday 2 AM UTC | 12 weeks |
| Monthly | 1st of month 2 AM UTC | 12 months |

---

## Encryption Key Rotation

1. Generate new key: `openssl rand -hex 32`
2. Update `BACKUP_ENCRYPTION_KEY` in secrets
3. Old backups remain decryptable with old key
4. Document key rotation in security log

---

## Google Maps API Key Security

### BLOCKER WARNING

> **Before sharing this application externally or deploying to production:**
> The Google Maps API key MUST be rotated and restricted. Unrestricted keys
> can be abused by malicious actors, causing unexpected billing charges.

### Key Rotation Checklist

| Step | Action | Status |
|------|--------|--------|
| 1 | Go to Google Cloud Console > APIs & Services > Credentials | ☐ |
| 2 | Create NEW API key (do not edit existing) | ☐ |
| 3 | Set Application Restrictions > HTTP referrers | ☐ |
| 4 | Add allowed domains: `*.openhouse.ai/*`, `*.vercel.app/*`, `localhost:*/*` | ☐ |
| 5 | Set API Restrictions > Restrict key to: Maps JavaScript API, Places API, Geocoding API | ☐ |
| 6 | Set Quotas > Daily request limit (e.g., 10,000/day per API) | ☐ |
| 7 | Update `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in all environments | ☐ |
| 8 | Verify maps load correctly in dev and production | ☐ |
| 9 | DISABLE the OLD key in Google Cloud Console | ☐ |
| 10 | Document rotation in security log | ☐ |

### Key Locations

The Google Maps API key should ONLY be stored in:
- **Secrets/Environment Variables**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

It should NOT appear in:
- Source code files
- Git history
- Documentation (except placeholder examples)

### Verification

Run the hardening status check which includes a manual confirmation prompt:
```bash
npx tsx scripts/hardening/status-check.ts
```

Look for: `[MANUAL] Google Maps API key rotation confirmed`

---

## Post-Incident

After any incident:

1. Write incident report (what happened, timeline, root cause)
2. Update this runbook if procedures were unclear
3. Review canary thresholds
4. Schedule postmortem if P1/P2
