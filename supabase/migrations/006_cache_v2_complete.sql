-- Migration: Complete Cache V2 Infrastructure
-- Purpose: Ensure api_cache table has all columns needed for industrial-grade caching
-- This migration is idempotent - safe to run multiple times

-- First, add any missing columns to api_cache
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

-- Create indices for better performance
CREATE INDEX IF NOT EXISTS idx_cache_key ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_api_endpoint ON api_cache(api_name, endpoint);
CREATE INDEX IF NOT EXISTS idx_cache_tags ON api_cache USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_cache_last_accessed ON api_cache(last_accessed);

-- Create cache telemetry table if it doesn't exist
CREATE TABLE IF NOT EXISTS cache_telemetry (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT CHECK (event_type IN ('hit','miss','stale','revalidate','error','evict')) NOT NULL,
  cache_key TEXT,
  api_name TEXT,
  endpoint TEXT,
  ttl_seconds INT,
  response_time_ms INT,
  cached_size_bytes INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_created ON cache_telemetry(created_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_event ON cache_telemetry(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_api ON cache_telemetry(api_name);

-- Create cache policies table to store our catalog-driven policies
CREATE TABLE IF NOT EXISTS cache_policies (
  route_key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  ttl_seconds INT NOT NULL,
  ttl_by_phase JSONB,
  stale_while_revalidate INT DEFAULT 3600,
  etag_enabled BOOLEAN DEFAULT true,
  conditional_get BOOLEAN DEFAULT true,
  immutable BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  template_name TEXT,
  category TEXT,
  subcategory TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_source ON cache_policies(source);
CREATE INDEX IF NOT EXISTS idx_policies_category ON cache_policies(category, subcategory);

-- Insert some default policies for Congress.gov endpoints
INSERT INTO cache_policies (route_key, source, ttl_seconds, template_name, category, subcategory) VALUES
  ('congress.gov:bill-status', 'congress.gov', 21600, 'session_aware_bill_status', 'federal', 'legislation'),
  ('congress.gov:member-profile', 'congress.gov', 2592000, 'member_profile', 'federal', 'members'),
  ('congress.gov:member-votes', 'congress.gov', 31536000, 'member_votes', 'federal', 'members'),
  ('congress.gov:committee-members', 'congress.gov', 604800, 'weekly_roster', 'federal', 'members'),
  ('congress.gov:amendments', 'congress.gov', 1209600, 'fast_amendments', 'federal', 'legislation'),
  ('congress.gov:roll-call-vote-final', 'congress.gov', 31536000, 'immutable_doc', 'federal', 'legislation'),
  ('govinfo:bill-text-enrolled', 'govinfo', 31536000, 'immutable_doc', 'federal', 'legislation')
ON CONFLICT (route_key) DO UPDATE SET
  ttl_seconds = EXCLUDED.ttl_seconds,
  updated_at = NOW();

-- Create a function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_cache
  WHERE expires_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup
  INSERT INTO cache_telemetry (event_type, api_name, endpoint, cached_size_bytes)
  VALUES ('evict', 'system', 'cleanup', deleted_count);

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_stats()
RETURNS TABLE (
  total_entries BIGINT,
  total_size_bytes BIGINT,
  avg_hit_count NUMERIC,
  most_accessed_key TEXT,
  oldest_entry TIMESTAMPTZ,
  newest_entry TIMESTAMPTZ,
  expired_count BIGINT,
  by_api_name JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_entries,
    SUM(size_bytes) as total_size_bytes,
    AVG(hit_count) as avg_hit_count,
    (SELECT cache_key FROM api_cache ORDER BY hit_count DESC LIMIT 1) as most_accessed_key,
    MIN(created_at) as oldest_entry,
    MAX(created_at) as newest_entry,
    COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_count,
    jsonb_object_agg(
      COALESCE(api_name, 'unknown'),
      json_build_object(
        'count', count_by_api,
        'size_bytes', size_by_api
      )
    ) as by_api_name
  FROM api_cache
  LEFT JOIN LATERAL (
    SELECT
      api_name,
      COUNT(*) as count_by_api,
      SUM(size_bytes) as size_by_api
    FROM api_cache
    GROUP BY api_name
  ) api_stats ON TRUE;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security for better control
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_policies ENABLE ROW LEVEL SECURITY;

-- Create policies allowing Edge Functions to manage cache
CREATE POLICY "Edge functions can manage cache" ON api_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Edge functions can write telemetry" ON cache_telemetry
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Edge functions can read policies" ON cache_policies
  FOR SELECT
  USING (true);

-- Grant permissions to service role
GRANT ALL ON api_cache TO service_role;
GRANT ALL ON cache_telemetry TO service_role;
GRANT SELECT ON cache_policies TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Add comment documentation
COMMENT ON TABLE api_cache IS 'Server-side cache for API responses with intelligent TTLs based on governmental cycles';
COMMENT ON TABLE cache_telemetry IS 'Telemetry data for monitoring cache performance and hit rates';
COMMENT ON TABLE cache_policies IS 'Catalog-driven cache policies for different API endpoints';
COMMENT ON COLUMN api_cache.refresh_strategy IS 'Cache refresh strategy: ttl (time-based), swr (stale-while-revalidate), or immutable';
COMMENT ON COLUMN api_cache.tags IS 'Tags for cache invalidation and categorization';

-- Create a view for monitoring cache health
CREATE OR REPLACE VIEW cache_health AS
SELECT
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_entries,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
  AVG(hit_count) as avg_hits,
  MAX(hit_count) as max_hits,
  SUM(size_bytes) / 1024 / 1024 as total_size_mb,
  COUNT(DISTINCT api_name) as unique_apis,
  COUNT(DISTINCT endpoint) as unique_endpoints,
  MAX(last_accessed) as last_activity
FROM api_cache;

GRANT SELECT ON cache_health TO anon, authenticated, service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Cache V2 infrastructure successfully created/updated';
  RAISE NOTICE 'Tables: api_cache, cache_telemetry, cache_policies';
  RAISE NOTICE 'Functions: cleanup_expired_cache(), get_cache_stats()';
  RAISE NOTICE 'View: cache_health';
END $$;