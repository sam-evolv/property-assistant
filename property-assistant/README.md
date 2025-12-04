# OpenHouse AI - Monorepo

Welcome to the OpenHouse AI monorepo. This repository contains multiple applications and shared packages for our multi-tenant property management platform.

## 📁 Repository Structure

```
openhouse-ai-monorepo/
├── apps/
│   ├── assistant-tenant/     # Resident-facing Property Assistant (Next.js 14)
│   └── master-admin/          # Multi-tenant Master Admin Console (Next.js 15)
├── packages/
│   ├── db/                    # Shared database schemas and utilities
│   ├── auth/                  # Shared authentication logic
│   ├── ui/                    # Shared UI components
│   └── workers/               # Background jobs and workers
├── package.json               # Root package.json with workspace configuration
└── README.md                  # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (optional, for full functionality)
- Environment variables configured (see documentation in each app)

### Installation

Install dependencies for all apps:
```bash
npm run install:all
```

Or install individually:
```bash
# Root dependencies (concurrently)
npm install

# Tenant Assistant app
cd apps/assistant-tenant && npm install

# Master Admin app
cd apps/master-admin && npm install
```

### Development

Run both applications simultaneously:
```bash
npm run dev
```

This will start:
- **Property Assistant** on `http://localhost:5000`
- **Master Admin** on `http://localhost:3000`

Run applications individually:
```bash
# Tenant Assistant only
npm run dev:assistant

# Master Admin only
npm run dev:master
```

## 📦 Applications

### Property Assistant (`apps/assistant-tenant`)
Multi-tenant resident-facing application featuring:
- AI-powered chat with RAG document search
- Intelligent model routing (GPT-3.5/GPT-4)
- Live Google Maps integration with POI filtering
- Resident onboarding via QR codes
- Analytics dashboard
- Dark/light mode with premium UI/UX

**Tech Stack:** Next.js 14, TypeScript, PostgreSQL, OpenAI API, Google Maps

**Documentation:** [apps/assistant-tenant/README.md](apps/assistant-tenant/README.md)

### Master Admin (`apps/master-admin`)
Multi-tenant management console for OpenHouse AI platform administrators.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui

## 🏗️ Shared Packages

### `packages/db`
Database schemas, migrations, and utilities shared across applications.

### `packages/auth`
Authentication and authorization logic for multi-tenant access control.

### `packages/ui`
Shared React components and design system.

### `packages/workers`
Background job processors and scheduled tasks.

## 🔧 Scripts

- `npm run dev` - Run both apps concurrently
- `npm run dev:assistant` - Run Property Assistant only
- `npm run dev:master` - Run Master Admin only
- `npm run build` - Build both applications for production
- `npm run install:all` - Install dependencies for all apps

## 🌐 Environment Variables

Each application has its own environment variables. See individual app documentation:

**Property Assistant:**
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `GOOGLE_MAPS_API_KEY` - Google Maps JavaScript API key
- `SESSION_SECRET` - Session encryption secret

**Master Admin:**
- TBD based on implementation needs

## 📚 Documentation

- [Property Assistant README](apps/assistant-tenant/README.md)
- [Property Assistant Setup Guide](apps/assistant-tenant/SETUP.md)
- [Operator Runbook](apps/assistant-tenant/OPERATOR_RUNBOOK.md)
- [Replit Project Notes](replit.md)

## 🤝 Contributing

This is a private monorepo for OpenHouse AI. For contribution guidelines, please contact the development team.

## 📄 License

Proprietary - All rights reserved © 2025 OpenHouse AI

---

**Need Help?** Check the individual app READMEs or contact the development team.
