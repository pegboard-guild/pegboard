import React, { useState, useEffect } from 'react';
import {
  FileText,
  Users,
  Calendar,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  Vote,
  User,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import {
  getBillDetails,
  getBillVotes,
  OpenStatesBill,
  OpenStatesVote
} from '../services/openstates';
import { getBillText } from '../services/govinfoService';
import BillTextModal from './BillTextModal';

interface EnhancedBillCardProps {
  bill: any; // Can be OpenStatesBill or federal bill
  onPeg?: (billId: string, sentiment: 'approve' | 'disapprove') => void;
  isFederal?: boolean;
}

const EnhancedBillCard: React.FC<EnhancedBillCardProps> = ({
  bill,
  onPeg,
  isFederal = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const [billVotes, setBillVotes] = useState<OpenStatesVote[]>([]);
  const [detailedBill, setDetailedBill] = useState<OpenStatesBill | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showBillText, setShowBillText] = useState(false);
  const [billTextAvailable, setBillTextAvailable] = useState(false);

  useEffect(() => {
    if (expanded && !isFederal && bill.id && billVotes.length === 0) {
      loadBillDetails();
    }
    if (isFederal && bill.number) {
      checkBillTextAvailability();
    }
  }, [expanded, bill.id, isFederal]);

  const loadBillDetails = async () => {
    setLoadingDetails(true);
    try {
      const [details, votes] = await Promise.all([
        getBillDetails(bill.id),
        getBillVotes(bill.id)
      ]);
      setDetailedBill(details);
      setBillVotes(votes);
    } catch (error) {
      console.error('Error loading bill details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const checkBillTextAvailability = async () => {
    try {
      const congress = bill.congress || '118';
      const billType = bill.type?.toLowerCase() || 'hr';
      const billNumber = bill.number;

      if (billType && billNumber) {
        const text = await getBillText(congress, billType, billNumber);
        setBillTextAvailable(!!text);
      }
    } catch (error) {
      console.error('Error checking bill text:', error);
      setBillTextAvailable(false);
    }
  };

  const formatBillId = () => {
    if (isFederal) {
      return `${bill.type} ${bill.number}`;
    }
    return bill.identifier || bill.id;
  };

  const getBillTitle = () => {
    if (isFederal) {
      return bill.title || bill.short_title || 'Untitled Bill';
    }
    return bill.title || 'Untitled Bill';
  };

  const getBillSummary = () => {
    if (isFederal) {
      return bill.summary || bill.policy_area || '';
    }
    return bill.abstract || '';
  };

  const getLatestAction = () => {
    if (isFederal) {
      return bill.latest_action ? {
        description: bill.latest_action.text,
        date: bill.latest_action.action_date
      } : null;
    }
    return bill.latest_action || null;
  };

  const getSponsors = () => {
    if (isFederal) {
      return bill.sponsor ? [{ name: bill.sponsor }] : [];
    }
    return detailedBill?.sponsors || bill.sponsors || [];
  };

  const latestAction = getLatestAction();
  const sponsors = getSponsors();

  return (
    <>
      <div className={`enhanced-bill-card ${expanded ? 'expanded' : ''}`}>
        <div className="bill-header">
          <div className="bill-id-badge">
            <FileText size={16} />
            <span>{formatBillId()}</span>
          </div>
          {bill.session && (
            <span className="session-badge">{bill.session}</span>
          )}
          {isFederal && bill.congress && (
            <span className="congress-badge">{bill.congress}th Congress</span>
          )}
        </div>

        <h3 className="bill-title">{getBillTitle()}</h3>

        {getBillSummary() && (
          <p className="bill-summary">
            {getBillSummary().substring(0, 200)}
            {getBillSummary().length > 200 && '...'}
          </p>
        )}

        {latestAction && (
          <div className="latest-action">
            <span className="action-label">Latest Action:</span>
            <span className="action-text">{latestAction.description}</span>
            <span className="action-date">
              {new Date(latestAction.date).toLocaleDateString()}
            </span>
          </div>
        )}

        <div className="bill-meta">
          {sponsors.length > 0 && (
            <div className="sponsors">
              <User size={14} />
              <span>
                {sponsors.slice(0, 2).map((s: any) => s.name).join(', ')}
                {sponsors.length > 2 && ` +${sponsors.length - 2}`}
              </span>
            </div>
          )}

          {billVotes.length > 0 && (
            <div className="vote-summary">
              <Vote size={14} />
              <span>{billVotes.length} votes recorded</span>
            </div>
          )}

          {bill.subject && bill.subject.length > 0 && (
            <div className="subjects">
              {bill.subject.slice(0, 3).map((subj: string) => (
                <span key={subj} className="subject-tag">{subj}</span>
              ))}
            </div>
          )}
        </div>

        <div className="bill-actions">
          {onPeg && (
            <>
              <button
                className="peg-button approve"
                onClick={() => onPeg(bill.id, 'approve')}
              >
                <ThumbsUp size={14} />
                <span>Support</span>
              </button>
              <button
                className="peg-button disapprove"
                onClick={() => onPeg(bill.id, 'disapprove')}
              >
                <ThumbsDown size={14} />
                <span>Oppose</span>
              </button>
            </>
          )}

          {billTextAvailable && (
            <button
              className="read-button"
              onClick={() => setShowBillText(true)}
            >
              <BookOpen size={14} />
              <span>Read Full Text</span>
            </button>
          )}

          {bill.openstates_url && (
            <a
              href={bill.openstates_url}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              <ExternalLink size={14} />
              <span>View Source</span>
            </a>
          )}

          <button
            className="expand-button"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{expanded ? 'Less' : 'More'}</span>
          </button>
        </div>

        {expanded && (
          <div className="expanded-content">
            {loadingDetails ? (
              <div className="loading">Loading bill details...</div>
            ) : (
              <>
                {billVotes.length > 0 && (
                  <div className="voting-breakdown">
                    <h4><Vote size={16} /> Voting Record</h4>
                    <div className="votes-list">
                      {billVotes.map(vote => (
                        <div key={vote.id} className="vote-record">
                          <div className="vote-description">
                            <p>{vote.motion_text}</p>
                            <p className="vote-chamber">
                              {vote.chamber === 'upper' ? 'Senate' : 'House'}
                            </p>
                          </div>
                          <div className="vote-counts">
                            <span className="yes">Yes: {vote.yes_count}</span>
                            <span className="no">No: {vote.no_count}</span>
                            <span className="absent">Absent: {vote.absent_count}</span>
                          </div>
                          <div className={`vote-result ${vote.result}`}>
                            {vote.result === 'pass' ? '✓ Passed' : '✗ Failed'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailedBill?.sponsors && detailedBill.sponsors.length > 0 && (
                  <div className="sponsors-list">
                    <h4><Users size={16} /> Bill Sponsors</h4>
                    <div className="sponsors-grid">
                      {detailedBill.sponsors.map((sponsor, idx) => (
                        <div key={idx} className="sponsor-item">
                          <User size={14} />
                          <span className="sponsor-name">{sponsor.name}</span>
                          <span className="sponsor-type">{sponsor.classification}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailedBill?.sources && detailedBill.sources.length > 0 && (
                  <div className="bill-sources">
                    <h4>Additional Resources</h4>
                    {detailedBill.sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                      >
                        <ExternalLink size={12} />
                        {source.note || 'View Document'}
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showBillText && isFederal && (
        <BillTextModal
          billId={`${bill.type}-${bill.number}`}
          isOpen={showBillText}
          onClose={() => setShowBillText(false)}
        />
      )}
    </>
  );
};

export default EnhancedBillCard;