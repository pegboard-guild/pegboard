// Bill Text Modal - Full legislative text with citizen commenting
// Core component for Pegboard's mission of empowering public engagement

import React, { useState, useEffect } from 'react';
import { X, MessageSquare, ThumbsUp, ThumbsDown, Copy, ExternalLink, User } from 'lucide-react';
import { getBillDetails as getOpenStatesBillDetails, OpenStatesBill } from '../services/openstates';
import { getSessionId } from '../utils';

interface BillTextModalProps {
  billId: string;
  isOpen: boolean;
  onClose: () => void;
  onPeg?: (billId: string, sentiment: 'approve' | 'disapprove') => void;
}

interface BillComment {
  id: string;
  text: string;
  section: string;
  sentiment: 'approve' | 'disapprove';
  author: string;
  created_at: string;
}

interface BillTextData {
  full_text: string;
  format: string;
  retrieved_at: string;
}

const BillTextModal: React.FC<BillTextModalProps> = ({
  billId,
  isOpen,
  onClose,
  onPeg
}) => {
  const [bill, setBill] = useState<OpenStatesBill | null>(null);
  const [billText, setBillText] = useState<BillTextData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'summary' | 'comments'>('summary');
  const [comments, setComments] = useState<BillComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [selectedSection, setSelectedSection] = useState('general');
  const [userSentiment, setUserSentiment] = useState<'approve' | 'disapprove' | null>(null);

  const sessionId = getSessionId();

  useEffect(() => {
    if (isOpen && billId) {
      loadBillData();
    }
  }, [isOpen, billId]);

  const loadBillData = async () => {
    setLoading(true);
    try {
      console.log('📄 Loading bill data for:', billId);

      // Check if this is a federal bill (format: congress-type-number, e.g., "119-HR-1234")
      const federalBillMatch = billId.match(/^(\d+)-(HR|S|HRES|SRES|HJRES|SJRES|HCONRES|SCONRES)-(\d+)$/i);

      if (federalBillMatch) {
        // Federal bill - use Congress.gov
        const [, congress, type, number] = federalBillMatch;
        const congressUrl = `https://www.congress.gov/bill/${congress}th-congress/${type.toLowerCase().includes('h') ? 'house' : 'senate'}-bill/${number}`;

        setBill({
          id: billId,
          identifier: `${type} ${number}`,
          title: `Federal Bill ${type} ${number}`,
          openstates_url: congressUrl,
          latest_action: {
            date: new Date().toISOString(),
            description: 'View on Congress.gov for full details'
          }
        } as any);

        setBillText({
          full_text: `<div style="padding: 20px; text-align: center;">
            <h3>Federal Bill: ${type} ${number}</h3>
            <p style="margin: 20px 0;">Full text and legislative details are available on Congress.gov</p>
            <a href="${congressUrl}" target="_blank" rel="noopener noreferrer"
               style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
              View on Congress.gov →
            </a>
          </div>`,
          format: 'html',
          retrieved_at: new Date().toISOString()
        });
      } else {
        // State bill - use OpenStates
        const billDetails = await getOpenStatesBillDetails(billId);
        setBill(billDetails);

        // Simulate bill text for now (OpenStates provides links to external sources)
        if (billDetails?.sources && billDetails.sources.length > 0) {
          setBillText({
            full_text: `<p>Full bill text available at: <a href="${billDetails.sources[0].url}" target="_blank">${billDetails.sources[0].url}</a></p>`,
            format: 'html',
            retrieved_at: new Date().toISOString()
          });
        } else if (billDetails?.openstates_url) {
          setBillText({
            full_text: `<p>View full bill details at: <a href="${billDetails.openstates_url}" target="_blank">OpenStates.org</a></p>`,
            format: 'html',
            retrieved_at: new Date().toISOString()
          });
        }
      }

      // Load comments (mock data for now)
      setComments([
        {
          id: '1',
          text: 'This provision about healthcare funding seems problematic...',
          section: 'Section 3',
          sentiment: 'disapprove',
          author: 'Anonymous Citizen',
          created_at: new Date().toISOString()
        }
      ]);

    } catch (error) {
      console.error('Error loading bill data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeg = (sentiment: 'approve' | 'disapprove') => {
    setUserSentiment(sentiment);
    onPeg?.(billId, sentiment);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: BillComment = {
      id: Date.now().toString(),
      text: newComment,
      section: selectedSection,
      sentiment: userSentiment || 'approve',
      author: `Citizen ${sessionId.slice(0, 8)}`,
      created_at: new Date().toISOString()
    };

    setComments([comment, ...comments]);
    setNewComment('');
  };

  const copyBillUrl = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bill-text-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-section">
            <h2 className="modal-title">
              {bill?.title || 'Loading Bill...'}
            </h2>
            <div className="bill-meta">
              <span className="bill-id">{bill?.identifier || billId}</span>
              <span className="bill-date">
                {bill?.latest_action?.date && new Date(bill.latest_action.date).toLocaleDateString()}
              </span>
              <span className="bill-author">{bill?.sponsors?.[0]?.name || 'Unknown'}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button className="action-button" onClick={copyBillUrl} title="Copy Link">
              <Copy size={18} />
            </button>
            {bill?.openstates_url && (
              <a href={bill.openstates_url} target="_blank" rel="noopener noreferrer"
                 className="action-button" title="View on OpenStates">
                <ExternalLink size={18} />
              </a>
            )}
            <button className="close-button" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="modal-nav">
          <button
            className={`nav-tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`nav-tab ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            Full Text
          </button>
          <button
            className={`nav-tab ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            Comments ({comments.length})
          </button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading legislative text...</p>
            </div>
          ) : (
            <>
              {activeTab === 'summary' && (
                <div className="bill-summary">
                  <div className="summary-content">
                    {bill?.abstract ? (
                      <p>{bill.abstract}</p>
                    ) : (
                      <div>
                        <p className="no-summary">
                          {bill?.title || 'Summary not available. View the full text to read this legislation.'}
                        </p>
                        {bill?.latest_action && (
                          <div className="latest-action">
                            <strong>Latest Action:</strong> {bill.latest_action.description}
                            <span className="action-date"> ({new Date(bill.latest_action.date).toLocaleDateString()})</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="citizen-action">
                    <h3>Your Voice Matters</h3>
                    <p>Express your opinion on this legislation:</p>
                    <div className="peg-buttons-large">
                      <button
                        className={`peg-button approve ${userSentiment === 'approve' ? 'active' : ''}`}
                        onClick={() => handlePeg('approve')}
                      >
                        <ThumbsUp size={20} />
                        Approve
                      </button>
                      <button
                        className={`peg-button disapprove ${userSentiment === 'disapprove' ? 'active' : ''}`}
                        onClick={() => handlePeg('disapprove')}
                      >
                        <ThumbsDown size={20} />
                        Disapprove
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'text' && (
                <div className="bill-text">
                  {billText?.full_text ? (
                    <div
                      className="bill-text-content"
                      dangerouslySetInnerHTML={{ __html: billText.full_text }}
                    />
                  ) : (
                    <div className="no-text">
                      <p>Full text not available at this time.</p>
                      <p>Try viewing the bill on OpenStates using the link above.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="bill-comments">
                  <div className="comment-form">
                    <h4>Add Your Comment</h4>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your thoughts on this legislation..."
                      className="comment-input"
                      rows={3}
                    />
                    <div className="comment-actions">
                      <select
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        className="section-select"
                      >
                        <option value="general">General Comment</option>
                        <option value="section1">Section 1</option>
                        <option value="section2">Section 2</option>
                        <option value="section3">Section 3</option>
                      </select>
                      <button
                        onClick={handleAddComment}
                        className="submit-comment"
                        disabled={!newComment.trim()}
                      >
                        <MessageSquare size={16} />
                        Comment
                      </button>
                    </div>
                  </div>

                  <div className="comments-list">
                    {comments.length === 0 ? (
                      <div className="no-comments">
                        <MessageSquare size={48} />
                        <h3>No Comments Yet</h3>
                        <p>Be the first to share your thoughts on this legislation.</p>
                      </div>
                    ) : (
                      comments.map(comment => (
                        <div key={comment.id} className="comment">
                          <div className="comment-header">
                            <div className="comment-author">
                              <User size={16} />
                              {comment.author}
                            </div>
                            <div className="comment-meta">
                              <span className="comment-section">{comment.section}</span>
                              <span className="comment-date">
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                              <span className={`comment-sentiment ${comment.sentiment}`}>
                                {comment.sentiment === 'approve' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
                              </span>
                            </div>
                          </div>
                          <div className="comment-text">
                            {comment.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillTextModal;