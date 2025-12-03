import type { Config } from "drizzle-kit";
import path from "path";

export default {
  schema: path.resolve(__dirname, "./schema.ts"),
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  },
} satisfies Config;
