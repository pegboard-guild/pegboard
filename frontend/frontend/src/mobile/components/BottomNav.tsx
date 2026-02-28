import React from 'react';

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

interface BottomNavProps {
  active: string;
  items: NavItem[];
  onChange: (key: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ active, items, onChange }) => {
  return (
    <nav className="m-bottom">
      {items.map((it) => (
        <button
          key={it.key}
          className={`m-bottom-item ${active === it.key ? 'active' : ''}`}
          onClick={() => onChange(it.key)}
        >
          <div className="m-bottom-icon">{it.icon}</div>
          <span className="m-bottom-label">{it.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;


