import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  User,
  FileText,
  Bell,
  LogOut,
  Building2,
  Calendar,
  Search,
  DollarSign
} from 'lucide-react';
import {
  Member,
  Peg
} from '../types';
import {
  addPeg,
  subscribeToFeed
} from '../services/supabase';
import { getAllRepresentatives, EnhancedMember } from '../services/representativeService';
import {
  getActivityFeed as getActivityFeedFromService,
  getTrendingBills as getTrendingBillsFromService,
  ActivityFeedItem as LegislativeActivityItem
} from '../services/legislativeData';
import { 
  formatParty,
  formatChamber,
  getSessionId,
  clearUserData,
  getAlignmentLabel,
  getAlignmentColor
} from '../utils';
import RepresentativeCard from '../components/RepresentativeCard';
import MultiLevelRepresentatives from '../components/MultiLevelRepresentatives';
import StateLegislatureActivity from '../components/StateLegislatureActivity';
import CommitteesSection from '../components/CommitteesSection';
import LegislativeEvents from '../components/LegislativeEvents';
import EnhancedBillSearch from '../components/EnhancedBillSearch';
import LegislationSection from '../components/LegislationSection';
import GovernmentSpending from '../components/GovernmentSpending';
import HyperlocalNow from '../components/HyperlocalNow';
import RegulatoryTracker from '../components/RegulatoryTracker';
import UnifiedActivityFeed from '../components/UnifiedActivityFeed';
import ObjectiveCanvas from '../components/ObjectiveCanvas';
import '../styles/MultiLevelRepresentatives.css';
import '../styles/NewComponents.css';
import '../styles/BillTextModal.css';

interface DashboardProps {
  zipcode: string;
  onZipcodeChange: () => void;
}

// Helper function to extract state from zipcode
const getStateFromZipcode = (zipcode: string): string => {
  const zipRanges: { [key: string]: string } = {
    '750': 'TX', '751': 'TX', '752': 'TX', '753': 'TX', '754': 'TX',
    '755': 'TX', '756': 'TX', '757': 'TX', '758': 'TX', '759': 'TX',
    '900': 'CA', '901': 'CA', '902': 'CA', '903': 'CA', '904': 'CA',
    '905': 'CA', '906': 'CA', '907': 'CA', '908': 'CA',
    '100': 'NY', '101': 'NY', '102': 'NY', '103': 'NY', '104': 'NY', '105': 'NY',
    '200': 'DC', '201': 'VA', '202': 'DC', '203': 'CT', '204': 'MD',
    '600': 'IL', '601': 'IL', '602': 'IL', '603': 'IL', '604': 'IL', '605': 'IL',
    '606': 'IL', '607': 'IL', '608': 'IL', '609': 'IL',
    '330': 'FL', '331': 'FL', '332': 'FL', '333': 'FL', '334': 'FL', '335': 'FL',
    '336': 'FL', '337': 'FL', '338': 'FL', '339': 'FL',
    '980': 'WA', '981': 'WA', '982': 'WA', '983': 'WA', '984': 'WA'
  };
  const prefix = zipcode.substring(0, 3);
  return zipRanges[prefix] || 'TX'; // Default to TX if not found
};

const Dashboard: React.FC<DashboardProps> = ({ zipcode, onZipcodeChange }) => {
  const [representatives, setRepresentatives] = useState<Member[]>([]);
  const [federalReps, setFederalReps] = useState<EnhancedMember[]>([]);
  const [stateReps, setStateReps] = useState<EnhancedMember[]>([]);
  const [localReps, setLocalReps] = useState<EnhancedMember[]>([]);
  const [useMultiLevel] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'legislation' | 'spending' | 'reps' | 'state' | 'committees' | 'events' | 'search' | 'money' | 'regulations' | 'canvas' | 'hyperlocal'>('reps');
  const [activeTopNav, setActiveTopNav] = useState<'home' | 'reps' | 'feed'>('reps');
  const [alignmentScores, setAlignmentScores] = useState<{[key: string]: number}>({});
  const userState = getStateFromZipcode(zipcode);
  const sessionId = getSessionId();

  const loadDashboard = useCallback(async () => {
    console.log('🚀 Starting loadDashboard for zipcode:', zipcode);
    setLoading(true);
    
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.error('❌ Dashboard loading timed out after 30 seconds');
      setLoading(false);
    }, 30000);
    
    try {
      console.log('📍 Loading representatives for zipcode:', zipcode);

      // Use Google Civic API since Congress.gov API is broken (as of August 2025)
      const representatives = await getAllRepresentatives(zipcode);

      console.log('✅ Found representatives:', {
        federal: representatives.federal.length,
        state: representatives.state.length,
        local: representatives.local.length
      });

      // Set the data
      setFederalReps(representatives.federal);
      setStateReps(representatives.state);
      setLocalReps(representatives.local);
      // Convert EnhancedMember to Member format for backward compatibility
      const convertedReps = representatives.federal.map(rep => ({
        bioguide_id: rep.bioguide_id,
        name: rep.full_name,
        party: rep.party || null,
        chamber: (rep.chamber as 'house' | 'senate') || 'house',
        state: rep.state || '',
        district: rep.district || null,
        image_url: rep.photo_url || null,
        phone: rep.phone || null,
        website: rep.website || null,
        alignment_score: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      setRepresentatives(convertedReps);

      // Load legislative data in parallel
      const [activityData, trendingData] = await Promise.allSettled([
        getActivityFeedFromService(zipcode, 20),
        getTrendingBillsFromService(zipcode, 15)
      ]);

      // Set activity feed
      if (activityData.status === 'fulfilled') {
        // Convert legislative activities to the expected format
        activityData.value.map((item: LegislativeActivityItem) => ({
          activity_id: item.activity_id,
          activity_type: item.type === 'bill' ? 'bill' as 'vote' | 'bill' | 'statement' :
                        item.type === 'vote' ? 'vote' as 'vote' | 'bill' | 'statement' :
                        'statement' as 'vote' | 'bill' | 'statement',
          activity_date: item.date,
          member_name: item.member_name || '',
          member_id: item.member_id || '',
          bill_id: item.bill_id || null,
          bill_title: item.title,
          bill_summary: item.description,
          vote: null,
          party: null,
          state: '',
          district: null,
          userSentiment: item.userSentiment
        }));
        // Activity feed data loaded
      } else {
        console.warn('Failed to load activity feed:', activityData.reason);
      }

      // Trending bills data loaded from legislative service
      if (trendingData.status === 'fulfilled') {
        console.log('Trending bills loaded');
      } else {
        console.warn('Failed to load trending bills:', trendingData.reason);
      }

      setAlignmentScores({});

      console.log('✅ Dashboard loading completed successfully with legislative data');
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [zipcode]);

  const subscribeToUpdates = useCallback(() => {
    return subscribeToFeed(zipcode, (payload) => {
      console.log('Real-time update:', payload);
      // Refresh the feed when new votes come in
      loadDashboard();
    });
  }, [zipcode, loadDashboard]);

  useEffect(() => {
    loadDashboard();
    const subscription = subscribeToUpdates();
    
    return () => {
      subscription?.unsubscribe();
    };
  }, [loadDashboard, subscribeToUpdates]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };


  const handlePeg = async (
    targetType: 'bill' | 'member' | 'vote',
    targetId: string,
    sentiment: 'approve' | 'disapprove'
  ) => {
    const peg: Omit<Peg, 'id' | 'created_at'> = {
      session_id: sessionId,
      zipcode,
      target_type: targetType,
      target_id: targetId,
      sentiment,
      comment: null
    };

    const result = await addPeg(peg);
    if (result) {
      // Peg recorded successfully - UI will update on next refresh
      // Refresh alignment scores
      loadDashboard();
    }
  };

  const handleLogout = () => {
    clearUserData();
    onZipcodeChange();
  };

  if (loading) {
    return (
      <div className="dashboard loading">
        <div className="loading-message">
          <p>Loading your government activity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <h1 className="dashboard-logo">
                <span className="logo-icon">📍</span>
                Pegboard
              </h1>
              <button 
                className="location-badge"
                onClick={handleLogout}
                title="Click to change zipcode"
              >
                <MapPin size={16} />
                <span>{zipcode}</span>
              </button>
            </div>
            <div className="top-nav">
              <button
                className={`nav-link ${activeTopNav === 'reps' ? 'active' : ''}`}
                onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveTopNav('reps'); }}
              >
                Representatives
              </button>
              <button
                className={`nav-link ${activeTopNav === 'feed' ? 'active' : ''}`}
                onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveTopNav('feed'); setActiveTab('feed'); }}
              >
                Activity Feed
              </button>
            </div>
            <div className="header-right">
              <button className="icon-button">
                <Bell size={20} />
              </button>
              <button 
                className="icon-button"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw 
                  size={20}
                />
              </button>
              <button 
                className="icon-button logout-button"
                onClick={handleLogout}
                title="Change Zipcode"
              >
                <LogOut size={20} />
                <span className="button-text">Change ZIP</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="container">

          {/* Representatives Section (Representatives view) */}
          {activeTopNav === 'reps' && (
          <section className="representatives-section">
            {useMultiLevel ? (
              <MultiLevelRepresentatives
                federal={federalReps}
                state={stateReps}
                local={localReps}
                alignmentScores={alignmentScores}
                onPeg={(memberId, sentiment) => handlePeg('member', memberId, sentiment)}
              />
            ) : (
              <>
                <h2 className="section-title">Your Representatives</h2>
                <div className="representatives-grid">
                  {representatives.map(rep => (
                    <RepresentativeCard
                      key={rep.bioguide_id}
                      representative={rep}
                      onPeg={(sentiment) => handlePeg('member', rep.bioguide_id, sentiment)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
          )}

          {/* Bottom Navigation (Activity Feed only) */}
          {activeTopNav === 'feed' && (
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              <FileText size={18} />
              Activity Feed
            </button>
            <button
              className={`tab-button ${activeTab === 'legislation' ? 'active' : ''}`}
              onClick={() => setActiveTab('legislation')}
            >
              <FileText size={18} />
              Legislation
            </button>
            <button
              className={`tab-button ${activeTab === 'reps' ? 'active' : ''}`}
              onClick={() => setActiveTab('reps')}
            >
              <User size={18} />
              Rep Details
            </button>
            <button
              className={`tab-button ${activeTab === 'state' ? 'active' : ''}`}
              onClick={() => setActiveTab('state')}
            >
              <Building2 size={18} />
              State Legislature
            </button>
            <button
              className={`tab-button ${activeTab === 'committees' ? 'active' : ''}`}
              onClick={() => setActiveTab('committees')}
            >
              <Building2 size={18} />
              Committees
            </button>
            <button
              className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              <Calendar size={18} />
              Events
            </button>
            <button
              className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <Search size={18} />
              Bill Search
            </button>
            <button
              className={`tab-button ${activeTab === 'hyperlocal' ? 'active' : ''}`}
              onClick={() => setActiveTab('hyperlocal')}
            >
              <MapPin size={18} />
              Hyperlocal Now
            </button>
            <button
              className={`tab-button ${activeTab === 'money' ? 'active' : ''}`}
              onClick={() => setActiveTab('money')}
            >
              <DollarSign size={18} />
              Spending
            </button>
            <button
              className={`tab-button ${activeTab === 'regulations' ? 'active' : ''}`}
              onClick={() => setActiveTab('regulations')}
            >
              <FileText size={18} />
              Regulations
            </button>
            <button
              className={`tab-button ${activeTab === 'canvas' ? 'active' : ''}`}
              onClick={() => setActiveTab('canvas')}
            >
              <FileText size={18} />
              Objective Canvas
            </button>
          </div>
          )}

          {/* Tab Content (Feed scope) */}
          {activeTopNav === 'feed' && (
          <div className="tab-content">
            {activeTab === 'feed' && (
              <UnifiedActivityFeed state={userState} zipcode={zipcode} />
            )}


            {activeTab === 'legislation' && (
              <LegislationSection
                zipcode={zipcode}
                onPeg={(billId, sentiment) => handlePeg('bill', billId, sentiment)}
              />
            )}

            {activeTab === 'reps' && (
              <section className="rep-details-section">
                <div className="section-header">
                  <h2 className="section-title">Representative Details</h2>
                  <p className="section-description">
                    Detailed information about your representatives
                  </p>
                </div>
                <div className="rep-details-grid">
                  {representatives.map(rep => (
                    <div key={rep.bioguide_id} className="rep-detail-card">
                      <div className="rep-header">
                        <div className="rep-avatar">
                          <User size={40} />
                        </div>
                        <div className="rep-info">
                          <h3>{rep.name}</h3>
                          <p className="rep-title">
                            {formatChamber(rep.chamber)} • {formatParty(rep.party)}
                          </p>
                          {rep.district && (
                            <p className="rep-district">
                              District {rep.district}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {rep.alignment_score !== undefined && (
                        <div className="alignment-meter">
                          <div className="alignment-header">
                            <span>Your Alignment</span>
                            <span 
                              className="alignment-score"
                              style={{ color: getAlignmentColor(rep.alignment_score) }}
                            >
                              {rep.alignment_score}%
                            </span>
                          </div>
                          <div className="alignment-bar">
                            <div 
                              className="alignment-fill"
                              style={{ 
                                width: `${rep.alignment_score}%`,
                                backgroundColor: getAlignmentColor(rep.alignment_score)
                              }}
                            />
                          </div>
                          <p className="alignment-label">
                            {getAlignmentLabel(rep.alignment_score)}
                          </p>
                        </div>
                      )}

                      <div className="rep-contact">
                        {rep.phone && (
                          <a href={`tel:${rep.phone}`} className="contact-link">
                            📞 {rep.phone}
                          </a>
                        )}
                        {rep.website && (
                          <a 
                            href={rep.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="contact-link"
                          >
                            🌐 Website
                          </a>
                        )}
                      </div>

                      <div className="rep-actions">
                        <button
                          className="peg-button approve"
                          onClick={() => handlePeg('member', rep.bioguide_id, 'approve')}
                        >
                          <ThumbsUp size={16} />
                          Approve
                        </button>
                        <button
                          className="peg-button disapprove"
                          onClick={() => handlePeg('member', rep.bioguide_id, 'disapprove')}
                        >
                          <ThumbsDown size={16} />
                          Disapprove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            
            {activeTab === 'state' && (
              <section className="state-legislature-section">
                <StateLegislatureActivity
                  zipcode={zipcode}
                  state={userState}
                />
              </section>
            )}

            {activeTab === 'committees' && (
              <CommitteesSection
                state={userState}
                zipcode={zipcode}
              />
            )}

            {activeTab === 'events' && (
              <LegislativeEvents
                state={userState}
                zipcode={zipcode}
              />
            )}

            {activeTab === 'search' && (
              <EnhancedBillSearch
                state={userState}
                zipcode={zipcode}
              />
            )}

            {activeTab === 'hyperlocal' && (
              <section className="hyperlocal-section">
                <HyperlocalNow zipcode={zipcode} />
              </section>
            )}

            {activeTab === 'money' && (
              <section className="spending-section">
                <GovernmentSpending
                  zipcode={zipcode}
                  state={userState}
                  district={representatives[0]?.district || '1'}
                />
              </section>
            )}

            {activeTab === 'regulations' && (
              <section className="regulations-section">
                <RegulatoryTracker
                  zipcode={zipcode}
                />
              </section>
            )}

            {activeTab === 'canvas' && (
              <section className="canvas-section">
                <ObjectiveCanvas
                  zipcode={zipcode}
                  state={userState}
                />
              </section>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;