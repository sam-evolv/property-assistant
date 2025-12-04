import type { Config } from "drizzle-kit";
import path from "path";

// Supabase is the single source of truth for migrations
// Use SUPABASE_DB_URL for all schema operations
export default {
  schema: path.resolve(__dirname, "./schema.ts"),
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  },
} satisfies Config;
