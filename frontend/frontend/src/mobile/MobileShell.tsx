import React, { useState } from 'react';
import { Home, Users, Compass, MoreHorizontal } from 'lucide-react';
import MobileActivityFeed from './pages/MobileActivityFeed';
import MobileRepresentatives from './pages/MobileRepresentatives';
import BottomNav from './components/BottomNav';
import './styles/mobile.css';

export type MobileTab = 'activity' | 'reps' | 'discover' | 'more';

interface MobileShellProps {
  zipcode: string;
  state: string;
}

const MobileShell: React.FC<MobileShellProps> = ({ zipcode, state }) => {
  const [tab, setTab] = useState<MobileTab>('activity');
  const [scope, setScope] = useState<'hyperlocal' | 'local' | 'state' | 'federal'>('local');

  return (
    <div className="m-shell">
      <div className="m-content">
        {tab === 'activity' && (
          <MobileActivityFeed scope={scope} setScope={setScope} zipcode={zipcode} state={state} />
        )}
        {tab === 'reps' && (
          <MobileRepresentatives scope={scope} setScope={setScope} zipcode={zipcode} state={state} />
        )}
        {tab === 'discover' && (
          <div className="m-placeholder">Discover (coming soon)</div>
        )}
        {tab === 'more' && (
          <div className="m-placeholder">More (coming soon)</div>
        )}
      </div>
      <BottomNav
        active={tab}
        items={[
          { key: 'activity', label: 'Activity Feed', icon: <Home size={18} /> },
          { key: 'reps', label: 'Representatives', icon: <Users size={18} /> },
          { key: 'discover', label: 'Discover', icon: <Compass size={18} /> },
          { key: 'more', label: 'More', icon: <MoreHorizontal size={18} /> },
        ]}
        onChange={(t) => setTab(t as MobileTab)}
      />
    </div>
  );
};

export default MobileShell;


