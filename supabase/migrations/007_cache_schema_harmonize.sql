-- Harmonize api_cache schema to use cache_key consistently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='api_cache' AND column_name='cache_key'
  ) THEN
    ALTER TABLE api_cache ADD COLUMN cache_key TEXT;
  END IF;
END $$;

-- Backfill cache_key from legacy key column if present and cache_key is null
UPDATE api_cache SET cache_key = key WHERE cache_key IS NULL AND key IS NOT NULL;

-- Enforce uniqueness on cache_key when possible
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_api_cache_cache_key'
  ) THEN
    CREATE UNIQUE INDEX idx_api_cache_cache_key ON api_cache(cache_key);
  END IF;
END $$;

-- Ensure params_hash exists and is indexed (used by edge function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='api_cache' AND column_name='params_hash'
  ) THEN
    ALTER TABLE api_cache ADD COLUMN params_hash CHAR(64);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_api_cache_params_hash'
  ) THEN
    CREATE INDEX idx_api_cache_params_hash ON api_cache(params_hash);
  END IF;
END $$;

-- Helpful composite index for observability dashboards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_api_cache_api_endpoint'
  ) THEN
    CREATE INDEX idx_api_cache_api_endpoint ON api_cache(api_name, endpoint);
  END IF;
END $$;

-- Cache schema harmonization migration
-- Adds missing columns and indices to support edge function operations

-- Add cache_key column if it doesn't exist (human-readable cache key)
ALTER TABLE api_cache ADD COLUMN IF NOT EXISTS cache_key TEXT;

-- Add additional metadata columns if they don't exist
ALTER TABLE api_cache ADD COLUMN IF NOT EXISTS api_name TEXT;
ALTER TABLE api_cache ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE api_cache ADD COLUMN IF NOT EXISTS params_hash TEXT;
ALTER TABLE api_cache ADD COLUMN IF NOT EXISTS status_code INTEGER;
ALTER TABLE api_cache ADD COLUMN IF NOT EXISTS size_bytes INTEGER;

-- Create index on cache_key for efficient lookups
CREATE INDEX IF NOT EXISTS idx_api_cache_cache_key ON api_cache(cache_key);

-- Create index on params_hash for parameter-based queries
CREATE INDEX IF NOT EXISTS idx_api_cache_params_hash ON api_cache(params_hash);

-- Create composite index for api_name + endpoint queries
CREATE INDEX IF NOT EXISTS idx_api_cache_api_endpoint ON api_cache(api_name, endpoint);

-- Create index on expires_at for TTL management
CREATE INDEX IF NOT EXISTS idx_api_cache_expires_at ON api_cache(expires_at);

-- Create index on last_accessed for cleanup queries
CREATE INDEX IF NOT EXISTS idx_api_cache_last_accessed ON api_cache(last_accessed);

-- Add a comment to document the purpose of new columns
COMMENT ON COLUMN api_cache.cache_key IS 'Human-readable cache key for debugging and monitoring';
COMMENT ON COLUMN api_cache.api_name IS 'API identifier (e.g., congress, openstates)';
COMMENT ON COLUMN api_cache.endpoint IS 'API endpoint path without query parameters';
COMMENT ON COLUMN api_cache.params_hash IS 'SHA-256 hash of sorted query parameters';
COMMENT ON COLUMN api_cache.status_code IS 'HTTP status code of the cached response';
COMMENT ON COLUMN api_cache.size_bytes IS 'Size of cached response body in bytes';