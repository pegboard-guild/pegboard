// Federal & State Bills Section - Shows current legislation with full text access
// Uses OpenStates API to empower citizens with legislative transparency

import React, { useState, useEffect } from 'react';
import { FileText, Calendar, User as UserIcon, ExternalLink, Eye, MessageSquare } from 'lucide-react';
import { getStateBills, searchBills, getBillDetails, OpenStatesBill } from '../services/openstates';
import BillTextModal from './BillTextModal';

interface FederalBillsSectionProps {
  zipcode: string;
  onPeg?: (billId: string, sentiment: 'approve' | 'disapprove') => void;
}

const FederalBillsSection: React.FC<FederalBillsSectionProps> = ({
  zipcode,
  onPeg
}) => {
  const [bills, setBills] = useState<OpenStatesBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'recent' | 'state'>('recent');
  const [selectedState, setSelectedState] = useState<string>('');  // Will be set based on zipcode

  useEffect(() => {
    // Determine state from zipcode (simplified for Texas)
    if (zipcode.startsWith('75') || zipcode.startsWith('76') || zipcode.startsWith('77') || zipcode.startsWith('78') || zipcode.startsWith('79')) {
      setSelectedState('TX');
    } else {
      setSelectedState('TX'); // Default to Texas for now
    }
  }, [zipcode]);

  useEffect(() => {
    if (selectedState) {
      loadBills();
    }
  }, [viewMode, selectedState]);

  const loadBills = async () => {
    if (!selectedState) return;

    setLoading(true);
    try {
      let billsData: OpenStatesBill[] = [];

      if (viewMode === 'recent') {
        // Get recent bills for the state
        billsData = await getStateBills(selectedState, {
          limit: 20
        });
      } else {
        // Get bills for specific state session
        billsData = await getStateBills(selectedState, {
          limit: 30
        });
      }

      console.log(`📋 Loaded ${billsData.length} state bills`);
      setBills(billsData);
    } catch (error) {
      console.error('Error loading bills:', error);
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  const formatBillTitle = (title: string) => {
    // Clean up bill titles
    return title.trim();
  };

  const formatBillId = (bill: OpenStatesBill) => {
    // Format bill identifier
    return bill.identifier || bill.id;
  };

  const getBillTypeColor = (bill: OpenStatesBill) => {
    // Color based on bill chamber
    if (bill.from_organization?.classification === 'lower') return '#3b82f6'; // Blue for House bills
    if (bill.from_organization?.classification === 'upper') return '#10b981'; // Green for Senate bills
    return '#8b5cf6'; // Purple for other
  };

  return (
    <div className="federal-bills-section">
      <div className="section-header">
        <h2 className="section-title">State Legislation</h2>
        <p className="section-description">
          Current bills and legislation in your state - read the full text and share your opinion
        </p>
      </div>

      <div className="bills-controls">
        <div className="view-controls">
          <button
            className={`control-button ${viewMode === 'recent' ? 'active' : ''}`}
            onClick={() => setViewMode('recent')}
          >
            Recent Bills
          </button>
          <button
            className={`control-button ${viewMode === 'state' ? 'active' : ''}`}
            onClick={() => setViewMode('state')}
          >
            All State Bills
          </button>
        </div>

        <div className="state-indicator">
          <span>Showing bills for: {selectedState || 'Loading...'}</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading state legislation...</p>
        </div>
      ) : bills.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>No Bills Found</h3>
          <p>No state legislation available for {selectedState}.</p>
        </div>
      ) : (
        <div className="bills-grid">
          {bills.map((bill) => (
            <div key={bill.id} className="bill-card">
              <div className="bill-header">
                <div className="bill-id-badge" style={{ backgroundColor: getBillTypeColor(bill) }}>
                  {formatBillId(bill)}
                </div>
                <div className="bill-meta">
                  <span className="bill-date">
                    <Calendar size={14} />
                    {bill.latest_action?.date ? new Date(bill.latest_action.date).toLocaleDateString() : 'N/A'}
                  </span>
                  <span className="bill-chamber">
                    {bill.from_organization?.name || 'Legislature'}
                  </span>
                </div>
              </div>

              <div className="bill-content">
                <h3 className="bill-title">
                  {formatBillTitle(bill.title)}
                </h3>

                {bill.sponsors && bill.sponsors.length > 0 && (
                  <div className="bill-author">
                    <UserIcon size={16} />
                    <span>{bill.sponsors[0].name}</span>
                    {bill.sponsors.length > 1 && (
                      <span className="sponsor-count">+{bill.sponsors.length - 1} more</span>
                    )}
                  </div>
                )}

                {bill.latest_action && (
                  <div className="bill-status">
                    <span className="status-badge">
                      {bill.latest_action.description}
                    </span>
                  </div>
                )}
              </div>

              <div className="bill-actions">
                <button
                  className="action-btn primary"
                  onClick={() => setSelectedBill(bill.id)}
                >
                  <Eye size={16} />
                  Read Full Text
                </button>

                <button
                  className="action-btn secondary"
                  onClick={() => setSelectedBill(bill.id)}
                >
                  <MessageSquare size={16} />
                  Comment
                </button>

                {bill.openstates_url && (
                  <a
                    href={bill.openstates_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-btn secondary"
                    title="View on OpenStates"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-footer">
        <p className="data-source">
          State legislation data from OpenStates.org
        </p>
        <p className="empowerment-message">
          💡 <strong>Your voice matters!</strong> Read the bills, understand the legislation,
          and let your representatives know how you feel.
        </p>
      </div>

      {selectedBill && (
        <BillTextModal
          billId={selectedBill}
          isOpen={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          onPeg={onPeg}
        />
      )}
    </div>
  );
};

export default FederalBillsSection;