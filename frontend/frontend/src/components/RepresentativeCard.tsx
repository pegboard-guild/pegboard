import React from 'react';
import { User, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Member } from '../types';
import { 
  formatParty, 
  getPartyColor, 
  formatChamber,
  getAlignmentColor
} from '../utils';

interface RepresentativeCardProps {
  representative: Member;
  onPeg: (sentiment: 'approve' | 'disapprove') => void;
}

const RepresentativeCard: React.FC<RepresentativeCardProps> = ({ 
  representative, 
  onPeg 
}) => {
  const partyColor = getPartyColor(representative.party);
  const alignmentColor = representative.alignment_score 
    ? getAlignmentColor(representative.alignment_score)
    : '#6b7280';

  return (
    <div className="representative-card">
      <div 
        className="party-indicator"
        style={{ backgroundColor: partyColor }}
      />
      
      <div className="rep-content">
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
      </div>
    </div>
  );
};

export default RepresentativeCard;