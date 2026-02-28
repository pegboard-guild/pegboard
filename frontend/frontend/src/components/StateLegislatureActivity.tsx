import React, { useState, useEffect, useCallback } from 'react';
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

// State name mapping
const STATE_NAMES: { [key: string]: string } = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

const StateLegislatureActivity: React.FC<StateLegislatureActivityProps> = ({ 
  zipcode, 
  state = 'TX',
  sessionId 
}) => {
  const [stateBills, setStateBills] = useState<OpenStatesBill[]>([]);
  const [stateLegislators, setStateLegislators] = useState<OpenStatesLegislator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bills' | 'legislators'>('bills');
  const [selectedLegislator, setSelectedLegislator] = useState<OpenStatesLegislator | null>(null);
  const [legislatorVotes, setLegislatorVotes] = useState<any[]>([]);
  const [detectedState, setDetectedState] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>('88');
  const [rateLimitHit, setRateLimitHit] = useState(false);

  // Texas sessions (can be expanded for other states)
  const TEXAS_SESSIONS = [
    { value: '88', label: '88th Regular Session (2023)' },
    { value: '881', label: '88th 1st Special Session (2023)' },
    { value: '882', label: '88th 2nd Special Session (2023)' },
    { value: '883', label: '88th 3rd Special Session (2023)' },
    { value: '884', label: '88th 4th Special Session (2023)' },
    { value: '87', label: '87th Regular Session (2021)' },
    { value: '871', label: '87th 1st Special Session (2021)' },
    { value: '872', label: '87th 2nd Special Session (2021)' },
    { value: '873', label: '87th 3rd Special Session (2021)' },
    { value: '89', label: '89th Regular Session (2025) - Upcoming' }
  ];

  const loadStateData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First, get coordinates and detect state from zipcode
      const coords = await fetch(`https://api.zippopotam.us/us/${zipcode}`)
        .then(res => res.json())
        .catch(() => null);
      
      const detectedStateCode = coords?.places?.[0]?.['state abbreviation'] || state;
      setDetectedState(detectedStateCode);

      // Load state-specific data for any zipcode
      console.log('Loading bills for session:', selectedSession, 'State:', detectedStateCode);

      // Load bills and legislators separately to avoid hitting rate limits
      let bills: any[] = [];
      let legislators: any[] = [];

      try {
        bills = await (detectedStateCode === 'TX'
          ? OpenStates.getStateBills('TX', { session: selectedSession, limit: 20 }) // Reduced limit
          : OpenStates.getStateBills(detectedStateCode, { limit: 20 }));

        console.log('Bills received:', bills?.length || 0, 'bills');
      } catch (billError) {
        console.error('Error loading bills:', billError);
      }

      try {
        legislators = await OpenStates.getStateLegislatorsByZipcode(zipcode);
        console.log('Legislators received:', legislators?.length || 0);
      } catch (legError) {
        console.error('Error loading legislators:', legError);
      }

      setStateBills(bills);
      setStateLegislators(legislators);
    } catch (err) {
      console.error('Error loading state data:', err);
      
      // More specific error handling
      if (err instanceof Error) {
        if (err.message.includes('API key')) {
          setError('OpenStates API key not configured. Please sign up at openstates.org and add your API key.');
        } else if (err.message.includes('geocoding')) {
          setError('Unable to find location for this zipcode. Please try a different zipcode.');
        } else if (err.message.includes('404')) {
          setError('No state legislature data found for this location.');
        } else {
          setError(`Failed to load state legislature data: ${err.message}`);
        }
      } else {
        setError('Failed to load state legislature data. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, [zipcode, state, selectedSession]);

  useEffect(() => {
    loadStateData();
  }, [loadStateData]);

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

  const handleLegislatorClick = async (legislator: OpenStatesLegislator) => {
    setSelectedLegislator(legislator);
    setLegislatorVotes([]);
    
    try {
      // Try to load voting data - using recent bills they may have voted on
      console.log('Loading voting data for:', legislator.name);
      
      // For now, show legislator details and some sample voting info
      // In the future, we could integrate with other APIs or show bill sponsorship data
      const sampleVotingData = [
        {
          bill: 'SB 2',
          title: 'Property Tax Reform Act',
          vote: 'Yes',
          date: '2025-05-15',
          result: 'Passed'
        },
        {
          bill: 'HB 127',
          title: 'Education Funding Bill',
          vote: 'No',
          date: '2025-04-22',
          result: 'Failed'
        },
        {
          bill: 'SB 45',
          title: 'Infrastructure Investment',
          vote: 'Yes',
          date: '2025-03-18',
          result: 'Passed'
        }
      ];
      
      setLegislatorVotes(sampleVotingData);
    } catch (error) {
      console.error('Error loading legislator voting data:', error);
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
        <div className="loading-message">
          <Building2 size={32} />
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
        <h2>{STATE_NAMES[detectedState || state] || 'State'} Legislature</h2>
        {detectedState === 'TX' && (
          <select
            className="session-selector"
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
          >
            {TEXAS_SESSIONS.map(session => (
              <option key={session.value} value={session.value}>
                {session.label}
              </option>
            ))}
          </select>
        )}
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
              Track and voice your opinion on {STATE_NAMES[detectedState || state] || 'state'} legislation
            </p>
          </div>

          {!stateBills || stateBills.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No Active Bills</h3>
              <p>The {STATE_NAMES[detectedState || state] || 'state'} legislature may not be in session</p>
              {rateLimitHit && (
                <div className="rate-limit-notice" style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}>
                  <strong>⚠️ API Rate Limit:</strong> The OpenStates free tier allows only 10 requests per hour.
                  Data is being cached to minimize API calls.
                </div>
              )}
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
                  
                  {bill.abstract && typeof bill.abstract === 'string' && bill.abstract.length > 0 && (
                    <p className="bill-abstract">
                      {bill.abstract.length > 200
                        ? `${bill.abstract.substring(0, 200)}...`
                        : bill.abstract}
                    </p>
                  )}

                  <div className="bill-metadata">
                    {bill.sponsors && Array.isArray(bill.sponsors) && bill.sponsors.length > 0 && (
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

                  {bill.subject && Array.isArray(bill.subject) && bill.subject.length > 0 && (
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
              {STATE_NAMES[detectedState || state] || 'State'} legislators representing your district
            </p>
          </div>

          {!stateLegislators || stateLegislators.length === 0 ? (
            <div className="empty-state">
              <User size={48} />
              <h3>No Legislators Found</h3>
              <p>Unable to find state legislators for your location</p>
            </div>
          ) : (
            <div className="state-legislators-grid">
              {stateLegislators.map(legislator => (
                <div 
                  key={legislator.id} 
                  className="legislator-card clickable-card"
                  onClick={() => handleLegislatorClick(legislator)}
                  style={{ cursor: 'pointer' }}
                >
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

      {/* State-specific information - only show for Texas */}
      {detectedState === 'TX' && (
        <div className="state-info-card">
          <h4>About the Texas Legislature</h4>
          <ul>
            <li>The Texas Legislature meets biennially (every two years) in odd-numbered years</li>
            <li>Regular sessions are limited to 140 days</li>
            <li>The 89th session began January 14, 2025</li>
            <li>Special sessions can be called by the Governor</li>
          </ul>
        </div>
      )}

      {/* Legislator Detail Modal */}
      {selectedLegislator && (
        <div className="legislator-modal-overlay" onClick={() => setSelectedLegislator(null)}>
          <div className="legislator-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedLegislator.name}</h2>
              <button 
                className="close-button"
                onClick={() => setSelectedLegislator(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="legislator-details">
                {selectedLegislator.image && (
                  <img 
                    src={selectedLegislator.image} 
                    alt={selectedLegislator.name}
                    className="legislator-modal-photo"
                  />
                )}
                
                <div className="legislator-info">
                  {selectedLegislator.current_role && (
                    <>
                      <p><strong>Title:</strong> {selectedLegislator.current_role.title}</p>
                      <p><strong>District:</strong> {selectedLegislator.current_role.district}</p>
                    </>
                  )}
                  {selectedLegislator.party && (
                    <p><strong>Party:</strong> {selectedLegislator.party}</p>
                  )}
                  {selectedLegislator.email && (
                    <p><strong>Email:</strong> <a href={`mailto:${selectedLegislator.email}`}>{selectedLegislator.email}</a></p>
                  )}
                </div>
              </div>

              <div className="voting-history">
                <h3>Recent Voting Activity</h3>
                <p className="note">Sample voting data - full integration coming soon</p>
                
                {legislatorVotes && legislatorVotes.length > 0 ? (
                  <div className="votes-list">
                    {legislatorVotes.map((vote, index) => (
                      <div key={index} className="vote-item">
                        <div className="vote-header">
                          <span className="bill-number">{vote.bill}</span>
                          <span className={`vote-value vote-${vote.vote.toLowerCase()}`}>
                            {vote.vote}
                          </span>
                        </div>
                        <h4 className="bill-title">{vote.title}</h4>
                        <div className="vote-meta">
                          <span className="vote-date">{vote.date}</span>
                          <span className={`bill-result result-${vote.result.toLowerCase()}`}>
                            {vote.result}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>Loading voting data...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StateLegislatureActivity;