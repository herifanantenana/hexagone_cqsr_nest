import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

dotenv.config();

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Running migrations...');

    const migrations = ['0000_initial.sql', '0001_views.sql'];

    for (const migration of migrations) {
      const filePath = path.join(__dirname, migration);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`Running migration: ${migration}`);
      await pool.query(sql);
      console.log(`Migration ${migration} completed`);
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
