-- Add columns for publish workflow (WS-10)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS medium_post_id text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS published_at timestamptz;
