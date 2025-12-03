# Phase 15: Production Deployment Guide

## 🚀 Overview

This document provides comprehensive instructions for deploying OpenHouse AI to production using Vercel and Supabase.

---

## 📋 Prerequisites

Before deploying, ensure you have:

- [ ] Vercel account with appropriate team/workspace
- [ ] Supabase project created and configured
- [ ] Domain(s) purchased and DNS access:
  - `app.openhouseai.ie` (Tenant Portal)
  - `developers.openhouseai.ie` (Developer Portal)
- [ ] OpenAI API key with sufficient credits
- [ ] Resend account for transactional emails
- [ ] Environment variables documented and secure

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Domain Layer                      │
├─────────────────────────────────────────────────────┤
│  app.openhouseai.ie          │  developers.openhouseai.ie │
│  (Tenant Portal)              │  (Developer Portal)        │
└─────────────────┬─────────────┴────────────┬───────┘
                  │                           │
            ┌─────▼────────┐          ┌─────▼────────┐
            │   Vercel     │          │   Vercel     │
            │  Project 1   │          │  Project 2   │
            │  (Tenant)    │          │  (Developer) │
            └─────┬────────┘          └─────┬────────┘
                  │                           │
                  └───────────┬───────────────┘
                              │
                      ┌───────▼────────┐
                      │   Supabase     │
                      │   PostgreSQL   │
                      │   + Auth       │
                      │   + Storage    │
                      └────────────────┘
```

---

## 🗂️ Deployment Steps

### 1. Supabase Setup

#### 1.1 Create Supabase Project

```bash
# Visit https://app.supabase.com
# Create new project:
#   - Name: openhouse-ai-production
#   - Region: Europe (Ireland) - eu-west-1
#   - Database Password: <strong-password>
```

#### 1.2 Run Database Migrations

```bash
# Navigate to SQL Editor in Supabase Dashboard
# Execute migrations in order:

# 1. Base schema
packages/db/migrations/0000_shallow_nekra.sql

# 2. Theme configuration
packages/db/migrations/004_theme_config.sql

# 3. Chat history
packages/db/migrations/005_chat_history.sql

# 4. Production optimizations (indexes and constraints)
packages/db/migrations/006_production_optimizations.sql

# Note: After running all migrations, optionally run this in SQL Editor
# for advanced vector index optimization (must be run outside transaction):
DROP INDEX IF EXISTS doc_chunks_embedding_idx;
CREATE INDEX doc_chunks_embedding_ivfflat_idx 
ON doc_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

#### 1.3 Enable Required Extensions

```sql
-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify
SELECT * FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp');
```

#### 1.4 Configure Row Level Security (RLS)

```sql
-- Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- All tables should have rowsecurity = true
```

#### 1.5 Set Up Storage Buckets

```bash
# In Supabase Dashboard > Storage
# Create buckets:
1. documents (private)
2. qr-codes (public)
3. logos (public)
4. avatars (public)

# Configure CORS for public buckets
```

---

### 2. Vercel Deployment - Tenant Portal

#### 2.1 Create Vercel Project

```bash
# Visit https://vercel.com/new
# Import from GitHub repository
# Configuration:
Framework Preset: Next.js
Root Directory: apps/tenant-portal
Build Command: npm run build
Output Directory: .next
Install Command: cd ../.. && npm run install:all && cd apps/tenant-portal
```

#### 2.2 Configure Environment Variables

Go to **Project Settings > Environment Variables** and add all variables from `.env.production.example`:

**Critical Variables:**
```env
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
DATABASE_URL=your-postgres-connection-string
OPENAI_API_KEY=sk-proj-your-key
SESSION_SECRET=<generate-with-openssl-rand-base64-32>
JWT_SECRET=<generate-with-openssl-rand-base64-32>
RESEND_API_KEY=re_your_key
MAIL_FROM=noreply@openhouseai.ie
```

**Important Notes:**
- Set `SUPABASE_SERVICE_ROLE_KEY` as **Production** environment only
- Use Supabase connection pooler URL for `DATABASE_URL` (port 6543)
- Never expose service role key to client-side

#### 2.3 Configure Domain

```bash
# In Vercel Project > Settings > Domains
# Add domain: app.openhouseai.ie

# DNS Configuration:
Type: CNAME
Name: app
Value: cname.vercel-dns.com
TTL: Auto
```

---

### 3. Vercel Deployment - Developer Portal

#### 3.1 Create Vercel Project

```bash
# Visit https://vercel.com/new
# Import from GitHub repository (same repo)
# Configuration:
Framework Preset: Next.js
Root Directory: apps/developer-portal
Build Command: npm run build
Output Directory: .next
Install Command: cd ../.. && npm run install:all && cd apps/developer-portal
```

#### 3.2 Configure Environment Variables

Add the same environment variables as Tenant Portal, with adjustments:

```env
NEXT_PUBLIC_APP_BASE_URL=https://developers.openhouseai.ie
# ... all other variables same as tenant portal
```

#### 3.3 Configure Domain

```bash
# In Vercel Project > Settings > Domains
# Add domain: developers.openhouseai.ie

# DNS Configuration:
Type: CNAME
Name: developers
Value: cname.vercel-dns.com
TTL: Auto
```

---

### 4. Production Build Verification

#### 4.1 Local Production Build Test

```bash
# Test tenant portal build
cd apps/tenant-portal
npm run build

# Test developer portal build
cd apps/developer-portal
npm run build

# Check for errors:
# - No TypeScript errors
# - No missing environment variables
# - No import/export issues
# - Build completes successfully
```

#### 4.2 Environment Variable Validation

```bash
# Create checklist:
✓ All NEXT_PUBLIC_ variables are safe for client
✓ Service role keys are server-only
✓ JWT secrets are unique and strong (32+ chars)
✓ Database URLs use connection pooler
✓ OpenAI API key has rate limits configured
✓ Email sender domain verified in Resend
```

---

### 5. Post-Deployment Health Checks

#### 5.1 Verify Health Endpoints

```bash
# Tenant Portal
curl https://app.openhouseai.ie/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-11-15T...",
  "service": "tenant-portal",
  "version": "abc123...",
  "environment": "production"
}

# Developer Portal
curl https://developers.openhouseai.ie/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-11-15T...",
  "service": "developer-portal",
  "version": "abc123..."
}
```

#### 5.2 Database Connectivity Test

```bash
# Test database connection through API
curl -X POST https://app.openhouseai.ie/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Should return 401/403 (auth required) not 500 (db error)
```

#### 5.3 Authentication Flow Test

```bash
# 1. Create test tenant
# 2. Upload test document
# 3. Train embeddings
# 4. Test chat functionality
# 5. Verify QR onboarding
# 6. Test theme customization
```

---

## 🔄 Database Migration Strategy

### Production Migration Process

```bash
# 1. Backup current database
# In Supabase Dashboard > Database > Backups
# Create manual backup

# 2. Test migration in staging environment
# Apply migration to staging first

# 3. Run migration in production during low-traffic window
# Execute SQL in Supabase SQL Editor

# 4. Verify migration success
SELECT * FROM _drizzle_migrations ORDER BY created_at DESC LIMIT 5;

# 5. Monitor for errors
# Check Vercel logs and Supabase logs
```

### Rollback Procedure

```sql
-- If migration fails, rollback using backup:

-- 1. Note current migration state
SELECT * FROM _drizzle_migrations;

-- 2. Restore from backup in Supabase Dashboard

-- 3. Verify restoration
SELECT count(*) FROM tenants;

-- 4. Redeploy previous Vercel version
-- In Vercel Dashboard > Deployments
-- Find previous working deployment > Promote to Production
```

---

## 🔧 Troubleshooting

### Common Issues

#### Build Fails with "Module not found"

```bash
# Solution: Ensure install command includes workspace setup
cd ../.. && npm install && npm run install:all && cd apps/tenant-portal
```

#### Database Connection Timeout

```bash
# Check:
1. DATABASE_URL uses connection pooler (port 6543)
2. Supabase project is not paused
3. Connection pool settings allow enough connections
4. Vercel function timeout is sufficient (60s)
```

#### CORS Errors

```bash
# Verify:
1. NEXT_PUBLIC_SUPABASE_URL matches exactly
2. Supabase Auth > URL Configuration includes production domain
3. No trailing slashes in URLs
```

#### Environment Variables Not Loading

```bash
# Check:
1. Variables are set in correct environment (Production/Preview/Development)
2. Deployment was triggered after adding variables
3. No typos in variable names
4. NEXT_PUBLIC_ prefix for client-side variables
```

---

## 📊 Monitoring & Logging

### Production Logging

```typescript
// Production log levels (configured automatically)
// Only log INFO and above in production
// ERROR logs include stack traces
// No DEBUG logs in production
```

### Vercel Analytics

```bash
# Enable in Vercel Dashboard:
1. Analytics (traffic, performance)
2. Speed Insights (Core Web Vitals)
3. Web Analytics (privacy-friendly)
```

### Supabase Monitoring

```bash
# Monitor in Supabase Dashboard:
1. Database > Query Performance
2. Database > Connection Pooling
3. Auth > Users (growth tracking)
4. Storage > Usage
```

### Error Tracking (Optional - Sentry)

```env
# Add to environment variables:
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

---

## 🔐 Security Checklist

- [ ] All secrets use strong random generation (32+ chars)
- [ ] Service role keys never exposed to client
- [ ] RLS policies active on all tables
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Security headers configured (see vercel.json)
- [ ] HTTPS enforced on all domains
- [ ] Database connection uses SSL
- [ ] Supabase Auth rate limits configured
- [ ] API routes have proper authentication
- [ ] File uploads validated and sanitized
- [ ] SQL injection prevented (using Drizzle ORM)

---

## 🚦 Pre-Launch Checklist

### Technical

- [ ] All migrations applied successfully
- [ ] Production build passes locally
- [ ] Health endpoints return 200 OK
- [ ] Database connectivity verified
- [ ] Authentication flow works
- [ ] Email sending configured
- [ ] Domain DNS propagated
- [ ] SSL certificates active

### Functional

- [ ] Tenant creation works
- [ ] Document upload and processing works
- [ ] AI chat responds correctly
- [ ] QR onboarding flow complete
- [ ] Theme customization saves
- [ ] Chat history persists
- [ ] Email notifications send
- [ ] Mobile responsive on all pages

### Performance

- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.8s
- [ ] Time to Interactive < 3.9s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1

---

## 📈 Scaling Considerations

### Database

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_house_created 
ON messages(house_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_embedding 
ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Monitor query performance
SELECT * FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;
```

### Vercel Functions

```json
// Increase limits for heavy operations
{
  "functions": {
    "apps/tenant-portal/app/api/train/**/*": {
      "maxDuration": 300,
      "memory": 3008
    }
  }
}
```

---

## 🔄 Continuous Deployment

### Git Workflow

```bash
main (production)
  ↑
  │ merge after QA
  │
staging (auto-deploy to Vercel preview)
  ↑
  │ merge after code review
  │
feature/* (local development)
```

### Automatic Deployments

```bash
# Vercel automatically deploys:
- main branch → Production
- PR branches → Preview deployments
- Each commit triggers build
```

---

## 📞 Support Contacts

- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
- **OpenAI Status**: https://status.openai.com
- **Resend Support**: https://resend.com/support

---

## 📝 Additional Resources

- [Vercel Deployment Documentation](https://vercel.com/docs)
- [Next.js Production Best Practices](https://nextjs.org/docs/going-to-production)
- [Supabase Production Checklist](https://supabase.com/docs/guides/getting-started/production-checklist)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/production-best-practices)

---

**Last Updated**: November 15, 2025  
**Phase**: 15 - Production Deployment Pipeline  
**Status**: ✅ Complete
