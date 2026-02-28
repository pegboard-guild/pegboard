import React, { useState } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  Building,
  Lock,
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle
} from 'lucide-react';
import { EnhancedMember } from '../services/representativeService';
import { getAlignmentColor, getAlignmentLabel, getPartyColor } from '../utils';

interface MultiLevelRepresentativesProps {
  federal: EnhancedMember[];
  state: EnhancedMember[];
  local: EnhancedMember[];
  alignmentScores: { [key: string]: number };
  onPeg?: (memberId: string, sentiment: 'approve' | 'disapprove') => void;
}

interface LevelSectionProps {
  title: string;
  level: 'federal' | 'state' | 'local';
  members: EnhancedMember[];
  alignmentScores: { [key: string]: number };
  isActive: boolean;
  onPeg?: (memberId: string, sentiment: 'approve' | 'disapprove') => void;
}

const LevelSection: React.FC<LevelSectionProps> = ({ 
  title, 
  level, 
  members, 
  alignmentScores,
  isActive,
  onPeg 
}) => {
  const [isExpanded, setIsExpanded] = useState(level === 'federal');
  
  const getLevelIcon = () => {
    switch(level) {
      case 'federal': return <Building className="text-blue-600" size={20} />;
      case 'state': return <MapPin className="text-purple-600" size={20} />;
      case 'local': return <Building className="text-green-600" size={20} />;
    }
  };
  
  const getLevelDescription = () => {
    switch(level) {
      case 'federal':
        return 'Track votes and bills in Congress';
      case 'state':
        return 'Track state legislation and votes';
      case 'local':
        return 'Track local ordinances and city council votes';
    }
  };
  
  return (
    <div className="level-section">
      <div 
        className="level-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="level-title-group">
          {getLevelIcon()}
          <h3>{title}</h3>
          <span className="member-count">{members.length} officials</span>
          {!isActive && <Lock size={16} className="lock-icon" />}
        </div>
        <div className="level-controls">
          {isActive ? (
            <span className="status-badge active">
              <Check size={14} />
              Active
            </span>
          ) : (
            <span className="status-badge coming-soon">
              Coming Soon
            </span>
          )}
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </div>
      
      {isExpanded && (
        <>
          <p className="level-description">{getLevelDescription()}</p>
          <div className="members-grid">
            {members.map(member => (
              <OfficialCard 
                key={member.member_id}
                member={member}
                alignment={alignmentScores[member.member_id]}
                isActive={isActive}
                onPeg={onPeg}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface OfficialCardProps {
  member: EnhancedMember;
  alignment?: number;
  isActive: boolean;
  onPeg?: (memberId: string, sentiment: 'approve' | 'disapprove') => void;
}

const OfficialCard: React.FC<OfficialCardProps> = ({ 
  member, 
  alignment = 50,
  isActive,
  onPeg 
}) => {
  const [userSentiment, setUserSentiment] = useState<'approve' | 'disapprove' | null>(null);
  
  const handlePeg = (sentiment: 'approve' | 'disapprove') => {
    if (!isActive) return;
    setUserSentiment(sentiment);
    onPeg?.(member.member_id, sentiment);
  };
  
  return (
    <div className={`official-card ${!isActive ? 'inactive' : ''}`}>
      <div className="official-header">
        <div className="official-photo">
          {member.photo_url ? (
            <img src={member.photo_url} alt={member.full_name} />
          ) : (
            <User size={40} />
          )}
        </div>
        <div className="official-info">
          <h4>{member.full_name}</h4>
          <p className="office-name">{member.office_name}</p>
          <span 
            className="party-badge"
            style={{ color: getPartyColor(member.party) }}
          >
            {member.party}
          </span>
        </div>
      </div>
      
      {isActive && (
        <div className="alignment-section">
          <div className="alignment-meter">
            <div 
              className="alignment-fill"
              style={{ 
                width: `${alignment}%`,
                backgroundColor: getAlignmentColor(alignment)
              }}
            />
          </div>
          <div className="alignment-label">
            <span>{alignment}%</span>
            <span className="alignment-text">{getAlignmentLabel(alignment)}</span>
          </div>
        </div>
      )}
      
      <div className="official-contact">
        {member.phone && (
          <a href={`tel:${member.phone}`} className="contact-link">
            <Phone size={14} />
            <span>{member.phone}</span>
          </a>
        )}
        {member.email && (
          <a href={`mailto:${member.email}`} className="contact-link">
            <Mail size={14} />
            <span>Email</span>
          </a>
        )}
        {member.website && (
          <a href={member.website} target="_blank" rel="noopener noreferrer" className="contact-link">
            <Globe size={14} />
            <span>Website</span>
          </a>
        )}
      </div>
      
      {isActive ? (
        <div className="peg-buttons">
          <button
            className={`peg-btn approve ${userSentiment === 'approve' ? 'active' : ''}`}
            onClick={() => handlePeg('approve')}
          >
            Approve
          </button>
          <button
            className={`peg-btn disapprove ${userSentiment === 'disapprove' ? 'active' : ''}`}
            onClick={() => handlePeg('disapprove')}
          >
            Disapprove
          </button>
        </div>
      ) : (
        <div className="coming-soon-overlay">
          <AlertCircle size={16} />
          <span>Feature coming soon</span>
        </div>
      )}
    </div>
  );
};

const MultiLevelRepresentatives: React.FC<MultiLevelRepresentativesProps> = ({
  federal,
  state,
  local,
  alignmentScores,
  onPeg
}) => {
  return (
    <div className="multi-level-representatives">
      <div className="representatives-header">
        <h2>Your Complete Representation</h2>
        <p className="subtitle">
          From President to City Council - all {federal.length + state.length + local.length} officials who represent you
        </p>
      </div>
      
      <LevelSection
        title="Federal Government"
        level="federal"
        members={federal}
        alignmentScores={alignmentScores}
        isActive={true}
        onPeg={onPeg}
      />
      
      <LevelSection
        title="State Government"
        level="state"
        members={state}
        alignmentScores={alignmentScores}
        isActive={true}
        onPeg={onPeg}
      />

      <LevelSection
        title="Local Government"
        level="local"
        members={local}
        alignmentScores={alignmentScores}
        isActive={true}
        onPeg={onPeg}
      />
      
      <div className="data-attribution">
        <p>Official data provided by OpenStates API</p>
        <p>Federal bill text from GovInfo API</p>
      </div>
    </div>
  );
};

export default MultiLevelRepresentatives;