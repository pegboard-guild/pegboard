-- Inventory Queries for Bulk Data Management
-- Based on ChatGPT5 Pro's recommendations
-- Run these to baseline coverage vs. intention

-- 1. What Texas sessions are actually present, and how fresh
SELECT session, count(*) AS bills, max(updated_at) AS newest_update
FROM tx_bills
GROUP BY session
ORDER BY session;

-- 2. Do we have vote summaries across sessions?
SELECT b.session, count(v.*) AS vote_events
FROM tx_bills b
LEFT JOIN tx_vote_summary v ON v.bill_id = b.id
GROUP BY b.session
ORDER BY b.session;

-- 3. Compare intent vs. inventory
SELECT p.id, p.domain, p.kind,
       i.row_count_bills, i.row_count_votes, i.row_count_people, i.last_upsert
FROM data_partitions p
LEFT JOIN partition_inventory i ON i.partition_id = p.id
ORDER BY p.domain, p.kind, p.id;

-- 4. Check storage usage against free tier limits
SELECT * FROM check_storage_limits();

-- 5. Storage summary by domain
SELECT * FROM storage_summary;

-- 6. Recent ingest runs and their status
SELECT
  ir.partition_id,
  ir.started_at,
  ir.finished_at,
  ir.mode,
  ir.inserted_rows,
  ir.updated_rows,
  ir.deleted_rows,
  ir.ok,
  ir.error_message,
  EXTRACT(EPOCH FROM (ir.finished_at - ir.started_at)) as duration_seconds
FROM ingest_runs ir
ORDER BY ir.started_at DESC
LIMIT 20;

-- 7. Partitions that need initial loading
SELECT
  p.id,
  p.label,
  p.domain,
  p.kind
FROM data_partitions p
LEFT JOIN partition_inventory i ON i.partition_id = p.id
WHERE p.intended = true
  AND (i.last_upsert IS NULL OR i.row_count_bills = 0)
ORDER BY p.domain, p.id;

-- 8. Partitions with stale data (not updated in 7 days)
SELECT
  p.id,
  p.label,
  i.last_upsert,
  CURRENT_DATE - i.last_upsert::date as days_old
FROM data_partitions p
JOIN partition_inventory i ON i.partition_id = p.id
WHERE p.intended = true
  AND i.last_upsert < CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY i.last_upsert;

-- 9. Texas data coverage check
SELECT * FROM check_tx_data_coverage();

-- 10. API cache entries by source
SELECT
  metadata->>'source' as source,
  COUNT(*) as entries,
  MIN(created_at) as oldest,
  MAX(created_at) as newest,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active,
  COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired
FROM api_cache
WHERE metadata->>'source' IS NOT NULL
GROUP BY metadata->>'source'
ORDER BY entries DESC;

-- 11. Check for duplicate bills across partitions
WITH bill_counts AS (
  SELECT
    bill_number,
    COUNT(DISTINCT session) as session_count,
    array_agg(DISTINCT session ORDER BY session) as sessions
  FROM tx_bills
  GROUP BY bill_number
  HAVING COUNT(DISTINCT session) > 1
)
SELECT * FROM bill_counts
ORDER BY session_count DESC, bill_number
LIMIT 20;

-- 12. Bills with recent activity (last 7 days)
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