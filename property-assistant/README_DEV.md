# 🛠️ OpenHouse AI - Development Guide

This guide explains how to develop, test, seed data, and train the AI model for the OpenHouse AI multi-tenant property management platform.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [Getting Started](#-getting-started)
4. [Database Management](#-database-management)
5. [Testing](#-testing)
6. [AI Training Pipeline](#-ai-training-pipeline)
7. [Development Workflows](#-development-workflows)
8. [Deployment](#-deployment)

---

## 🎯 Project Overview

**OpenHouse AI** is a production-grade multi-tenant SaaS platform for property management featuring:

- 🏢 **Multi-tenant architecture** with complete data isolation
- 💬 **AI-powered chat** with RAG (Retrieval-Augmented Generation)
- 📊 **Analytics dashboards** for property insights
- 🎫 **Ticket management** for maintenance requests
- 📋 **CSV bulk import** for property data
- 📧 **Email notifications** via Resend
- 📚 **FAQ library** with vector embeddings
- 📢 **Notices** with scheduling (active window management)
- 📍 **Geospatial features** with Points of Interest

### Tech Stack

- **Framework**: Next.js 14/15 with TypeScript
- **Database**: PostgreSQL (Neon/Supabase) with Drizzle ORM
- **AI**: OpenAI API for chat and embeddings
- **Auth**: Supabase Auth
- **Email**: Resend
- **Styling**: Tailwind CSS + Radix UI

---

## 🏗️ Architecture

### Monorepo Structure

```
openhouse-ai/
├── apps/
│   ├── tenant-portal/          # Main tenant-facing application
│   └── developer-dashboard/    # Admin/master dashboard
├── packages/
│   ├── db/                     # Database schema, migrations, and queries
│   ├── api/                    # Shared API utilities and auth
│   ├── ui/                     # Shared UI components
│   └── workers/                # Background job workers
├── scripts/
│   ├── data/                   # Seed data (CSV files)
│   ├── seed.ts                 # Database seeding script
│   ├── verify-db.ts            # Database verification
│   └── test-training-pipeline.ts  # AI pipeline test
└── DEPLOY_TO_SUPABASE.md       # Production deployment guide
```

### Database Schema (23 Tables)

**Core Multi-Tenant:**
- `tenants` - Property/tenant configurations
- `admins` - Administrator accounts
- `user_roles` - User role definitions

**Property Management:**
- `units` - Property units with resident info
- `tickets` - Support ticket system
- `issue_types` - Ticket categorization
- `contacts` - Contact directory

**Content & Knowledge:**
- `faqs` - FAQ library with embeddings
- `noticeboard_posts` - Notices with scheduling
- `notices` - Legacy notices
- `documents` - Document management
- `document_versions` - Version control
- `docs` - Documentation system
- `doc_chunks` - Document embeddings for RAG

**Communication:**
- `messages` - Chat message history
- `feedback` - User feedback collection

**Analytics:**
- `analytics_daily` - Daily metrics aggregation

**System:**
- `audit_log` - Activity logging
- `feature_flags` - Feature toggles
- `jobs` - Background job tracking
- `phases` - Project phases
- `rate_events` - Rate limiting

**Geospatial:**
- `pois` - Points of interest

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18 or higher
- npm or yarn
- PostgreSQL database (Replit provides this automatically)

### Installation

```bash
# Install dependencies for all packages
npm run install:all

# Or install root dependencies only
npm install
```

### Environment Variables

For **Replit development**, environment variables are configured as Secrets.

For **local development**, create a `.env` file in the project root:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - Replit Neon PostgreSQL connection string (auto-configured)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key for chat and embeddings
- `SESSION_SECRET` - Session encryption secret

### Running the Applications

**Start both apps:**
```bash
npm run dev
```

**Start tenant portal only:**
```bash
npm run dev:tenant
```

**Start developer dashboard only:**
```bash
npm run dev:dashboard
```

The apps will be available at:
- Tenant Portal: http://localhost:5000
- Developer Dashboard: http://localhost:3001 (if configured)

---

## 🗄️ Database Management

### Verify Database Connection

```bash
npx tsx scripts/verify-db.ts
```

Expected output:
```
✅ Database connected successfully
📊 Tenants count: 3
📋 Tables in database: 23
  ✓ tenants
  ✓ admins
  ✓ units
  ... (20 more tables)
✅ Database verification complete
```

### Schema Management

The project uses **Drizzle ORM** for database schema management.

**Generate migration files:**
```bash
npm run db:generate
```

**Push schema to database:**
```bash
npm run db:push
```

**Open Drizzle Studio (visual database browser):**
```bash
npm run db:studio
```

### Seeding the Database

The project includes seed scripts for initial data:

**Seed tenants and initial data:**
```bash
npm run db:seed
```

This will create:
- Sample tenants (Seaview, Oceanview, Hillside)
- Admin accounts
- Initial feature flags
- Sample data for testing

**Custom seeding:**

You can create custom seed scripts in `scripts/` directory:

```typescript
import { db } from '../packages/db/client';
import { tenants, admins } from '../packages/db/schema';

// Your seeding logic here
```

---

## 🧪 Testing

### Development Routes

The tenant portal includes dedicated development/testing routes:

**Ticket Management:**
```
http://localhost:5000/dev/tickets
```
- Create, view, and manage support tickets
- Test ticket status updates
- Verify ticket assignment

**CSV Import:**
```
http://localhost:5000/dev/import
```
- Import units, contacts, FAQs, issue types
- Validate CSV data
- Test bulk data operations

**Notices Management:**
```
http://localhost:5000/dev/notices
```
- Create notices with scheduling
- Test priority levels
- Verify active window filtering (start_date, end_date)

**Contact Directory:**
```
http://localhost:5000/dev/contacts
```
- View and manage contacts
- Test contact search

**FAQ Library:**
```
http://localhost:5000/docs
```
- Browse FAQ library
- Test AI-powered search
- Verify embeddings

### Testing Checklist

Before deploying or marking work complete:

- [ ] All dev routes load without errors
- [ ] Database queries execute successfully
- [ ] CSV imports work for all data types
- [ ] Notices scheduling filters correctly (active/scheduled/expired)
- [ ] Chat interface responds with AI messages
- [ ] Multi-tenant isolation is enforced
- [ ] No console errors in browser
- [ ] Workflow logs show no errors

### Manual Testing

```bash
# 1. Start the server
npm run dev:tenant

# 2. Check workflow logs
# Logs are available in Replit's workflow panel

# 3. Test database connectivity
npx tsx scripts/verify-db.ts

# 4. Test AI training pipeline
npx tsx scripts/test-training-pipeline.ts
```

---

## 🧠 AI Training Pipeline

⚠️ **Status: Scaffold Implementation - Not Production-Ready**

The project includes a scaffolded AI training pipeline for ingesting property data and generating embeddings for the RAG system. **This is currently a proof-of-concept and requires additional work before production use.**

### Pipeline Location

```
packages/api/src/train/index.ts
```

### Current Capabilities (Scaffold)

- ⚠️ CSV data ingestion (basic implementation)
- ⚠️ JSON data ingestion (basic implementation)
- ⚠️ Text chunking and preprocessing (simple implementation)
- ⚠️ OpenAI embedding generation (sequential, no batching)
- ⚠️ Vector storage in PostgreSQL (needs Drizzle integration)
- ⚠️ Multi-tenant data isolation (needs authorization enforcement)

### Security Features (Implemented)

- ✅ **Tenant Authorization**: trainModel() requires authorized tenant ID verification
- ✅ **Drizzle Integration**: Requires db instance parameter (no raw SQL)
- ✅ **Authorization Check**: Validates config.tenantId matches authorizedTenantId
- ✅ **Safe Scaffold**: Storage is stubbed (no actual writes until production implementation)

### Known Limitations

The current training pipeline scaffold has limitations that must be addressed for production:

1. **Storage Implementation**: Embedding storage is stubbed (logs only, no actual database writes)
2. **Scalability**: Sequential OpenAI API calls without batching or rate limiting
3. **Production Path**: No authenticated API endpoint or worker integration
4. **Complete Type Handling**: Needs full doc_chunks table implementation with proper pgvector types

### Required Improvements Before Production

- [x] Require Drizzle ORM instance (no raw SQL) ✅
- [x] Add tenant authorization checks before data operations ✅
- [ ] Implement actual embedding storage with doc_chunks table
- [ ] Implement batching for OpenAI API calls (16 chunks per batch)
- [ ] Add rate limiting and backoff strategies
- [ ] Create authenticated API endpoint (`/api/train`)
- [ ] Add worker/background job integration
- [ ] Implement proper error handling and logging
- [ ] Add progress tracking and status updates

### Testing the Pipeline

```bash
npx tsx scripts/test-training-pipeline.ts
```

Expected output:
```
======================================================================
🧠 AI TRAINING PIPELINE - INITIALIZED
======================================================================

✅ Training pipeline ready for data ingestion

Supported data formats:
  📄 CSV - Property data, FAQs, units, contacts
  📋 JSON - Structured property information
  📝 Text - Documents and knowledge base content

Pipeline capabilities:
  🔹 Multi-tenant data isolation
  🔹 OpenAI embedding generation
  🔹 Vector storage in PostgreSQL
  🔹 Automatic chunking and preprocessing

Configuration:
  🔑 OpenAI API Key: ✓ Configured
  🗄️ Database: ✓ Connected

Ready to ingest Seaview development data! 🏢
======================================================================
```

### Using the Training Pipeline

**Basic usage:**

```typescript
import { trainModel } from './packages/api/src/train';

const result = await trainModel({
  tenantId: 'your-tenant-id',
  source: {
    type: 'csv',
    data: csvRecords
  },
  options: {
    chunkSize: 1000,
    embeddingModel: 'text-embedding-3-small'
  }
});

console.log(result.message);
// "Training complete: 42 embeddings stored successfully"
```

**Supported data types:**

1. **CSV** - Array of objects
```typescript
{
  type: 'csv',
  data: [
    { id: 1, question: 'What is...', answer: '...' },
    { id: 2, question: 'How do I...', answer: '...' }
  ]
}
```

2. **JSON** - Structured objects
```typescript
{
  type: 'json',
  data: {
    units: [...],
    residents: [...],
    amenities: [...]
  }
}
```

### Training with Seaview Data

To train the model with Seaview pilot data:

```bash
# 1. Ensure Seaview CSV files are in scripts/data/
ls scripts/data/seaview_*.csv

# 2. Create training script
npx tsx -e "
import { trainModel } from './packages/api/src/train';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';

const csvData = parse(readFileSync('./scripts/data/seaview_faqs.csv'), {
  columns: true,
  skip_empty_lines: true
});

const result = await trainModel({
  tenantId: 'seaview-tenant-id',  // Replace with actual Seaview tenant ID
  source: {
    type: 'csv',
    data: csvData
  }
});

console.log(result);
"
```

---

## 🔄 Development Workflows

### Daily Development

1. **Start development server**
   ```bash
   npm run dev:tenant
   ```

2. **Check logs** (via Replit workflow panel or console)

3. **Make changes** to code

4. **Test changes** in browser (hot reload enabled)

5. **Verify database** if schema changed
   ```bash
   npx tsx scripts/verify-db.ts
   ```

### Adding New Features

1. **Schema changes** (if needed)
   - Update `packages/db/schema.ts`
   - Run `npm run db:push` to apply changes

2. **Create API routes**
   - Add to `apps/tenant-portal/app/api/`
   - Use `resolveTenantFromRequest()` for multi-tenant queries

3. **Build UI components**
   - Add to `apps/tenant-portal/components/`
   - Use shared components from `packages/ui/`

4. **Test thoroughly**
   - Use dev routes (`/dev/*`)
   - Check browser console
   - Verify database changes

5. **Document changes**
   - Update `replit.md` with architectural decisions
   - Update this README if needed

### Common Tasks

**Add a new table:**
```typescript
// In packages/db/schema.ts
export const myNewTable = pgTable('my_new_table', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

Then push to database:
```bash
npm run db:push
```

**Add a new API endpoint:**
```typescript
// In apps/tenant-portal/app/api/myendpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantFromRequest } from '@openhouse/api';

export async function GET(request: NextRequest) {
  const tenant = await resolveTenantFromRequest(request);
  
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Your logic here
  
  return NextResponse.json({ data: 'success' });
}
```

**Create a new page:**
```typescript
// In apps/tenant-portal/app/mypage/page.tsx
export default function MyPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold">My New Page</h1>
      {/* Your content */}
    </div>
  );
}
```

---

## 🚀 Deployment

### Development (Replit)

The app is already configured for Replit deployment:

1. Environment variables are set as Secrets
2. Database is Replit Neon PostgreSQL
3. Workflow automatically runs the server

### Production (External Supabase)

For production deployment to external Supabase:

1. **Follow deployment guide:**
   ```bash
   cat DEPLOY_TO_SUPABASE.md
   ```

2. **From your local machine:**
   - Download project archive
   - Set `SUPABASE_DB_URL` environment variable
   - Run `npm run db:push` to deploy schema

3. **Deploy to hosting platform:**
   - Vercel (recommended for Next.js)
   - Railway
   - Render
   - Fly.io

### Deployment Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database schema deployed
- [ ] Seed data loaded (if needed)
- [ ] AI model trained (embeddings generated)
- [ ] Email notifications configured (Resend)
- [ ] Row Level Security (RLS) enabled in Supabase
- [ ] Error tracking set up (Sentry, LogRocket, etc.)
- [ ] Performance monitoring enabled
- [ ] Documentation updated

---

## 📚 Additional Resources

- **Drizzle ORM Docs**: https://orm.drizzle.team
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **OpenAI API Docs**: https://platform.openai.com/docs
- **Tailwind CSS Docs**: https://tailwindcss.com/docs

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check environment variables
echo $DATABASE_URL

# Verify database connection
npx tsx scripts/verify-db.ts

# Restart workflow
# (Use Replit workflow panel to restart Server workflow)
```

### Schema Sync Issues

```bash
# Force push schema (use with caution)
npm run db:push -- --force

# Check current schema
npm run db:studio
```

### AI Training Pipeline Issues

```bash
# Verify OpenAI API key
echo ${OPENAI_API_KEY:0:10}...

# Test pipeline
npx tsx scripts/test-training-pipeline.ts
```

### Server Not Starting

1. Check workflow logs in Replit panel
2. Verify port 5000 is not blocked
3. Check for compile errors
4. Restart workflow

---

## ✅ Next Steps

After setting up the development environment:

1. ✅ **Verify database** connection and schema
2. ✅ **Test all dev routes** (`/dev/*`)
3. ✅ **Import Seaview data** via CSV import
4. ✅ **Train AI model** with Seaview FAQs
5. ✅ **Test chat interface** with RAG
6. ✅ **Configure email** notifications
7. ✅ **Set up analytics** tracking
8. ✅ **Deploy to staging** environment
9. ✅ **Conduct user testing** with Seaview pilot
10. ✅ **Deploy to production** 🎉

---

**Questions?** Check the main `README.md` or consult the project documentation in `replit.md`.

**Ready to build!** 🚀
