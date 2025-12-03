# 🚀 Deploy OpenHouse AI Schema to Supabase from Local Machine

This guide walks you through deploying your complete OpenHouse AI database schema from your local machine to your Supabase PostgreSQL database.

---

## 📋 Prerequisites

Before you begin, ensure you have:

1. ✅ **Node.js** installed (v18 or higher)
2. ✅ **npm** package manager
3. ✅ **Supabase account** with a project created
4. ✅ **Supabase database credentials** (connection string)

---

## 🔧 Step-by-Step Deployment Guide

### **Step 1: Download the Project**

You already have the project archive available in this Replit workspace:

```bash
# The file is: openhouse-ai-project.tar.gz
# Download it to your local machine via the Replit file browser
# (Right-click → Download)
```

---

### **Step 2: Extract and Navigate to Project**

On your local machine:

```bash
# Extract the project
tar -xzf openhouse-ai-project.tar.gz

# Navigate to the project directory
cd openhouse-ai-project
```

---

### **Step 3: Install Dependencies**

```bash
# Install all project dependencies
npm install

# This will install:
# - drizzle-kit (for migrations)
# - drizzle-orm (for database operations)
# - pg (PostgreSQL driver)
# - All other dependencies
```

---

### **Step 4: Get Your Supabase Connection String**

1. **Log in to Supabase**: https://app.supabase.com
2. **Select your project**: `qgkyuaagcrrynnkipbad` (or your project)
3. **Go to**: Project Settings → Database
4. **Find**: Connection string → URI
5. **Copy the connection string** - it should look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.qgkyuaagcrrynnkipbad.supabase.co:5432/postgres
   ```

**Your connection string:**
```
postgresql://postgres:Munsterman99$evolv@db.qgkyuaagcrrynnkipbad.supabase.co:5432/postgres
```

⚠️ **Important**: The `$` character in your password needs to be URL-encoded as `%24` for environment variables:
```
postgresql://postgres:Munsterman99%24evolv@db.qgkyuaagcrrynnkipbad.supabase.co:5432/postgres
```

---

### **Step 5: Create Local Environment File**

Create a `.env` file in the project root:

```bash
# Create the .env file
touch .env

# Open it in your text editor (VS Code, nano, vim, etc.)
code .env  # or nano .env
```

Add this content to `.env`:

```env
# Supabase Database Connection
SUPABASE_DB_URL=postgresql://postgres:Munsterman99%24evolv@db.qgkyuaagcrrynnkipbad.supabase.co:5432/postgres

# Optional: Other environment variables
NEXT_PUBLIC_SUPABASE_URL=https://qgkyuaagcrrynnkipbad.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

### **Step 6: Update Drizzle Configuration**

Open `packages/db/drizzle.config.ts` and update it:

```typescript
import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export default {
  schema: "./schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL!,
  },
} satisfies Config;
```

---

### **Step 7: Verify Environment Variable is Loaded**

Test that your environment variable is set correctly:

```bash
# On macOS/Linux:
echo $SUPABASE_DB_URL

# On Windows PowerShell:
echo $env:SUPABASE_DB_URL

# You should see (with masked password):
# postgresql://postgres:***@db.qgkyuaagcrrynnkipbad.supabase.co:5432/postgres
```

If the variable is empty, load it manually:

```bash
# On macOS/Linux:
export SUPABASE_DB_URL="postgresql://postgres:Munsterman99%24evolv@db.qgkyuaagcrrynnkipbad.supabase.co:5432/postgres"

# On Windows PowerShell:
$env:SUPABASE_DB_URL="postgresql://postgres:Munsterman99%24evolv@db.qgkyuaagcrrynnkipbad.supabase.co:5432/postgres"
```

---

### **Step 8: Push Schema to Supabase**

Navigate to the database package and push the schema:

```bash
# Navigate to the db package
cd packages/db

# Push the schema to Supabase
npx drizzle-kit push
```

**Expected Output:**

```
Reading config file '/path/to/packages/db/drizzle.config.ts'
Using 'pg' driver for database querying
[✓] Pulling schema from database...

Detected schema changes:
+ Create table "tenants"
+ Create table "admins"
+ Create table "units"
+ Create table "tickets"
+ Create table "faqs"
+ Create table "contacts"
+ Create table "issue_types"
+ Create table "noticeboard_posts"
+ Create table "documents"
+ Create table "document_versions"
+ Create table "audit_log"
+ Create table "feature_flags"
+ Create table "pois"
+ Create table "messages"
+ Create table "analytics_daily"
... (and 8 more tables)

✓ Tables created successfully
```

---

### **Step 9: Verify Tables in Supabase**

1. **Open Supabase Dashboard**: https://app.supabase.com
2. **Select your project**: `qgkyuaagcrrynnkipbad`
3. **Navigate to**: Table Editor (left sidebar)
4. **Verify tables** appear under the `public` schema:

**Expected Tables (23 total):**

✅ Core Multi-Tenant:
- `tenants` - Tenant/property configurations
- `admins` - Administrator accounts
- `user_roles` - User role definitions

✅ Property Management:
- `units` - Property units with resident info
- `tickets` - Support ticket system
- `issue_types` - Ticket categorization
- `contacts` - Contact directory

✅ Content & Knowledge:
- `faqs` - FAQ library with embeddings
- `noticeboard_posts` - Notices with scheduling (priority, start_date, end_date, active)
- `notices` - Legacy notices
- `documents` - Document management
- `document_versions` - Document version control
- `docs` - Documentation system
- `doc_chunks` - Document embeddings

✅ Communication:
- `messages` - Chat message history
- `feedback` - User feedback collection

✅ Analytics:
- `analytics_daily` - Daily metrics aggregation

✅ System:
- `audit_log` - Activity logging
- `feature_flags` - Feature toggles
- `jobs` - Background job tracking
- `phases` - Project phases
- `rate_events` - Rate limiting

✅ Geospatial:
- `pois` - Points of interest

---

### **Step 10: Verify Table Structure**

Click on any table (e.g., `noticeboard_posts`) and verify columns:

**Expected columns for `noticeboard_posts`:**
- `id` (uuid, primary key)
- `tenant_id` (uuid, foreign key → tenants)
- `title` (text)
- `content` (text)
- `author_id` (uuid, foreign key → admins)
- `priority` (integer) ✨
- `start_date` (timestamp) ✨
- `end_date` (timestamp) ✨
- `active` (boolean) ✨
- `created_at` (timestamp)
- `updated_at` (timestamp)

✨ = Enhanced fields for scheduling notices

---

### **Step 11: Test Database Connection**

Run a simple query to verify the connection works:

```bash
# From the project root
npx tsx -e "
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL
});

await client.connect();
const db = drizzle(client);

console.log('✅ Connected to Supabase!');
console.log('Testing query...');

const result = await client.query('SELECT COUNT(*) FROM tenants');
console.log('Tenants count:', result.rows[0].count);

await client.end();
"
```

---

## 🎯 Success Criteria

Your deployment is successful when:

✅ All 23 tables appear in Supabase Table Editor  
✅ Table structures match your schema (columns, types, constraints)  
✅ Foreign key relationships are established  
✅ Indexes are created (check in SQL Editor)  
✅ No error messages during `drizzle-kit push`  

---

## 🔄 Alternative Method: Using Supabase SQL Editor

If `drizzle-kit push` doesn't work, you can also generate SQL and run it manually:

```bash
# Generate SQL migration files
npx drizzle-kit generate

# This creates SQL files in ./drizzle folder
# Copy the SQL and paste into Supabase SQL Editor
```

Then:
1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Paste the generated SQL
4. Click "Run"

---

## 🐛 Troubleshooting

### **Issue: "ENOTFOUND" or "Connection refused"**

**Solution:**
- Verify your connection string is correct
- Check if your IP is allowed in Supabase (Database Settings → Connection Pooling)
- Ensure you're using the correct password (URL-encoded if necessary)

### **Issue: "Role does not exist"**

**Solution:**
- Make sure you're using the `postgres` user
- Verify your Supabase project is active

### **Issue: "Permission denied"**

**Solution:**
- Ensure you're using the database password, not the project password
- Check that your connection string includes the full credentials

### **Issue: Drizzle can't find schema**

**Solution:**
```bash
# Make sure you're in the packages/db directory
cd packages/db

# Then run the push command
npx drizzle-kit push
```

---

## 📊 Next Steps After Deployment

Once your schema is deployed to Supabase:

1. **Seed the database** with initial data:
   ```bash
   npm run db:seed
   ```

2. **Update your app** to use Supabase in production:
   - Update `packages/db/client.ts` to use `SUPABASE_DB_URL` in production
   - Set environment variables in your hosting platform (Vercel, Railway, etc.)

3. **Set up Row Level Security (RLS)** in Supabase:
   - Go to Table Editor → Select a table → RLS tab
   - Create policies for multi-tenant data isolation

4. **Enable real-time subscriptions** (optional):
   - Go to Database → Replication
   - Enable replication for tables you want to subscribe to

---

## ✅ Deployment Complete!

Your OpenHouse AI schema is now deployed to Supabase and ready for production use! 🎉

**Connection String for Production:**
```
postgresql://postgres:Munsterman99%24evolv@db.qgkyuaagcrrynnkipbad.supabase.co:5432/postgres
```

---

## 📞 Support

If you encounter issues:
- Check Supabase Status: https://status.supabase.com
- Supabase Docs: https://supabase.com/docs
- Drizzle Docs: https://orm.drizzle.team/docs/overview
