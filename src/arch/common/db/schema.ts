import { eq } from 'drizzle-orm';
import {
  pgTable,
  pgView,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Table principale des utilisateurs
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(), // UUID v4 généré par PostgreSQL
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  bio: text('bio'),
  avatarKey: varchar('avatar_key', { length: 500 }), // Chemin fichier sur disque
  avatarUrl: varchar('avatar_url', { length: 500 }), // URL publique de l'avatar
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Table des sessions (refresh tokens) — liée à users via FK cascade
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }), // Supprime les sessions si user supprimé
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(), // Hash bcrypt du refresh token
  revokedAt: timestamp('revoked_at', { withTimezone: true }), // null = session active
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  userAgent: varchar('user_agent', { length: 500 }), // Pour identifier l'appareil
  ip: varchar('ip', { length: 45 }), // IPv4 ou IPv6
});

// Vue publique : uniquement les infos visibles par les autres utilisateurs
export const userPublicView = pgView('user_public_view').as(
  (qb) =>
    qb
      .select({
        id: users.id,
        displayName: users.displayName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.status, 'active')), // Exclut les comptes désactivés
);

// Vue "me" : toutes les infos du profil (sauf passwordHash)
export const userMeView = pgView('user_me_view').as((qb) =>
  qb
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users),
);
