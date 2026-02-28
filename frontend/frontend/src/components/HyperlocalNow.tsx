import React from 'react';
import { MapPin, Calendar, AlertTriangle, Wrench, Leaf, ExternalLink } from 'lucide-react';
import { hyperlocalNow75205, HyperlocalItem } from '../data/hyperlocal_75205';
import '../styles/HyperlocalNow.css';

interface HyperlocalNowProps {
  zipcode: string;
}

const typeIcon = (item: HyperlocalItem) => {
  switch (item.type) {
    case 'street_project': return <Wrench size={16} />;
    case 'public_meeting': return <Calendar size={16} />;
    case 'park_trail': return <MapPin size={16} />;
    case 'notice': return <Leaf size={16} />;
    case 'event': return <Calendar size={16} />;
    default: return <MapPin size={16} />;
  }
};

const statusBadge = (status?: string) => {
  if (!status) return null;
  const map: Record<string, {label: string; className: string}> = {
    planned: { label: 'Planned', className: 'hl-badge planned' },
    in_progress: { label: 'In Progress', className: 'hl-badge progress' },
    completed: { label: 'Completed', className: 'hl-badge done' }
  };
  const cfg = map[status] || { label: status, className: 'hl-badge' };
  return <span className={cfg.className}>{cfg.label}</span>;
};

const formatDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString() : undefined;

const HyperlocalNow: React.FC<HyperlocalNowProps> = ({ zipcode }) => {
  const items = zipcode === '75205' ? hyperlocalNow75205 : [];

  return (
    <div className="hyperlocal-now">
      <div className="hl-header">
        <div>
          <h2>Hyperlocal Now</h2>
          <p>What’s happening around 75205 right now</p>
        </div>
        <span className="hl-zip">
          <MapPin size={14} /> {zipcode}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="hl-empty">
          <AlertTriangle size={18} />
          <p>No hyperlocal updates yet. We’re wiring your city feeds.</p>
        </div>
      ) : (
        <div className="hl-grid">
          {items.map(item => (
            <div className="hl-card" key={item.id}>
              <div className="hl-card-head">
                <div className="hl-icon">{typeIcon(item)}</div>
                <div className="hl-title">
                  <h4>{item.title}</h4>
                  {item.subtitle && <span className="hl-sub">{item.subtitle}</span>}
                </div>
                {statusBadge(item.status)}
              </div>
              <div className="hl-meta">
                {(item.start_date || item.end_date) && (
                  <span className="hl-date">
                    <Calendar size={14} />
                    {formatDate(item.start_date)}{item.end_date ? ` – ${formatDate(item.end_date)}` : ''}
                  </span>
                )}
                {item.location && (
                  <span className="hl-loc">
                    <MapPin size={14} /> {item.location}
                  </span>
                )}
              </div>
              {item.description && <p className="hl-desc">{item.description}</p>}
              {item.url && (
                <a className="hl-link" href={item.url} target="_blank" rel="noopener noreferrer">
                  Details <ExternalLink size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HyperlocalNow;


