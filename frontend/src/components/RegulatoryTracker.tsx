import React, { useState, useEffect } from 'react';
import {
  FileText,
  MessageCircle,
  AlertCircle,
  Calendar,
  Building2,
  Gavel,
  ExternalLink,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  getRecentDocuments,
  getDocumentsOpenForComment,
  getExecutiveOrders,
  getPublicInspectionDocuments,
  FederalDocument,
  ExecutiveOrder,
  PublicInspectionDocument
} from '../services/federalRegister';
import '../styles/RegulatoryTracker.css';

interface RegulatoryTrackerProps {
  zipcode?: string;
}

const RegulatoryTracker: React.FC<RegulatoryTrackerProps> = ({ zipcode }) => {
  const [activeTab, setActiveTab] = useState<'recent' | 'comment' | 'executive' | 'upcoming'>('recent');
  const [recentDocs, setRecentDocs] = useState<FederalDocument[]>([]);
  const [commentDocs, setCommentDocs] = useState<FederalDocument[]>([]);
  const [executiveOrders, setExecutiveOrders] = useState<ExecutiveOrder[]>([]);
  const [upcomingDocs, setUpcomingDocs] = useState<PublicInspectionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRegulatoryData();
  }, []);

  const loadRegulatoryData = async () => {
    setLoading(true);
    try {
      const [recent, openComment, executive, upcoming] = await Promise.all([
        getRecentDocuments({ perPage: 20 }),
        getDocumentsOpenForComment(),
        getExecutiveOrders(10),
        getPublicInspectionDocuments()
      ]);

      setRecentDocs(recent);
      setCommentDocs(openComment);
      setExecutiveOrders(executive);
      setUpcomingDocs(upcoming);
    } catch (error) {
      console.error('Error loading regulatory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDocExpanded = (docNumber: string) => {
    const newExpanded = new Set(expandedDocs);
    if (newExpanded.has(docNumber)) {
      newExpanded.delete(docNumber);
    } else {
      newExpanded.add(docNumber);
    }
    setExpandedDocs(newExpanded);
  };

  const getDocumentTypeColor = (type: string): string => {
    switch (type) {
      case 'Rule':
        return 'rule';
      case 'Proposed Rule':
        return 'proposed';
      case 'Notice':
        return 'notice';
      case 'Presidential Document':
      case 'Executive Order':
        return 'executive';
      default:
        return 'other';
    }
  };

  const getDaysUntilComment = (endDate: string): number => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return (
      <div className="regulatory-tracker loading">
        <FileText className="spin" />
        <p>Loading regulatory documents...</p>
      </div>
    );
  }

  return (
    <div className="regulatory-tracker">
      <div className="tracker-header">
        <h2>
          <Gavel size={24} />
          Federal Regulatory Tracker
        </h2>
        <p>Monitor rules, regulations, and executive actions affecting you</p>
      </div>

      <div className="tracker-tabs">
        <button
          className={activeTab === 'recent' ? 'active' : ''}
          onClick={() => setActiveTab('recent')}
        >
          <FileText size={16} />
          Recent Rules ({recentDocs.length})
        </button>
        <button
          className={activeTab === 'comment' ? 'active' : ''}
          onClick={() => setActiveTab('comment')}
        >
          <MessageCircle size={16} />
          Open for Comment ({commentDocs.length})
        </button>
        <button
          className={activeTab === 'executive' ? 'active' : ''}
          onClick={() => setActiveTab('executive')}
        >
          <Building2 size={16} />
          Executive Orders ({executiveOrders.length})
        </button>
        <button
          className={activeTab === 'upcoming' ? 'active' : ''}
          onClick={() => setActiveTab('upcoming')}
        >
          <Clock size={16} />
          Coming Soon ({upcomingDocs.length})
        </button>
      </div>

      <div className="tracker-content">
        {activeTab === 'recent' && (
          <div className="recent-documents">
            {recentDocs.map(doc => (
              <div key={doc.document_number} className="document-card">
                <div className="document-header">
                  <span className={`doc-type ${getDocumentTypeColor(doc.type)}`}>
                    {doc.type}
                  </span>
                  <span className="doc-date">
                    {new Date(doc.publication_date).toLocaleDateString()}
                  </span>
                </div>
                <h3>{doc.title}</h3>
                <div className="doc-agencies">
                  {doc.agencies.map(agency => (
                    <span key={agency.id} className="agency-tag">
                      <Building2 size={12} />
                      {agency.name}
                    </span>
                  ))}
                </div>
                {doc.abstract && (
                  <p className={`doc-abstract ${expandedDocs.has(doc.document_number) ? 'expanded' : ''}`}>
                    {doc.abstract}
                  </p>
                )}
                <div className="doc-actions">
                  {doc.abstract && doc.abstract.length > 200 && (
                    <button
                      className="expand-btn"
                      onClick={() => toggleDocExpanded(doc.document_number)}
                    >
                      {expandedDocs.has(doc.document_number) ? (
                        <>
                          <ChevronUp size={14} /> Less
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> More
                        </>
                      )}
                    </button>
                  )}
                  <a
                    href={doc.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-link"
                  >
                    <Eye size={14} />
                    View Full Text
                    <ExternalLink size={12} />
                  </a>
                  {doc.pdf_url && (
                    <a
                      href={doc.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="doc-link pdf"
                    >
                      <FileText size={14} />
                      PDF
                    </a>
                  )}
                </div>
                {doc.topics.length > 0 && (
                  <div className="doc-topics">
                    {doc.topics.slice(0, 3).map(topic => (
                      <span key={topic} className="topic-tag">{topic}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'comment' && (
          <div className="comment-documents">
            <div className="comment-notice">
              <AlertCircle size={20} />
              <p>
                These federal regulations are open for public comment. Your input can influence
                final rules that affect your community and industry.
              </p>
            </div>
            {commentDocs.map(doc => {
              const daysLeft = doc.comment_end_date ? getDaysUntilComment(doc.comment_end_date) : 0;
              return (
                <div key={doc.document_number} className="document-card comment-card">
                  <div className="comment-deadline">
                    <Clock size={16} />
                    {daysLeft > 0 ? (
                      <span className={daysLeft <= 7 ? 'urgent' : ''}>
                        {daysLeft} days left to comment
                      </span>
                    ) : (
                      <span className="expired">Comment period closed</span>
                    )}
                  </div>
                  <h3>{doc.title}</h3>
                  <div className="doc-agencies">
                    {doc.agencies.map(agency => (
                      <span key={agency.id} className="agency-tag">
                        {agency.name}
                      </span>
                    ))}
                  </div>
                  {doc.abstract && (
                    <p className="doc-abstract">{doc.abstract.substring(0, 200)}...</p>
                  )}
                  <div className="comment-actions">
                    {doc.public_comment_url && daysLeft > 0 && (
                      <a
                        href={doc.public_comment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="comment-btn"
                      >
                        <MessageCircle size={16} />
                        Submit Comment
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <a
                      href={doc.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="doc-link"
                    >
                      Read Full Document
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'executive' && (
          <div className="executive-orders">
            {executiveOrders.map(order => (
              <div key={order.document_number} className="executive-order-card">
                <div className="order-header">
                  <span className="order-number">
                    Executive Order {order.executive_order_number}
                  </span>
                  <span className="order-date">
                    Signed: {new Date(order.signing_date).toLocaleDateString()}
                  </span>
                </div>
                <h3>{order.title}</h3>
                <div className="order-president">
                  <Building2 size={14} />
                  {order.president.name}
                </div>
                {order.disposition_notes && (
                  <p className="disposition-notes">{order.disposition_notes}</p>
                )}
                <div className="order-actions">
                  <a
                    href={order.full_text_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-link"
                  >
                    <FileText size={14} />
                    Read Full Text
                    <ExternalLink size={12} />
                  </a>
                  {order.pdf_url && (
                    <a
                      href={order.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="doc-link pdf"
                    >
                      PDF Version
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'upcoming' && (
          <div className="upcoming-documents">
            <div className="upcoming-notice">
              <Clock size={20} />
              <p>
                These documents have been filed for public inspection and will be officially
                published in the Federal Register soon.
              </p>
            </div>
            {upcomingDocs.map(doc => (
              <div key={doc.document_number} className="document-card upcoming-card">
                <div className="upcoming-header">
                  <span className="doc-type">{doc.type}</span>
                  <span className="publication-date">
                    <Calendar size={14} />
                    Publishes: {new Date(doc.publication_date).toLocaleDateString()}
                  </span>
                </div>
                <h3>{doc.title}</h3>
                <div className="doc-agencies">
                  {doc.agencies.map(agency => (
                    <span key={agency} className="agency-tag">{agency}</span>
                  ))}
                </div>
                <div className="doc-meta">
                  <span className="filed-at">
                    Filed: {new Date(doc.filed_at).toLocaleString()}
                  </span>
                  <span className="num-pages">{doc.num_pages} pages</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="tracker-footer">
        <p>
          Data from the <a href="https://www.federalregister.gov" target="_blank" rel="noopener noreferrer">
            Federal Register <ExternalLink size={12} />
          </a>
          - The Daily Journal of the United States Government
        </p>
      </div>
    </div>
  );
};

export default RegulatoryTracker;