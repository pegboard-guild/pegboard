import React, { useState, useEffect } from 'react';
import {
  User,
  ThumbsUp,
  ThumbsDown,
  Vote,
  TrendingUp,
  Phone,
  Mail,
  Globe,
  ChevronDown,
  ChevronUp,
  Users,
  Gavel
} from 'lucide-react';
import { Member } from '../types';
import {
  getLegislatorVotes,
  getLegislatorDetails,
  OpenStatesVote,
  OpenStatesLegislator
} from '../services/openstates';
import {
  formatParty,
  getPartyColor,
  formatChamber,
  getAlignmentColor
} from '../utils';

interface EnhancedRepresentativeCardProps {
  representative: Member & { openstates_id?: string };
  onPeg: (sentiment: 'approve' | 'disapprove') => void;
}

const EnhancedRepresentativeCard: React.FC<EnhancedRepresentativeCardProps> = ({
  representative,
  onPeg
}) => {
  const [expanded, setExpanded] = useState(false);
  const [recentVotes, setRecentVotes] = useState<OpenStatesVote[]>([]);
  const [detailedInfo, setDetailedInfo] = useState<OpenStatesLegislator | null>(null);
  const [loadingVotes, setLoadingVotes] = useState(false);

  const partyColor = getPartyColor(representative.party);
  const alignmentColor = representative.alignment_score
    ? getAlignmentColor(representative.alignment_score)
    : '#6b7280';

  useEffect(() => {
    if (expanded && representative.openstates_id && recentVotes.length === 0) {
      loadAdditionalData();
    }
  }, [expanded, representative.openstates_id]);

  const loadAdditionalData = async () => {
    if (!representative.openstates_id) return;

    setLoadingVotes(true);
    try {
      const [votes, details] = await Promise.all([
        getLegislatorVotes(representative.openstates_id, 10),
        getLegislatorDetails(representative.openstates_id)
      ]);
      setRecentVotes(votes);
      setDetailedInfo(details);
    } catch (error) {
      console.error('Error loading legislator data:', error);
    } finally {
      setLoadingVotes(false);
    }
  };

  const calculateVotingStats = () => {
    const total = recentVotes.length;
    const yesVotes = recentVotes.filter(v =>
      v.votes?.find(vote => vote.voter?.id === representative.openstates_id)?.option === 'yes'
    ).length;
    const noVotes = recentVotes.filter(v =>
      v.votes?.find(vote => vote.voter?.id === representative.openstates_id)?.option === 'no'
    ).length;
    const withMajority = recentVotes.filter(v => {
      const vote = v.votes?.find(vote => vote.voter?.id === representative.openstates_id);
      return (vote?.option === 'yes' && v.result === 'pass') ||
             (vote?.option === 'no' && v.result === 'fail');
    }).length;

    return { total, yesVotes, noVotes, withMajority };
  };

  const stats = calculateVotingStats();

  return (
    <div className={`enhanced-representative-card ${expanded ? 'expanded' : ''}`}>
      <div
        className="party-indicator"
        style={{ backgroundColor: partyColor }}
      />

      <div className="rep-content">
        <div className="rep-header">
          <div className="rep-avatar">
            {representative.image_url ? (
              <img
                src={representative.image_url}
                alt={representative.name}
                className="avatar-image"
              />
            ) : (
              <User size={32} />
            )}
          </div>

          <div className="rep-details">
            <h3 className="rep-name">{representative.name}</h3>
            <p className="rep-role">
              {formatChamber(representative.chamber)}
              {representative.district && ` • District ${representative.district}`}
            </p>
            <p className="rep-party" style={{ color: partyColor }}>
              {formatParty(representative.party)}
            </p>

            {detailedInfo && (
              <div className="contact-info">
                {detailedInfo.email && (
                  <a href={`mailto:${detailedInfo.email}`} title="Email">
                    <Mail size={14} />
                  </a>
                )}
                {detailedInfo.extras?.phone && (
                  <a href={`tel:${detailedInfo.extras.phone}`} title="Call">
                    <Phone size={14} />
                  </a>
                )}
                {detailedInfo.extras?.website && (
                  <a href={detailedInfo.extras.website} target="_blank" rel="noopener noreferrer" title="Website">
                    <Globe size={14} />
                  </a>
                )}
              </div>
            )}
          </div>

          {representative.alignment_score !== undefined && (
            <div className="alignment-badge">
              <div
                className="alignment-circle"
                style={{
                  borderColor: alignmentColor,
                  color: alignmentColor
                }}
              >
                {representative.alignment_score}%
              </div>
              <span className="alignment-text">alignment</span>
            </div>
          )}
        </div>

        <div className="rep-stats">
          {stats.total > 0 && (
            <>
              <div className="stat">
                <Vote size={14} />
                <span>{stats.total} recent votes</span>
              </div>
              <div className="stat">
                <TrendingUp size={14} />
                <span>{Math.round((stats.withMajority / stats.total) * 100)}% with majority</span>
              </div>
            </>
          )}
        </div>

        <div className="rep-actions">
          <button
            className="peg-button compact approve"
            onClick={() => onPeg('approve')}
            title="Approve this representative"
          >
            <ThumbsUp size={14} />
          </button>
          <button
            className="peg-button compact disapprove"
            onClick={() => onPeg('disapprove')}
            title="Disapprove this representative"
          >
            <ThumbsDown size={14} />
          </button>
          <button
            className="expand-button"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Show less' : 'Show voting record'}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{expanded ? 'Less' : 'More'}</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="expanded-content">
          {loadingVotes ? (
            <div className="loading">Loading voting record...</div>
          ) : (
            <>
              {recentVotes.length > 0 && (
                <div className="voting-record">
                  <h4><Vote size={16} /> Recent Voting Record</h4>
                  <div className="votes-list">
                    {recentVotes.slice(0, 5).map(vote => {
                      const legislatorVote = vote.votes?.find(v => v.voter?.id === representative.openstates_id);
                      return (
                        <div key={vote.id} className="vote-item">
                          <div className="vote-info">
                            <p className="vote-motion">{vote.motion_text}</p>
                            <p className="vote-date">{new Date(vote.start_date).toLocaleDateString()}</p>
                          </div>
                          <div className="vote-stance">
                            <span className={`vote-option ${legislatorVote?.option}`}>
                              {legislatorVote?.option?.toUpperCase() || 'N/A'}
                            </span>
                            <span className={`vote-result ${vote.result}`}>
                              {vote.result === 'pass' ? '✓ Passed' : '✗ Failed'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {detailedInfo?.current_role && (
                <div className="committee-memberships">
                  <h4><Users size={16} /> Committee Assignments</h4>
                  <p className="committee-info">
                    {detailedInfo.current_role.title} • {detailedInfo.current_role.chamber === 'upper' ? 'Senate' : 'House'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedRepresentativeCard;