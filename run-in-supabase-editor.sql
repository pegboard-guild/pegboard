-- Run this script in the Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/yurdvlcxednoaikrljbh/editor
-- Paste this entire script and click "Run"

-- Migration: Complete Cache V2 Infrastructure
-- Purpose: Ensure api_cache table has all columns needed for industrial-grade caching

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

-- Grant permissions to service role
GRANT ALL ON api_cache TO service_role;
GRANT ALL ON api_cache TO anon;
GRANT ALL ON api_cache TO authenticated;

-- Success check
SELECT
  COUNT(*) as total_columns,
  array_agg(column_name ORDER BY ordinal_position) as all_columns
FROM information_schema.columns
WHERE table_name = 'api_cache';