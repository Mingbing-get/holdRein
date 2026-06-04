import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    url: process.env.SQLITE_DB_PATH ?? "./data/hold-rein.sqlite"
  },
  dialect: "sqlite",
  out: "./drizzle",
  schema: "./src/db/schema.ts"
});
