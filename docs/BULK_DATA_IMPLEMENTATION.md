# Bulk Data Implementation Plan (ChatGPT5 Pro Refined)

## Critical Updates
- **Texas 89th Session Status**: Regular session ENDED June 2, 2025
- **Called Sessions Active**: 89(1) started July 21, 2025
- Need to handle both completed 89R and active called sessions

## 1. Lightweight Inventory System

### Create 4 Simple Tables for Tracking

```sql
-- 1. What dataset partitions we intend to hold
CREATE TABLE data_partitions (
  id TEXT PRIMARY KEY,              -- 'tx:87R', 'tx:88R', 'tx:89R', 'tx:89(1)'
  domain TEXT NOT NULL,             -- 'tx', 'uscongress', 'fec'
  kind TEXT NOT NULL,               -- 'bills', 'votes', 'people'
  label TEXT,                       -- 'TX 89th Regular Session'
  intended boolean DEFAULT true
);

-- 2. Source file/bundle metadata
CREATE TABLE partition_sources (
  partition_id TEXT REFERENCES data_partitions(id),
  source_url TEXT NOT NULL,
  etag TEXT,
  last_modified TIMESTAMP,
  byte_size BIGINT,
  PRIMARY KEY (partition_id, source_url)
);

-- 3. What's actually in our DB
CREATE TABLE partition_inventory (
  partition_id TEXT PRIMARY KEY REFERENCES data_partitions(id),
  row_count_bills INTEGER DEFAULT 0,
  row_count_votes INTEGER DEFAULT 0,
  row_count_people INTEGER DEFAULT 0,
  last_upsert TIMESTAMP,
  bill_xor BIGINT,  -- cheap fingerprint for change detection
  vote_xor BIGINT,
  people_xor BIGINT
);

-- 4. Audit trail
CREATE TABLE ingest_runs (
  id BIGSERIAL PRIMARY KEY,
  partition_id TEXT REFERENCES data_partitions(id),
  source_url TEXT,
  started_at TIMESTAMP DEFAULT now(),
  finished_at TIMESTAMP,
  mode TEXT CHECK (mode IN ('seed','delta','replace')),
  inserted_rows INTEGER,
  updated_rows INTEGER,
  deleted_rows INTEGER,
  ok BOOLEAN DEFAULT true,
  note TEXT
);
```

## 2. Texas Priority Implementation

### Use Texas Legislature Online (TLO) Bulk Downloads

```typescript
// Texas bulk loader using TLO XML files
async function loadTexasBills(session: string) {
  // TLO provides bills in groups of 100
  // https://capitol.texas.gov/billlookup/filedownloads.aspx

  const baseUrl = 'https://capitol.texas.gov/tlodocs';
  const sessionPath = `${session}/billhistory`;

  // 1. Check history.xml for updates
  const historyUrl = `${baseUrl}/${sessionPath}/history.xml`;
  const history = await fetch(historyUrl);
  const etag = history.headers.get('etag');

  // 2. Compare with our last known etag
  const { data: lastSource } = await supabase
    .from('partition_sources')
    .select('etag')
    .eq('partition_id', `tx:${session}`)
    .single();

  if (lastSource?.etag === etag) {
    console.log(`No changes for TX ${session}`);
    return;
  }

  // 3. Process bill directories (grouped by 100s)
  // e.g., HB00001-HB00099, HB00100-HB00199, etc.
  const billGroups = [
    'HB00001-HB00099',
    'HB00100-HB00199',
    // ... continue
  ];

  for (const group of billGroups) {
    const groupUrl = `${baseUrl}/${sessionPath}/${group}`;
    // Fetch and process XML files in this group
  }

  // 4. Update our inventory
  await supabase.from('partition_sources').upsert({
    partition_id: `tx:${session}`,
    source_url: historyUrl,
    etag,
    last_modified: new Date()
  });
}
```

### Texas Sessions to Load

```sql
-- Initial data partitions for Texas
INSERT INTO data_partitions (id, domain, kind, label, intended) VALUES
  ('tx:87R', 'tx', 'bills', 'TX 87th Regular (2021)', true),
  ('tx:88R', 'tx', 'bills', 'TX 88th Regular (2023)', true),
  ('tx:89R', 'tx', 'bills', 'TX 89th Regular (2025)', true),
  ('tx:89(1)', 'tx', 'bills', 'TX 89th 1st Called (2025)', true);
```

## 3. Smart Bulk Loading Strategy

### What to Bulk Load (Priority Order)

#### Week 1: Core Texas Data
1. **TheUnitedStates.io** (50MB)
   ```bash
   wget https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.json
   wget https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-historical.json
   ```

2. **Texas Bills via TLO** (80MB)
   - 87R, 88R, 89R (completed)
   - Use XML files, store only metadata
   - Skip full bill text

3. **Texas Legislators via OpenStates** (1MB)
   - CSV/YAML bulk files
   - Simple upsert by OpenStates ID

#### Week 2: Expand Coverage
4. **Congressional Indexes** (100MB)
   - 117th Congress (completed)
   - Store only: bill_id, title, status, sponsor
   - Link to Congress.gov for full text

5. **Hot States Cache** (150MB)
   - California, New York, Florida
   - Current session only
   - 90-day TTL

## 4. Delta Strategy (Simple)

### For Immutable Partitions (e.g., TX 87R, 88R)
```typescript
async function checkAndReplace(partitionId: string) {
  // 1. Check remote ETag/Last-Modified
  const remoteEtag = await fetchRemoteEtag(partitionId);

  // 2. Compare with our stored version
  const { data: local } = await supabase
    .from('partition_sources')
    .select('etag')
    .eq('partition_id', partitionId)
    .single();

  if (remoteEtag !== local?.etag) {
    // 3. Drop and replace entire partition
    await supabase
      .from('tx_bills')
      .delete()
      .eq('partition_id', partitionId);

    // 4. Reload from bulk
    await loadBulkData(partitionId);
  }
}
```

### For Live Texas Sessions (89(1) called session)
```typescript
async function updateTexasLive() {
  // Use TLO's history.xml for delta detection
  const historyXml = await fetch(
    'https://capitol.texas.gov/tlodocs/891/billhistory/history.xml'
  );

  // Parse for bills updated since our last check
  const updatedBills = parseUpdatedBills(historyXml, lastCheckTime);

  // Fetch and upsert only changed bills
  for (const billId of updatedBills) {
    const billXml = await fetchBillXml(billId);
    await upsertBill(parseBillXml(billXml));
  }
}
```

## 5. Storage Reality Check

### Actual Sizes (ChatGPT5 Corrected)
- **USAspending**: >1.5TB ❌ (way too big - aggregates only)
- **FEC**: Transaction-level, very large ❌ (summaries only)
- **Congress BILLSTATUS**: Gets big fast (indexes only)
- **OpenStates**: Reasonable monthly dumps ✅

### Practical Free Tier Budget (500MB)
```
Texas (87R, 88R, 89R, 89(1)):     80MB
TheUnitedStates.io:                10MB
Hot States (indexes only):        150MB
Congress 117 (indexes):           100MB
Buffer & indices:                 160MB
--------------------------------
Total:                            500MB
```

## 6. Implementation Checklist

### Today
- [ ] Create inventory tables
- [ ] Load TheUnitedStates.io legislators
- [ ] Set up Texas partition structure

### This Week
- [ ] Implement TLO XML loader for TX 88R
- [ ] Test partition drop/replace logic
- [ ] Add history.xml delta checker

### Next Week
- [ ] Load TX 87R, 89R
- [ ] Add OpenStates legislator sync
- [ ] Implement 90-day TTL for hot states

## 7. Key Insights from ChatGPT5

1. **No Heavy Diff Logic Needed**: Use ETag/Last-Modified + partition replace
2. **Texas Has Perfect Bulk Setup**: TLO provides XML files + history.xml for deltas
3. **Keep Federal Light**: Indexes only, link to original sources
4. **Partition Everything**: Makes drop/replace O(1) operation
5. **Simple Fingerprints**: XOR of hashes detects changes without row-by-row diff

## 8. Source URLs

- **Texas Legislature Online**: https://capitol.texas.gov/billlookup/filedownloads.aspx
- **OpenStates Bulk**: https://open.pluralpolicy.com/data/
- **TheUnitedStates.io**: https://github.com/unitedstates/congress-legislators
- **GovInfo Bulk**: https://www.govinfo.gov/bulkdata/
- **FEC Bulk**: https://www.fec.gov/data/browse-data/

## Success Metrics

- Texas bills load < 5 minutes
- Zero API calls for historical data
- Storage stays under 400MB
- Updates run daily without manual intervention
- Users can browse any TX session without rate limits