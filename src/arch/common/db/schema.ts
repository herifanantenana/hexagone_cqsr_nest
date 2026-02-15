// Schéma Drizzle : source de vérité pour la structure de la base PostgreSQL
// Les migrations SQL sont générées à partir de ce fichier (drizzle-kit generate)
// Les vues servent de read models optimisés pour les queries CQRS

import { eq } from 'drizzle-orm';
import {
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ─── Table Users ─────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(), // UUID v4 généré par PostgreSQL
  email: varchar('email', { length: 255 }).notNull().unique(), // Contrainte UNIQUE pour éviter les doublons
  passwordHash: varchar('password_hash', { length: 255 }).notNull(), // bcrypt hash (60 chars, marge à 255)
  displayName: varchar('display_name', { length: 100 }).notNull(),
  bio: text('bio'), // Nullable : optionnel dans le profil
  avatarKey: varchar('avatar_key', { length: 500 }), // Chemin fichier local (ex: avatars/uuid.jpg)
  avatarUrl: varchar('avatar_url', { length: 500 }), // URL publique servie par express static
  status: varchar('status', { length: 20 }).notNull().default('active'), // active | inactive | banned
  createdAt: timestamp('created_at', { withTimezone: true }) // withTimezone → stocke en UTC
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Table Sessions ──────────────────────────────────────────────────────────
// Une session = un refresh token actif. Plusieurs sessions par user (multi-device).
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }), // Cascade : supprime les sessions si user supprimé
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(), // Hash du refresh token (jamais stocké en clair)
  revokedAt: timestamp('revoked_at', { withTimezone: true }), // Null = active, non-null = révoquée (logout)
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // Durée de vie du refresh token (7j par défaut)
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  userAgent: varchar('user_agent', { length: 500 }), // Pour identifier le device (optionnel)
  ip: varchar('ip', { length: 45 }), // IPv6 max = 45 chars
});

// ─── Table Posts ─────────────────────────────────────────────────────────────
// owner_id FK → users.id avec cascade (supprime les posts si user supprimé)
// visibility : 'public' (visible par tous) ou 'private' (owner uniquement)
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }), // Cascade : supprime les posts si user supprimé
  title: varchar('title', { length: 255 }).notNull(), // Contrainte longueur max 255 (validée aussi côté DTO)
  content: text('content').notNull(), // text = pas de limite de longueur côté DB
  visibility: varchar('visibility', { length: 20 }).notNull().default('public'), // 'public' | 'private'
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Vues (read models pour les queries CQRS) ──────────────────────────────

// Vue profil public : exclut email/password, filtre les users inactifs
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
      .where(eq(users.status, 'active')), // Seuls les users actifs sont visibles publiquement
);

// Vue profil personnel : inclut email et status (pour l'utilisateur connecté)
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

// Vue publique des posts : join avec users pour le displayName de l'auteur
// Filtrée sur visibility = 'public' uniquement (les posts privés ne sont jamais dans cette vue)
export const postsPublicView = pgView('posts_public_view').as((qb) =>
  qb
    .select({
      id: posts.id,
      ownerId: posts.ownerId,
      title: posts.title,
      content: posts.content,
      visibility: posts.visibility,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      ownerDisplayName: users.displayName, // Dénormalisé dans la vue pour éviter un join côté app
    })
    .from(posts)
    .innerJoin(users, eq(posts.ownerId, users.id))
    .where(eq(posts.visibility, 'public')),
);

// ─── Table Conversations ────────────────────────────────────────────────────
// Une conversation regroupe des membres qui echangent des messages
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }), // Createur de la conversation
  title: varchar('title', { length: 255 }), // Optionnel : nom de la conversation
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Table Conversation Members ─────────────────────────────────────────────
// Relation N:N entre conversations et users (PK composite = UNIQUE implicite)
export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
  }),
);

// ─── Table Messages ─────────────────────────────────────────────────────────
// Les messages envoyes dans une conversation
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
