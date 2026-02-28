import React, { useState, useEffect } from 'react';
import {
  User,
  Building2,
  FileText,
  Calendar,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Mail,
  Phone,
  Globe,
  Vote,
  Users,
  Activity,
  BookOpen,
  Gavel,
  AlertCircle
} from 'lucide-react';
import {
  getStateLegislatorsByZipcode,
  getAllLegislatorsByZipcode,
  getStateBills,
  getLegislatorVotes,
  getCommittees,
  getEvents,
  getBillDetails,
  getBillVotes,
  getLegislatorDetails,
  OpenStatesLegislator,
  OpenStatesBill,
  OpenStatesVote,
  OpenStatesCommittee,
  OpenStatesEvent
} from '../services/openstates';
import '../styles/OpenStatesDataMaximizer.css';

interface OpenStatesDataMaximizerProps {
  zipcode: string;
}

const OpenStatesDataMaximizer: React.FC<OpenStatesDataMaximizerProps> = ({ zipcode }) => {
  const [activeTab, setActiveTab] = useState<'legislators' | 'bills' | 'votes' | 'committees' | 'events'>('legislators');
  const [legislators, setLegislators] = useState<OpenStatesLegislator[]>([]);
  const [federalLegislators, setFederalLegislators] = useState<OpenStatesLegislator[]>([]);
  const [bills, setBills] = useState<OpenStatesBill[]>([]);
  const [votes, setVotes] = useState<OpenStatesVote[]>([]);
  const [committees, setCommittees] = useState<OpenStatesCommittee[]>([]);
  const [events, setEvents] = useState<OpenStatesEvent[]>([]);
  const [selectedLegislator, setSelectedLegislator] = useState<OpenStatesLegislator | null>(null);
  const [selectedBill, setSelectedBill] = useState<OpenStatesBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all data from OpenStates
  useEffect(() => {
    loadAllData();
  }, [zipcode]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all legislators (federal + state)
      const allLegislators = await getAllLegislatorsByZipcode(zipcode);

      // Separate federal and state legislators
      const federal = allLegislators.filter(leg =>
        leg.jurisdiction?.classification === 'government' ||
        leg.current_role?.title?.toLowerCase().includes('senator') ||
        leg.current_role?.title?.toLowerCase().includes('representative')
      );
      const state = allLegislators.filter(leg =>
        leg.jurisdiction?.classification === 'state' ||
        leg.current_role?.chamber
      );

      setFederalLegislators(federal);
      setLegislators(state);

      // Get state from zipcode (simplified - you might want a proper zipcode to state mapping)
      const stateCode = state[0]?.jurisdiction?.id?.replace('ocd-jurisdiction/country:us/state:', '').split('/')[0] || 'tx';

      // Load bills, committees, and events
      const [stateBills, stateCommittees, stateEvents] = await Promise.all([
        getStateBills(stateCode),
        getCommittees(stateCode),
        getEvents(stateCode)
      ]);

      setBills(stateBills);
      setCommittees(stateCommittees);
      setEvents(stateEvents);

    } catch (err) {
      console.error('Error loading OpenStates data:', err);
      setError('Failed to load data from OpenStates API');
    } finally {
      setLoading(false);
    }
  };

  const loadLegislatorDetails = async (legislator: OpenStatesLegislator) => {
    try {
      const [details, votes] = await Promise.all([
        getLegislatorDetails(legislator.id),
        getLegislatorVotes(legislator.id, 20)
      ]);
      setSelectedLegislator(details);
      setVotes(votes);
    } catch (err) {
      console.error('Error loading legislator details:', err);
    }
  };

  const loadBillDetails = async (bill: OpenStatesBill) => {
    try {
      const [details, votes] = await Promise.all([
        getBillDetails(bill.id),
        getBillVotes(bill.id)
      ]);
      setSelectedBill(details);
      setVotes(votes);
    } catch (err) {
      console.error('Error loading bill details:', err);
    }
  };

  if (loading) {
    return (
      <div className="openstates-maximizer loading">
        <div className="loading-spinner">
          <Activity className="spin" />
          <p>Loading comprehensive data from OpenStates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="openstates-maximizer error">
        <AlertCircle />
        <p>{error}</p>
        <button onClick={loadAllData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="openstates-maximizer">
      <div className="maximizer-header">
        <h2>Comprehensive Government Data</h2>
        <p>Powered by OpenStates API - Federal & State Level</p>
      </div>

      <div className="data-tabs">
        <button
          className={activeTab === 'legislators' ? 'active' : ''}
          onClick={() => setActiveTab('legislators')}
        >
          <User /> Representatives ({federalLegislators.length + legislators.length})
        </button>
        <button
          className={activeTab === 'bills' ? 'active' : ''}
          onClick={() => setActiveTab('bills')}
        >
          <FileText /> Bills ({bills.length})
        </button>
        <button
          className={activeTab === 'votes' ? 'active' : ''}
          onClick={() => setActiveTab('votes')}
        >
          <Vote /> Votes ({votes.length})
        </button>
        <button
          className={activeTab === 'committees' ? 'active' : ''}
          onClick={() => setActiveTab('committees')}
        >
          <Users /> Committees ({committees.length})
        </button>
        <button
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          <Calendar /> Events ({events.length})
        </button>
      </div>

      <div className="data-content">
        {activeTab === 'legislators' && (
          <div className="legislators-section">
            <h3>Federal Representatives</h3>
            <div className="legislators-grid">
              {federalLegislators.map(leg => (
                <div
                  key={leg.id}
                  className="legislator-card"
                  onClick={() => loadLegislatorDetails(leg)}
                >
                  {leg.image && <img src={leg.image} alt={leg.name} />}
                  <h4>{leg.name}</h4>
                  <p className="role">{leg.current_role?.title}</p>
                  <p className="party">{leg.party}</p>
                  {leg.current_role?.district && (
                    <p className="district">District {leg.current_role.district}</p>
                  )}
                  <div className="contact-info">
                    {leg.email && (
                      <a href={`mailto:${leg.email}`} onClick={e => e.stopPropagation()}>
                        <Mail size={14} />
                      </a>
                    )}
                    {leg.extras?.phone && (
                      <a href={`tel:${leg.extras.phone}`} onClick={e => e.stopPropagation()}>
                        <Phone size={14} />
                      </a>
                    )}
                    {leg.extras?.website && (
                      <a href={leg.extras.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <Globe size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <h3>State Legislators</h3>
            <div className="legislators-grid">
              {legislators.map(leg => (
                <div
                  key={leg.id}
                  className="legislator-card"
                  onClick={() => loadLegislatorDetails(leg)}
                >
                  {leg.image && <img src={leg.image} alt={leg.name} />}
                  <h4>{leg.name}</h4>
                  <p className="role">
                    {leg.current_role?.title} - {leg.current_role?.chamber === 'upper' ? 'Senate' : 'House'}
                  </p>
                  <p className="party">{leg.party}</p>
                  {leg.current_role?.district && (
                    <p className="district">District {leg.current_role.district}</p>
                  )}
                  <div className="contact-info">
                    {leg.email && (
                      <a href={`mailto:${leg.email}`} onClick={e => e.stopPropagation()}>
                        <Mail size={14} />
                      </a>
                    )}
                    {leg.extras?.phone && (
                      <a href={`tel:${leg.extras.phone}`} onClick={e => e.stopPropagation()}>
                        <Phone size={14} />
                      </a>
                    )}
                    {leg.extras?.website && (
                      <a href={leg.extras.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <Globe size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedLegislator && (
              <div className="detail-modal">
                <div className="modal-content">
                  <button className="close" onClick={() => setSelectedLegislator(null)}>×</button>
                  <h3>{selectedLegislator.name} - Detailed Profile</h3>
                  <div className="voting-record">
                    <h4>Recent Votes</h4>
                    {votes.map(vote => (
                      <div key={vote.id} className="vote-item">
                        <p>{vote.motion_text}</p>
                        <p className="vote-date">{new Date(vote.start_date).toLocaleDateString()}</p>
                        <p className={`vote-result ${vote.result}`}>{vote.result}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bills' && (
          <div className="bills-section">
            <h3>Active Legislation</h3>
            <div className="bills-list">
              {bills.map(bill => (
                <div
                  key={bill.id}
                  className="bill-card"
                  onClick={() => loadBillDetails(bill)}
                >
                  <div className="bill-header">
                    <h4>{bill.identifier}</h4>
                    <span className="session">{bill.session}</span>
                  </div>
                  <p className="bill-title">{bill.title}</p>
                  {bill.abstract && (
                    <p className="bill-abstract">{bill.abstract.substring(0, 200)}...</p>
                  )}
                  {bill.latest_action && (
                    <div className="latest-action">
                      <p><strong>Latest Action:</strong> {bill.latest_action.description}</p>
                      <p className="action-date">{new Date(bill.latest_action.date).toLocaleDateString()}</p>
                    </div>
                  )}
                  {bill.sponsors && bill.sponsors.length > 0 && (
                    <div className="sponsors">
                      <strong>Sponsors:</strong> {bill.sponsors.slice(0, 3).map(s => s.name).join(', ')}
                      {bill.sponsors.length > 3 && ` +${bill.sponsors.length - 3} more`}
                    </div>
                  )}
                  <div className="bill-meta">
                    {bill.subject.slice(0, 3).map(subj => (
                      <span key={subj} className="subject-tag">{subj}</span>
                    ))}
                  </div>
                  <a
                    href={bill.openstates_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="view-on-openstates"
                  >
                    View on OpenStates <ExternalLink size={12} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'votes' && (
          <div className="votes-section">
            <h3>Legislative Votes</h3>
            {votes.length > 0 ? (
              <div className="votes-list">
                {votes.map(vote => (
                  <div key={vote.id} className="vote-card">
                    <h4>{vote.motion_text}</h4>
                    <div className="vote-stats">
                      <span className="yes">Yes: {vote.yes_count}</span>
                      <span className="no">No: {vote.no_count}</span>
                      <span className="absent">Absent: {vote.absent_count}</span>
                      <span className="abstain">Abstain: {vote.abstain_count}</span>
                    </div>
                    <p className={`result ${vote.result}`}>
                      Result: {vote.result === 'pass' ? 'PASSED' : 'FAILED'}
                    </p>
                    <p className="vote-date">{new Date(vote.start_date).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">Select a legislator or bill to see voting records</p>
            )}
          </div>
        )}

        {activeTab === 'committees' && (
          <div className="committees-section">
            <h3>Legislative Committees</h3>
            <div className="committees-grid">
              {committees.map(committee => (
                <div key={committee.id} className="committee-card">
                  <h4>{committee.name}</h4>
                  <p className="chamber">{committee.chamber === 'upper' ? 'Senate' : 'House'}</p>
                  {committee.jurisdiction && typeof committee.jurisdiction === 'string' && (
                    <p className="jurisdiction">{committee.jurisdiction}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="events-section">
            <h3>Upcoming Legislative Events</h3>
            <div className="events-list">
              {events.map(event => (
                <div key={event.id} className="event-card">
                  <h4>{event.name}</h4>
                  <p className="event-date">
                    <Calendar size={14} /> Event Details
                  </p>
                  {event.location && typeof event.location === 'string' && (
                    <p className="location">
                      <Building2 size={14} />
                      <span>{event.location}</span>
                    </p>
                  )}
                  {event.description && (
                    <p className="description">{event.description}</p>
                  )}
                  {event.agenda && event.agenda.length > 0 && (
                    <div className="agenda">
                      <h5>Agenda:</h5>
                      <ul>
                        {event.agenda.slice(0, 3).map((item, idx) => (
                          <li key={idx}>{item.description}</li>
                        ))}
                        {event.agenda.length > 3 && (
                          <li>+{event.agenda.length - 3} more items</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpenStatesDataMaximizer;