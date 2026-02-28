import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  RefreshCw, 
  ThumbsUp, 
  ThumbsDown, 
  User, 
  FileText,
  TrendingUp,
  Bell,
  LogOut,
  Building2
} from 'lucide-react';
import { 
  Member, 
  ActivityFeedItem, 
  Bill,
  Peg
} from '../types';
import { 
  getMyReps, 
  getActivityFeed, 
  addPeg,
  getAlignmentScore,
  getTrendingBills,
  subscribeToFeed
} from '../services/supabase';
import { getRealDataForZipcode } from '../services/realData';
import { getRealMembersByState, getRealBills, generateRealActivityFeed } from '../services/realCongressAPI';
import { getAllRepresentatives, EnhancedMember } from '../services/googleCivic';
import { 
  formatDate, 
  formatRelativeTime,
  formatParty,
  getPartyColor,
  formatVote,
  getVoteColor,
  formatChamber,
  formatBillId,
  getSessionId,
  clearUserData,
  getAlignmentLabel,
  getAlignmentColor,
  truncateText
} from '../utils';
import RepresentativeCard from '../components/RepresentativeCard';
import ActivityCard from '../components/ActivityCard';
import TrendingBills from '../components/TrendingBills';
import MultiLevelRepresentatives from '../components/MultiLevelRepresentatives';
import StateLegislatureActivity from '../components/StateLegislatureActivity';
import '../styles/MultiLevelRepresentatives.css';

interface DashboardProps {
  zipcode: string;
  onZipcodeChange: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ zipcode, onZipcodeChange }) => {
  const [representatives, setRepresentatives] = useState<Member[]>([]);
  const [federalReps, setFederalReps] = useState<EnhancedMember[]>([]);
  const [stateReps, setStateReps] = useState<EnhancedMember[]>([]);
  const [localReps, setLocalReps] = useState<EnhancedMember[]>([]);
  const [useMultiLevel, setUseMultiLevel] = useState(true);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [trendingBills, setTrendingBills] = useState<(Bill & { peg_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'bills' | 'reps' | 'state'>('feed');
  const [alignmentScores, setAlignmentScores] = useState<{[key: string]: number}>({});
  const sessionId = getSessionId();

  useEffect(() => {
    loadDashboard();
    const subscription = subscribeToUpdates();
    
    return () => {
      subscription?.unsubscribe();
    };
  }, [zipcode]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // First try to load from Supabase
      let reps = await getMyReps(zipcode);
      let feed = await getActivityFeed(zipcode, 20);
      let trending = await getTrendingBills(5, zipcode);
      
      console.log('Initial load - Zipcode:', zipcode);
      console.log('Reps from Supabase:', reps);

      // Try Google Civic API for complete representative data
      if (useMultiLevel) {
        try {
          console.log('Fetching all representatives from Google Civic API...');
          const civicData = await getAllRepresentatives(zipcode);
          
          if (civicData.federal.length > 0 || civicData.state.length > 0 || civicData.local.length > 0) {
            console.log('Google Civic data received:', {
              federal: civicData.federal.length,
              state: civicData.state.length,
              local: civicData.local.length
            });
            
            setFederalReps(civicData.federal);
            setStateReps(civicData.state);
            setLocalReps(civicData.local);
            
            // Use federal reps for activity feed if we have them
            if (civicData.federal.length > 0) {
              // Convert to Member type for compatibility
              reps = civicData.federal.map(rep => ({
                bioguide_id: rep.bioguide_id,
                member_id: rep.member_id,
                name: rep.full_name,
                full_name: rep.full_name,
                party: rep.party || null,
                chamber: (rep.chamber?.toLowerCase() as 'senate' | 'house') || 'house',
                state: rep.state || '',
                district: rep.district || null,
                in_office: rep.in_office,
                next_election: rep.next_election || '',
                image_url: rep.photo_url || null,
                website: rep.website || null,
                phone: rep.phone || null,
                created_at: rep.created_at,
                updated_at: rep.updated_at
              }));
            }
          }
        } catch (civicError) {
          console.error('Google Civic API error:', civicError);
        }
      }
      
      // If no data from Supabase or Google Civic, use real data API
      if (reps.length === 0) {
        console.log('No data in Supabase or Google Civic, fetching real data...');
        try {
          // First get location info for the zipcode
          const realData = await getRealDataForZipcode(zipcode);
          const { state, district } = realData.location;
          
          // Try real Congress.gov API through our proxy
          try {
            console.log('Fetching REAL data from Congress.gov API...');
            console.log('State:', state, 'District:', district);
            
            // Get real members from Congress.gov
            const realMembers = await getRealMembersByState(state, district);
            console.log('REAL Congress.gov members:', realMembers);
            
            // Get real bills from Congress.gov  
            const realBills = await getRealBills();
            console.log('REAL Congress.gov bills:', realBills);
            
            if (realMembers && realMembers.length > 0) {
              reps = realMembers;
              feed = generateRealActivityFeed(realMembers, realBills);
              trending = realBills.slice(0, 5).map((bill, index) => ({
                ...bill,
                peg_count: Math.floor(Math.random() * 50) + 10
              }));
              console.log('✅ Using REAL Congress.gov data!');
            } else {
              throw new Error('No members returned from Congress.gov API');
            }
          } catch (congressError) {
            console.error('Congress.gov proxy error, falling back:', congressError);
            // Fall back to hardcoded data only if proxy fails
            reps = realData.representatives;
            feed = realData.activityFeed;
            trending = realData.bills.map((bill, index) => ({
              ...bill,
              peg_count: Math.floor(Math.random() * 50) + 10
            }));
            console.log('Using fallback representatives:', reps);
          }
          
          // Store in Supabase for future use (if connected)
          const { supabase } = await import('../services/supabase');
          if (supabase && reps.length > 0) {
            // Save district
            await supabase.from('districts').upsert({
              zipcode,
              state,
              district
            });
            
            // Save members
            await supabase.from('members').upsert(reps);
            
            // Save bills if we have them
            if (trending.length > 0) {
              const billsToSave = trending.map(({ peg_count, ...bill }) => bill);
              await supabase.from('bills').upsert(billsToSave);
            }
          }
        } catch (realDataError) {
          console.error('Error fetching real data:', realDataError);
        }
      }

      // Load alignment scores for each rep
      const repsWithScores = await Promise.all(
        reps.map(async (rep) => ({
          ...rep,
          alignment_score: rep.alignment_score || await getAlignmentScore(sessionId, rep.bioguide_id)
        }))
      );

      // Load alignment scores for multi-level reps
      const alignments: {[key: string]: number} = {};
      for (const rep of repsWithScores) {
        alignments[rep.bioguide_id] = rep.alignment_score || 50;
      }
      for (const rep of federalReps) {
        alignments[rep.member_id] = await getAlignmentScore(sessionId, rep.member_id);
      }
      
      setAlignmentScores(alignments);
      setRepresentatives(repsWithScores);
      setActivityFeed(feed);
      setTrendingBills(trending);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const subscribeToUpdates = () => {
    return subscribeToFeed(zipcode, (payload) => {
      console.log('Real-time update:', payload);
      // Refresh the feed when new votes come in
      loadDashboard();
    });
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
      // Update UI to reflect the peg
      setActivityFeed(prev => 
        prev.map(item => 
          item.activity_id === targetId 
            ? { ...item, userSentiment: sentiment }
            : item
        )
      );
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
        <div className="loading-spinner">
          <RefreshCw className="spinner" size={32} />
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
                  className={refreshing ? 'spinner' : ''}
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
          {/* Representatives Section */}
          <section className="representatives-section">
            {useMultiLevel && (federalReps.length > 0 || stateReps.length > 0 || localReps.length > 0) ? (
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

          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              <FileText size={18} />
              Activity Feed
            </button>
            <button
              className={`tab-button ${activeTab === 'bills' ? 'active' : ''}`}
              onClick={() => setActiveTab('bills')}
            >
              <TrendingUp size={18} />
              Trending Bills
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
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'feed' && (
              <section className="activity-section">
                <div className="section-header">
                  <h2 className="section-title">Recent Activity</h2>
                  <p className="section-description">
                    How your representatives are voting on bills
                  </p>
                </div>
                <div className="activity-feed">
                  {activityFeed.length > 0 ? (
                    activityFeed.map(item => (
                      <ActivityCard
                        key={item.activity_id}
                        activity={item}
                        onPeg={(sentiment) => 
                          handlePeg(
                            item.bill_id ? 'bill' : 'vote',
                            item.bill_id || item.activity_id,
                            sentiment
                          )
                        }
                      />
                    ))
                  ) : (
                    <div className="empty-state">
                      <FileText size={48} />
                      <h3>No Recent Activity</h3>
                      <p>Your representatives haven't voted recently</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'bills' && (
              <section className="trending-section">
                <div className="section-header">
                  <h2 className="section-title">Trending Bills</h2>
                  <p className="section-description">
                    Most discussed bills in your area
                  </p>
                </div>
                <TrendingBills
                  bills={trendingBills}
                  onPeg={(billId, sentiment) => handlePeg('bill', billId, sentiment)}
                />
              </section>
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
                  state="TX"
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;