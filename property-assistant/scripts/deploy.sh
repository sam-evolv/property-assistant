#!/bin/bash

# OpenHouse AI - Deployment Script
# This script handles production deployment to Replit

set -e

echo "🚀 Starting OpenHouse AI Deployment..."

# Check if required environment variables are set
required_vars=("POSTGRES_URL" "NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "OPENAI_API_KEY")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Error: $var is not set"
    exit 1
  fi
done

echo "✅ Environment variables verified"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build all applications
echo "🏗️  Building applications..."
npm run build

# Run database migrations
echo "🗄️  Running database migrations..."
npm run db:push

echo "✅ Deployment complete!"
echo "🎉 Your OpenHouse AI platform is ready!"
