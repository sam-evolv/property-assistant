# Vercel Deployment Runbook: Phase 1 Videos Feature

## Confirmations

### Videos Location
**Confirmed**: Videos tab is located under **Smart Archive** (`/developer/archive`) as a sibling tab to Documents, Important Docs, and Insights.

### DELETE Endpoint Security
**Confirmed**: DELETE `/api/videos?id=<uuid>` validates tenant ownership:
```typescript
const existing = await db.query.video_resources.findFirst({
  where: and(
    eq(video_resources.id, videoId),
    eq(video_resources.tenant_id, adminContext.tenantId)  // Tenant isolation
  ),
});
if (!existing) {
  return NextResponse.json({ error: 'Video not found' }, { status: 404 });
}
```

---

## Environment Variables

### Production Environment (Initial Deploy - Feature OFF)

| Variable | Value | Notes |
|----------|-------|-------|
| `FEATURE_VIDEOS` | `false` | Server-side flag |
| `NEXT_PUBLIC_FEATURE_VIDEOS` | `false` | Client-side flag (build-time) |

### Preview Environment (Testing - Feature ON)

| Variable | Value | Notes |
|----------|-------|-------|
| `FEATURE_VIDEOS` | `true` | Server-side flag |
| `NEXT_PUBLIC_FEATURE_VIDEOS` | `true` | Client-side flag (build-time) |

### All Environments (Required)

These must already be configured in Vercel:

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Neon/Postgres connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SESSION_SECRET` | Random 32+ char string |
| `OPENAI_API_KEY` | OpenAI API key |

---

## Deployment Steps

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Phase 1 Videos: link-based embeds behind feature flag"
git push origin main
```

### Step 2: Configure Vercel Environment Variables

1. Go to Vercel Dashboard > Project Settings > Environment Variables
2. Add for **Preview** environment:
   - `FEATURE_VIDEOS` = `true`
   - `NEXT_PUBLIC_FEATURE_VIDEOS` = `true`
3. Add for **Production** environment:
   - `FEATURE_VIDEOS` = `false`
   - `NEXT_PUBLIC_FEATURE_VIDEOS` = `false`

### Step 3: Trigger Deployment
- Push triggers automatic deploy
- Or manually trigger from Vercel Dashboard

### Step 4: Verify Preview Deployment
1. Open Preview URL (provided below)
2. Log in as developer
3. Navigate to Smart Archive
4. Confirm Videos tab appears
5. Test add/play/delete video flow

### Step 5: iOS Device Testing
Use the Preview URL on a real iPhone to test:
- Video playback in iframe
- Inline playback (not fullscreen redirect)
- Modal open/close behavior
- Landscape orientation

---

## Preview URL for iPhone Testing

**Replit Development URL:**
```
https://84141d02-f316-41eb-8d70-a45b1b91c63c-00-140og66wspdkl.riker.replit.dev
```

**Test Path:**
```
/developer/archive
```

**Full Test URL:**
```
https://84141d02-f316-41eb-8d70-a45b1b91c63c-00-140og66wspdkl.riker.replit.dev/developer/archive
```

---

## Rollout Plan

| Phase | Action | Feature Flag |
|-------|--------|--------------|
| 1 | Deploy to Production | `false` |
| 2 | Test on Preview | `true` |
| 3 | iOS device verification | Preview URL |
| 4 | Enable for pilot scheme | `true` (Production) |
| 5 | Monitor for 1 week | - |
| 6 | Full rollout | - |

---

## Rollback

To disable Videos feature immediately:
1. Set `FEATURE_VIDEOS=false` in Vercel Production
2. Set `NEXT_PUBLIC_FEATURE_VIDEOS=false` in Vercel Production
3. Trigger redeploy

All API endpoints will return 404, tab will not render.

---

## Database Migration

The `video_resources` table schema is managed by Drizzle ORM. Run migration before first use:

```bash
npm run db:push
```

Table will be created automatically on first deploy if not exists.
