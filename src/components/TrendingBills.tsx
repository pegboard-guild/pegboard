import React from 'react';
import { TrendingUp, ThumbsUp, ThumbsDown, Users } from 'lucide-react';
import { Bill } from '../types';
import { formatDate, formatBillId, truncateText } from '../utils';

interface TrendingBillsProps {
  bills: (Bill & { peg_count: number })[];
  onPeg: (billId: string, sentiment: 'approve' | 'disapprove') => void;
}

const TrendingBills: React.FC<TrendingBillsProps> = ({ bills, onPeg }) => {
  if (bills.length === 0) {
    return (
      <div className="empty-state">
        <TrendingUp size={48} />
        <h3>No Trending Bills</h3>
        <p>Bills will appear here as people in your area engage with them</p>
      </div>
    );
  }

  return (
    <div className="trending-bills">
      {bills.map((bill, index) => (
        <div key={bill.bill_id} className="trending-bill-card">
          <div className="trending-rank">
            <span className="rank-number">#{index + 1}</span>
            <div className="peg-count">
              <Users size={14} />
              <span>{bill.peg_count} pegs</span>
            </div>
          </div>

          <div className="bill-content">
            <h4 className="bill-title">
              <span className="bill-id">{formatBillId(bill.bill_id)}</span>
              {bill.title}
            </h4>
            {bill.summary && (
              <p className="bill-summary">
                {truncateText(bill.summary, 100)}
              </p>
            )}
            <div className="bill-meta">
              {bill.sponsor && (
                <span className="bill-sponsor">
                  Sponsored by {bill.sponsor.name}
                </span>
              )}
              {bill.introduced_date && (
                <span className="bill-date">
                  {formatDate(bill.introduced_date)}
                </span>
              )}
            </div>
          </div>

          <div className="bill-actions">
            <button
              className="peg-button compact approve"
              onClick={() => onPeg(bill.bill_id, 'approve')}
            >
              <ThumbsUp size={14} />
            </button>
            <button
              className="peg-button compact disapprove"
              onClick={() => onPeg(bill.bill_id, 'disapprove')}
            >
              <ThumbsDown size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TrendingBills;