# Free Tier Data Strategy

## Goal
Stay within Supabase free tier (500MB database) while providing excellent Texas legislative data coverage.

## Phase 1: Texas Only (Immediate) - ~100MB total
Load only Texas data to start:

### Data to Load:
1. **Current Session (88th - 2023)**: ~20MB
   - ~7,000 bills with metadata
   - ~150 legislators
   - Recent votes only (last 100)

2. **Previous Session (87th - 2021)**: ~20MB
   - Bills and key votes
   - Historical reference

3. **Upcoming Session (89th - 2025)**: ~5MB
   - Pre-filed bills
   - Session calendar

**Total: ~45MB** (well under 500MB limit)

### Implementation:
```sql
-- Minimal schema for Texas
CREATE TABLE tx_bills (
  id TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  bill_number TEXT NOT NULL,
  title TEXT,
  abstract TEXT,  -- First 500 chars only
  sponsors JSONB,
  status TEXT,
  last_action TEXT,
  last_action_date DATE,
  subjects TEXT[],
  updated_at TIMESTAMP,
  INDEX idx_session (session),
  INDEX idx_updated (updated_at DESC)
);

CREATE TABLE tx_legislators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT,
  chamber TEXT,
  party TEXT,
  email TEXT,
  image_url TEXT,
  current BOOLEAN DEFAULT true
);

-- Only store aggregate votes, not individual records
CREATE TABLE tx_vote_summary (
  id TEXT PRIMARY KEY,
  bill_id TEXT REFERENCES tx_bills(id),
  vote_date DATE,
  yeas INTEGER,
  nays INTEGER,
  present INTEGER,
  absent INTEGER,
  result TEXT
);
```

## Phase 2: Smart Caching (After Launch) - ~200MB
Add intelligent caching for other states:

1. **Hot States Cache** (~150MB)
   - California, Florida, New York
   - Current session only
   - Auto-expire after 90 days

2. **User-Driven Cache** (~50MB)
   - Cache states as users request them
   - LRU eviction when approaching limits
   - Keep Texas data permanent

## Phase 3: Optimize Storage

### Compression Techniques:
1. **Truncate abstracts**: Store first 500 chars, fetch full via API if needed
2. **Aggregate votes**: Store totals, not individual votes (saves 90% space)
3. **JSON compression**: Use JSONB, remove whitespace
4. **Archive old sessions**: Move to cold storage after 2 years

### What NOT to Store:
- Full bill text (fetch on-demand)
- Individual vote records (use aggregates)
- Committee meeting transcripts
- Historical sessions beyond 2 years
- Other states (until Phase 2)

## Storage Math:

### Current Plan (Texas only):
- Bills (3 sessions): 45MB
- Legislators: 1MB
- Vote summaries: 5MB
- Committees: 1MB
- **Total: ~52MB** ✅ (10% of free tier)

### With Smart Additions:
- Texas (permanent): 52MB
- Hot states cache: 150MB
- User cache: 50MB
- Buffer: 248MB
- **Total: ~250MB** ✅ (50% of free tier)

## Benefits:
1. **No rate limits** on Texas data
2. **Fast performance** for primary use case
3. **Room to grow** - Using only 10% initially
4. **Sustainable** - Can run free for months
5. **Upgradeable** - Easy to add more states when ready

## Implementation Steps:

### Week 1:
1. Create Supabase tables for Texas
2. Write bulk data loader Edge Function
3. Load 88th session data
4. Update frontend to query Supabase

### Week 2:
1. Add 87th session (historical)
2. Add vote summaries
3. Implement data freshness checks
4. Add "last updated" indicators

### Week 3:
1. Monitor storage usage
2. Add cache eviction logic
3. Document expansion plan
4. Prepare for other states

## Monitoring:
```sql
-- Check database size
SELECT pg_database_size('postgres') / 1024 / 1024 as size_mb;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Upgrade Triggers:
Consider paid tier ($25/month) when:
- Database exceeds 400MB
- Need real-time vote tracking
- Want all 50 states
- API requests exceed 40k/month

## Fallback Plan:
If we hit limits:
1. Clear cache tables first
2. Archive old sessions
3. Reduce abstract length
4. Remove images/URLs
5. Aggregate more data

This strategy keeps us comfortably within free tier limits while providing excellent functionality for Texas users!