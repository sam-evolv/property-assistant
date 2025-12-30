# AI Governance Lockdown - Phase 1

## Overview

This document describes the Phase 1 safety lockdown implementation for the OpenHouse AI platform. The goal is to establish progressive controls that prepare the codebase for production launch while maintaining developer velocity.

**Implementation Date:** December 2025  
**Phase:** 1 of 3 (Safety Lockdown)  
**Status:** Active

## Environment Classification

The application now supports three distinct environments:

| Environment | `APP_ENV` | Purpose |
|------------|-----------|---------|
| Development | `dev` | Local development, full write access |
| Staging | `staging` | Pre-production testing, read-only by default |
| Production | `prod` | Live environment, restricted access |

### Configuration File

Location: `apps/unified-portal/lib/config/env.ts`

```typescript
import { APP_ENV, IS_DEV, IS_STAGING, IS_PROD, FEATURE_FLAGS } from '@/lib/config/env';
```

## Feature Flags

| Flag | Dev Default | Staging Default | Prod Default | Description |
|------|-------------|-----------------|--------------|-------------|
| `DB_WRITE_ENABLED` | `true` | `false` | `false` | Allow INSERT/UPDATE/DELETE |
| `ALLOW_DESTRUCTIVE_DB` | `true` | `false` | `false` | Allow DROP/TRUNCATE/ALTER DROP |
| `ENABLE_RATE_LIMITS` | `false` | `true` | `true` | Enable per-route rate limiting |
| `ENABLE_AUDIT_LOGS` | `true` | `true` | `true` | Enable structured audit logging |

## Environment Variables

### Required Variables

| Variable | Required In | Description |
|----------|-------------|-------------|
| `APP_ENV` | All | Environment identifier (`dev`, `staging`, `prod`) |
| `SUPABASE_DB_URL` | Staging/Prod | Database connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging/Prod | Supabase service role key |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging/Prod | Public Supabase URL |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_WRITE_ENABLED` | Env-dependent | Override write permission |
| `ALLOW_DESTRUCTIVE_DB` | Env-dependent | Override destructive permission |
| `ENABLE_RATE_LIMITS` | Env-dependent | Override rate limiting |
| `DB_WRITE_OVERRIDE_TOKEN` | None | Token for manual write override |

## Database Safety Guards

### Write Guard

Location: `apps/unified-portal/lib/db/safeDb.ts`

The safe database wrapper blocks write operations in staging/prod unless explicitly allowed:

```typescript
import { validateDbOperation, guardDbWrite } from '@/lib/db/safeDb';

// Check if operation is allowed
const result = validateDbOperation(sql);
if (!result.allowed) {
  console.error(result.reason);
}

// Or throw on blocked operations
guardDbWrite(sql);
```

### Blocked Operations (Staging/Prod)

When `DB_WRITE_ENABLED=false`:
- `INSERT`
- `UPDATE`
- `DELETE`

When `ALLOW_DESTRUCTIVE_DB=false`:
- `DROP`
- `TRUNCATE`
- `ALTER TABLE ... DROP`
- `DELETE FROM table` (without WHERE)

### Manual Override Procedure

For approved database operations in staging/prod:

1. **Option A: Temporary Environment Variable**
   ```bash
   DB_WRITE_ENABLED=true npm run migrate
   ```

2. **Option B: Override Header Token**
   ```bash
   # Set in environment
   DB_WRITE_OVERRIDE_TOKEN=your-secure-token-here
   
   # Use in request
   curl -H "x-db-write-override: your-secure-token-here" ...
   ```

## Rate Limiting

Location: `apps/unified-portal/lib/security/rate-limiter.ts`

### Protected Endpoints

| Route Pattern | Requests/Minute | Window |
|--------------|-----------------|--------|
| `/api/chat` | 30 | 60s |
| `/api/houses/*` | 100 | 60s |
| `/api/purchaser/*` | 50 | 60s |
| `/api/super/*` | 200 | 60s |
| `/api/developer/*` | 200 | 60s |
| Default | 100 | 60s |

### Response Headers

Rate-limited responses include:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Seconds until window reset

### Circuit Breaker

Automatically trips after 5 consecutive failures:
- Opens for 30 seconds
- Returns 503 with `Retry-After` header
- Half-opens to test recovery

## Audit Logging

Location: `apps/unified-portal/lib/logging/audit.ts`

### Log Format

```json
{
  "timestamp": "2025-12-30T12:00:00.000Z",
  "env": "staging",
  "eventName": "api_request_start",
  "actorType": "human",
  "actorId": "admin@example.com",
  "requestId": "abc123xyz",
  "route": "/api/chat",
  "method": "POST"
}
```

### Actor Type Detection

| Condition | Actor Type |
|-----------|------------|
| `x-agent-run: replit-agent` | `ai` |
| `x-ai-change` header present | `ai` |
| `x-system-actor: true` | `system` |
| Browser user-agent | `human` |
| Other | `unknown` |

### Usage

```typescript
import { logAudit, logSecurityEvent, logDbWriteAttempt } from '@/lib/logging/audit';

logAudit({
  eventName: 'user_login',
  actorType: 'human',
  actorId: user.email,
  metadata: { method: 'oauth' }
});
```

## Staging Mode

### Enabling Staging

1. Set environment variables:
   ```
   APP_ENV=staging
   DB_WRITE_ENABLED=false
   ENABLE_RATE_LIMITS=true
   ```

2. Verify configuration:
   ```bash
   npm run staging-smoke-test
   ```

### Smoke Test

Location: `scripts/staging-smoke-test.ts`

```bash
# Run smoke test
SMOKE_TEST_URL=https://staging.example.com npx tsx scripts/staging-smoke-test.ts
```

Tests:
- Health check endpoint
- Read operations succeed
- Rate limit headers present
- Request ID headers present

## Files Changed/Added

### New Files

| File | Purpose |
|------|---------|
| `lib/config/env.ts` | Environment configuration |
| `lib/db/safeDb.ts` | Database write guards |
| `lib/logging/audit.ts` | Structured audit logging |
| `lib/security/rate-limiter.ts` | Rate limiting & circuit breaker |
| `middleware-safety.ts` | Safety middleware wrapper |
| `scripts/staging-smoke-test.ts` | Staging validation |
| `AI_GOVERNANCE_LOCKDOWN.md` | This document |

### Modified Files

| File | Changes |
|------|---------|
| `replit.md` | Added Phase 1 lockdown section |

## API Route Integration (Phase 2)

### Circuit Breaker Recording

API routes should integrate circuit breaker recording to enable automatic failure detection:

```typescript
// Option 1: Use wrapApiHandler for entire route
import { wrapApiHandler } from '@/middleware-safety';

export async function GET(request: NextRequest) {
  return wrapApiHandler('/api/your-route', async () => {
    // Your handler logic here
    return NextResponse.json({ data });
  });
}

// Option 2: Manual recording at response points
import { recordApiResult } from '@/middleware-safety';

export async function POST(request: NextRequest) {
  try {
    const result = await processRequest();
    recordApiResult('/api/your-route', true);  // Success
    return NextResponse.json(result);
  } catch (error) {
    recordApiResult('/api/your-route', false); // Failure
    throw error;
  }
}
```

### Priority Routes for Integration

1. `/api/chat` - AI chat endpoint (high cost, high impact)
2. `/api/houses/resolve` - Unit resolution 
3. `/api/purchaser/profile` - User data

## Roadmap

### Phase 2 (Beta - Weeks 2-4)

- [ ] Integrate circuit breaker recording into protected routes
- [ ] Soft delete for user/client tables
- [ ] Database migration safety checks
- [ ] Enhanced audit log storage (persistent)
- [ ] Admin approval workflow for destructive ops

### Phase 3 (Launch - Weeks 5-6)

- [ ] Production hard lockdown
- [ ] Automated security scanning
- [ ] Compliance audit trail
- [ ] Incident response procedures

## Quick Reference

### Check Current Environment

```typescript
import { getEnvSummary } from '@/lib/config/env';
console.log(getEnvSummary());
```

### Check DB Safety Status

```typescript
import { getDbSafetyStatus } from '@/lib/db/safeDb';
console.log(getDbSafetyStatus());
```

### Validate Staging Config

```typescript
import { validateStagingProdConfig } from '@/lib/config/env';
const { valid, errors } = validateStagingProdConfig();
```

## Support

For questions about AI governance controls:
1. Check this document
2. Review code comments in referenced files
3. Contact platform team

---

*Document Version: 1.0*  
*Last Updated: December 2025*
