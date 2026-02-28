import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Building2,
  MapPin,
  Award,
  AlertTriangle,
  ExternalLink,
  FileText
} from 'lucide-react';
import {
  getSpendingByZipcode,
  getAwardsByDistrict,
  getSpendingByAgency,
  getDisasterSpending,
  SpendingByLocation,
  Award as SpendingAward,
  AgencySpending
} from '../services/usaSpending';
import '../styles/GovernmentSpending.css';

interface GovernmentSpendingProps {
  zipcode: string;
  state?: string;
  district?: string;
}

const GovernmentSpending: React.FC<GovernmentSpendingProps> = ({
  zipcode,
  state = 'TX',
  district = '32'
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'agencies' | 'awards' | 'disaster'>('local');
  const [localSpending, setLocalSpending] = useState<SpendingByLocation | null>(null);
  const [awards, setAwards] = useState<SpendingAward[]>([]);
  const [agencySpending, setAgencySpending] = useState<AgencySpending[]>([]);
  const [disasterSpending, setDisasterSpending] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadSpendingData = useCallback(async () => {
    setLoading(true);
    try {
      // Per-call timeouts to avoid hanging UI (tune per endpoint)
      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => {
        return new Promise<T>((resolve, reject) => {
          const id = setTimeout(() => reject(new Error('timeout')), ms);
          p.then((v) => { clearTimeout(id); resolve(v); })
           .catch((e) => { clearTimeout(id); reject(e); });
        });
      };

      const results = await Promise.allSettled([
        // Local geography queries are relatively fast
        withTimeout(getSpendingByZipcode(zipcode), 12000),
        // Awards search can take longer
        withTimeout(getAwardsByDistrict(state, district), 15000),
        // Agency aggregation is slow upstream; allow more time
        withTimeout(getSpendingByAgency(), 25000),
        // Disaster overview moderate
        withTimeout(getDisasterSpending(), 15000)
      ]);

      const [local, districtAwards, agencies, disaster] = results;

      if (local.status === 'fulfilled') setLocalSpending(local.value);
      else console.warn('Local spending unavailable:', local.reason);

      if (districtAwards.status === 'fulfilled') setAwards(districtAwards.value);
      else console.warn('Awards by district unavailable:', districtAwards.reason);

      if (agencies.status === 'fulfilled') setAgencySpending(agencies.value);
      else console.warn('Agency spending unavailable:', agencies.reason);

      if (disaster.status === 'fulfilled') setDisasterSpending(disaster.value);
      else console.warn('Disaster spending unavailable:', disaster.reason);
    } catch (error) {
      console.error('Error loading spending data:', error);
    } finally {
      setLoading(false);
    }
  }, [zipcode]);

  useEffect(() => {
    loadSpendingData();
  }, [loadSpendingData]);

  const formatCurrency = (amount: number | undefined | null): string => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '$0';
    }
    if (amount >= 1e9) {
      return `$${(amount / 1e9).toFixed(1)}B`;
    } else if (amount >= 1e6) {
      return `$${(amount / 1e6).toFixed(1)}M`;
    } else if (amount >= 1e3) {
      return `$${(amount / 1e3).toFixed(1)}K`;
    } else {
      return `$${amount.toFixed(0)}`;
    }
  };

  if (loading) {
    return (
      <div className="government-spending loading">
        <DollarSign className="spin" />
        <p>Loading government spending data...</p>
      </div>
    );
  }

  return (
    <div className="government-spending">
      <div className="spending-header">
        <h2>
          <DollarSign size={24} />
          Government Spending Transparency
        </h2>
        <p>Track where your tax dollars go - powered by USASpending.gov</p>
      </div>

      <div className="spending-tabs">
        <button
          className={activeTab === 'local' ? 'active' : ''}
          onClick={() => setActiveTab('local')}
        >
          <MapPin size={16} />
          Local Spending
        </button>
        <button
          className={activeTab === 'agencies' ? 'active' : ''}
          onClick={() => setActiveTab('agencies')}
        >
          <Building2 size={16} />
          By Agency
        </button>
        <button
          className={activeTab === 'awards' ? 'active' : ''}
          onClick={() => setActiveTab('awards')}
        >
          <Award size={16} />
          Contracts & Grants
        </button>
        <button
          className={activeTab === 'disaster' ? 'active' : ''}
          onClick={() => setActiveTab('disaster')}
        >
          <AlertTriangle size={16} />
          Emergency Spending
        </button>
      </div>

      <div className="spending-content">
        {activeTab === 'local' && localSpending && (
          <div className="local-spending">
            <div className="spending-summary">
              <div className="summary-card">
                <h3>Total Obligations</h3>
                <p className="amount">{formatCurrency(localSpending?.total_obligations)}</p>
                <span className="label">Committed spending</span>
              </div>
              <div className="summary-card">
                <h3>Total Outlays</h3>
                <p className="amount">{formatCurrency(localSpending?.total_outlays)}</p>
                <span className="label">Actual payments</span>
              </div>
              <div className="summary-card">
                <h3>Per Capita</h3>
                <p className="amount">{formatCurrency(localSpending?.per_capita)}</p>
                <span className="label">Per person in area</span>
              </div>
              <div className="summary-card">
                <h3>Total Awards</h3>
                <p className="amount">{(localSpending?.award_count || 0).toLocaleString()}</p>
                <span className="label">Contracts & grants</span>
              </div>
            </div>

            <div className="spending-details">
              <h3>Understanding Federal Spending in Your Area</h3>
              <p>
                This data represents federal spending in ZIP code {zipcode}, including contracts,
                grants, loans, and other financial assistance. The information is updated daily
                from USASpending.gov, the official source for federal spending data.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'agencies' && (
          <div className="agency-spending">
            <h3>Federal Agency Spending</h3>
            <div className="agency-list">
              {agencySpending.map((agency, index) => (
                <div key={index} className="agency-card">
                  <div className="agency-header">
                    <h4>{agency.agency_name}</h4>
                    {agency.abbreviation && (
                      <span className="abbreviation">{agency.abbreviation}</span>
                    )}
                  </div>
                  <div className="agency-metrics">
                    <div className="metric">
                      <span className="label">Budget</span>
                      <span className="value">
                        {formatCurrency(agency?.total_budgetary_resources)}
                      </span>
                    </div>
                    <div className="metric">
                      <span className="label">Obligations</span>
                      <span className="value">
                        {formatCurrency(agency?.total_obligations)}
                      </span>
                    </div>
                    <div className="metric">
                      <span className="label">Outlays</span>
                      <span className="value">
                        {formatCurrency(agency?.total_outlays)}
                      </span>
                    </div>
                  </div>
                  {agency.congressional_justification_url && (
                    <a
                      href={agency.congressional_justification_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="justification-link"
                    >
                      <FileText size={14} />
                      Congressional Justification
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'awards' && (
          <div className="awards-section">
            <h3>Recent Federal Awards in District {district}</h3>
            <div className="awards-list">
              {awards.length > 0 ? (
                awards.map((award, index) => (
                  <div key={index} className="award-card">
                    <div className="award-header">
                      <span className={`award-type ${award.award_type}`}>
                        {award.award_type}
                      </span>
                      <span className="award-amount">
                        {formatCurrency(award?.award_amount)}
                      </span>
                    </div>
                    <h4>{award.recipient_name}</h4>
                    <p className="award-description">{award.description}</p>
                    <div className="award-details">
                      <span className="agency">
                        <Building2 size={12} />
                        {award.awarding_agency}
                      </span>
                      {award.place_of_performance.city && (
                        <span className="location">
                          <MapPin size={12} />
                          {award.place_of_performance.city}, {award.place_of_performance.state}
                        </span>
                      )}
                    </div>
                    <div className="award-dates">
                      <span>Start: {new Date(award.start_date).toLocaleDateString()}</span>
                      {award.end_date && (
                        <span>End: {new Date(award.end_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-data">No recent awards found for this district</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'disaster' && disasterSpending && (
          <div className="disaster-spending">
            <div className="disaster-summary">
              <h3>Emergency & Disaster Spending</h3>
              <p className="total-amount">
                Total: {formatCurrency(disasterSpending?.total)}
              </p>
            </div>

            {disasterSpending.by_disaster.length > 0 && (
              <div className="disaster-list">
                <h4>Recent Disaster Allocations</h4>
                {disasterSpending.by_disaster.slice(0, 5).map((disaster: any, index: number) => (
                  <div key={index} className="disaster-card">
                    <div className="disaster-info">
                      <h5>{disaster.name}</h5>
                      <span className="disaster-code">{disaster.code}</span>
                    </div>
                    <span className="disaster-amount">
                      {formatCurrency(disaster?.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {disasterSpending.by_state.length > 0 && (
              <div className="state-disaster-spending">
                <h4>Disaster Spending by State</h4>
                <div className="state-list">
                  {disasterSpending.by_state.slice(0, 10).map((state: any, index: number) => (
                    <div key={index} className="state-item">
                      <span className="state-code">{state.state}</span>
                      <div className="spending-bar">
                        <div
                          className="spending-fill"
                          style={{
                            width: `${((state?.amount || 0) / (disasterSpending?.by_state?.[0]?.amount || 1)) * 100}%`
                          }}
                        />
                      </div>
                      <span className="state-amount">{formatCurrency(state?.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="spending-footer">
        <p>
          Data from <a href="https://www.usaspending.gov" target="_blank" rel="noopener noreferrer">
            USASpending.gov <ExternalLink size={12} />
          </a>
          - The official source for spending data of the U.S. Government
        </p>
      </div>
    </div>
  );
};

export default GovernmentSpending;