import React from 'react';

interface RailItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

interface NavRailProps {
  active: string;
  items: RailItem[];
  onChange: (key: string) => void;
}

const NavRail: React.FC<NavRailProps> = ({ active, items, onChange }) => {
  return (
    <aside className="d-rail">
      <div className="d-rail-inner">
        {items.map((it) => (
          <button
            key={it.key}
            className={`d-rail-item ${active === it.key ? 'active' : ''}`}
            onClick={() => onChange(it.key)}
          >
            <div className="d-rail-icon">{it.icon}</div>
            <span className="d-rail-label">{it.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};

export default NavRail;


