import React, { useState } from 'react';
import { MapPin, Search, Users, Vote, TrendingUp, AlertCircle } from 'lucide-react';
import { isValidZipcode } from '../utils';

interface LandingPageProps {
  onZipcodeSubmit: (zipcode: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onZipcodeSubmit }) => {
  const [zipcode, setZipcode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!isValidZipcode(zipcode)) {
      setError('Please enter a valid 5-digit zipcode');
      return;
    }
    
    onZipcodeSubmit(zipcode);
  };

  return (
    <div className="landing-page">
      <header className="header">
        <div className="container">
          <h1 className="logo">
            <span className="logo-icon">📍</span>
            Pegboard
          </h1>
          <p className="tagline">Your Government. Your Voice. Real-Time.</p>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h2 className="hero-title">
              See What YOUR Government<br />
              Is Doing Right Now
            </h2>
            <p className="hero-description">
              Enter your zipcode to instantly see how your representatives are voting,
              what bills affect you, and make your voice heard.
            </p>

            <form onSubmit={handleSubmit} className="zipcode-form">
              <div className="form-group">
                <div className="input-wrapper">
                  <MapPin className="input-icon" size={20} />
                  <input
                    type="text"
                    placeholder="Enter your 5-digit zipcode"
                    value={zipcode}
                    onChange={(e) => setZipcode(e.target.value)}
                    maxLength={5}
                    className="zipcode-input"
                    autoFocus
                  />
                  <button type="submit" className="submit-button">
                    <Search size={20} />
                    <span>Get Started</span>
                  </button>
                </div>
                {error && (
                  <div className="error-message">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </form>

            <div className="example-zipcodes">
              <span className="example-label">Try:</span>
              <button 
                onClick={() => onZipcodeSubmit('60601')}
                className="example-zipcode"
              >
                Chicago (60601)
              </button>
              <button 
                onClick={() => onZipcodeSubmit('10001')}
                className="example-zipcode"
              >
                New York (10001)
              </button>
              <button 
                onClick={() => onZipcodeSubmit('90210')}
                className="example-zipcode"
              >
                Beverly Hills (90210)
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h3 className="features-title">Real Democracy, Real-Time</h3>
          <div className="features-grid">
            <div className="feature">
              <div className="feature-icon">
                <Users size={32} />
              </div>
              <h4>Your Representatives</h4>
              <p>Instantly see your House Rep and both Senators based on your zipcode</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <Vote size={32} />
              </div>
              <h4>Live Votes</h4>
              <p>Track how your reps vote on bills in real-time as it happens</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <TrendingUp size={32} />
              </div>
              <h4>Voice Your Opinion</h4>
              <p>"Peg" your approval or disapproval on any bill or representative action</p>
            </div>
          </div>
        </div>
      </section>

      <section className="vision">
        <div className="container">
          <div className="vision-content">
            <h3>The Vision: Complete Transparency</h3>
            <p>
              Today we're tracking Congress. Tomorrow, we'll show you every government 
              action at every level - from federal bills to local pothole repairs. 
              Every tax dollar. Every decision. Every official. All connected to you 
              through your zipcode.
            </p>
            <div className="vision-preview">
              <div className="preview-item">
                <span className="preview-label">Federal</span>
                <span className="preview-value">Congress Votes</span>
              </div>
              <div className="preview-item coming-soon">
                <span className="preview-label">State</span>
                <span className="preview-value">Legislature Actions</span>
                <span className="badge">Coming Soon</span>
              </div>
              <div className="preview-item coming-soon">
                <span className="preview-label">Local</span>
                <span className="preview-value">City Council Decisions</span>
                <span className="badge">Coming Soon</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <p>
            © 2024 Pegboard | Building radical transparency in government
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;