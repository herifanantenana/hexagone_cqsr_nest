import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

// Script standalone exécuté via ts-node pour peupler la DB en dev
dotenv.config();

async function seed() {
  // Connexion directe (pas via NestJS) — script indépendant
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Starting seed...');

    // Hash partagé entre tous les users de test (salt rounds = 10)
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // ON CONFLICT DO NOTHING → idempotent, peut être relancé sans erreur
    await pool.query(
      `
      INSERT INTO users (email, password_hash, display_name, bio, status)
      VALUES
        ('john@example.com', $1, 'John Doe', 'Software engineer passionate about clean architecture', 'active'),
        ('jane@example.com', $1, 'Jane Smith', 'Full-stack developer', 'active'),
        ('bob@example.com', $1, 'Bob Johnson', 'Backend specialist', 'active')
      ON CONFLICT (email) DO NOTHING;
    `,
      [passwordHash],
    );

    console.log('Seed completed successfully');
    console.log('Test users created with password: Password123!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void seed();
