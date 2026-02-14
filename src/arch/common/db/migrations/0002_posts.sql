-- Migration : ajout de la table posts et de la vue posts_public_view

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index sur owner_id pour accélérer les requêtes par propriétaire
CREATE INDEX IF NOT EXISTS idx_posts_owner_id ON posts(owner_id);
-- Index sur visibility pour filtrer les posts publics
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);

-- Vue publique des posts avec le nom de l'auteur
CREATE OR REPLACE VIEW posts_public_view AS
  SELECT
    p.id,
    p.owner_id,
    p.title,
    p.content,
    p.visibility,
    p.created_at,
    p.updated_at,
    u.display_name AS owner_display_name
  FROM posts p
  INNER JOIN users u ON p.owner_id = u.id
  WHERE p.visibility = 'public';
