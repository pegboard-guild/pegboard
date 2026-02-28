-- 01_inventory.sql
-- Lightweight Inventory System + helpers

-- 1) Partitions we intend to hold
CREATE TABLE IF NOT EXISTS data_partitions (
  id TEXT PRIMARY KEY,              -- 'tx:87R', 'tx:88R', 'tx:89R', 'tx:891', 'congress:117'
  domain TEXT NOT NULL,             -- 'tx', 'congress', 'fec', 'openstates', 'theunitedstates'
  kind TEXT NOT NULL,               -- 'bills', 'votes', 'people', 'committees'
  label TEXT,                       -- 'TX 89th Regular Session', '117th Congress'
  intended boolean DEFAULT true,    -- Whether we plan to keep this partition
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2) Source file/bundle metadata
CREATE TABLE IF NOT EXISTS partition_sources (
  partition_id TEXT REFERENCES data_partitions(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  etag TEXT,
  last_modified TIMESTAMP,
  byte_size BIGINT,
  source_type TEXT,                 -- 'xml', 'json', 'csv', 'postgres_dump'
  PRIMARY KEY (partition_id, source_url)
);

-- 3) What's actually in our DB
CREATE TABLE IF NOT EXISTS partition_inventory (
  partition_id TEXT PRIMARY KEY REFERENCES data_partitions(id) ON DELETE CASCADE,
  row_count_bills INTEGER DEFAULT 0,
  row_count_votes INTEGER DEFAULT 0,
  row_count_people INTEGER DEFAULT 0,
  row_count_committees INTEGER DEFAULT 0,
  last_upsert TIMESTAMP,
  bill_xor BIGINT,                  -- optional cheap fingerprint
  vote_xor BIGINT,
  people_xor BIGINT,
  committee_xor BIGINT,
  storage_bytes BIGINT,
  is_complete BOOLEAN DEFAULT false
);

-- 4) Audit trail for ingestion operations
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_partitions_domain ON data_partitions(domain);
CREATE INDEX IF NOT EXISTS idx_partitions_kind   ON data_partitions(kind);
CREATE INDEX IF NOT EXISTS idx_inventory_last_upsert ON partition_inventory(last_upsert DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_partition ON ingest_runs(partition_id, started_at DESC);

-- Keep data_partitions.updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS data_partitions_touch_updated ON data_partitions;
CREATE TRIGGER data_partitions_touch_updated
BEFORE UPDATE ON data_partitions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Initial partitions (TX)
INSERT INTO data_partitions (id, domain, kind, label, intended) VALUES
  ('tx:87R', 'tx', 'bills', 'TX 87th Regular Session (2021)', true),
  ('tx:88R', 'tx', 'bills', 'TX 88th Regular Session (2023)', true),
  ('tx:89R', 'tx', 'bills', 'TX 89th Regular Session (2025)', true),
  ('tx:891', 'tx', 'bills', 'TX 89th 1st Called Session (2025)', true),
  ('tx:892', 'tx', 'bills', 'TX 89th 2nd Called Session (2025)', false)
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Initial partitions (TheUnitedStates.io)
INSERT INTO data_partitions (id, domain, kind, label, intended) VALUES
  ('theunitedstates:legislators-current', 'theunitedstates', 'people', 'Current U.S. Legislators', true),
  ('theunitedstates:legislators-historical', 'theunitedstates', 'people', 'Historical U.S. Legislators', true),
  ('theunitedstates:committees-current', 'theunitedstates', 'committees', 'Current Congressional Committees', true)
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Initial partitions (Congress: completed only)
INSERT INTO data_partitions (id, domain, kind, label, intended) VALUES
  ('congress:117', 'congress', 'bills', '117th Congress (2021-2022)', true),
  ('congress:116', 'congress', 'bills', '116th Congress (2019-2020)', true)
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Storage summary view (uses partition_inventory.storage_bytes)
CREATE OR REPLACE VIEW storage_summary AS
SELECT
  domain,
  COUNT(*) AS partition_count,
  SUM(pi.storage_bytes) AS total_bytes,
  ROUND(COALESCE(SUM(pi.storage_bytes),0) / 1024.0 / 1024.0, 2) AS total_mb,
  SUM(COALESCE(pi.row_count_bills,0) + COALESCE(pi.row_count_votes,0)
    + COALESCE(pi.row_count_people,0) + COALESCE(pi.row_count_committees,0)) AS total_rows
FROM data_partitions dp
LEFT JOIN partition_inventory pi ON dp.id = pi.partition_id
GROUP BY domain
ORDER BY total_bytes DESC NULLS LAST;

-- Free-tier guardrail
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
  percent := CASE WHEN free_limit_mb = 0 THEN 0
                  ELSE ROUND((used_megabytes / free_limit_mb) * 100, 1) END;

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
    END;
END;
$$ LANGUAGE plpgsql;

-- OPTIONAL: refresh per-partition bytes (works once you create child partitions)
-- You can add/remove sessions as needed. The IF guards prevent errors if a child doesn't exist yet.
CREATE OR REPLACE FUNCTION refresh_partition_bytes()
RETURNS void AS $$
BEGIN
  -- 87R
  IF to_regclass('public.tx_bills_87r') IS NOT NULL THEN
    UPDATE partition_inventory
    SET storage_bytes = (pg_total_relation_size('public.tx_bills_87r') + pg_indexes_size('public.tx_bills_87r')),
        last_upsert   = COALESCE(last_upsert, now())
    WHERE partition_id = 'tx:87R';
  END IF;

  -- 88R
  IF to_regclass('public.tx_bills_88r') IS NOT NULL THEN
    UPDATE partition_inventory
    SET storage_bytes = (pg_total_relation_size('public.tx_bills_88r') + pg_indexes_size('public.tx_bills_88r')),
        last_upsert   = COALESCE(last_upsert, now())
    WHERE partition_id = 'tx:88R';
  END IF;

  -- 89R
  IF to_regclass('public.tx_bills_89r') IS NOT NULL THEN
    UPDATE partition_inventory
    SET storage_bytes = (pg_total_relation_size('public.tx_bills_89r') + pg_indexes_size('public.tx_bills_89r')),
        last_upsert   = COALESCE(last_upsert, now())
    WHERE partition_id = 'tx:89R';
  END IF;

  -- 891 (1st Called)
  IF to_regclass('public.tx_bills_891') IS NOT NULL THEN
    UPDATE partition_inventory
    SET storage_bytes = (pg_total_relation_size('public.tx_bills_891') + pg_indexes_size('public.tx_bills_891')),
        last_upsert   = COALESCE(last_upsert, now())
    WHERE partition_id = 'tx:891';
  END IF;

  -- 892 (2nd Called)
  IF to_regclass('public.tx_bills_892') IS NOT NULL THEN
    UPDATE partition_inventory
    SET storage_bytes = (pg_total_relation_size('public.tx_bills_892') + pg_indexes_size('public.tx_bills_892')),
        last_upsert   = COALESCE(last_upsert, now())
    WHERE partition_id = 'tx:892';
  END IF;
END;
$$ LANGUAGE plpgsql;