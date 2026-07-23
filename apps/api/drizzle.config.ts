import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { findRepoRootEnvFile } from './src/config/root-env';

// Local dev: pick up the monorepo root .env so `npm run db:generate` works
// without needing DATABASE_URL exported in the shell.
const rootEnvFile = findRepoRootEnvFile();
if (rootEnvFile) loadDotenv({ path: rootEnvFile });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://intra:intra@localhost:5432/intra',
  },
  casing: 'snake_case',
});
