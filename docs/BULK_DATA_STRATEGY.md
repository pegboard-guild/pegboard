# Bulk Data Loading Strategy

## Problem
- OpenStates API rate limit: 10 requests/hour (free tier)
- Makes the app unusable for browsing state legislation
- Users can't explore different sessions without hitting limits

## Solution: Bulk Data Loading

### Available Bulk Data Sources

1. **OpenStates Bulk Data** (https://open.pluralpolicy.com/data/)
   - PostgreSQL dumps (monthly)
   - CSV/JSON exports
   - Public domain license
   - Includes: legislators, bills, votes, committees

2. **TheUnitedStates.io** (GitHub)
   - JSON files for federal legislators
   - Committee memberships
   - Historical data

3. **GovTrack Bulk Data**
   - RSS feeds
   - Historical bill data
   - Vote records

### Implementation Plan

#### Phase 1: Create Bulk Data Loader (Immediate)
```typescript
// supabase/functions/sync-openstates-bulk/index.ts
// Run monthly via cron job
async function syncOpenStatesBulk() {
  // 1. Download PostgreSQL dump or CSV files
  // 2. Parse and transform data
  // 3. Load into Supabase tables:
  //    - state_bills
  //    - state_legislators
  //    - state_votes
  //    - state_committees
}
```

#### Phase 2: Database Schema
```sql
-- State bills table with all sessions
CREATE TABLE state_bills (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  session TEXT NOT NULL,
  identifier TEXT NOT NULL,
  title TEXT,
  abstract TEXT,
  subjects TEXT[],
  sponsors JSONB,
  updated_at TIMESTAMP,
  created_at TIMESTAMP,
  openstates_url TEXT,
  INDEX idx_state_session (state, session),
  INDEX idx_updated (updated_at DESC)
);

-- State legislators
CREATE TABLE state_legislators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  chamber TEXT,
  district TEXT,
  party TEXT,
  email TEXT,
  phone TEXT,
  image_url TEXT,
  current_role JSONB,
  updated_at TIMESTAMP
);
```

#### Phase 3: Update Frontend Services
```typescript
// Use Supabase directly instead of OpenStates API
export async function getStateBills(state: string, session: string) {
  const { data, error } = await supabase
    .from('state_bills')
    .select('*')
    .eq('state', state)
    .eq('session', session)
    .order('updated_at', { ascending: false })
    .limit(100);

  return data || [];
}
```

### Benefits
1. **No rate limits** - Query our own database
2. **Better performance** - Local queries vs API calls
3. **Offline capability** - Data available even if OpenStates is down
4. **Historical data** - Keep all sessions permanently
5. **Cost effective** - Free tier Supabase handles this easily

### Data Freshness Strategy
- **Daily sync**: Check for updates
- **Weekly full sync**: Complete data refresh
- **Manual trigger**: Admin can force refresh
- **Incremental updates**: Only fetch changed records

### Storage Estimates
- Texas bills (all sessions): ~50MB
- All states bills: ~2GB
- Legislators (all states): ~10MB
- Votes: ~500MB
- **Total**: Well within Supabase free tier (500MB database)

### Implementation Timeline
1. Week 1: Create sync functions and database schema
2. Week 2: Load Texas data as pilot
3. Week 3: Expand to all states
4. Week 4: Add incremental update logic

### Alternative: Use Cached Proxy
If bulk loading is too complex initially:
1. Keep using OpenStates API
2. Cache aggressively (30-day TTL for old sessions)
3. Show cached data with "last updated" timestamp
4. Add "Pro" tier with higher rate limits

## Recommendation
Implement bulk data loading for state legislative data immediately. This removes the biggest bottleneck in the app and provides a much better user experience.