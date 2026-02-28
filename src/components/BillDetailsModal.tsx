import React, { useEffect, useState } from 'react';
import { X, Calendar, User, FileText, ExternalLink, Loader } from 'lucide-react';
import { Bill } from '../types';

interface BillDetailsModalProps {
  billId: string;
  onClose: () => void;
}

const BillDetailsModal: React.FC<BillDetailsModalProps> = ({ billId, onClose }) => {
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullText, setFullText] = useState<string>('');

  useEffect(() => {
    fetchBillDetails();
  }, [billId]);

  const fetchBillDetails = async () => {
    setLoading(true);
    try {
      // Parse bill ID (e.g., "HR-1234" or "S-567")
      const [type, number] = billId.split('-');
      
      // For now, we'll show the basic info we have
      // In a full implementation, this would fetch from Congress.gov API
      const mockBill: Bill = {
        bill_id: billId,
        congress_number: 118,
        title: `Loading details for ${billId}...`,
        summary: 'Fetching bill summary and full text from Congress.gov...',
        status: 'In Progress',
        introduced_date: new Date().toISOString(),
        sponsor_id: '',
        last_action: 'Loading...',
        last_action_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setBill(mockBill);
      
      // Construct Congress.gov URL
      const congressUrl = `https://www.congress.gov/bill/118th-congress/${type.toLowerCase()}-bill/${number}`;
      setFullText(`View full bill text at: ${congressUrl}`);
      
    } catch (error) {
      console.error('Error fetching bill details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content bill-details-modal">
        <div className="modal-header">
          <h2>Bill Details</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="loading-state">
            <Loader className="spinner" size={32} />
            <p>Loading bill details...</p>
          </div>
        ) : bill ? (
          <div className="modal-body">
            <div className="bill-header">
              <span className="bill-id-badge">{bill.bill_id}</span>
              <h3>{bill.title}</h3>
            </div>

            <div className="bill-meta">
              <div className="meta-item">
                <Calendar size={16} />
                <span>Introduced: {bill.introduced_date ? new Date(bill.introduced_date).toLocaleDateString() : 'Unknown'}</span>
              </div>
              {bill.sponsor_id && (
                <div className="meta-item">
                  <User size={16} />
                  <span>Sponsor: {bill.sponsor_id}</span>
                </div>
              )}
              <div className="meta-item">
                <FileText size={16} />
                <span>Status: {bill.status}</span>
              </div>
            </div>

            <div className="bill-section">
              <h4>Summary</h4>
              <p>{bill.summary || 'No summary available yet.'}</p>
            </div>

            <div className="bill-section">
              <h4>Last Action</h4>
              <p>{bill.last_action}</p>
              {bill.last_action_date && (
                <p className="action-date">
                  {new Date(bill.last_action_date).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="bill-section">
              <h4>Full Text</h4>
              <p className="full-text-note">{fullText}</p>
              {billId && (
                <a 
                  href={`https://www.congress.gov/bill/118th-congress/${billId.split('-')[0].toLowerCase()}-bill/${billId.split('-')[1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  <ExternalLink size={16} />
                  View on Congress.gov
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="error-state">
            <p>Failed to load bill details</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillDetailsModal;