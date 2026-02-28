import React, { useEffect, useState } from 'react';
import { MessageCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { getAllRepresentatives, EnhancedMember } from '../../services/representativeService';
import { getPegCounters } from '../../services/supabase';
import { getLegislatorVotes, OpenStatesVote, searchBills, OpenStatesBill } from '../../services/openstates';

interface Props {
  scope: 'hyperlocal' | 'local' | 'state' | 'federal';
  setScope: (s: Props['scope']) => void;
  zipcode: string;
  state: string;
}

const Chip: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button className={`m-chip ${active ? 'active' : ''}`} onClick={onClick}>{label}</button>
);

const RepCard: React.FC<{ name: string; title: string; ago?: string; headline: string; lines?: string[]; tag: string; likes: number; dislikes: number; comments: number; photo?: string }>
  = ({ name, title, ago, headline, lines, tag, likes, dislikes, comments, photo }) => (
  <div className="m-card">
    <div className="m-rep-row">
      <div className="m-avatar" style={{ backgroundImage: photo ? `url(${photo})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className="m-rep-meta">
        <strong>{name}</strong>
        <span>{title}</span>
      </div>
      {ago && <span className="m-card-time">{ago}</span>}
    </div>
    <h2 className="m-card-title">{headline}</h2>
    {lines && lines.length > 0 && (
      <div className="m-card-desc" style={{ marginTop: -4 }}>
        {lines.slice(0, 2).map((l, i) => (
          <div key={i}>• {l}</div>
        ))}
      </div>
    )}
    <span className={`m-card-tag ${tag.toLowerCase()}`}>{tag}</span>
    <div className="m-card-actions">
      <span className="m-act"><ThumbsUp size={16} /> {likes}</span>
      <span className="m-act"><ThumbsDown size={16} /> {dislikes}</span>
      <span className="m-act"><MessageCircle size={16} /> {comments}</span>
    </div>
  </div>
);

const MobileRepresentatives: React.FC<Props> = ({ scope, setScope, zipcode }) => {
  const [reps, setReps] = useState<Array<{ id: string; name: string; title: string; level: string; photo?: string; personId?: string; state?: string }>>([]);
  const [counts, setCounts] = useState<Record<string, { up: number; down: number; comments: number }>>({});
  const [voteLines, setVoteLines] = useState<Record<string, string[]>>({});

  function compact(s: string): string {
    if (!s) return '';
    const t = s
      .replace(/^(an?|the)\s+act\s+relating\s+to\s+/i, '')
      .replace(/^relating\s+to\s+/i, '')
      .replace(/^an?\s+act\s+/i, '')
      .replace(/^a\s+bill\s+to\s+/i, '');
    const first = t.split(/[.;]/)[0].trim();
    const capped = first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
    return capped.length > 80 ? capped.slice(0, 77).trimEnd() + '…' : capped;
  }

  useEffect(() => {
    (async () => {
      const data = await getAllRepresentatives(zipcode);
      const filtered: EnhancedMember[] = scope === 'federal' ? data.federal : scope === 'state' ? data.state : data.local;
      const mapped = filtered.map((m: EnhancedMember) => ({
        id: m.member_id,
        name: m.full_name,
        title: m.office_name,
        level: m.level,
        photo: m.photo_url,
        personId: (m as any).openstates_person_id,
        state: (m as any).state
      }));
      setReps(mapped);

      const entries: Record<string, { up: number; down: number; comments: number }> = {};
      for (const r of mapped) {
        const c = await getPegCounters('member', r.id, zipcode);
        entries[r.id] = { up: c.up, down: c.down, comments: c.comments };
      }
      setCounts(entries);

      // For state reps, load recent vote summaries
      if (scope === 'state') {
        const summaries: Record<string, string[]> = {};
        await Promise.all(mapped.map(async (r) => {
          if (!r.personId) return;
          try {
            const votes: OpenStatesVote[] = await getLegislatorVotes(r.personId, 5);
            const lines = (votes || []).slice(0, 2).map((v) => {
              const stance = v.votes?.find(vt => vt.voter?.id === r.personId)?.option;
              const billId = v.bill?.identifier ? v.bill.identifier : '';
              const motion = v.motion_text?.replace(/\s+/g, ' ').trim();
              const label = billId ? `${billId}` : motion?.slice(0, 60) || 'Vote';
              const result = v.result === 'pass' ? 'Passed' : 'Failed';
              const voteWord = stance ? stance.toUpperCase() : 'VOTE';
              return `${voteWord} on ${label} • ${result}`;
            });
            // Fallback: show sponsored bills if no vote lines
            if (lines.length === 0) {
              try {
                const bills: OpenStatesBill[] = await searchBills({ state: (r.state as string) || 'TX', sponsor: r.name, limit: 2, sort: 'updated_desc' as any });
                const blines = (bills || []).map(b => `Sponsored ${b.identifier}: ${compact(b.title)}`);
                if (blines.length > 0) summaries[r.id] = blines;
              } catch (_) { /* ignore */ }
            } else {
              summaries[r.id] = lines;
            }
          } catch (_) {
            // ignore
          }
        }));
        setVoteLines(summaries);
      } else {
        setVoteLines({});
      }
    })();
  }, [zipcode, scope]);

  return (
    <div className="m-page">
      <div className="m-top">
        <h1>Representatives Feed</h1>
        <div className="m-chips">
          <Chip active={scope==='hyperlocal'} label="Hyperlocal" onClick={()=>setScope('hyperlocal')} />
          <Chip active={scope==='local'} label="Local" onClick={()=>setScope('local')} />
          <Chip active={scope==='state'} label="State" onClick={()=>setScope('state')} />
          <Chip active={scope==='federal'} label="Federal" onClick={()=>setScope('federal')} />
        </div>
      </div>
      {reps.length === 0 ? (
        <div className="m-card"><p className="m-card-desc">Loading representatives…</p></div>
      ) : (
        reps.map(r => (
          <RepCard
            key={r.id}
            name={r.name}
            title={r.title}
            headline={r.level === 'state' && r.personId ? `Recent votes by ${r.name}` : `Recent activity from ${r.name}`}
            lines={voteLines[r.id]}
            tag={r.level === 'federal' ? 'Federal' : r.level === 'state' ? 'State' : 'Local'}
            likes={counts[r.id]?.up ?? 0}
            dislikes={counts[r.id]?.down ?? 0}
            comments={counts[r.id]?.comments ?? 0}
            photo={r.photo}
          />
        ))
      )}
    </div>
  );
};

export default MobileRepresentatives;


