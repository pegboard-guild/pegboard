-- First ensure api_cache table has a key column
ALTER TABLE api_cache
  ADD COLUMN IF NOT EXISTS key TEXT UNIQUE;

-- Update existing rows to have a key if they don't have one
UPDATE api_cache
SET key = encode(digest(COALESCE(data::text, '') || COALESCE(expires_at::text, ''), 'sha256'), 'hex')
WHERE key IS NULL;

-- Make key NOT NULL after populating
ALTER TABLE api_cache
  ALTER COLUMN key SET NOT NULL;

-- Enhanced api_cache for server-side only (with proper security)
ALTER TABLE api_cache
  ADD COLUMN IF NOT EXISTS api_name TEXT,
  ADD COLUMN IF NOT EXISTS endpoint TEXT,
  ADD COLUMN IF NOT EXISTS params_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS hit_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_strategy TEXT CHECK (refresh_strategy IN ('ttl','swr','immutable')) DEFAULT 'ttl',
  ADD COLUMN IF NOT EXISTS data_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS status_code INT,
  ADD COLUMN IF NOT EXISTS headers JSONB,
  ADD COLUMN IF NOT EXISTS etag TEXT,
  ADD COLUMN IF NOT EXISTS last_modified TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS ux_cache_key ON api_cache(api_name, endpoint, params_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_tags ON api_cache USING gin(tags);

-- Cache telemetry for monitoring
CREATE TABLE IF NOT EXISTS api_cache_events (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT CHECK (kind IN ('hit','miss','stale','revalidate','error')) NOT NULL,
  api_name TEXT,
  endpoint TEXT,
  params_hash CHAR(64),
  status INT,
  ts TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cache_events_ts ON api_cache_events(ts);

-- CRITICAL: Replace zipcode_coverage with OCD division mapping
CREATE TABLE IF NOT EXISTS zip_to_divisions (
  zipcode TEXT NOT NULL,
  ocd_division_id TEXT NOT NULL, -- e.g., 'ocd-division/country:us/state:tx/cd:32'
  division_type TEXT NOT NULL,   -- 'federal-cd','state-lower','county','place','school'
  PRIMARY KEY (zipcode, ocd_division_id)
);

CREATE TABLE IF NOT EXISTS division_coverage (
  ocd_division_id TEXT PRIMARY KEY,
  level TEXT CHECK (level IN ('federal','state','local')) NOT NULL,
  last_fetched TIMESTAMPTZ,
  fetch_count INT DEFAULT 0,
  has_representatives BOOLEAN DEFAULT FALSE,
  has_active_legislation BOOLEAN DEFAULT FALSE,
  has_local_officials BOOLEAN DEFAULT FALSE
);

-- Job queue for background processing
CREATE TABLE IF NOT EXISTS cache_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_type TEXT CHECK (job_type IN ('build_division','revalidate_tag','warm_endpoints')) NOT NULL,
  payload JSONB NOT NULL,
  status TEXT CHECK (status IN ('queued','running','succeeded','failed')) DEFAULT 'queued',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_cache_jobs_status ON cache_jobs(status, created_at);

-- Advisory locking functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION cache_try_lock(k TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT pg_try_advisory_lock(hashtext(k)) INTO ok;
  RETURN ok;
END $$;

CREATE OR REPLACE FUNCTION cache_unlock(k TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_unlock(hashtext(k));
END $$;

-- Tag-based invalidation
CREATE OR REPLACE FUNCTION cache_invalidate_by_tag(tag TEXT) RETURNS INT
LANGUAGE sql AS $$
  DELETE FROM api_cache WHERE tags @> ARRAY[tag]::TEXT[] RETURNING 1
$$;

-- Monitoring views
CREATE OR REPLACE VIEW cache_stats AS
SELECT
  COUNT(*) FILTER (WHERE expires_at > NOW()) AS fresh_entries,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) AS expired_entries,
  COALESCE(SUM(size_bytes), 0) AS total_size_bytes
FROM api_cache;

-- Event rollup for monitoring (hourly buckets)
CREATE OR REPLACE VIEW cache_event_rollup AS
SELECT
  date_trunc('hour', ts) as bucket,
  kind,
  api_name,
  COUNT(*) as n,
  AVG(status) as avg_status
FROM api_cache_events
WHERE ts > NOW() - INTERVAL '7 days'
GROUP BY 1, 2, 3;

-- RLS: Only service role can write
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role write" ON api_cache
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read" ON api_cache
  FOR SELECT USING (true);

-- Apply same RLS to new tables
ALTER TABLE api_cache_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role write" ON api_cache_events
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE cache_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role write" ON cache_jobs
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read status" ON cache_jobs
  FOR SELECT USING (true);

-- Helper function to increment hit counts efficiently
CREATE OR REPLACE FUNCTION increment_hit_count(cache_key TEXT) RETURNS VOID
LANGUAGE sql AS $$
  UPDATE api_cache
  SET hit_count = hit_count + 1,
      last_accessed = NOW()
  WHERE key = cache_key
$$;

-- Function to get cache key for monitoring
CREATE OR REPLACE FUNCTION get_cache_key(api TEXT, ep TEXT, params JSONB) RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  params_str TEXT;
  params_hash TEXT;
BEGIN
  -- Sort keys for stable stringification
  SELECT string_agg(key || ':' || value, ',' ORDER BY key)
  INTO params_str
  FROM jsonb_each_text(params);

  -- Generate SHA256 hash
  SELECT encode(digest(COALESCE(params_str, ''), 'sha256'), 'hex')
  INTO params_hash;

  RETURN api || ':' || ep || ':' || params_hash;
END $$;

-- Add trigger to log cache events
CREATE OR REPLACE FUNCTION log_cache_event() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO api_cache_events (kind, api_name, endpoint, params_hash, status)
    VALUES ('miss', NEW.api_name, NEW.endpoint, NEW.params_hash, NEW.status_code);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER cache_event_logger
  AFTER INSERT ON api_cache
  FOR EACH ROW
  EXECUTE FUNCTION log_cache_event();

-- Cleanup old cache events (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_cache_events() RETURNS VOID
LANGUAGE sql AS $$
  DELETE FROM api_cache_events WHERE ts < NOW() - INTERVAL '30 days'
$$;

-- Initial data for common Texas ZIP to division mappings
INSERT INTO zip_to_divisions (zipcode, ocd_division_id, division_type) VALUES
  ('75205', 'ocd-division/country:us/state:tx/cd:32', 'federal-cd'),
  ('75205', 'ocd-division/country:us/state:tx/sldl:108', 'state-lower'),
  ('75205', 'ocd-division/country:us/state:tx/sldu:23', 'state-upper'),
  ('75205', 'ocd-division/country:us/state:tx/county:dallas', 'county'),
  ('75205', 'ocd-division/country:us/state:tx/place:dallas', 'place')
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT SELECT ON cache_stats TO anon, authenticated;
GRANT SELECT ON cache_event_rollup TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_cache_key TO anon, authenticated;