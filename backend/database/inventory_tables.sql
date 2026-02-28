-- Lightweight Inventory System for Bulk Data Management
-- Based on ChatGPT5 Pro recommendations

-- 1. What dataset partitions we intend to hold
CREATE TABLE IF NOT EXISTS data_partitions (
  id TEXT PRIMARY KEY,              -- 'tx:87R', 'tx:88R', 'tx:89R', 'tx:89(1)', 'congress:117'
  domain TEXT NOT NULL,             -- 'tx', 'congress', 'fec', 'openstates'
  kind TEXT NOT NULL,               -- 'bills', 'votes', 'people', 'committees'
  label TEXT,                       -- 'TX 89th Regular Session', '117th Congress'
  intended boolean DEFAULT true,    -- Whether we plan to keep this partition
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Source file/bundle metadata
CREATE TABLE IF NOT EXISTS partition_sources (
  partition_id TEXT REFERENCES data_partitions(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  etag TEXT,
  last_modified TIMESTAMP,
  byte_size BIGINT,
  source_type TEXT,                 -- 'xml', 'json', 'csv', 'postgres_dump'
  PRIMARY KEY (partition_id, source_url)
);

-- 3. What's actually in our DB
CREATE TABLE IF NOT EXISTS partition_inventory (
  partition_id TEXT PRIMARY KEY REFERENCES data_partitions(id) ON DELETE CASCADE,
  row_count_bills INTEGER DEFAULT 0,
  row_count_votes INTEGER DEFAULT 0,
  row_count_people INTEGER DEFAULT 0,
  row_count_committees INTEGER DEFAULT 0,
  last_upsert TIMESTAMP,
  bill_xor BIGINT,  -- cheap fingerprint for change detection
  vote_xor BIGINT,
  people_xor BIGINT,
  committee_xor BIGINT,
  storage_bytes BIGINT,
  is_complete BOOLEAN DEFAULT false
);

-- 4. Audit trail for data loading operations
CREATE TABLE IF NOT EXISTS ingest_runs (
  id SERIAL PRIMARY KEY,
  partition_id TEXT REFERENCES data_partitions(id) ON DELETE CASCADE,
  source_url TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  mode TEXT CHECK (mode IN ('seed','delta','replace')),
  inserted_rows INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,
  deleted_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  ok BOOLEAN DEFAULT true,
  error_message TEXT,
  note TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_partitions_domain ON data_partitions(domain);
CREATE INDEX IF NOT EXISTS idx_partitions_kind ON data_partitions(kind);
CREATE INDEX IF NOT EXISTS idx_inventory_last_upsert ON partition_inventory(last_upsert DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_partition ON ingest_runs(partition_id, started_at DESC);

-- Initial data partitions for Texas (priority implementation)
-- Using numeric codes for called sessions per ChatGPT5 Pro
INSERT INTO data_partitions (id, domain, kind, label, intended) VALUES
  ('tx:87R', 'tx', 'bills', 'TX 87th Regular Session (2021)', true),
  ('tx:88R', 'tx', 'bills', 'TX 88th Regular Session (2023)', true),
  ('tx:89R', 'tx', 'bills', 'TX 89th Regular Session (2025)', true),
  ('tx:891', 'tx', 'bills', 'TX 89th 1st Called Session (2025)', true),
  ('tx:892', 'tx', 'bills', 'TX 89th 2nd Called Session (2025)', false) -- placeholder
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- Initial data partitions for TheUnitedStates.io
INSERT INTO data_partitions (id, domain, kind, label, intended) VALUES
  ('theunitedstates:legislators-current', 'theunitedstates', 'people', 'Current U.S. Legislators', true),
  ('theunitedstates:legislators-historical', 'theunitedstates', 'people', 'Historical U.S. Legislators', true),
  ('theunitedstates:committees-current', 'theunitedstates', 'committees', 'Current Congressional Committees', true)
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- Initial data partitions for Congress (completed sessions only)
INSERT INTO data_partitions (id, domain, kind, label, intended) VALUES
  ('congress:117', 'congress', 'bills', '117th Congress (2021-2022)', true),
  ('congress:116', 'congress', 'bills', '116th Congress (2019-2020)', true)
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- Helper view to monitor storage usage
CREATE OR REPLACE VIEW storage_summary AS
SELECT
  domain,
  COUNT(*) as partition_count,
  SUM(pi.storage_bytes) as total_bytes,
  ROUND(SUM(pi.storage_bytes) / 1024.0 / 1024.0, 2) as total_mb,
  SUM(pi.row_count_bills + pi.row_count_votes + pi.row_count_people + pi.row_count_committees) as total_rows
FROM data_partitions dp
LEFT JOIN partition_inventory pi ON dp.id = pi.partition_id
GROUP BY domain
ORDER BY total_bytes DESC NULLS LAST;

-- Helper function to check if we're approaching storage limits
CREATE OR REPLACE FUNCTION check_storage_limits()
RETURNS TABLE(
  used_mb NUMERIC,
  free_tier_limit_mb INTEGER,
  percent_used NUMERIC,
  warning_message TEXT
) AS $$
DECLARE
  total_bytes BIGINT;
  used_megabytes NUMERIC;
  free_limit_mb CONSTANT INTEGER := 500;
  percent NUMERIC;
BEGIN
  SELECT COALESCE(SUM(storage_bytes), 0) INTO total_bytes
  FROM partition_inventory;

  used_megabytes := ROUND(total_bytes / 1024.0 / 1024.0, 2);
  percent := ROUND((used_megabytes / free_limit_mb) * 100, 1);

  RETURN QUERY
  SELECT
    used_megabytes,
    free_limit_mb,
    percent,
    CASE
      WHEN percent >= 90 THEN 'CRITICAL: Approaching free tier limit!'
      WHEN percent >= 75 THEN 'WARNING: High storage usage'
      WHEN percent >= 50 THEN 'INFO: Moderate storage usage'
      ELSE 'OK: Storage usage within limits'
    END AS warning_message;
END;
$$ LANGUAGE plpgsql;