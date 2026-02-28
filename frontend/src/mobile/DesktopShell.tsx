import React, { useState } from 'react';
import { Home, Users, Compass, MoreHorizontal } from 'lucide-react';
import MobileActivityFeed from './pages/MobileActivityFeed';
import MobileRepresentatives from './pages/MobileRepresentatives';
import NavRail from './components/NavRail';
import './styles/mobile.css';

type Tab = 'activity' | 'reps' | 'discover' | 'more';

interface DesktopShellProps {
  zipcode: string;
  state: string;
}

const DesktopShell: React.FC<DesktopShellProps> = ({ zipcode, state }) => {
  const [tab, setTab] = useState<Tab>('activity');
  const [scope, setScope] = useState<'hyperlocal' | 'local' | 'state' | 'federal'>('local');

  return (
    <div className="d-shell">
      <NavRail
        active={tab}
        items={[
          { key: 'activity', label: 'Activity', icon: <Home size={20} /> },
          { key: 'reps', label: 'Reps', icon: <Users size={20} /> },
          { key: 'discover', label: 'Discover', icon: <Compass size={20} /> },
          { key: 'more', label: 'More', icon: <MoreHorizontal size={20} /> },
        ]}
        onChange={(k) => setTab(k as Tab)}
      />
      <div className="m-content" style={{ paddingLeft: 16 }}>
        {tab === 'activity' && (
          <MobileActivityFeed scope={scope} setScope={setScope} zipcode={zipcode} state={state} />
        )}
        {tab === 'reps' && (
          <MobileRepresentatives scope={scope} setScope={setScope} zipcode={zipcode} state={state} />
        )}
        {tab === 'discover' && <div className="m-placeholder">Discover (coming soon)</div>}
        {tab === 'more' && <div className="m-placeholder">More (coming soon)</div>}
      </div>
    </div>
  );
};

export default DesktopShell;


