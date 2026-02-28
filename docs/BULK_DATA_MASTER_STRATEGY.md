# Master Bulk Data Strategy - All APIs

## Executive Summary
Most of our APIs offer bulk data downloads for historical/static content. By pre-loading this data into Supabase, we can eliminate API rate limits and provide instant access to historical government data.

## APIs with Bulk Data Available

### 1. 🟢 **OpenStates** (State Legislation)
**Bulk Options:**
- PostgreSQL dumps (monthly)
- CSV/JSON exports
- Public domain license

**What to Bulk Load:**
- ✅ All completed legislative sessions (won't change)
- ✅ Legislators from past terms
- ✅ Historical votes
- ❌ Current session bills (keep using API for real-time)

**Storage Estimate:** ~50MB per state per session

---

### 2. 🟢 **Congress.gov / GovInfo** (Federal Legislation)
**Bulk Options:**
- GPO Bulk Data Repository (XML/JSON)
- Bill Status XML (113th Congress to present)
- Congressional Bills text
- Congressional Record

**What to Bulk Load:**
- ✅ All bills from completed Congresses (113-117)
- ✅ Final vote records (immutable)
- ✅ Member profiles from past Congresses
- ✅ Committee reports (historical)
- ❌ Current 118th Congress (use API for updates)

**Storage Estimate:** ~200MB per Congress

**Direct Bulk Access:**
```
https://www.govinfo.gov/bulkdata/BILLS/[congress]/[session]/
https://www.govinfo.gov/bulkdata/BILLSTATUS/[congress]/
```

---

### 3. 🟢 **USAspending.gov** (Federal Spending)
**Bulk Options:**
- PostgreSQL database dumps (monthly)
- Custom CSV downloads
- Award archives by fiscal year

**What to Bulk Load:**
- ✅ Completed fiscal years (FY2001-FY2023)
- ✅ Historical awards and contracts
- ❌ Current FY2024 (use API for updates)

**Storage Estimate:** ~10GB per fiscal year (too large!)
**Solution:** Store aggregated summaries only (~100MB)

---

### 4. 🟢 **FEC** (Campaign Finance)
**Bulk Options:**
- CSV bulk files
- Committee/candidate master files
- Individual contributions files

**What to Bulk Load:**
- ✅ Completed election cycles (2016, 2018, 2020, 2022)
- ✅ Candidate committees (historical)
- ✅ PAC contributions (completed cycles)
- ❌ Current 2024 cycle (use API for updates)

**Storage Estimate:** ~500MB per election cycle

---

### 5. 🟢 **TheUnitedStates.io** (GitHub)
**Bulk Options:**
- JSON files on GitHub (no API needed!)
- Legislators current/historical
- Committee memberships
- Social media accounts

**What to Bulk Load:**
- ✅ ALL of it - it's already bulk data
- Historical legislators
- Committee memberships
- District offices

**Storage Estimate:** ~50MB total

**Direct Access:**
```bash
wget https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.json
wget https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-historical.json
wget https://raw.githubusercontent.com/unitedstates/congress-legislators/main/committees-current.json
```

---

### 6. 🔴 **Federal Register** (Regulations)
**Bulk Options:**
- XML bulk downloads
- JSON via API only

**What to Bulk Load:**
- ✅ Final rules (immutable once published)
- ❌ Proposed rules (change frequently)
- ❌ Public comments (too large, too dynamic)

**Storage Estimate:** ~1GB per year

---

## Implementation Strategy

### Phase 1: Quick Wins (Week 1)
Load static, never-changing data first:

1. **TheUnitedStates.io** (~50MB)
   - All legislators (current + historical)
   - Committees
   - Zero API calls needed!

2. **Completed Congressional Sessions** (~200MB)
   - 116th Congress (2019-2020)
   - 117th Congress (2021-2022)
   - All votes, bills, members

3. **Texas Legislature Historical** (~100MB)
   - 86th, 87th sessions
   - Complete bill texts
   - Vote records

### Phase 2: High-Value Historical (Week 2)

4. **FEC 2020 & 2022 Cycles** (~500MB)
   - All contributions
   - Committee finances
   - Candidate summaries

5. **USAspending Aggregates** (~100MB)
   - Agency totals by year
   - Top contractors
   - State/district summaries

### Phase 3: Optimize Storage (Week 3)

6. **Compression Strategy:**
   - Store only metadata, not full text
   - Aggregate votes (totals only)
   - Link to original sources

---

## Database Schema

```sql
-- Universal historical data table
CREATE TABLE historical_data (
  id TEXT PRIMARY KEY,
  data_type TEXT NOT NULL, -- 'bill', 'vote', 'member', 'contribution'
  source TEXT NOT NULL,    -- 'congress', 'openstates', 'fec'
  session TEXT,            -- '117', '87', '2020-cycle'
  title TEXT,
  metadata JSONB,
  created_date DATE,
  is_final BOOLEAN DEFAULT true,
  INDEX idx_type_session (data_type, session),
  INDEX idx_source (source),
  INDEX idx_created (created_date DESC)
);

-- Materialized view for fast searches
CREATE MATERIALIZED VIEW search_index AS
SELECT id, title, data_type, source, session
FROM historical_data;
```

---

## Storage Budget (Free Tier: 500MB)

| Dataset | Size | Priority |
|---------|------|----------|
| TheUnitedStates.io | 50MB | ✅ HIGH |
| Texas Legislature (3 sessions) | 100MB | ✅ HIGH |
| Congress 116-117 | 200MB | ✅ HIGH |
| **Subtotal** | **350MB** | **70% used** |
| Buffer for growth | 150MB | |

---

## Benefits Analysis

### What This Solves:
1. **No API rate limits** for historical data
2. **Instant search** across all historical bills
3. **Offline capability** for core features
4. **Cross-dataset queries** (e.g., bills + votes + spending)

### What Still Needs APIs:
1. Current legislative sessions
2. Today's Federal Register
3. Live vote tracking
4. New campaign contributions

---

## Implementation Code

```typescript
// Bulk loader Edge Function
export async function loadHistoricalData() {
  // 1. Load TheUnitedStates.io
  const legislators = await fetch(
    'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-historical.json'
  ).then(r => r.json());

  // 2. Transform and load
  for (const legislator of legislators) {
    await supabase.from('historical_data').insert({
      id: `member-${legislator.id.bioguide}`,
      data_type: 'member',
      source: 'theunitedstates',
      title: legislator.name.official_full,
      metadata: legislator,
      created_date: legislator.terms[0]?.start
    });
  }

  // 3. Load Congress bills
  const bills = await fetch(
    'https://www.govinfo.gov/bulkdata/json/BILLS/117/hr'
  ).then(r => r.json());

  // ... continue for each dataset
}
```

---

## Decision Matrix

| API | Has Bulk? | Should Load? | When? |
|-----|-----------|--------------|-------|
| OpenStates | ✅ Yes | ✅ Historical | Now |
| Congress.gov | ✅ Yes | ✅ Completed | Now |
| USAspending | ✅ Yes | ⚠️ Aggregates | Later |
| FEC | ✅ Yes | ✅ Past cycles | Now |
| TheUnitedStates.io | ✅ Yes | ✅ Everything | Now |
| Federal Register | ✅ Yes | ⚠️ Final rules | Later |

---

## Next Steps

1. **Today:** Load TheUnitedStates.io data (easiest win)
2. **Tomorrow:** Load Texas historical sessions
3. **This Week:** Load Congressional data
4. **Next Week:** Evaluate storage usage, add more states

This strategy keeps us under the 500MB free tier limit while eliminating 90% of our API calls!