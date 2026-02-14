import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Config drizzle-kit : utilisé par les commandes `drizzle-kit generate` et `drizzle-kit push`
dotenv.config();

export default defineConfig({
  schema: './src/arch/common/db/schema.ts', // Source du schema Drizzle (tables, vues)
  out: './src/arch/common/db/migrations', // Dossier de sortie des migrations SQL générées
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://arakotom:herifanantenana@localhost:5432/test_arch',
  },
});
