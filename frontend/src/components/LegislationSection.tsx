// Unified Legislation Section - Shows federal, state, and local bills
// Dynamically loads content based on user's zipcode

import React, { useState, useEffect } from 'react';
import { FileText, Calendar, User as UserIcon, ExternalLink, Eye, MessageSquare, Building, MapPin, AlertCircle } from 'lucide-react';

// Import services for different legislation levels
import {
  getRecentBills,
  getBillsByType,
  CongressBill,
  formatBillId as formatCongressBillId,
  getBillUrl,
  getCurrentCongress
} from '../services/congressAPI';

import {
  getStateBills,
  OpenStatesBill
} from '../services/openstates';

import BillTextModal from './BillTextModal';

interface LegislationSectionProps {
  zipcode: string;
  onPeg?: (billId: string, sentiment: 'approve' | 'disapprove') => void;
}

type LegislationLevel = 'federal' | 'state' | 'local';
type BillType = CongressBill | OpenStatesBill | LocalBill;

interface LocalBill {
  id: string;
  title: string;
  type: string;
  date: string;
  status: string;
  sponsor?: string;
  description?: string;
}

const LegislationSection: React.FC<LegislationSectionProps> = ({
  zipcode,
  onPeg
}) => {
  const [activeLevel, setActiveLevel] = useState<LegislationLevel>('federal');
  const [federalBills, setFederalBills] = useState<CongressBill[]>([]);
  const [stateBills, setStateBills] = useState<OpenStatesBill[]>([]);
  const [localBills, setLocalBills] = useState<LocalBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [selectedCongress, setSelectedCongress] = useState(getCurrentCongress());
  const [viewMode, setViewMode] = useState<'all' | 'house' | 'senate'>('all');
  const [userState, setUserState] = useState<string>('');
  const [localSupported, setLocalSupported] = useState(false);

  // Determine state from zipcode
  useEffect(() => {
    const determineState = () => {
      // Texas zipcodes
      if (zipcode.startsWith('75') || zipcode.startsWith('76') || zipcode.startsWith('77') || zipcode.startsWith('78') || zipcode.startsWith('79')) {
        setUserState('TX');
        // Check if it's Dallas area for local support
        const dallasPrefixes = ['752', '753']; // Dallas area zip prefixes
        setLocalSupported(dallasPrefixes.some(prefix => zipcode.startsWith(prefix)));
      } else {
        // Add more state mappings as needed
        setUserState('TX'); // Default to Texas for demo
        setLocalSupported(false);
      }
    };

    determineState();
  }, [zipcode]);

  // Load bills based on active level
  useEffect(() => {
    loadBills();
  }, [activeLevel, selectedCongress, viewMode, userState]);

  const loadBills = async () => {
    setLoading(true);
    try {
      switch (activeLevel) {
        case 'federal':
          await loadFederalBills();
          break;
        case 'state':
          await loadStateBills();
          break;
        case 'local':
          await loadLocalBills();
          break;
      }
    } catch (error) {
      console.error(`Error loading ${activeLevel} bills:`, error);
    } finally {
      setLoading(false);
    }
  };

  const loadFederalBills = async () => {
    try {
      let bills: CongressBill[] = [];

      if (viewMode === 'all') {
        bills = await getRecentBills(selectedCongress, 20);
      } else if (viewMode === 'house') {
        bills = await getBillsByType(selectedCongress, 'hr', 20);
      } else if (viewMode === 'senate') {
        bills = await getBillsByType(selectedCongress, 's', 20);
      }

      console.log(`📋 Loaded ${bills.length} federal bills`);
      setFederalBills(bills);
    } catch (error) {
      console.error('Error loading federal bills:', error);
      setFederalBills([]);
    }
  };

  const loadStateBills = async () => {
    if (!userState) return;

    try {
      const bills = await getStateBills(userState, { limit: 20 });
      console.log(`📋 Loaded ${bills.length} state bills for ${userState}`);
      setStateBills(bills);
    } catch (error) {
      console.error('Error loading state bills:', error);
      setStateBills([]);
    }
  };

  const loadLocalBills = async () => {
    // For now, local bills are only available for Dallas area
    if (!localSupported) {
      setLocalBills([]);
      return;
    }

    // Mock local bills for Dallas - replace with real API when available
    const mockLocalBills: LocalBill[] = [
      {
        id: 'local-1',
        title: 'City Budget Amendment for Parks and Recreation',
        type: 'Resolution',
        date: '2025-09-10',
        status: 'Under Review',
        sponsor: 'District 14',
        description: 'Proposal to allocate additional funding for park maintenance and youth programs'
      },
      {
        id: 'local-2',
        title: 'Zoning Change Request - Deep Ellum District',
        type: 'Ordinance',
        date: '2025-09-08',
        status: 'Public Comment Period',
        sponsor: 'City Planning',
        description: 'Request to modify zoning regulations for mixed-use development'
      }
    ];

    setLocalBills(mockLocalBills);
  };

  const getBillTypeColor = (bill: any) => {
    if (activeLevel === 'federal') {
      const congressBill = bill as CongressBill;
      if (congressBill.type?.includes('H')) return '#3b82f6'; // Blue for House
      if (congressBill.type?.includes('S')) return '#10b981'; // Green for Senate
    } else if (activeLevel === 'state') {
      const stateBill = bill as OpenStatesBill;
      if (stateBill.from_organization?.classification === 'lower') return '#3b82f6';
      if (stateBill.from_organization?.classification === 'upper') return '#10b981';
    }
    return '#8b5cf6'; // Purple for other
  };

  const formatBillId = (bill: any) => {
    if (activeLevel === 'federal') {
      return formatCongressBillId(bill as CongressBill);
    } else if (activeLevel === 'state') {
      const stateBill = bill as OpenStatesBill;
      return stateBill.identifier || stateBill.id;
    } else {
      const localBill = bill as LocalBill;
      return localBill.type;
    }
  };

  const getCurrentBills = () => {
    switch (activeLevel) {
      case 'federal':
        return federalBills;
      case 'state':
        return stateBills;
      case 'local':
        return localBills;
      default:
        return [];
    }
  };

  return (
    <div className="legislation-section">
      <div className="section-header">
        <h2 className="section-title">Legislation</h2>
        <p className="section-description">
          Track bills and legislation at all levels of government
        </p>
      </div>

      {/* Level Selector */}
      <div className="level-selector">
        <button
          className={`level-btn ${activeLevel === 'federal' ? 'active' : ''}`}
          onClick={() => setActiveLevel('federal')}
        >
          <Building size={16} />
          Federal
        </button>
        <button
          className={`level-btn ${activeLevel === 'state' ? 'active' : ''}`}
          onClick={() => setActiveLevel('state')}
        >
          <MapPin size={16} />
          State
        </button>
        <button
          className={`level-btn ${activeLevel === 'local' ? 'active' : ''}`}
          onClick={() => setActiveLevel('local')}
        >
          <MapPin size={16} />
          Local
        </button>
      </div>

      {/* Federal Controls */}
      {activeLevel === 'federal' && (
        <div className="bills-controls">
          <div className="view-controls">
            <button
              className={`control-button ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
            >
              All Bills
            </button>
            <button
              className={`control-button ${viewMode === 'house' ? 'active' : ''}`}
              onClick={() => setViewMode('house')}
            >
              House
            </button>
            <button
              className={`control-button ${viewMode === 'senate' ? 'active' : ''}`}
              onClick={() => setViewMode('senate')}
            >
              Senate
            </button>
          </div>

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
      )}

      {/* State Indicator */}
      {activeLevel === 'state' && userState && (
        <div className="state-indicator">
          <span>Showing bills for: {userState}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading {activeLevel} legislation...</p>
        </div>
      ) : (
        <>
          {/* Empty State for Local (when not supported) */}
          {activeLevel === 'local' && !localSupported ? (
            <div className="coming-soon-state">
              <AlertCircle size={48} />
              <h3>Local Legislation Coming Soon</h3>
              <p>Local bills and ordinances are currently available for Dallas area zipcodes (752xx, 753xx).</p>
              <p>Support for your area will be added soon!</p>
            </div>
          ) : getCurrentBills().length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No Bills Found</h3>
              <p>No {activeLevel} legislation available.</p>
            </div>
          ) : (
            <div className="bills-grid">
              {getCurrentBills().map((bill: any) => (
                <div key={bill.id || `${bill.congress}-${bill.type}-${bill.number}`} className="bill-card">
                  <div className="bill-header">
                    <div className="bill-id-badge" style={{ backgroundColor: getBillTypeColor(bill) }}>
                      {formatBillId(bill)}
                    </div>
                    <div className="bill-meta">
                      <span className="bill-date">
                        <Calendar size={14} />
                        {activeLevel === 'federal' && bill.latestAction?.actionDate
                          ? new Date(bill.latestAction.actionDate).toLocaleDateString()
                          : activeLevel === 'state' && bill.latest_action?.date
                          ? new Date(bill.latest_action.date).toLocaleDateString()
                          : activeLevel === 'local' && bill.date
                          ? new Date(bill.date).toLocaleDateString()
                          : 'N/A'}
                      </span>
                      <span className="bill-chamber">
                        {activeLevel === 'federal' && bill.originChamber}
                        {activeLevel === 'state' && (bill.from_organization?.name || 'Legislature')}
                        {activeLevel === 'local' && bill.status}
                      </span>
                    </div>
                  </div>

                  <div className="bill-content">
                    <h3 className="bill-title">
                      {bill.title}
                    </h3>

                    {/* Sponsor Info */}
                    {((activeLevel === 'state' && bill.sponsors?.length > 0) ||
                      (activeLevel === 'local' && bill.sponsor)) && (
                      <div className="bill-author">
                        <UserIcon size={16} />
                        <span>
                          {activeLevel === 'state' ? bill.sponsors[0].name : bill.sponsor}
                        </span>
                      </div>
                    )}

                    {/* Latest Action / Description */}
                    {((activeLevel === 'federal' && bill.latestAction) ||
                      (activeLevel === 'state' && bill.latest_action) ||
                      (activeLevel === 'local' && bill.description)) && (
                      <div className="bill-status">
                        <span className="status-badge">
                          {activeLevel === 'federal' && bill.latestAction.text}
                          {activeLevel === 'state' && bill.latest_action.description}
                          {activeLevel === 'local' && bill.description}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="bill-actions">
                    <button
                      className="action-btn primary"
                      onClick={() => setSelectedBill(
                        activeLevel === 'federal'
                          ? `${bill.congress}-${bill.type}-${bill.number}`
                          : bill.id
                      )}
                    >
                      <Eye size={16} />
                      View Details
                    </button>

                    <button
                      className="action-btn secondary"
                      onClick={() => onPeg?.(
                        activeLevel === 'federal'
                          ? `${bill.congress}-${bill.type}-${bill.number}`
                          : bill.id,
                        'approve'
                      )}
                    >
                      <MessageSquare size={16} />
                      Support
                    </button>

                    {activeLevel === 'federal' && (
                      <a
                        href={getBillUrl(bill)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="action-btn secondary"
                        title="View on Congress.gov"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}

                    {activeLevel === 'state' && bill.openstates_url && (
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
        </>
      )}

      <div className="section-footer">
        <p className="data-source">
          {activeLevel === 'federal' && 'Federal legislation from Congress.gov API'}
          {activeLevel === 'state' && 'State legislation from OpenStates.org'}
          {activeLevel === 'local' && 'Local ordinances and resolutions'}
        </p>
        <p className="empowerment-message">
          💡 <strong>Your voice matters!</strong> Track legislation at every level of government.
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

export default LegislationSection;