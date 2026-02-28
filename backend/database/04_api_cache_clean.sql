-- 04_api_cache_clean.sql
-- Clean version - drops and recreates api_cache if it exists with wrong schema

-- Add ingest_mode to data_partitions first
ALTER TABLE data_partitions
  ADD COLUMN IF NOT EXISTS ingest_mode TEXT
  CHECK (ingest_mode IN ('api','bulk')) DEFAULT 'api';

-- Set initial ingest modes\


UPDATE data_partitions
SET ingest_mode = CASE
  WHEN id LIKE 'theunitedstates:%' THEN 'bulk'
  ELSE 'api'
END;

-- Drop existing views that depend on api_cache (if they exist)
DROP VIEW IF EXISTS api_cache_hit_rate CASCADE;
DROP VIEW IF EXISTS api_cache_stats CASCADE;
DROP VIEW IF EXISTS tx_freshness CASCADE;

-- Drop existing functions that depend on api_cache
DROP FUNCTION IF EXISTS get_cached_api_response CASCADE;
DROP FUNCTION IF EXISTS store_api_response CASCADE;
DROP FUNCTION IF EXISTS get_cache_ttl CASCADE;
DROP FUNCTION IF EXISTS purge_api_cache CASCADE;

-- Drop and recreate the api_cache table with correct schema
DROP TABLE IF EXISTS api_cache CASCADE;
CREATE TABLE api_cache (
  key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  params JSONB,
  status INTEGER,
  body JSONB,
  etag TEXT,
  last_modified TIMESTAMP,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  last_accessed TIMESTAMP NOT NULL DEFAULT NOW(),
  error TEXT
);

-- Create indexes
CREATE INDEX idx_api_cache_source ON api_cache(source);
CREATE INDEX idx_api_cache_exp ON api_cache(expires_at);
CREATE INDEX idx_api_cache_access ON api_cache(last_accessed DESC);

-- Recreate the purge function
CREATE OR REPLACE FUNCTION purge_api_cache(p_soft_cap_rows INT DEFAULT 200000)
RETURNS VOID AS $$
BEGIN
  DELETE FROM api_cache WHERE expires_at IS NOT NULL AND expires_at < NOW();

  IF (SELECT COUNT(*) FROM api_cache) > p_soft_cap_rows THEN
    WITH c AS (
      SELECT key
      FROM api_cache
      ORDER BY last_accessed ASC
      LIMIT (SELECT COUNT(*) - p_soft_cap_rows FROM api_cache)
    )
    DELETE FROM api_cache a USING c WHERE a.key = c.key;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create monitoring views
CREATE VIEW api_cache_hit_rate AS
SELECT
  source,
  COUNT(*) FILTER (WHERE fetched_at < NOW() - INTERVAL '5 minutes'
                  AND last_accessed > fetched_at) AS hits,
  COUNT(*) AS lookups,
  ROUND(100.0 * COUNT(*) FILTER (WHERE last_accessed > fetched_at) / NULLIF(COUNT(*),0), 1) AS hit_rate_pct
FROM api_cache
WHERE last_accessed > NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY hit_rate_pct DESC NULLS LAST;

CREATE VIEW tx_freshness AS
SELECT
  session,
  NOW() - MAX(updated_at) AS staleness
FROM tx_bills
GROUP BY session
ORDER BY session;

CREATE VIEW api_cache_stats AS
SELECT
  source,
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE expires_at > NOW()) AS valid_entries,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) AS expired_entries,
  COUNT(*) FILTER (WHERE error IS NOT NULL) AS error_entries,
  AVG(EXTRACT(EPOCH FROM (expires_at - fetched_at))) / 3600 AS avg_ttl_hours,
  MAX(last_accessed) AS last_activity,
  pg_size_pretty(SUM(pg_column_size(body))) AS total_size
FROM api_cache
GROUP BY source
ORDER BY total_entries DESC;

-- Helper functions
CREATE OR REPLACE FUNCTION get_cached_api_response(
  p_key TEXT,
  p_source TEXT,
  p_url TEXT,
  p_params JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(
  cache_hit BOOLEAN,
  status INTEGER,
  body JSONB,
  error TEXT,
  expires_at TIMESTAMP
) AS $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT
    ac.status,
    ac.body,
    ac.error,
    ac.expires_at,
    TRUE AS cache_hit
  INTO v_result
  FROM api_cache ac
  WHERE ac.key = p_key
    AND (ac.expires_at IS NULL OR ac.expires_at > NOW());

  IF FOUND THEN
    UPDATE api_cache
    SET last_accessed = NOW()
    WHERE key = p_key;

    RETURN QUERY
    SELECT v_result.cache_hit, v_result.status, v_result.body, v_result.error, v_result.expires_at;
  ELSE
    RETURN QUERY
    SELECT FALSE, NULL::INTEGER, NULL::JSONB, NULL::TEXT, NULL::TIMESTAMP;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION store_api_response(
  p_key TEXT,
  p_source TEXT,
  p_url TEXT,
  p_params JSONB,
  p_status INTEGER,
  p_body JSONB,
  p_ttl_seconds INTEGER DEFAULT 3600,
  p_etag TEXT DEFAULT NULL,
  p_last_modified TIMESTAMP DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO api_cache (
    key, source, url, params, status, body, etag, last_modified,
    fetched_at, expires_at, last_accessed, error
  ) VALUES (
    p_key, p_source, p_url, p_params, p_status, p_body, p_etag, p_last_modified,
    NOW(), NOW() + (p_ttl_seconds || ' seconds')::INTERVAL, NOW(), p_error
  )
  ON CONFLICT (key) DO UPDATE SET
    status = EXCLUDED.status,
    body = EXCLUDED.body,
    etag = EXCLUDED.etag,
    last_modified = EXCLUDED.last_modified,
    fetched_at = EXCLUDED.fetched_at,
    expires_at = EXCLUDED.expires_at,
    last_accessed = EXCLUDED.last_accessed,
    error = EXCLUDED.error;
END;
$$ LANGUAGE plpgsql;

-- TTL configuration table
DROP TABLE IF EXISTS cache_ttl_config CASCADE;
CREATE TABLE cache_ttl_config (
  source TEXT NOT NULL,
  endpoint_pattern TEXT NOT NULL,
  ttl_seconds INTEGER NOT NULL,
  description TEXT,
  PRIMARY KEY (source, endpoint_pattern)
);

-- Insert TTL configurations
INSERT INTO cache_ttl_config (source, endpoint_pattern, ttl_seconds, description) VALUES
  ('openstates', '.*bills.*current.*', 3600, 'TX current/called session bills: 1 hour'),
  ('openstates', '.*bills.*', 21600, 'TX historical session bills: 6 hours'),
  ('openstates', '.*votes.*', 3600, 'Votes: 1 hour until final'),
  ('openstates', '.*people.*', 604800, 'Legislators: 7 days'),
  ('congress', '.*bill.*', 86400, 'Federal bill indices: 24 hours'),
  ('theunitedstates', '.*', 2592000, 'TheUnitedStates.io: 30 days'),
  ('fec', '.*', 86400, 'FEC data: 24 hours'),
  ('nyol', '.*', 86400, 'NY bills: 24 hours'),
  ('default', '.*', 3600, 'Default: 1 hour')
ON CONFLICT (source, endpoint_pattern) DO UPDATE SET
  ttl_seconds = EXCLUDED.ttl_seconds,
  description = EXCLUDED.description;

-- Function to get TTL
CREATE OR REPLACE FUNCTION get_cache_ttl(p_source TEXT, p_url TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_ttl INTEGER;
BEGIN
  SELECT ttl_seconds INTO v_ttl
  FROM cache_ttl_config
  WHERE source = p_source
    AND p_url ~ endpoint_pattern
  ORDER BY length(endpoint_pattern) DESC
  LIMIT 1;

  IF v_ttl IS NULL THEN
    SELECT ttl_seconds INTO v_ttl
    FROM cache_ttl_config
    WHERE source = 'default'
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_ttl, 3600);
END;
$$ LANGUAGE plpgsql;