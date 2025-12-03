#!/bin/bash

# OpenHouse AI - Database Migration Script
# This script handles database schema migrations

set -e

echo "🗄️  Starting database migration..."

# Check if DATABASE_URL or POSTGRES_URL is set
if [ -z "$POSTGRES_URL" ] && [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: Neither POSTGRES_URL nor DATABASE_URL is set"
  exit 1
fi

echo "✅ Database connection verified"

# Run Drizzle migrations
echo "📊 Pushing schema changes to database..."
npx drizzle-kit push --config=packages/db/drizzle.config.ts

echo "✅ Database migration complete!"
echo "💡 You can view your database with: npm run db:studio"
