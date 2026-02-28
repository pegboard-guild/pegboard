import React, { useState, useCallback, useEffect } from 'react';
import { Search, Filter, Clock, User, Tag, Building2, ExternalLink, X } from 'lucide-react';
import { searchBills, OpenStatesBill } from '../services/openstates';

interface EnhancedBillSearchProps {
  state: string;
  zipcode: string;
}

interface SearchFilters {
  query: string;
  chamber: '' | 'upper' | 'lower';
  subject: string;
  classification: string;
  status: string;
  sponsor: string;
  sort: 'updated_desc' | 'created_desc' | 'first_action_date' | 'last_action_date';
}

const EnhancedBillSearch: React.FC<EnhancedBillSearchProps> = ({ state, zipcode }) => {
  const [bills, setBills] = useState<OpenStatesBill[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    chamber: '',
    subject: '',
    classification: '',
    status: '',
    sponsor: '',
    sort: 'updated_desc'
  });

  const handleSearch = useCallback(async () => {
    if (!state) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const searchOptions = {
        state,
        searchQuery: filters.query || undefined,
        chamber: filters.chamber || undefined,
        subject: filters.subject || undefined,
        classification: filters.classification || undefined,
        status: filters.status || undefined,
        sponsor: filters.sponsor || undefined,
        sort: filters.sort,
        limit: 50
      };

      const results = await searchBills(searchOptions);
      setBills(results);
    } catch (error) {
      console.error('Error searching bills:', error);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [state, filters]);

  // Load initial bills on mount
  useEffect(() => {
    if (state && !hasSearched) {
      handleSearch();
    }
  }, [state, handleSearch, hasSearched]);

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      chamber: '',
      subject: '',
      classification: '',
      status: '',
      sponsor: '',
      sort: 'updated_desc'
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) =>
    key !== 'sort' && value !== ''
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getChamberLabel = (orgName: string) => {
    if (orgName.toLowerCase().includes('senate')) return 'Senate';
    if (orgName.toLowerCase().includes('house')) return 'House';
    return orgName;
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';

    const lower = status.toLowerCase();
    if (lower.includes('passed') || lower.includes('enacted')) return 'bg-green-100 text-green-800';
    if (lower.includes('failed') || lower.includes('died')) return 'bg-red-100 text-red-800';
    if (lower.includes('introduced') || lower.includes('referred')) return 'bg-blue-100 text-blue-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <section className="enhanced-bill-search">
      <div className="section-header">
        <Search size={24} />
        <h2>Legislative Bill Search</h2>
        <button
          className={`filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} />
          Filters
          {hasActiveFilters && <span className="filter-indicator"></span>}
        </button>
      </div>

      <div className="search-container">
        <div className="search-input-container">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search bills by title, summary, or bill number..."
            value={filters.query}
            onChange={(e) => handleFilterChange('query', e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          <button
            className="search-button"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {showFilters && (
          <div className="filters-panel">
            <div className="filters-grid">
              <div className="filter-group">
                <label>Chamber</label>
                <select
                  value={filters.chamber}
                  onChange={(e) => handleFilterChange('chamber', e.target.value)}
                >
                  <option value="">All Chambers</option>
                  <option value="upper">Senate</option>
                  <option value="lower">House</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Subject</label>
                <input
                  type="text"
                  placeholder="e.g., healthcare, education"
                  value={filters.subject}
                  onChange={(e) => handleFilterChange('subject', e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label>Classification</label>
                <select
                  value={filters.classification}
                  onChange={(e) => handleFilterChange('classification', e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="bill">Bill</option>
                  <option value="resolution">Resolution</option>
                  <option value="memorial">Memorial</option>
                  <option value="concurrent resolution">Concurrent Resolution</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Sponsor</label>
                <input
                  type="text"
                  placeholder="Legislator name"
                  value={filters.sponsor}
                  onChange={(e) => handleFilterChange('sponsor', e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label>Sort By</label>
                <select
                  value={filters.sort}
                  onChange={(e) => handleFilterChange('sort', e.target.value as SearchFilters['sort'])}
                >
                  <option value="updated_desc">Recently Updated</option>
                  <option value="created_desc">Recently Introduced</option>
                  <option value="last_action_date">Latest Action</option>
                  <option value="first_action_date">First Action</option>
                </select>
              </div>
            </div>

            <div className="filter-actions">
              <button
                className="clear-filters-btn"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                <X size={16} />
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="search-results">
        {loading && (
          <div className="loading-message">
            <p>Searching bills...</p>
          </div>
        )}

        {!loading && hasSearched && bills.length === 0 && (
          <div className="no-results">
            <p>No bills found matching your search criteria.</p>
          </div>
        )}

        {!loading && bills.length > 0 && (
          <>
            <div className="results-header">
              <span className="results-count">{bills.length} bills found</span>
            </div>

            <div className="bills-list">
              {bills.map((bill) => (
                <div key={bill.id} className="bill-card">
                  <div className="bill-header">
                    <div className="bill-id-section">
                      <span className="bill-identifier">{bill.identifier}</span>
                      <span className="bill-session">Session {bill.session}</span>
                    </div>
                    <div className="bill-chamber">
                      <Building2 size={14} />
                      {getChamberLabel(bill.from_organization.name)}
                    </div>
                  </div>

                  <h3 className="bill-title">{bill.title}</h3>

                  {bill.abstract && (
                    <p className="bill-abstract">{bill.abstract}</p>
                  )}

                  <div className="bill-meta">
                    {bill.sponsors && bill.sponsors.length > 0 && (
                      <div className="bill-sponsor">
                        <User size={14} />
                        <span>
                          {bill.sponsors[0].name}
                          {bill.sponsors.length > 1 && ` +${bill.sponsors.length - 1} more`}
                        </span>
                      </div>
                    )}

                    {bill.subject && bill.subject.length > 0 && (
                      <div className="bill-subjects">
                        <Tag size={14} />
                        <div className="subject-tags">
                          {bill.subject.slice(0, 3).map((subject, index) => (
                            <span key={index} className="subject-tag">{subject}</span>
                          ))}
                          {bill.subject.length > 3 && (
                            <span className="more-subjects">+{bill.subject.length - 3}</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="bill-dates">
                      <Clock size={14} />
                      <span>Introduced: {formatDate(bill.introduced_date)}</span>
                      {bill.latest_action && (
                        <span> • Last Action: {formatDate(bill.latest_action.date)}</span>
                      )}
                    </div>
                  </div>

                  {bill.latest_action && (
                    <div className="bill-status">
                      <span className={`status-badge ${getStatusColor(bill.latest_action.description)}`}>
                        {bill.latest_action.description}
                      </span>
                    </div>
                  )}

                  <div className="bill-actions">
                    <a
                      href={bill.openstates_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-details-btn"
                    >
                      <ExternalLink size={14} />
                      View Details
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default EnhancedBillSearch;