-- ALOHA Health display preferences. Not canonical HealthConcern facts.
-- An authenticated user's point/attention is scoped to their own Space Person.
CREATE TABLE IF NOT EXISTS health_concern_presentation (
  space_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  concern_id TEXT NOT NULL,
  attention TEXT NOT NULL DEFAULT 'unset' CHECK (attention IN ('unset','routine','watch','priority')),
  view TEXT CHECK (view IS NULL OR view IN ('front','back')),
  asset_id TEXT,
  x REAL CHECK (x IS NULL OR (x >= 0 AND x <= 1)),
  y REAL CHECK (y IS NULL OR (y >= 0 AND y <= 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (space_id,user_id,person_id,concern_id),
  CHECK (
    (view IS NULL AND asset_id IS NULL AND x IS NULL AND y IS NULL)
    OR (view IS NOT NULL AND asset_id IS NOT NULL AND x IS NOT NULL AND y IS NOT NULL)
  )
);
