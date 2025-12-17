# Required Environment Variables for Vercel Deployment

This document lists all environment variables required for the OpenHouse AI Unified Portal to work correctly on Vercel.

## Database (CRITICAL)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Drizzle/Neon) | `postgres://user:pass@host:5432/dbname?sslmode=require` |
| `SUPABASE_DB_URL` | Alternative database URL (if using Supabase Postgres) | Same format as above |

**Note:** At least one of these must be set. The app tries `SUPABASE_DB_URL` first, then falls back to `DATABASE_URL`.

## Supabase Auth & Storage (CRITICAL)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_JWT_SECRET` | JWT secret for token verification | Your JWT secret |

## OpenAI (CRITICAL for AI Features)

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for embeddings & chat | `sk-...` |

## Application URLs

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployed app | `https://portal.openhouseai.ie` |
| `NEXT_PUBLIC_TENANT_PORTAL_URL` | URL for tenant portal (QR links) | `https://portal.openhouseai.ie` |

## Optional but Recommended

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key for location features | `AIza...` |
| `RESEND_API_KEY` | Resend API key for email sending | `re_...` |
| `SESSION_SECRET` | Session encryption secret | Random 32+ character string |

## Database Pool Settings (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_POOL_MAX` | 20 | Maximum connections in pool |
| `DB_POOL_MIN` | 2 | Minimum connections in pool |
| `DB_POOL_IDLE_MS` | 30000 | Idle timeout (ms) |
| `DB_POOL_CONN_TIMEOUT_MS` | 5000 | Connection timeout (ms) |
| `DATABASE_SSL` | auto | Set to 'true' to force SSL |

## Vercel Setup Checklist

1. Go to your Vercel project Settings > Environment Variables
2. Add all CRITICAL variables listed above
3. Make sure variables are set for **Production** environment
4. Redeploy the application after adding variables

## Troubleshooting

### "supabaseUrl is required" error
- Ensure `NEXT_PUBLIC_SUPABASE_URL` is set

### Database connection errors / 500 on API routes
- Verify `DATABASE_URL` points to the correct Postgres instance
- Check that the database has been migrated with `npm run db:push`

### QR codes redirect to login
- The middleware now allows `/units`, `/homes`, `/purchaser` routes without authentication
- If still redirecting, clear browser cache and try again

### Analytics showing empty data
- Verify `DATABASE_URL` is set and the database contains data
- Check Vercel function logs for specific errors

## Schema Migration Notes

The Drizzle schema (packages/db/schema.ts) is the authoritative source of truth. Some legacy Supabase columns are not present in Drizzle:

| Legacy Supabase Column | Status in Drizzle | Notes |
|------------------------|-------------------|-------|
| `units.handover_date` | Not present | API returns `null` |
| `units.snag_list_url` | Not present | API returns `has_snag_list: false` |
| `units.user_id` | Not present | Derived from `purchaser_email` presence |
| `unit_types` table | Replaced | Use `units.house_type_code` instead |
| `projects` table | Replaced | Use `developments` table instead |

If these fields are needed, consider:
1. Adding them to the Drizzle schema and running migrations
2. Importing the data from Supabase legacy tables
