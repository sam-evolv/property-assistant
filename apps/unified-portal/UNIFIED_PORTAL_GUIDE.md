# Unified Portal Architecture Guide

## 🎯 Overview
The Unified Portal consolidates the Developer Portal and Tenant Portal into a single Next.js application with role-based routing. This simplifies deployment, reduces code duplication, and provides a seamless experience across all user types.

## 🏗️ Route Structure

### Public Routes (No Authentication Required)
- `/` - Root page, redirects to `/login`
- `/login` - Shared login page with role-based redirection
- `/homes/:unitUid` - Resident QR code experience (no auth required)
- `/test-hub` - Development test harness (dev only)

### Authenticated Routes (Role-Based Access)

#### Developer Routes (`/developer`)
**Required Role:** `developer` or `admin`

```
/developer
├── page.tsx                    # Developer dashboard homepage
├── dashboard-client.tsx        # Client component for dashboard UI
├── documents/                  # Document management
├── homeowners/                 # Homeowner directory
└── noticeboard/               # Notice board management
```

**Features:**
- Development analytics and insights
- Unit management
- Homeowner management
- Document uploads and training
- Notice board for resident communications

#### Super Admin Routes (`/super`)
**Required Role:** `super_admin`

```
/super
├── page.tsx                    # Super admin dashboard homepage
├── overview-client.tsx         # Enterprise overview dashboard
├── nav-client.tsx             # Navigation component
├── layout.tsx                 # Super admin layout wrapper
├── analytics/                 # Platform-wide analytics
├── chat-analytics/            # Chat usage analytics
├── dashboard/                 # Admin dashboard
├── developers/                # Developer management
├── developments/              # All developments view
├── documents/                 # Document explorer
├── homeowners/                # Cross-tenant homeowners
├── rag/                       # RAG analytics and performance
├── system-logs/               # System logs viewer
├── training-jobs/             # Training job queue
└── units/                     # Cross-tenant units explorer
```

**Features:**
- Cross-tenant analytics and reporting
- System monitoring and logs
- RAG performance metrics
- Platform-wide user management
- Developer account management
- Training job monitoring

#### Resident Routes (`/homes/:unitUid`)
**Required Role:** None (public QR code access)

**Features:**
- AI chat assistant for property questions
- Contextual greeting based on unit data
- Document-grounded responses (RAG)
- Mobile-optimized interface

## 🔐 Authentication Flow

### Login Process
1. User visits `/login`
2. Enters credentials (email + password)
3. Server authenticates via Supabase
4. Fetch user role from `/api/auth/me`
5. Redirect based on role:
   - `super_admin` → `/super`
   - `developer` or `admin` → `/developer`
   - Other → `/dashboard`

### Middleware Protection
**File:** `middleware.ts`

- All routes protected by default (requires authentication)
- Exceptions:
  - `/login` - Login page
  - `/homes/*` - Public resident QR routes
  - `/test-hub` - Dev-only test harness
  - `/api/*` - API routes
  - Static files

### Session Management
- Supabase Auth handles JWT tokens
- Middleware refreshes session on each request
- Session data stored in cookies
- `getServerSession()` fetches admin role from database

## 🧪 Test Hub (`/test-hub`)

The Test Hub provides quick access to test accounts and portal views during development.

**Features:**
- One-click login for test accounts
- Quick links to all major portal sections
- Route documentation
- Available only in development mode

**Test Accounts:**
- Super Admin: `sam@evolvai.ie`
- Developer A: `developer-a@test.com`
- Developer B: `developer-b@test.com`

**Usage:**
```bash
# Navigate to test hub
http://localhost:5000/test-hub

# Click quick login button for any test account
# Password: test123 (auto-filled via /api/auth/test-login)
```

## 🔧 Development

### Running the Portal
```bash
# Start unified portal (uses PORT env var, defaults to 3000)
cd apps/unified-portal
npm run dev

# In Replit (port 5000 for webview):
PORT=5000 npm run dev

# Access at http://localhost:3000 (or 5000 in Replit)
```

### Port Configuration (Dual-Port Strategy)
- **Default Port:** 3000 (Next.js default when PORT env var not set)
- **Replit Port:** 5000 (overridden via PORT=5000 in workflow for webview compliance)
- **Package.json:** Scripts use `--hostname 0.0.0.0` without hardcoded port, allowing Next.js to respect PORT env var
- **Why Dual-Port?** 
  - Replit webview REQUIRES port 5000 for frontend preview
  - Production deployments standardize on port 3000 (Next.js default)
  - PORT env var reconciles both requirements without code changes

**Port Verification:**
```bash
# Local development (Next.js defaults to 3000)
npm run dev
# Access at http://localhost:3000

# Replit development (workflow sets PORT=5000)
PORT=5000 npm run dev
# Access at http://localhost:5000

# Production (explicit port override)
PORT=8080 npm start
# Access at http://localhost:8080

# Verify current configuration
echo $PORT  # If set, Next.js uses this; otherwise defaults to 3000
```

**Deployment Notes:**
- **Replit:** Workflow automatically sets PORT=5000 for webview
- **Vercel/Netlify:** Uses PORT=3000 by default
- **Docker:** Set PORT env var in container config
- **AWS/GCP:** Set PORT via environment variables

### Environment Variables
```bash
DATABASE_URL=postgres://...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SESSION_SECRET=your-secret
```

## 📂 API Routes

### Shared API Routes
All API routes from both portals are available:

**Authentication:**
- `POST /api/auth/login` - Login endpoint
- `GET /api/auth/me` - Get current user session
- `POST /api/auth/test-login` - Dev-only test login

**Developer APIs:**
- `GET /api/developments` - List developments
- `GET /api/developments/:id` - Development details
- `POST /api/train` - Start document training
- `POST /api/chat` - Chat with AI assistant
- `GET /api/documents` - List documents
- `POST /api/homeowners` - Create homeowner

**Super Admin APIs:**
- `GET /api/admin/analytics/overview` - Platform analytics
- `GET /api/admin/analytics/chat` - Chat analytics
- `GET /api/admin/analytics/rag` - RAG performance
- `GET /api/admin/system-logs` - System logs
- `GET /api/admin/units` - All units
- `GET /api/tenants` - List all tenants

**Resident APIs:**
- `GET /api/houses/resolve?code=:unitCode` - Resolve unit by QR code
- `POST /api/chat` - Chat with AI (includes houseId context)

## 🎨 Theming & UI

### Design System
- **Primary Color:** Gold (#D4AF37)
- **Components:** Located in `/components`
- **Shared Components:** Premium UI library from `@openhouse/ui`

### Premium Components
- `PremiumButton` - Gold gradient buttons
- `PremiumCard` - Cards with subtle shadows
- `PremiumInput` - Inputs with gold focus states
- `PremiumSectionHeader` - Consistent section headers

### Enterprise Components
Located in `/components/admin-enterprise/`:
- `DataTable.tsx` - Sortable, filterable tables
- `InsightCard.tsx` - Metric display cards
- `LoadingState.tsx` - Skeleton loaders
- `charts/` - Recharts wrappers (LineChart, BarChart, etc.)

## 🚀 Deployment

### Production Build
```bash
cd apps/unified-portal
npm run build
npm run start
```

### Deployment Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] API keys set as secrets
- [ ] Port 5000 exposed
- [ ] SSL/TLS configured
- [ ] Domain routing configured

## 📊 Database Schema

### Key Tables
- `admins` - Developer and super admin accounts
- `developments` - Real estate developments
- `units` - Property units
- `homeowners` - Resident accounts
- `documents` - Uploaded documents
- `doc_chunks` - Vector embeddings for RAG
- `messages` - Chat history
- `training_jobs` - Background processing queue

### Multi-Tenancy
All queries scoped by `tenant_id` for data isolation.

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Restart workflow
npm run dev
```

### Login Redirects to Wrong Page
Check `/api/auth/me` response - ensure admin role is set correctly in database.

### QR Code Route Requires Auth
Verify middleware.ts has `isHomesRoute` exception.

### Fast Refresh Warnings
Normal during development - Next.js reloading due to file changes.

## 📝 Migration Notes

### From Separate Portals
1. Developer Portal (port 3001) → `/developer` routes
2. Tenant Portal (port 5000) → `/homes/:unitUid` routes
3. Enterprise Admin → `/super` routes
4. Shared login on `/login` with role-based routing

### Breaking Changes
- Port changed from 3001 → 5000
- Route structure changed (flat → hierarchical)
- Authentication now centralized
- Test accounts use `/api/auth/test-login`

## 🎯 Next Steps

### Performance Optimization
- [ ] Implement lazy loading for heavy components
- [ ] Add Suspense boundaries around data fetching
- [ ] Optimize DataTable with virtual scrolling
- [ ] Implement proper memoization with stable props

### Feature Enhancements
- [ ] Role-based UI customization
- [ ] White-label theming per tenant
- [ ] Real-time notifications
- [ ] Advanced analytics dashboards

### Testing
- [ ] E2E tests for auth flow
- [ ] Unit tests for role-based routing
- [ ] Integration tests for API endpoints
- [ ] Load testing for RAG chat

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Drizzle ORM](https://orm.drizzle.team)
- [Replit Deployment Guide](https://docs.replit.com)

---

**Last Updated:** November 21, 2025
**Version:** 1.0.0
**Maintained By:** Evolv AI Team
