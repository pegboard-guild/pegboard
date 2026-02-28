// Federal Bills Section - Shows current federal legislation from Congress.gov
// Uses real Congress.gov API data to empower citizens with legislative transparency

import React, { useState, useEffect } from 'react';
import { FileText, Calendar, User as UserIcon, ExternalLink, Eye, MessageSquare, Building } from 'lucide-react';
import {
  getRecentBills,
  getBillsByType,
  CongressBill,
  formatBillId,
  getBillUrl,
  getCurrentCongress
} from '../services/congressAPI';
import BillTextModal from './BillTextModal';

interface FederalBillsSectionProps {
  zipcode: string;
  onPeg?: (billId: string, sentiment: 'approve' | 'disapprove') => void;
}

const FederalBillsSection: React.FC<FederalBillsSectionProps> = ({
  zipcode,
  onPeg
}) => {
  const [bills, setBills] = useState<CongressBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'recent' | 'house' | 'senate'>('recent');
  const [selectedCongress, setSelectedCongress] = useState(getCurrentCongress());

  useEffect(() => {
    loadBills();
  }, [viewMode, selectedCongress]);

  const loadBills = async () => {
    setLoading(true);
    try {
      let billsData: CongressBill[] = [];

      if (viewMode === 'recent') {
        // Get recent bills from all chambers
        billsData = await getRecentBills(selectedCongress, 20);
      } else if (viewMode === 'house') {
        // Get House bills
        billsData = await getBillsByType(selectedCongress, 'hr', 20);
      } else if (viewMode === 'senate') {
        // Get Senate bills
        billsData = await getBillsByType(selectedCongress, 's', 20);
      }

      console.log(`📋 Loaded ${billsData.length} federal bills from ${selectedCongress}th Congress`);
      setBills(billsData);
    } catch (error) {
      console.error('Error loading federal bills:', error);
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  const formatBillTitle = (title: string) => {
    // Clean up bill titles
    return title.trim();
  };

  const getBillTypeColor = (bill: CongressBill) => {
    // Color based on bill type and chamber
    if (bill.type === 'HR' || bill.type === 'HRES' || bill.type === 'HJRES' || bill.type === 'HCONRES') {
      return '#3b82f6'; // Blue for House bills
    }
    if (bill.type === 'S' || bill.type === 'SRES' || bill.type === 'SJRES' || bill.type === 'SCONRES') {
      return '#10b981'; // Green for Senate bills
    }
    return '#8b5cf6'; // Purple for other
  };

  return (
    <div className="federal-bills-section">
      <div className="section-header">
        <h2 className="section-title">Federal Legislation</h2>
        <p className="section-description">
          Current bills in the U.S. Congress - track real federal legislation and share your opinion
        </p>
      </div>

      <div className="bills-controls">
        <div className="view-controls">
          <button
            className={`control-button ${viewMode === 'recent' ? 'active' : ''}`}
            onClick={() => setViewMode('recent')}
          >
            All Recent
          </button>
          <button
            className={`control-button ${viewMode === 'house' ? 'active' : ''}`}
            onClick={() => setViewMode('house')}
          >
            House Bills
          </button>
          <button
            className={`control-button ${viewMode === 'senate' ? 'active' : ''}`}
            onClick={() => setViewMode('senate')}
          >
            Senate Bills
          </button>
        </div>

        <div className="congress-selector">
          <select
            value={selectedCongress}
            onChange={(e) => setSelectedCongress(Number(e.target.value))}
            className="congress-select"
          >
            <option value={119}>119th Congress (2025-2026)</option>
            <option value={118}>118th Congress (2023-2024)</option>
            <option value={117}>117th Congress (2021-2022)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading federal legislation from Congress.gov...</p>
        </div>
      ) : bills.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>No Bills Found</h3>
          <p>No federal legislation available for the {selectedCongress}th Congress.</p>
        </div>
      ) : (
        <div className="bills-grid">
          {bills.map((bill) => (
            <div key={`${bill.congress}-${bill.type}-${bill.number}`} className="bill-card">
              <div className="bill-header">
                <div className="bill-id-badge" style={{ backgroundColor: getBillTypeColor(bill) }}>
                  {formatBillId(bill)}
                </div>
                <div className="bill-meta">
                  <span className="bill-date">
                    <Calendar size={14} />
                    {bill.latestAction?.actionDate ? new Date(bill.latestAction.actionDate).toLocaleDateString() : 'N/A'}
                  </span>
                  <span className="bill-chamber">
                    <Building size={14} />
                    {bill.originChamber}
                  </span>
                </div>
              </div>

              <div className="bill-content">
                <h3 className="bill-title">
                  {formatBillTitle(bill.title)}
                </h3>

                {bill.latestAction && (
                  <div className="bill-status">
                    <span className="status-badge">
                      {bill.latestAction.text}
                    </span>
                  </div>
                )}
              </div>

              <div className="bill-actions">
                <button
                  className="action-btn primary"
                  onClick={() => setSelectedBill(`${bill.congress}-${bill.type}-${bill.number}`)}
                >
                  <Eye size={16} />
                  View Details
                </button>

                <button
                  className="action-btn secondary"
                  onClick={() => onPeg?.(`${bill.congress}-${bill.type}-${bill.number}`, 'approve')}
                >
                  <MessageSquare size={16} />
                  Support
                </button>

                <a
                  href={getBillUrl(bill)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-btn secondary"
                  title="View on Congress.gov"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-footer">
        <p className="data-source">
          Federal legislation data from Congress.gov API
        </p>
        <p className="empowerment-message">
          💡 <strong>Your voice matters!</strong> Track real federal bills, understand the legislation,
          and contact your representatives to share your views.
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