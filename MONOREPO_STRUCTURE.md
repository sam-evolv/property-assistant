# OpenHouse AI - Monorepo Structure

This document describes the monorepo structure for the OpenHouse AI Platform.

## 📁 Directory Structure

```
openhouse-ai-monorepo/
├── apps/
│   ├── admin-portal/          # Global administrative console
│   ├── developer-portal/      # Developer-facing dashboard (placeholder)
│   ├── resident-app/          # Resident chat interface (placeholder)
│   ├── marketing/             # Marketing website (placeholder)
│   ├── tenant-portal/         # Legacy app (currently active)
│   ├── assistant-tenant/      # (existing)
│   └── developer-dashboard/   # (existing)
├── packages/
│   ├── db/                    # Drizzle ORM + Supabase config
│   ├── api/                   # Shared API logic
│   ├── auth/                  # Authentication utilities
│   ├── ui/                    # Shared UI components
│   └── workers/               # Background workers
└── scripts/                   # Build and deployment scripts
```

## 🚀 Applications

### apps/admin-portal
**Status:** ✅ Fully implemented  
**Port:** 3000  
**Purpose:** Global administrative console for OpenHouse AI Platform

Contains all admin-specific routes and features:
- `/admin` - Admin dashboard
- `/admin/developments` - Development management
- `/admin/documents` - Document management
- `/admin/analytics` - Analytics and reporting

**Run:** `npm run dev:admin`

### apps/developer-portal
**Status:** 🚧 Placeholder  
**Port:** 3001  
**Purpose:** Developer-facing dashboard for managing property developments

Future features:
- Development management
- AI assistant configuration
- Document upload and management
- Analytics and insights

**Run:** `npm run dev:developer`

### apps/resident-app
**Status:** 🚧 Placeholder  
**Port:** 3002  
**Purpose:** Resident-facing chat interface

Future features:
- AI-powered chat interface
- Property information access
- Maintenance requests
- Community updates

**Run:** `npm run dev:resident`

### apps/marketing
**Status:** 🚧 Placeholder with basic landing page  
**Port:** 3003  
**Purpose:** Marketing website for OpenHouse AI Platform

Current: Basic landing page showcasing platform features  
Future: Full marketing site with pricing, testimonials, blog

**Run:** `npm run dev:marketing`

### apps/tenant-portal
**Status:** ✅ Currently active (legacy)  
**Port:** 5000  
**Purpose:** Original Next.js app containing all routes

This is the current active application. Over time, routes will be migrated to the appropriate apps above.

**Run:** `npm run dev` or `npm run dev:tenant`

## 📦 Shared Packages

### packages/db
Drizzle ORM schema and database utilities. Single source of truth for all database operations.

**Key files:**
- `schema.ts` - Database schema definitions
- `drizzle.config.ts` - Drizzle configuration
- `seed.ts` - Database seeding scripts

### packages/api
Shared API utilities and functions used across applications.

### packages/auth
Authentication and authorization utilities.

### packages/ui
Shared React components used across applications.

### packages/workers
Background worker functions for document processing and training.

## 🛠️ Development Commands

### Running Individual Apps

```bash
# Admin Portal (port 3000)
npm run dev:admin

# Developer Portal (port 3001)
npm run dev:developer

# Resident App (port 3002)
npm run dev:resident

# Marketing Site (port 3003)
npm run dev:marketing

# Legacy Tenant Portal (port 5000) - Currently active
npm run dev
npm run dev:tenant
```

### Building

```bash
# Build main apps
npm run build

# Build all apps
npm run build:all
```

### Installing Dependencies

```bash
# Install all dependencies across the monorepo
npm run install:all
```

### Database Commands

```bash
# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema to database
npm run db:push

# Seed database
npm run db:seed

# Open Drizzle Studio
npm run db:studio

# Verify database connection
npm run db:verify
```

## 🔄 Migration Strategy

### Current State (Phase 1)
- ✅ Monorepo structure created
- ✅ Admin portal app extracted from tenant-portal
- ✅ Placeholder apps created for developer/resident/marketing
- ✅ All existing routes still functional in tenant-portal

### Future Phases
- **Phase 2:** Migrate developer routes from tenant-portal to developer-portal
- **Phase 3:** Migrate resident/public routes to resident-app
- **Phase 4:** Update workflows to use new apps
- **Phase 5:** Deprecate tenant-portal once all routes migrated

## 📝 Notes

- All apps share the same `packages/db` for database operations
- Each app can run independently on different ports
- The current active app is still `apps/tenant-portal` on port 5000
- No database schemas, Supabase configs, or AI logic were changed in this refactor
- This is purely a structural reorganization to support future growth

## ✅ Success Criteria

- [x] Separate folders for admin-portal, developer-portal, resident-app, marketing
- [x] Each app has its own package.json and dev script
- [x] Existing `/admin/developments/new` route still works
- [x] Can create developments successfully
- [x] Clear documentation of structure and commands

## 🎯 Next Steps

1. Test all new apps to ensure they start correctly
2. Begin migrating routes from tenant-portal to appropriate apps
3. Update deployment configuration for multi-app structure
4. Set up proper routing/proxy for production multi-tenant architecture
