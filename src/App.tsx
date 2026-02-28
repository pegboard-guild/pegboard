import React, { useState, useEffect } from 'react';
import './App.css';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import { saveZipcode, getSavedZipcode } from './utils';

function App() {
  const [zipcode, setZipcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for saved zipcode on mount
    const savedZipcode = getSavedZipcode();
    if (savedZipcode) {
      setZipcode(savedZipcode);
    }
    setLoading(false);
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
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {!zipcode ? (
        <LandingPage onZipcodeSubmit={handleZipcodeSubmit} />
      ) : (
        <Dashboard 
          zipcode={zipcode} 
          onZipcodeChange={handleZipcodeChange}
        />
      )}
    </div>
  );
}

export default App;
