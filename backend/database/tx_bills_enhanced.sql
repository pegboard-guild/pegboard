-- Enhanced Texas Bills Schema with ChatGPT5 Pro's Optimizations
-- Includes proper indexing, partitioning support, and FTS

-- Drop existing tables if needed for clean migration
-- DROP TABLE IF EXISTS tx_vote_summary CASCADE;
-- DROP TABLE IF EXISTS tx_bills CASCADE;
-- DROP TABLE IF EXISTS tx_legislators CASCADE;

-- Texas bills table with optimizations
CREATE TABLE IF NOT EXISTS tx_bills (
  id TEXT PRIMARY KEY,
  session TEXT NOT NULL,           -- '87R', '88R', '89R', '891', '892'
  bill_number TEXT NOT NULL,       -- 'HB1', 'SB100', etc.
  title TEXT,
  abstract TEXT,                   -- First 500 chars only per ChatGPT5
  sponsors JSONB,
  status TEXT,
  last_action TEXT,
  last_action_date DATE,
  subjects TEXT[],
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),

  -- Generated columns for efficient lookups
  bill_key TEXT GENERATED ALWAYS AS (concat(session, '-', bill_number)) STORED
);

-- Unique index on bill_key for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS ux_tx_bills_bill_key ON tx_bills (bill_key);

-- Composite index for session + bill_number queries
CREATE INDEX IF NOT EXISTS idx_tx_bills_session_bill ON tx_bills (session, bill_number);

-- Index for session queries
CREATE INDEX IF NOT EXISTS idx_tx_bills_session ON tx_bills (session);

-- Index for recent updates
CREATE INDEX IF NOT EXISTS idx_tx_bills_updated ON tx_bills (updated_at DESC);

-- GIN index for subjects array
CREATE INDEX IF NOT EXISTS idx_tx_bills_subjects ON tx_bills USING GIN (subjects);

-- Add full-text search column and index
ALTER TABLE tx_bills
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tx_bills_tsv ON tx_bills USING GIN (tsv);

-- Texas legislators table
CREATE TABLE IF NOT EXISTS tx_legislators (
  id TEXT PRIMARY KEY,              -- OpenStates person ID
  name TEXT NOT NULL,
  district TEXT,
  chamber TEXT,                     -- 'upper' or 'lower'
  party TEXT,
  email TEXT,
  phone TEXT,
  image_url TEXT,
  current_role JSONB,
  bioguide_id TEXT,                 -- Federal bioguide for cross-reference
  current BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_legislators_chamber ON tx_legislators (chamber);
CREATE INDEX IF NOT EXISTS idx_tx_legislators_current ON tx_legislators (current);
CREATE INDEX IF NOT EXISTS idx_tx_legislators_bioguide ON tx_legislators (bioguide_id);

-- Vote summaries (aggregates only per ChatGPT5 Pro)
CREATE TABLE IF NOT EXISTS tx_vote_summary (
  id TEXT PRIMARY KEY,
  bill_id TEXT REFERENCES tx_bills(id) ON DELETE CASCADE,
  vote_date DATE,
  chamber TEXT,                     -- 'upper' or 'lower'
  yeas INTEGER,
  nays INTEGER,
  present INTEGER,
  absent INTEGER,
  result TEXT,                       -- 'passed' or 'failed'
  motion TEXT,                       -- Description of what was voted on
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Fast fan-in by bill + date
CREATE INDEX IF NOT EXISTS idx_tx_vote_summary_bill_date
  ON tx_vote_summary (bill_id, vote_date DESC);

CREATE INDEX IF NOT EXISTS idx_tx_vote_summary_date
  ON tx_vote_summary (vote_date DESC);

-- Partitioned version for easy drop/replace by session
-- (Can migrate to this later if needed)
CREATE TABLE IF NOT EXISTS tx_bills_partitioned (
  LIKE tx_bills INCLUDING ALL
) PARTITION BY LIST (session);

-- Create partitions for each session
-- Uncomment to use partitioned approach:
-- CREATE TABLE tx_bills_87r PARTITION OF tx_bills_partitioned FOR VALUES IN ('87R');
-- CREATE TABLE tx_bills_88r PARTITION OF tx_bills_partitioned FOR VALUES IN ('88R');
-- CREATE TABLE tx_bills_89r PARTITION OF tx_bills_partitioned FOR VALUES IN ('89R');
-- CREATE TABLE tx_bills_891 PARTITION OF tx_bills_partitioned FOR VALUES IN ('891');
-- CREATE TABLE tx_bills_892 PARTITION OF tx_bills_partitioned FOR VALUES IN ('892');

-- Helper views for monitoring
CREATE OR REPLACE VIEW tx_bills_summary AS
SELECT
  session,
  COUNT(*) as bill_count,
  COUNT(DISTINCT subjects) as unique_subjects,
  MAX(updated_at) as last_updated,
  COUNT(CASE WHEN status = 'passed' THEN 1 END) as passed_count,
  COUNT(CASE WHEN last_action_date > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_activity
FROM tx_bills
GROUP BY session
ORDER BY session DESC;

CREATE OR REPLACE VIEW tx_votes_summary AS
SELECT
  b.session,
  COUNT(DISTINCT v.id) as total_votes,
  COUNT(DISTINCT v.bill_id) as bills_with_votes,
  MAX(v.vote_date) as most_recent_vote,
  SUM(CASE WHEN v.result = 'passed' THEN 1 ELSE 0 END) as passed_votes,
  SUM(CASE WHEN v.result = 'failed' THEN 1 ELSE 0 END) as failed_votes
FROM tx_bills b
LEFT JOIN tx_vote_summary v ON v.bill_id = b.id
GROUP BY b.session
ORDER BY b.session DESC;

-- Function to get bill fingerprint for change detection
-- Requires pgcrypto extension
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION get_session_fingerprint(p_session TEXT)
RETURNS TEXT AS $$
DECLARE
  fingerprint TEXT;
BEGIN
  SELECT encode(
    digest(string_agg(id, ',' ORDER BY id), 'sha256'),
    'hex'
  ) INTO fingerprint
  FROM tx_bills
  WHERE session = p_session;

  RETURN fingerprint;
END;
$$ LANGUAGE plpgsql;

-- Function to check what data we have vs intended
CREATE OR REPLACE FUNCTION check_tx_data_coverage()
RETURNS TABLE(
  session TEXT,
  partition_exists BOOLEAN,
  bills_loaded INTEGER,
  votes_loaded INTEGER,
  last_update TIMESTAMP,
  fingerprint TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id::TEXT as session,
    EXISTS(SELECT 1 FROM tx_bills b WHERE b.session = REPLACE(p.id, 'tx:', '')) as partition_exists,
    COUNT(DISTINCT b.id)::INTEGER as bills_loaded,
    COUNT(DISTINCT v.id)::INTEGER as votes_loaded,
    MAX(b.updated_at) as last_update,
    get_session_fingerprint(REPLACE(p.id, 'tx:', '')) as fingerprint
  FROM data_partitions p
  LEFT JOIN tx_bills b ON b.session = REPLACE(p.id, 'tx:', '')
  LEFT JOIN tx_vote_summary v ON v.bill_id = b.id
  WHERE p.domain = 'tx'
  GROUP BY p.id
  ORDER BY p.id;
END;
$$ LANGUAGE plpgsql;

-- Grant appropriate permissions (adjust as needed)
-- GRANT SELECT ON tx_bills, tx_legislators, tx_vote_summary TO authenticated;
-- GRANT ALL ON tx_bills, tx_legislators, tx_vote_summary TO service_role;