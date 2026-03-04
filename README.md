# OpenHouse AI

AI-powered property management and homeowner aftercare platform.

**→ [Developer Setup Guide](./SETUP.md)**

## Products

- **Property Assistant** — AI chat for property developers and purchasers
- **OpenHouse Care** — Homeowner aftercare portal for renewable energy installers

## Quick Start

```bash
git clone https://github.com/sam-evolv/property-assistant.git
cd property-assistant
npm install
cp apps/unified-portal/.env.example apps/unified-portal/.env.local
# Fill in your Supabase and OpenAI keys in .env.local
npm run dev
```

See [SETUP.md](./SETUP.md) for the full guide including database setup, migrations, and deployment.

## Tech Stack

- **Framework**: Next.js 14 (App Router), TypeScript
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
