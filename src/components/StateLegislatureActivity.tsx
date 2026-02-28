import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  FileText, 
  ThumbsUp, 
  ThumbsDown, 
  Calendar, 
  User,
  ExternalLink,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { 
  OpenStates,
  OpenStatesBill,
  OpenStatesLegislator 
} from '../services/openstates';
import { addPeg } from '../services/supabase';
import { getSessionId } from '../utils';
import '../styles/StateLegislatureActivity.css';

interface StateLegislatureActivityProps {
  zipcode: string;
  state?: string;
  sessionId?: string;
}

const StateLegislatureActivity: React.FC<StateLegislatureActivityProps> = ({ 
  zipcode, 
  state = 'TX',
  sessionId 
}) => {
  const [stateBills, setStateBills] = useState<OpenStatesBill[]>([]);
  const [stateLegislators, setStateLegislators] = useState<OpenStatesLegislator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<OpenStatesBill | null>(null);
  const [activeTab, setActiveTab] = useState<'bills' | 'legislators'>('bills');

  useEffect(() => {
    loadStateData();
  }, [zipcode, state]);

  const loadStateData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if API key is configured
      if (!process.env.REACT_APP_OPENSTATES_API_KEY || 
          process.env.REACT_APP_OPENSTATES_API_KEY === 'YOUR_OPENSTATES_API_KEY_HERE') {
        setError('OpenStates API key not configured. Please sign up at openstates.org and add your API key.');
        setLoading(false);
        return;
      }

      // Load Texas-specific data for Dallas zipcode
      if (zipcode === '75205' || state === 'TX') {
        const [bills, legislators] = await Promise.all([
          OpenStates.getTexasActiveBills(),
          OpenStates.getTexasLegislatorsByZipcode(zipcode)
        ]);
        
        setStateBills(bills);
        setStateLegislators(legislators);
      } else {
        // Load data for other states
        const bills = await OpenStates.getStateBills(state, { limit: 20 });
        setStateBills(bills);
      }
    } catch (err) {
      console.error('Error loading state data:', err);
      setError('Failed to load state legislature data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePegBill = async (billId: string, sentiment: 'approve' | 'disapprove') => {
    try {
      const peg = {
        session_id: getSessionId(),
        zipcode,
        target_type: 'state_bill' as const,
        target_id: billId,
        sentiment,
        comment: null
      };
      await addPeg(peg);
      console.log(`Pegged state bill ${billId} as ${sentiment}`);
    } catch (error) {
      console.error('Error pegging state bill:', error);
    }
  };

  const formatBillStatus = (bill: OpenStatesBill): string => {
    if (bill.latest_action) {
      return bill.latest_action.description;
    }
    return 'Introduced';
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getChamberLabel = (chamber?: string): string => {
    if (chamber === 'upper') return 'Senate';
    if (chamber === 'lower') return 'House';
    return 'Legislature';
  };

  if (loading) {
    return (
      <div className="state-legislature-loading">
        <div className="loading-spinner">
          <Building2 className="spinner" size={32} />
          <p>Loading state legislature data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-legislature-error">
        <AlertCircle size={24} />
        <p>{error}</p>
        {error.includes('API key') && (
          <a 
            href="https://openstates.org/accounts/signup/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="api-signup-link"
          >
            Get your free API key →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="state-legislature-activity">
      <div className="state-header">
        <Building2 size={24} />
        <h2>Texas State Legislature</h2>
        <span className="session-badge">89th Session (2025)</span>
      </div>

      <div className="state-tabs">
        <button
          className={`tab-button ${activeTab === 'bills' ? 'active' : ''}`}
          onClick={() => setActiveTab('bills')}
        >
          <FileText size={18} />
          Recent Bills
        </button>
        <button
          className={`tab-button ${activeTab === 'legislators' ? 'active' : ''}`}
          onClick={() => setActiveTab('legislators')}
        >
          <User size={18} />
          Your State Legislators
        </button>
      </div>

      {activeTab === 'bills' && (
        <div className="state-bills-section">
          <div className="section-header">
            <h3>Recent State Bills</h3>
            <p className="section-description">
              Track and voice your opinion on Texas state legislation
            </p>
          </div>

          {stateBills.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No Active Bills</h3>
              <p>The Texas legislature may not be in session</p>
            </div>
          ) : (
            <div className="state-bills-list">
              {stateBills.map(bill => (
                <div key={bill.id} className="state-bill-card">
                  <div className="bill-header">
                    <div className="bill-identifier">
                      <span className="bill-number">{bill.identifier}</span>
                      <span className="bill-chamber">
                        {getChamberLabel(bill.from_organization?.classification)}
                      </span>
                    </div>
                    <div className="bill-date">
                      <Calendar size={14} />
                      {formatDate(bill.latest_action?.date)}
                    </div>
                  </div>

                  <h4 className="bill-title">{bill.title}</h4>
                  
                  {bill.abstract && (
                    <p className="bill-abstract">
                      {bill.abstract.length > 200 
                        ? `${bill.abstract.substring(0, 200)}...` 
                        : bill.abstract}
                    </p>
                  )}

                  <div className="bill-metadata">
                    {bill.sponsors && bill.sponsors.length > 0 && (
                      <div className="bill-sponsor">
                        <User size={14} />
                        <span>Sponsored by {bill.sponsors[0].name}</span>
                      </div>
                    )}
                    
                    <div className="bill-status">
                      <TrendingUp size={14} />
                      <span>{formatBillStatus(bill)}</span>
                    </div>
                  </div>

                  {bill.subject && bill.subject.length > 0 && (
                    <div className="bill-subjects">
                      {bill.subject.slice(0, 3).map((subject, idx) => (
                        <span key={idx} className="subject-tag">
                          {subject}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="bill-actions">
                    <button
                      className="peg-button approve"
                      onClick={() => handlePegBill(bill.id, 'approve')}
                      title="Support this bill"
                    >
                      <ThumbsUp size={16} />
                      Support
                    </button>
                    <button
                      className="peg-button disapprove"
                      onClick={() => handlePegBill(bill.id, 'disapprove')}
                      title="Oppose this bill"
                    >
                      <ThumbsDown size={16} />
                      Oppose
                    </button>
                    <a
                      href={bill.openstates_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-details-link"
                    >
                      <ExternalLink size={16} />
                      View Details
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'legislators' && (
        <div className="state-legislators-section">
          <div className="section-header">
            <h3>Your State Representatives</h3>
            <p className="section-description">
              Texas legislators representing your district
            </p>
          </div>

          {stateLegislators.length === 0 ? (
            <div className="empty-state">
              <User size={48} />
              <h3>No Legislators Found</h3>
              <p>Unable to find state legislators for your location</p>
            </div>
          ) : (
            <div className="state-legislators-grid">
              {stateLegislators.map(legislator => (
                <div key={legislator.id} className="legislator-card">
                  <div className="legislator-header">
                    {legislator.image ? (
                      <img 
                        src={legislator.image} 
                        alt={legislator.name}
                        className="legislator-photo"
                      />
                    ) : (
                      <div className="legislator-avatar">
                        <User size={32} />
                      </div>
                    )}
                    <div className="legislator-info">
                      <h4>{legislator.name}</h4>
                      {legislator.current_role && (
                        <>
                          <p className="legislator-title">
                            {legislator.current_role.title}
                          </p>
                          <p className="legislator-district">
                            District {legislator.current_role.district}
                          </p>
                        </>
                      )}
                      {legislator.party && (
                        <span className={`party-badge party-${legislator.party.toLowerCase()}`}>
                          {legislator.party}
                        </span>
                      )}
                    </div>
                  </div>

                  {legislator.email && (
                    <div className="legislator-contact">
                      <a href={`mailto:${legislator.email}`}>
                        📧 {legislator.email}
                      </a>
                    </div>
                  )}

                  {legislator.extras?.phone && (
                    <div className="legislator-contact">
                      <a href={`tel:${legislator.extras.phone}`}>
                        📞 {legislator.extras.phone}
                      </a>
                    </div>
                  )}

                  <div className="legislator-actions">
                    <button
                      className="peg-button approve"
                      onClick={() => console.log('Approve legislator')}
                    >
                      <ThumbsUp size={16} />
                      Approve
                    </button>
                    <button
                      className="peg-button disapprove"
                      onClick={() => console.log('Disapprove legislator')}
                    >
                      <ThumbsDown size={16} />
                      Disapprove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Texas-specific information */}
      <div className="state-info-card">
        <h4>About the Texas Legislature</h4>
        <ul>
          <li>The Texas Legislature meets biennially (every two years) in odd-numbered years</li>
          <li>Regular sessions are limited to 140 days</li>
          <li>The 89th session began January 14, 2025</li>
          <li>Special sessions can be called by the Governor</li>
        </ul>
      </div>
    </div>
  );
};

export default StateLegislatureActivity;