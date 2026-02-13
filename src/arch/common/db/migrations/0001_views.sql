-- Create user_public_view
CREATE OR REPLACE VIEW "user_public_view" AS
SELECT
  id,
  display_name,
  bio,
  avatar_url,
  created_at
FROM users
WHERE status = 'active';

-- Create user_me_view
CREATE OR REPLACE VIEW "user_me_view" AS
SELECT
  id,
  email,
  display_name,
  bio,
  avatar_url,
  status,
  created_at,
  updated_at
FROM users;
