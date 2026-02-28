-- 02_tx_schema.sql
-- Texas bills/legislators/votes schema with correctness & performance fixes

-- Extensions used by some indexes & helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for digest()
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- for trigram search
CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive text (emails, etc.)

-- -------------------------
-- Bills
-- -------------------------
CREATE TABLE IF NOT EXISTS tx_bills (
  id TEXT PRIMARY KEY,
  session TEXT NOT NULL,                 -- '87R', '88R', '89R', '891', '892'
  bill_number TEXT NOT NULL,             -- 'HB1', 'SB100', etc.
  title TEXT,
  abstract TEXT,                         -- store ≤ 500 chars (enforced below)
  sponsors JSONB,
  status TEXT,
  last_action TEXT,
  last_action_date DATE,
  subjects TEXT[],
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  bill_key TEXT GENERATED ALWAYS AS ((session || '-' || bill_number)) STORED
);

-- Enforce abstract length to guard storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'abstract_len_chk'
      AND conrelid = 'public.tx_bills'::regclass
  ) THEN
    ALTER TABLE tx_bills
      ADD CONSTRAINT abstract_len_chk CHECK (abstract IS NULL OR char_length(abstract) <= 500);
  END IF;
END$$;

-- Basic quality checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_format_chk'
      AND conrelid = 'public.tx_bills'::regclass
  ) THEN
    ALTER TABLE tx_bills
      ADD CONSTRAINT session_format_chk CHECK (session ~ '^([0-9]{2}R|[0-9]{3})$');  -- '87R' or '891'
  END IF;
END$$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS ux_tx_bills_bill_key ON tx_bills (bill_key);
CREATE INDEX IF NOT EXISTS idx_tx_bills_session_bill  ON tx_bills (session, bill_number);
CREATE INDEX IF NOT EXISTS idx_tx_bills_session       ON tx_bills (session);
CREATE INDEX IF NOT EXISTS idx_tx_bills_updated       ON tx_bills (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_bills_subjects      ON tx_bills USING GIN (subjects);
-- Optional ergonomic search
CREATE INDEX IF NOT EXISTS idx_tx_bills_title_trgm    ON tx_bills USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tx_bills_billnum_trgm  ON tx_bills USING GIN (bill_number gin_trgm_ops);
-- JSONB sponsors lookup (e.g., by sponsor.id)
CREATE INDEX IF NOT EXISTS idx_tx_bills_sponsors      ON tx_bills USING GIN (sponsors jsonb_path_ops);
-- BRIN for time-ranged scans
CREATE INDEX IF NOT EXISTS brin_tx_bills_updated      ON tx_bills USING BRIN (updated_at);

-- FTS column & index
ALTER TABLE tx_bills
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,''))
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_tx_bills_tsv ON tx_bills USING GIN (tsv);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS tx_bills_touch_updated ON tx_bills;
CREATE TRIGGER tx_bills_touch_updated
BEFORE UPDATE ON tx_bills
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------
-- Legislators
-- -------------------------
CREATE TABLE IF NOT EXISTS tx_legislators (
  id TEXT PRIMARY KEY,              -- OpenStates person ID (canonical)
  name TEXT NOT NULL,
  district TEXT,
  chamber TEXT,                     -- 'upper' or 'lower'
  party TEXT,
  email CITEXT,
  phone TEXT,
  image_url TEXT,
  role_info JSONB,                  -- Changed from current_role (reserved keyword)
  bioguide_id TEXT,                 -- Federal bioguide for cross-reference
  current BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_legislators_chamber ON tx_legislators (chamber);
CREATE INDEX IF NOT EXISTS idx_tx_legislators_current ON tx_legislators (current);
CREATE INDEX IF NOT EXISTS idx_tx_legislators_bioguide ON tx_legislators (bioguide_id);

DROP TRIGGER IF EXISTS tx_legislators_touch_updated ON tx_legislators;
CREATE TRIGGER tx_legislators_touch_updated
BEFORE UPDATE ON tx_legislators
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------
-- Vote summaries (aggregates only)
-- -------------------------
CREATE TABLE IF NOT EXISTS tx_vote_summary (
  id TEXT PRIMARY KEY,
  bill_id TEXT REFERENCES tx_bills(id) ON DELETE CASCADE,
  vote_date DATE,
  chamber TEXT,                     -- 'upper' or 'lower'
  yeas INTEGER,
  nays INTEGER,
  present INTEGER,
  absent INTEGER,
  result TEXT,                      -- 'passed' or 'failed'
  motion TEXT,                      -- description of what was voted on
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Guard values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vote_chamber_chk'
      AND conrelid = 'public.tx_vote_summary'::regclass
  ) THEN
    ALTER TABLE tx_vote_summary
      ADD CONSTRAINT vote_chamber_chk CHECK (chamber IN ('upper','lower'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vote_result_chk'
      AND conrelid = 'public.tx_vote_summary'::regclass
  ) THEN
    ALTER TABLE tx_vote_summary
      ADD CONSTRAINT vote_result_chk CHECK (result IN ('passed','failed'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tx_vote_summary_bill_date
  ON tx_vote_summary (bill_id, vote_date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_vote_summary_date
  ON tx_vote_summary (vote_date DESC);

DROP TRIGGER IF EXISTS tx_vote_summary_touch_updated ON tx_vote_summary;
CREATE TRIGGER tx_vote_summary_touch_updated
BEFORE UPDATE ON tx_vote_summary
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------
-- Monitoring Views & Helpers
-- -------------------------

-- FIXED: count distinct subjects across array values (not arrays)
CREATE OR REPLACE VIEW tx_bills_summary AS
SELECT
  b.session,
  COUNT(*) AS bill_count,
  COUNT(DISTINCT s.subject) AS unique_subjects,
  MAX(b.updated_at) AS last_updated,
  COUNT(*) FILTER (WHERE b.status = 'passed') AS passed_count,
  COUNT(*) FILTER (WHERE b.last_action_date > CURRENT_DATE - INTERVAL '7 days') AS recent_activity
FROM tx_bills b
LEFT JOIN LATERAL unnest(b.subjects) AS s(subject) ON TRUE
GROUP BY b.session
ORDER BY b.session DESC;

CREATE OR REPLACE VIEW tx_votes_summary AS
SELECT
  b.session,
  COUNT(DISTINCT v.id) AS total_votes,
  COUNT(DISTINCT v.bill_id) AS bills_with_votes,
  MAX(v.vote_date) AS most_recent_vote,
  COUNT(*) FILTER (WHERE v.result = 'passed') AS passed_votes,
  COUNT(*) FILTER (WHERE v.result = 'failed') AS failed_votes
FROM tx_bills b
LEFT JOIN tx_vote_summary v ON v.bill_id = b.id
GROUP BY b.session
ORDER BY b.session DESC;

-- Session-level fingerprint (stable order)
CREATE OR REPLACE FUNCTION get_session_fingerprint(p_session TEXT)
RETURNS TEXT AS $$
DECLARE
  fingerprint TEXT;
BEGIN
  SELECT encode(
    digest(string_agg(id, ',' ORDER BY id), 'sha256'),
    'hex'
  )
  INTO fingerprint
  FROM tx_bills
  WHERE session = p_session;

  RETURN fingerprint;
END;
$$ LANGUAGE plpgsql;

-- Compare intent vs. what we actually have
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
    p.id::TEXT AS session,
    EXISTS(SELECT 1 FROM tx_bills b WHERE b.session = REPLACE(p.id, 'tx:', '')) AS partition_exists,
    COUNT(DISTINCT b.id)::INTEGER AS bills_loaded,
    COUNT(DISTINCT v.id)::INTEGER AS votes_loaded,
    MAX(b.updated_at) AS last_update,
    get_session_fingerprint(REPLACE(p.id, 'tx:', '')) AS fingerprint
  FROM data_partitions p
  LEFT JOIN tx_bills b ON b.session = REPLACE(p.id, 'tx:', '')
  LEFT JOIN tx_vote_summary v ON v.bill_id = b.id
  WHERE p.domain = 'tx' AND p.kind = 'bills'
  GROUP BY p.id
  ORDER BY p.id;
END;
$$ LANGUAGE plpgsql;

-- OPTIONAL: Partitioning (run later if/when you migrate)
-- Suggested child partition names:
--   tx_bills_87r, tx_bills_88r, tx_bills_89r, tx_bills_891, tx_bills_892
-- Migration plan:
-- 1) CREATE TABLE tx_bills_p (...) PARTITION BY LIST (session);
-- 2) CREATE TABLE tx_bills_87r PARTITION OF tx_bills_p FOR VALUES IN ('87R'); ... etc.
-- 3) INSERT INTO tx_bills_p SELECT * FROM tx_bills;
-- 4) ALTER TABLE tx_bills RENAME TO tx_bills_old;
-- 5) ALTER TABLE tx_bills_p RENAME TO tx_bills;
-- 6) Recreate any dependent indexes/views if names changed; drop tx_bills_old when satisfied.