import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

// Script standalone exécuté via tsx pour peupler la DB en dev
// Idempotent grâce à ON CONFLICT DO NOTHING → peut être relancé sans erreur
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

    // ─── Users ────────────────────────────────────────────────────────────────
    // ON CONFLICT DO NOTHING → idempotent, peut être relancé sans erreur
    const usersResult = await pool.query(
      `
      INSERT INTO users (email, password_hash, display_name, bio, status)
      VALUES
        ('john@example.com', $1, 'John Doe', 'Software engineer passionate about clean architecture', 'active'),
        ('jane@example.com', $1, 'Jane Smith', 'Full-stack developer', 'active'),
        ('bob@example.com', $1, 'Bob Johnson', 'Backend specialist', 'active')
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email;
    `,
      [passwordHash],
    );

    console.log(`Users seeded: ${usersResult.rowCount} created`);

    // Récupère les IDs des users pour créer les posts
    const usersRows = await pool.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email IN ('john@example.com', 'jane@example.com', 'bob@example.com')`,
    );
    const userMap = new Map<string, string>();
    for (const row of usersRows.rows) {
      userMap.set(row.email, row.id);
    }

    const johnId = userMap.get('john@example.com');
    const janeId = userMap.get('jane@example.com');
    const bobId = userMap.get('bob@example.com');

    // ─── Posts ────────────────────────────────────────────────────────────────
    // Mix de posts publics et privés pour tester les endpoints
    if (johnId && janeId && bobId) {
      const postsResult = await pool.query(
        `
        INSERT INTO posts (owner_id, title, content, visibility)
        VALUES
          ($1, 'Getting Started with Hexagonal Architecture', 'Hexagonal architecture separates your domain logic from external concerns like databases, HTTP, and message queues. The key idea is that the domain sits at the center and communicates with the outside world through ports and adapters.', 'public'),
          ($1, 'My CQRS Notes', 'Command Query Responsibility Segregation splits reads and writes into separate models. Commands mutate state, queries return data. This pairs well with event sourcing and hexagonal architecture.', 'private'),
          ($2, 'NestJS Tips & Tricks', 'NestJS provides a powerful module system that works great with hexagonal architecture. Use custom providers to bind your domain ports to infrastructure adapters.', 'public'),
          ($2, 'Draft: Conference Talk Ideas', 'Some ideas for my next talk: DDD in TypeScript, CQRS patterns with NestJS, Testing hexagonal apps...', 'private'),
          ($3, 'Why PostgreSQL is Awesome', 'PostgreSQL offers powerful features like JSONB columns, CTEs, window functions, and excellent indexing support. Combined with Drizzle ORM, it provides type-safe database access in TypeScript.', 'public'),
          ($3, 'Backend Best Practices', 'Always validate at system boundaries. Use domain errors instead of HTTP exceptions in your business logic. Keep your domain layer free of framework dependencies.', 'public')
        ON CONFLICT DO NOTHING;
      `,
        [johnId, janeId, bobId],
      );

      console.log(`Posts seeded: ${postsResult.rowCount} created`);
    }

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
