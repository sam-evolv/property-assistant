# OpenHouse AI Database Package

Shared database configuration and schema for the OpenHouse AI monorepo using Drizzle ORM and PostgreSQL.

## Overview

This package provides:
- Drizzle ORM schema definitions for all tables
- Database client configuration
- Migration management
- Seed data for development
- Row-Level Security (RLS) policies

## Tables

### Core Tables

- **tenants** - Property developments with branding and configuration
- **admins** - Property managers and staff accounts
- **documents** - Resident handbooks, policies, and documents
- **noticeboard_posts** - Community announcements and updates
- **pois** - Points of Interest (amenities, parking, services)
- **messages** - Chat messages and interactions
- **analytics_daily** - Daily metrics for analytics dashboards

All tables use UUID primary keys and include tenant_id for multi-tenancy.

## Usage

### Import Database Client

```typescript
import { db } from '@openhouse/db';
import { tenants, admins, documents } from '@openhouse/db';

const allTenants = await db.select().from(tenants);
```

### Schema Structure

Each table follows this pattern:
- `id` - UUID primary key with auto-generation
- `tenant_id` - UUID foreign key to tenants table
- `created_at` - Timestamp with timezone
- Additional fields specific to the table

### Available Scripts

Run from the monorepo root:

```bash
npm run db:push          # Push schema changes to database
npm run db:generate      # Generate migration files
npm run db:migrate       # Apply migrations
npm run db:seed          # Seed demo data
```

## Row-Level Security

RLS policies are defined in `policies.sql` and enforce:
- Tenant isolation - Users can only access their tenant's data
- Platform admin bypass - Users with role='platform' can access all data
- JWT-based filtering using `tenant_id` claim

## Demo Data

The seed script creates:
- 1 existing tenant (Seaview Apartments)
- 1 admin user
- 3 sample documents
- 4 sample POIs
- 2 noticeboard posts

## Environment Variables

Required:
- `DATABASE_URL` or `POSTGRES_URL` - PostgreSQL connection string

Optional:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
