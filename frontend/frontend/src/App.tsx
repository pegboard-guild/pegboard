import React, { useState, useEffect } from 'react';
import './App.css';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import MobileShell from './mobile/MobileShell';
import DesktopShell from './mobile/DesktopShell';
import { saveZipcode, getSavedZipcode } from './utils';

function App() {
  const [zipcode, setZipcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // Check for saved zipcode on mount
    const savedZipcode = getSavedZipcode();
    if (savedZipcode) {
      setZipcode(savedZipcode);
    }
    setLoading(false);
    const check = () => {
      const qp = new URLSearchParams(window.location.search);
      if (qp.get('lab') === '1') { setIsMobile(false); return; }
      // Treat widths under 992px as mobile; otherwise desktop layout with rail
      setIsMobile(window.innerWidth < 992);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleZipcodeSubmit = (newZipcode: string) => {
    saveZipcode(newZipcode);
    setZipcode(newZipcode);
  };

  const handleZipcodeChange = () => {
    setZipcode(null);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-content">
          <h1 className="logo">
            <span className="logo-icon">📍</span>
            Pegboard
          </h1>
          <div className="loading-message">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {!zipcode ? (
        <LandingPage onZipcodeSubmit={handleZipcodeSubmit} />
      ) : (
        isMobile ? (
          <MobileShell zipcode={zipcode} state={zipcode.substring(0,3)} />
        ) : (
          <DesktopShell zipcode={zipcode} state={zipcode.substring(0,3)} />
        )
      )}
    </div>
  );
}

export default App;
