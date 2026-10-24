import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Carrega o .env para o drizzle-kit conseguir ler DATABASE_URL.
config({ path: ".env" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
