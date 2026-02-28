-- 03_inventory_queries.sql
-- Inventory & health checks (no external table refs)

-- 1) What TX sessions are present, and how fresh?
SELECT session, COUNT(*) AS bills, MAX(updated_at) AS newest_update
FROM tx_bills
GROUP BY session
ORDER BY session;

-- 2) Do we have vote summaries across sessions?
SELECT b.session, COUNT(v.*) AS vote_events
FROM tx_bills b
LEFT JOIN tx_vote_summary v ON v.bill_id = b.id
GROUP BY b.session
ORDER BY b.session;

-- 3) Intent vs. inventory
SELECT p.id, p.domain, p.kind,
       i.row_count_bills, i.row_count_votes, i.row_count_people, i.last_upsert
FROM data_partitions p
LEFT JOIN partition_inventory i ON i.partition_id = p.id
ORDER BY p.domain, p.kind, p.id;

-- 4) Storage usage vs free tier limit
SELECT * FROM check_storage_limits();

-- 5) Storage summary by domain (uses partition_inventory.storage_bytes)
SELECT * FROM storage_summary;

-- 6) Recent ingest runs
SELECT
  ir.partition_id,
  ir.started_at,
  ir.finished_at,
  ir.mode,
  ir.inserted_rows,
  ir.updated_rows,
  ir.deleted_rows,
  ir.skipped_rows,
  ir.ok,
  ir.error_message,
  EXTRACT(EPOCH FROM (ir.finished_at - ir.started_at)) AS duration_seconds
FROM ingest_runs ir
ORDER BY ir.started_at DESC
LIMIT 20;

-- 7) Partitions that need initial loading
SELECT
  p.id,
  p.label,
  p.domain,
  p.kind
FROM data_partitions p
LEFT JOIN partition_inventory i ON i.partition_id = p.id
WHERE p.intended = true
  AND (i.last_upsert IS NULL OR COALESCE(i.row_count_bills,0) = 0)
ORDER BY p.domain, p.id;

-- 8) Partitions with stale data (>7 days since last_upsert)
SELECT
  p.id,
  p.label,
  i.last_upsert,
  (CURRENT_TIMESTAMP - i.last_upsert) AS age
FROM data_partitions p
JOIN partition_inventory i ON i.partition_id = p.id
WHERE p.intended = true
  AND i.last_upsert < CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY i.last_upsert;

-- 9) Texas data coverage (function)
SELECT * FROM check_tx_data_coverage();

-- 10) Bills with recent activity (last 7 days)
SELECT
  session,
  bill_number,
  title,
  last_action,
  last_action_date,
  updated_at
FROM tx_bills
WHERE last_action_date > CURRENT_DATE - INTERVAL '7 days'
ORDER BY last_action_date DESC
LIMIT 50;

-- 11) Potential duplicates by bill_number across sessions (informational only)
WITH bill_counts AS (
  SELECT
    bill_number,
    COUNT(DISTINCT session) AS session_count,
    array_agg(DISTINCT session ORDER BY session) AS sessions
  FROM tx_bills
  GROUP BY bill_number
  HAVING COUNT(DISTINCT session) > 1
)
SELECT * FROM bill_counts
ORDER BY session_count DESC, bill_number
LIMIT 20;