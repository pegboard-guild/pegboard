import React, { useEffect, useRef, useState } from 'react';
import { Tag, ChevronRight, MessageCircle, ThumbsUp, ThumbsDown, Building2 } from 'lucide-react';
import { getTrendingBills, getPegCounters, getDistrict } from '../../services/supabase';
import { getRecentBills as getRecentBillsCongress, getCurrentCongress, getBillUrl } from '../../services/congressAPI';
import { getStateBills } from '../../services/openstates';
import { hyperlocalNow75205 } from '../../data/hyperlocal_75205';
import { localGovernmentService } from '../../services/localGovernmentService';
import ZipControl from '../components/ZipControl';

interface Props {
  scope: 'hyperlocal' | 'local' | 'state' | 'federal';
  setScope: (s: Props['scope']) => void;
  zipcode: string;
  state: string;
}

const Chip: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button className={`m-chip ${active ? 'active' : ''}`} onClick={onClick}>{label}</button>
);

type VoteRoster = { YES: string[]; NO: string[]; ABSTAIN: string[]; ABSENT: string[] };
type Card = { id: string; title: string; desc?: string; tagLabel?: string; tagClass?: string; ago?: string; loc?: string; votes?: VoteRoster; fullDesc?: string; statusKeys?: string[]; link?: string };

const MobileActivityFeed: React.FC<Props> = ({ scope, setScope, zipcode }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [counts, setCounts] = useState<Record<string, { up: number; down: number; comments: number }>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState<string>('TX');
  const [page, setPage] = useState<number>(0);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const pageSize = 10;
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [filterChips, setFilterChips] = useState<string[]>(['All']);
  const resetVersionRef = useRef<number>(0);

  function compactSentenceCase(s: string): string {
    if (!s) return '';
    const t = s
      .replace(/^(an?|the)\s+act\s+relating\s+to\s+/i, '')
      .replace(/^relating\s+to\s+/i, '')
      .replace(/^an?\s+act\s+/i, '')
      .replace(/^a\s+bill\s+to\s+/i, '');
    const first = t.split(/[.;]/)[0].trim();
    if (!first) return '';
    const capped = first.charAt(0).toUpperCase() + first.slice(1);
    return capped.length > 80 ? capped.slice(0, 77).trimEnd() + '…' : capped;
  }

  function getStateBillCompactTitle(b: any): string {
    if (b?.abstract && b.abstract.trim().length > 0) return compactSentenceCase(b.abstract);
    if (b?.title) return compactSentenceCase(b.title);
    return '';
  }

  function clip(text: string, max: number = 60): string {
    return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
  }

  function summarizeLocalAgendaTitle(raw?: string): string {
    const s = (raw || '').trim();
    if (!s) return 'Agenda item';
    const lower = s.toLowerCase();

    const after = (kw: string) => {
      const i = lower.indexOf(kw);
      if (i < 0) return null;
      let rest = s.slice(i + kw.length);
      rest = rest.replace(/^\s*:/, '');
      rest = rest.replace(/^\s*\(\d+\)\s*/, '');
      rest = rest.replace(/^\s*(the|an|a)\s+/i, '');
      return rest.trim();
    };

    const fromRegarding = after('regarding') || after('concerning');
    if (fromRegarding) return clip(`Public hearing: ${compactSentenceCase(fromRegarding)}`);

    const ordToIdx = lower.indexOf('ordinance to');
    if (ordToIdx >= 0) return clip(`Ordinance: ${compactSentenceCase(s.slice(ordToIdx + 'ordinance to'.length))}`);

    const hearingPrefix = /^a\s+public\s+hearing\s+to\s+receive\s+comments\b[:\s]*/i;
    if (hearingPrefix.test(s)) return clip(`Public hearing: ${compactSentenceCase(s.replace(hearingPrefix, ''))}`);

    return clip(compactSentenceCase(s));
  }

  function safeDateString(value?: string): string | undefined {
    if (!value) return undefined;
    const t = Date.parse(value);
    if (Number.isNaN(t)) return undefined;
    return new Date(t).toLocaleDateString();
  }

  function normalizeVote(v?: string): 'YES' | 'NO' | 'ABSTAIN' | 'ABSENT' | 'OTHER' {
    const s = (v || '').toUpperCase();
    if (s.includes('YES')) return 'YES';
    if (s.includes('NO')) return 'NO';
    if (s.includes('ABSTAIN') || s === 'ABST' || s === 'ABSTAINED') return 'ABSTAIN';
    if (s.includes('ABSENT') || s.includes('AWVT')) return 'ABSENT';
    return 'OTHER';
  }

  // Resolve state from zipcode (for state-level feed)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getDistrict(zipcode);
        if (alive) setStateCode(d?.state || 'TX');
      } catch (_) {
        if (alive) setStateCode('TX');
      }
    })();
    return () => { alive = false; };
  }, [zipcode]);

  // Reset paging when zipcode/scope changes
  useEffect(() => {
    resetVersionRef.current++;
    setCards([]);
    setCounts({});
    setPage(0);
    setHasMore(true);
    setActiveFilter('All');
    setFilterChips(['All']);
  }, [zipcode, scope, stateCode]);

  // Reset also when filter changes for non-hyperlocal scopes
  useEffect(() => {
    if (scope === 'hyperlocal') return;
    resetVersionRef.current++;
    setCards([]);
    setCounts({});
    setPage(0);
    setHasMore(true);
    // Kick off initial load for the new filter
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadPage(0);
  }, [activeFilter, scope]);

  // Recompute chips whenever cards change
  useEffect(() => {
    const set = new Set<string>();
    if (scope !== 'hyperlocal') {
      cards.forEach(c => (c.statusKeys || []).forEach(k => set.add(k)));
    }
    let arr = ['All', ...Array.from(set)];

    // Federal uses a fixed vocabulary regardless of currently loaded items
    if (scope === 'federal') {
      arr = ['All','Introduced','In Committee','Floor Action','Passed House','Passed Senate','Enacted','Vetoed','In Progress'];
    }

    setFilterChips(arr);
  }, [cards, scope]);

  async function loadPage(nextPage: number) {
    setLoadingMore(true);
    const offset = nextPage * pageSize;
    let mapped: Card[] = [];
    const myVersion = resetVersionRef.current;

    if (scope === 'hyperlocal') {
      const src = zipcode === '75205' ? hyperlocalNow75205 : [];
      mapped = src.slice(offset, offset + pageSize).map(i => ({
        id: `hyperlocal:${i.id}`,
        title: i.title,
        desc: i.subtitle || i.description,
        tagLabel: 'Local Action',
        tagClass: 'local',
        ago: i.start_date,
        loc: i.location || 'Nearby',
        statusKeys: ['Local Action']
      }));
      setCounts((prev) => prev); // unchanged for hyperlocal
    } else if (scope === 'local') {
      // Dallas City Council votes via edge (handles caching)
      const RAW_ROWS_PER_ITEM = 12; // approx council size
      const limit = Math.max(200, pageSize * (nextPage + 1) * RAW_ROWS_PER_ITEM);
      const votes = await localGovernmentService.getCityCouncilVotes(limit);

      // Group per agenda item (one card per item, not per member vote)
      type Agg = {
        date?: string;
        agenda_item_number?: string;
        agenda_item_description?: string;
        item_type?: string;
        final_action_taken?: string;
        counts: { YES: number; NO: number; ABSTAIN: number; ABSENT: number; OTHER: number };
        voters: { YES: string[]; NO: string[]; ABSTAIN: string[]; ABSENT: string[]; OTHER: string[] };
      };
      const byItem = new Map<string, Agg>();
      for (const v of votes as any[]) {
        const key = `${v.date || ''}::${v.agenda_item_number || (v.agenda_item_description || '').slice(0,80)}`;
        const existing = byItem.get(key) || {
          date: v.date,
          agenda_item_number: v.agenda_item_number,
          agenda_item_description: v.agenda_item_description,
          item_type: v.item_type,
          final_action_taken: v.final_action_taken,
          counts: { YES: 0, NO: 0, ABSTAIN: 0, ABSENT: 0, OTHER: 0 },
          voters: { YES: [], NO: [], ABSTAIN: [], ABSENT: [], OTHER: [] }
        } as Agg;
        const cat = normalizeVote(v.vote);
        existing.counts[cat] = (existing.counts[cat] || 0) + 1;
        if (v.voter_name) existing.voters[cat].push(String(v.voter_name));
        if (!existing.item_type && v.item_type) existing.item_type = v.item_type;
        if (!existing.final_action_taken && v.final_action_taken) existing.final_action_taken = v.final_action_taken;
        byItem.set(key, existing);
      }

      let aggregated = Array.from(byItem.entries())
        .sort((a, b) => (Date.parse(b[1].date || '') || 0) - (Date.parse(a[1].date || '') || 0));

      // Filter aggregated items if a filter is active
      if (activeFilter !== 'All') {
        const af = activeFilter.toUpperCase();
        aggregated = aggregated.filter(([, a]) => {
          const keys: string[] = [];
          if (a.item_type) keys.push(String(a.item_type).toUpperCase());
          if (a.final_action_taken) keys.push(String(a.final_action_taken).toUpperCase());
          return keys.includes(af);
        });
      }

      // Ensure stable unique keys by incorporating index in slice window
      const windowed = aggregated.slice(offset, offset + pageSize);

      mapped = windowed.map(([key, a], idx) => {
        const compactTitle = summarizeLocalAgendaTitle(a.agenda_item_description || '') || `Council vote ${a.agenda_item_number || ''}`.trim();
        const idSuffix = (a.agenda_item_number || compactTitle).replace(/\W+/g, '_');
        const countsText = [
          `Yes ${a.counts.YES}`,
          `No ${a.counts.NO}`,
          a.counts.ABSTAIN ? `Abstain ${a.counts.ABSTAIN}` : null,
          a.counts.ABSENT ? `Absent ${a.counts.ABSENT}` : null
        ].filter(Boolean).join(' • ');
        const outcome = (a.final_action_taken || '').toUpperCase();
        const desc = [countsText, outcome ? `Outcome: ${outcome}` : null].filter(Boolean).join(' • ');
        return {
          id: `dal-item:${key}:${idx}`,
          title: compactTitle,
          desc,
          tagLabel: a.item_type || 'Vote',
          tagClass: 'vote',
          ago: safeDateString(a.date),
          loc: 'City of Dallas',
          votes: { YES: a.voters.YES, NO: a.voters.NO, ABSTAIN: a.voters.ABSTAIN, ABSENT: a.voters.ABSENT },
          fullDesc: a.agenda_item_description,
          statusKeys: [
            ...(a.item_type ? [String(a.item_type).toUpperCase()] : []),
            ...(a.final_action_taken ? [String(a.final_action_taken).toUpperCase()] : [])
          ]
        } as Card;
      });

      // Batch counters to reduce N calls
      const ids = mapped.map(m => m.id);
      try {
        const { getPegCountersBatch } = await import('../../services/supabase');
        const batch = await getPegCountersBatch('vote', ids, zipcode);
        if (myVersion !== resetVersionRef.current) return; // stale
        const merged: Record<string, { up: number; down: number; comments: number }> = { ...counts };
        for (const id of ids) {
          merged[id] = batch[id] || { up: 0, down: 0, comments: 0 };
        }
        setCounts(merged);
      } catch (_) {
        const entries: Record<string, { up: number; down: number; comments: number }> = { ...counts };
        for (const v of mapped) {
          const c = await getPegCounters('vote', v.id, zipcode);
          entries[v.id] = { up: c.up, down: c.down, comments: c.comments };
        }
        if (myVersion === resetVersionRef.current) setCounts(entries);
      }
    } else if (scope === 'state') {
      const overFetchFactor = activeFilter === 'All' ? 1 : 3;
      const stateBills = await getStateBills(stateCode, { limit: pageSize * overFetchFactor, page: nextPage + 1 });

      const mapStatus = (classes?: string[]): { label: string; css: string } => {
        const set = new Set((classes || []).map(c => c.toLowerCase()));
        if (set.has('enacted')) return { label: 'Enacted', css: 'status-enacted' };
        if (set.has('vetoed')) return { label: 'Vetoed', css: 'status-vetoed' };
        if (set.has('passed-lower')) return { label: 'Passed House', css: 'status-passed' };
        if (set.has('passed-upper')) return { label: 'Passed Senate', css: 'status-passed' };
        if (set.has('passed')) return { label: 'Passed', css: 'status-passed' };
        if (set.has('committee-passage') || set.has('committee-referral') || set.has('committee-hearing')) return { label: 'In Committee', css: 'status-committee' };
        if (set.has('introduced')) return { label: 'Introduced', css: 'status-introduced' };
        return { label: 'In Progress', css: 'status-progress' };
      };

      mapped = (stateBills || []).map((b: any) => {
        const st = mapStatus(b.latest_action?.classification);
        const compact = getStateBillCompactTitle(b);
        return {
          id: b.id,
          title: `${b.identifier || 'Bill'}${compact ? ': ' + compact : ''}`,
          desc: b.title,
          tagLabel: st.label,
          tagClass: st.css,
          ago: b.latest_action?.date,
          loc: b.jurisdiction?.name || 'State Legislature',
          statusKeys: [st.label],
          link: b.openstates_url
        };
      });

      if (activeFilter !== 'All') {
        const filtered = mapped.filter(c => (c.statusKeys || []).includes(activeFilter));
        const windowed = filtered.slice(offset, offset + pageSize);
        mapped = windowed;
      }
    } else {
      const cc = getCurrentCongress();
      const mapFedStatus = (text?: string): { label: string; css: string } => {
        const s = (text || '').toLowerCase();
        if (s.includes('became public law') || s.includes('enacted')) return { label: 'Enacted', css: 'status-enacted' };
        if (s.includes('veto')) return { label: 'Vetoed', css: 'status-vetoed' };
        if (s.includes('passed the house') || s.includes('passed house')) return { label: 'Passed House', css: 'status-passed' };
        if (s.includes('passed the senate') || s.includes('passed senate')) return { label: 'Passed Senate', css: 'status-passed' };
        if (s.includes('introduced')) return { label: 'Introduced', css: 'status-introduced' };
        if (s.includes('committee') || s.includes('referred to the')) return { label: 'In Committee', css: 'status-committee' };
        if (s.includes('calendar') || s.includes('cloture')) return { label: 'Floor Action', css: 'status-progress' };
        return { label: 'In Progress', css: 'status-progress' };
      };

      let recent: any[] = [];
      if (activeFilter === 'All') {
        recent = await getRecentBillsCongress(cc, pageSize, offset);
      } else {
        // Progressive backfill for filtered federal statuses
        const chunkSize = 100; // fetch larger chunks for speed
        const desiredMatches = Math.max((nextPage + 1) * pageSize, 30); // aim for at least 30 matches
        let chunkOffset = 0;
        let attempts = 0;
        const maxAttempts = 10; // up to 1000 items scanned
        const matches: any[] = [];
        while (matches.length < desiredMatches && attempts < maxAttempts) {
          const chunk = await getRecentBillsCongress(cc, chunkSize, chunkOffset);
          if (myVersion !== resetVersionRef.current) break; // abort on reset
          const chunkMatches = (chunk || []).filter((b: any) => mapFedStatus(b.latestAction?.text).label === activeFilter);
          matches.push(...chunkMatches);
          if (!chunk || chunk.length < chunkSize) break; // reached end
          chunkOffset += chunkSize;
          attempts++;
        }
        recent = matches;
      }

      mapped = (recent || []).map((b: any) => {
        const st = mapFedStatus(b.latestAction?.text);
        return {
          id: `${b.congress}-${b.type}-${b.number}`,
          title: b.title,
          desc: b.latestAction?.text,
          tagLabel: st.label,
          tagClass: st.css,
          ago: b.latestAction?.actionDate,
          loc: b.originChamber,
          statusKeys: [st.label],
          link: getBillUrl(b)
        };
      });

      if (activeFilter !== 'All') {
        const filtered = mapped.filter(c => (c.statusKeys || []).includes(activeFilter));
        mapped = filtered.slice(offset, offset + pageSize);
      }
    }

    // Append deduped
    if (myVersion !== resetVersionRef.current) {
      setLoadingMore(false);
      return;
    }
    setCards(prev => {
      const existing = new Set(prev.map(c => c.id));
      const dedup = mapped.filter(c => !existing.has(c.id));
      return [...prev, ...dedup];
    });
    // Heuristic: if we returned fewer than pageSize items under a filter, keep hasMore true to allow further backfill
    const underFilter = activeFilter !== 'All' && (scope === 'state' || scope === 'federal' || scope === 'local');
    setHasMore(underFilter ? true : mapped.length === pageSize);
    setPage(nextPage);
    setLoadingMore(false);
  }

  // Initial load and reload on reset
  useEffect(() => {
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipcode, scope, stateCode]);
  return (
    <div className="m-page">
      <div className="m-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Activity Feed</h1>
        <ZipControl zipcode={zipcode} />
        <div className="m-chips">
          <Chip active={scope==='hyperlocal'} label="Hyperlocal" onClick={()=>setScope('hyperlocal')} />
          <Chip active={scope==='local'} label="Local" onClick={()=>setScope('local')} />
          <Chip active={scope==='state'} label="State" onClick={()=>setScope('state')} />
          <Chip active={scope==='federal'} label="Federal" onClick={()=>setScope('federal')} />
        </div>
      </div>

      {(scope === 'local' || scope === 'state' || scope === 'federal') && (
        <div style={{ marginTop: 8, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {filterChips.map(s => (
            <button key={s} className={`m-chip ${activeFilter===s ? 'active' : ''}`} onClick={()=>setActiveFilter(s)}>{s}</button>
          ))}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="m-card"><div className="m-card-img-skel" /><p className="m-card-desc">No activity yet for your area.</p></div>
      ) : (
        cards.map((c) => {
          const tagClass = c.tagClass || ((scope === 'local' || scope === 'hyperlocal') ? 'local' : (scope === 'federal' ? 'vote' : 'decision'));
          const tagLabel = c.tagLabel || (scope === 'hyperlocal' ? 'Local Action' : (scope === 'local' ? 'Local Action' : (scope === 'state' ? 'State' : 'Federal')));
          return (
            <div className="m-card" key={c.id} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
              <div className="m-card-head">
                <span className={`m-card-tag ${tagClass}`}>{tagLabel}</span>
                {c.ago && <span className="m-card-time">{c.ago}</span>}
              </div>
              <h2 className="m-card-title">{c.title}</h2>
              {c.desc && <p className="m-card-desc">{c.desc}</p>}
              <div className="m-card-foot">
                <span className="m-card-loc"><Building2 size={14} /> {c.loc || (scope === 'state' ? 'State Legislature' : 'City Hall')}</span>
                <button className="m-card-more" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === c.id ? null : c.id); }}>
                  {expandedId === c.id ? 'Show Less' : 'Show More'} <ChevronRight size={14} />
                </button>
              </div>
              {expandedId === c.id && (
                <div className="m-card-details" style={{ padding: '8px 0 0 0' }}>
                  {scope === 'local' && c.votes ? (
                    <div className="m-vote-roster" style={{ fontSize: 13, lineHeight: '18px' }}>
                      <div><strong>Yes ({c.votes.YES.length})</strong>: {c.votes.YES.join(', ') || '—'}</div>
                      <div><strong>No ({c.votes.NO.length})</strong>: {c.votes.NO.join(', ') || '—'}</div>
                      {c.votes.ABSTAIN?.length ? <div><strong>Abstain ({c.votes.ABSTAIN.length})</strong>: {c.votes.ABSTAIN.join(', ')}</div> : null}
                      {c.votes.ABSENT?.length ? <div><strong>Absent ({c.votes.ABSENT.length})</strong>: {c.votes.ABSENT.join(', ')}</div> : null}
                      {c.fullDesc ? <div style={{ marginTop: 6, color: '#555' }}>{c.fullDesc}</div> : null}
                    </div>
                  ) : (
                    <>
                      {c.fullDesc ? <div style={{ fontSize: 13, color: '#555' }}>{c.fullDesc}</div> : null}
                      {c.link && (
                        <div style={{ marginTop: 10 }}>
                          <a className="m-card-more" href={c.link} target="_blank" rel="noopener noreferrer">View full legislation →</a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="m-card-actions">
                <span className="m-act"><ThumbsUp size={16} /> {counts[c.id]?.up ?? 0}</span>
                <span className="m-act"><ThumbsDown size={16} /> {counts[c.id]?.down ?? 0}</span>
                <span className="m-act"><MessageCircle size={16} /> {counts[c.id]?.comments ?? 0}</span>
              </div>
            </div>
          );
        })
      )}

      {hasMore && (
        <div style={{ padding: '8px 16px' }}>
          <button className="m-card-more" disabled={loadingMore} onClick={() => loadPage(page + 1)}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileActivityFeed;


