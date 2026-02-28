import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Calendar, User } from 'lucide-react';
import { ActivityFeedItem } from '../types';
import { 
  formatRelativeTime,
  formatVote,
  getVoteColor,
  getPartyColor,
  truncateText
} from '../utils';
import BillDetailsModal from './BillDetailsModal';

interface ActivityCardProps {
  activity: ActivityFeedItem;
  onPeg: (sentiment: 'approve' | 'disapprove') => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onPeg }) => {
  const [showBillDetails, setShowBillDetails] = useState(false);
  const voteColor = activity.vote ? getVoteColor(activity.vote) : '#6b7280';
  const partyColor = getPartyColor(activity.party);

  return (
    <div className="activity-card">
      <div className="activity-header">
        <div className="activity-meta">
          <div className="member-info">
            <User size={16} />
            <span className="member-name">{activity.member_name}</span>
            <span 
              className="member-party"
              style={{ color: partyColor }}
            >
              ({activity.party})
            </span>
          </div>
          <div className="activity-time">
            <Calendar size={14} />
            <span>{formatRelativeTime(activity.activity_date)}</span>
          </div>
        </div>
      </div>

      <div className="activity-body">
        {activity.activity_type === 'vote' && activity.vote && (
          <div className="vote-badge" style={{ backgroundColor: voteColor }}>
            {formatVote(activity.vote)}
          </div>
        )}
        
        <div className="activity-content">
          <h4 className="bill-title">
            {activity.bill_title || 'Unknown Bill'}
          </h4>
          {activity.bill_summary && (
            <p className="bill-summary">
              {truncateText(activity.bill_summary, 150)}
            </p>
          )}
        </div>
      </div>

      <div className="activity-footer">
        <div className="peg-buttons">
          <button
            className={`peg-button ${activity.userSentiment === 'approve' ? 'active' : ''}`}
            onClick={() => onPeg('approve')}
          >
            <ThumbsUp size={16} />
            <span>Approve</span>
          </button>
          <button
            className={`peg-button ${activity.userSentiment === 'disapprove' ? 'active' : ''}`}
            onClick={() => onPeg('disapprove')}
          >
            <ThumbsDown size={16} />
            <span>Disapprove</span>
          </button>
        </div>
        {activity.bill_id && (
          <button 
            className="view-bill-link"
            onClick={() => setShowBillDetails(true)}
          >
            View Bill Details →
          </button>
        )}
      </div>
      
      {showBillDetails && activity.bill_id && (
        <BillDetailsModal 
          billId={activity.bill_id}
          onClose={() => setShowBillDetails(false)}
        />
      )}
    </div>
  );
};

export default ActivityCard;