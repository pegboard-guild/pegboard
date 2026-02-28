import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Users,
  Calendar,
  DollarSign,
  AlertCircle,
  Clock,
  Building2,
  ScrollText,
  RefreshCw
} from 'lucide-react';
import { getStateBills, getEvents } from '../services/openstates';
import { getRecentBills } from '../services/congressAPI';
import { getRecentDocuments } from '../services/federalRegister';
import { searchAwards } from '../services/usaSpending';
import { formatRelativeTime } from '../utils';
import '../styles/UnifiedActivityFeed.css';

interface FeedItem {
  id: string;
  type: 'bill' | 'vote' | 'event' | 'committee' | 'federal_bill' | 'regulation' | 'contract' | 'hearing';
  title: string;
  description?: string;
  date: string;
  source: string;
  icon: React.ReactNode;
  metadata?: any;
  url?: string;
  importance?: 'high' | 'medium' | 'low';
  status?: string;
  statusType?: 'introduced' | 'in-progress' | 'passed' | 'failed' | 'enrolled' | 'signed';
  actionType?: string;
}

interface UnifiedActivityFeedProps {
  state: string;
  zipcode: string;
}

const UnifiedActivityFeed: React.FC<UnifiedActivityFeedProps> = ({ state, zipcode }) => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('30days');
  const [error, setError] = useState<string | null>(null);

  const loadFeedData = useCallback(async () => {
    try {
      setError(null);
      const allItems: FeedItem[] = [];

      // Determine how many bills to fetch based on time range
      const billLimit = timeRange === '90days' ? 30 : timeRange === '60days' ? 20 : 15;

      // Load state bills
      try {
        const stateBills = await getStateBills(state, { limit: billLimit });
        stateBills.forEach((bill: any) => {
          // Determine bill status based on latest action and other fields
          const latestAction = bill.latest_action?.description?.toLowerCase() || '';
          const classification = bill.classification?.join(' ').toLowerCase() || '';
          let statusType: 'introduced' | 'in-progress' | 'passed' | 'failed' | 'enrolled' | 'signed' = 'in-progress';
          let actionType = bill.latest_action?.description || 'In Progress';

          // Check for signed/enacted bills
          if (latestAction.includes('signed') || latestAction.includes('enacted') ||
              latestAction.includes('chaptered') || classification.includes('enacted')) {
            statusType = 'signed';
          } else if (latestAction.includes('enrolled') || latestAction.includes('to governor')) {
            statusType = 'enrolled';
          } else if (latestAction.includes('passed') || latestAction.includes('adopted') ||
                     latestAction.includes('concurred') || latestAction.includes('agreed')) {
            statusType = 'passed';
          } else if (latestAction.includes('failed') || latestAction.includes('defeated') ||
                     latestAction.includes('died') || latestAction.includes('withdrawn')) {
            statusType = 'failed';
          } else if (latestAction.includes('introduced') || latestAction.includes('filed') ||
                     latestAction.includes('first reading')) {
            statusType = 'introduced';
          } else if (latestAction.includes('committee') || latestAction.includes('referred') ||
                     latestAction.includes('hearing')) {
            statusType = 'in-progress';
          }

          allItems.push({
            id: `bill-${bill.id}`,
            type: 'bill',
            title: bill.title,
            description: bill.abstract || bill.title,
            date: bill.latest_action?.date || bill.updated_at || bill.created_at,
            source: `${state} Legislature`,
            icon: <FileText size={16} />,
            metadata: { bill },
            url: bill.openstates_url,
            importance: statusType === 'passed' || statusType === 'signed' ? 'high' : 'medium',
            status: actionType,
            statusType: statusType,
            actionType: actionType
          });
        });
      } catch (err) {
        console.error('Failed to load state bills:', err);
      }

      // Load recent votes - skip for now since we need actual legislator IDs
      // This would normally load vote data from legislators

      // Load legislative events
      try {
        const events = await getEvents(state);
        (events || []).forEach(event => {
          allItems.push({
            id: `event-${event.id}`,
            type: 'event',
            title: event.name,
            description: event.description,
            date: event.start_date,
            source: 'State Legislature',
            icon: <Calendar size={16} />,
            metadata: { event },
            importance: 'low'
          });
        });
      } catch (err) {
        console.error('Failed to load events:', err);
      }

      // Load committees - skip for now since they don't have activity dates
      // Committees are organizational structures, not time-based events

      // Load federal bills - fetch both current and previous congress for more passed bills
      try {
        console.log('Loading federal bills...');
        // Focus on 118th Congress (2023-2024) which has lots of passed bills
        // 119th Congress just started in January 2025
        const currentCongress = 118;
        const prevCongress = 117;

        // Fetch from both congresses to get more passed legislation
        const [currentBills, prevBills] = await Promise.all([
          getRecentBills(currentCongress, billLimit),
          timeRange !== '30days' ? getRecentBills(prevCongress, 10) : Promise.resolve([])
        ]);

        const federalBills = [...currentBills, ...prevBills];
        console.log(`Loaded ${federalBills.length} federal bills`);

        if (federalBills && Array.isArray(federalBills)) {
          federalBills.forEach((bill: any) => {
            // Use the Congress API fields correctly
            const billDate = bill.latestAction?.actionDate || bill.updateDate || bill.introducedDate;

            if (billDate) {
              // Determine federal bill status from latestAction and policyArea
              const latestActionText = bill.latestAction?.text?.toLowerCase() || '';
              const chamber = bill.latestAction?.actionChamber?.toLowerCase() || '';
              let statusType: 'introduced' | 'in-progress' | 'passed' | 'failed' | 'enrolled' | 'signed' = 'in-progress';

              // More comprehensive status detection - check for law numbers first
              if (bill.laws && bill.laws.length > 0) {
                statusType = 'signed';
                console.log(`Bill ${bill.type} ${bill.number} has law:`, bill.laws);
              } else if (latestActionText.includes('became law') ||
                         latestActionText.includes('signed by president') ||
                         latestActionText.includes('public law') ||
                         latestActionText.includes('signed by the president')) {
                statusType = 'signed';
              } else if (latestActionText.includes('resolving differences') ||
                         latestActionText.includes('conference report') ||
                         latestActionText.includes('enrolled')) {
                statusType = 'enrolled';
              } else if (latestActionText.includes('passed') ||
                         latestActionText.includes('agreed to') ||
                         latestActionText.includes('resolution agreed') ||
                         latestActionText.includes('measure passed') ||
                         latestActionText.includes('bill passed')) {
                statusType = 'passed';
              } else if (latestActionText.includes('failed') ||
                         latestActionText.includes('rejected') ||
                         latestActionText.includes('motion to proceed not agreed') ||
                         latestActionText.includes('cloture not invoked')) {
                statusType = 'failed';
              } else if (latestActionText.includes('introduced') ||
                         latestActionText.includes('sponsor introductory') ||
                         latestActionText.includes('read twice')) {
                statusType = 'introduced';
              } else if (latestActionText.includes('committee') ||
                         latestActionText.includes('referred') ||
                         latestActionText.includes('hearing') ||
                         latestActionText.includes('markup') ||
                         latestActionText.includes('placed on calendar')) {
                statusType = 'in-progress';
              }

              // Debug logging for a few bills
              if (federalBills.indexOf(bill) < 3) {
                console.log(`Bill ${bill.type} ${bill.number}:`, {
                  title: bill.title,
                  latestAction: bill.latestAction?.text,
                  statusDetected: statusType,
                  laws: bill.laws
                });
              }

              allItems.push({
                id: `federal-${bill.type}-${bill.number}`,
                type: 'federal_bill',
                title: `${bill.type} ${bill.number}: ${bill.title}`,
                description: bill.title,
                date: billDate,
                source: 'U.S. Congress',
                icon: <Building2 size={16} />,
                metadata: { bill },
                url: bill.url,
                importance: statusType === 'passed' || statusType === 'signed' ? 'high' : 'medium',
                status: bill.latestAction?.text || 'In Progress',
                statusType: statusType,
                actionType: bill.latestAction?.text
              });
            }
          });
        }
      } catch (err) {
        console.error('Failed to load federal bills:', err);
      }

      // Load federal regulations
      try {
        const regulations = await getRecentDocuments({ perPage: 5 });
        if (regulations && Array.isArray(regulations)) {
          regulations.forEach((doc: any) => {
            allItems.push({
              id: `reg-${doc.document_number}`,
              type: 'regulation',
              title: doc.title,
              description: doc.abstract || doc.title,
              date: doc.publication_date,
              source: 'Federal Register',
              icon: <ScrollText size={16} />,
              metadata: { document: doc },
              url: doc.html_url,
              importance: doc.type === 'Rule' ? 'high' : 'medium'
            });
          });
        }
      } catch (err) {
        console.error('Failed to load regulations:', err);
      }

      // Load government contracts
      try {
        const contracts = await searchAwards(zipcode);
        if (contracts && Array.isArray(contracts)) {
          contracts.slice(0, 5).forEach((contract: any) => {
            // Only add contracts with valid dates
            const contractDate = contract.action_date || contract.period_of_performance_start_date || contract.date_signed;
            if (contractDate) {
              allItems.push({
                id: `contract-${contract.generated_unique_award_id || Math.random()}`,
                type: 'contract',
                title: contract.description || 'Government Contract',
                description: `$${contract.total_obligated_amount?.toLocaleString() || 0} - ${contract.recipient_name}`,
                date: contractDate,
                source: 'USASpending.gov',
                icon: <DollarSign size={16} />,
                metadata: { contract },
                importance: contract.total_obligated_amount > 1000000 ? 'high' : 'medium'
              });
            }
          });
        }
      } catch (err) {
        console.error('Failed to load contracts:', err);
      }

      // Sort by date (most recent first)
      allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setFeedItems(allItems);
    } catch (err) {
      setError('Failed to load activity feed');
      console.error('Activity feed error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state, zipcode, timeRange]);

  useEffect(() => {
    loadFeedData();
  }, [loadFeedData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeedData();
  };

  const getFilteredItems = () => {
    let items = feedItems;

    // Apply type filter
    if (filter !== 'all') {
      if (filter === 'federal_bills') {
        items = items.filter(item => item.type === 'federal_bill');
      } else if (filter === 'state_bills') {
        items = items.filter(item => item.type === 'bill');
      } else {
        items = items.filter(item => item.type === filter);
      }
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      items = items.filter(item => item.statusType === statusFilter);
    }

    // Apply time filter
    if (timeRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();

      switch(timeRange) {
        case '7days':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case '30days':
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case '60days':
          cutoffDate.setDate(now.getDate() - 60);
          break;
        case '90days':
          cutoffDate.setDate(now.getDate() - 90);
          break;
        case '180days':
          cutoffDate.setDate(now.getDate() - 180);
          break;
        case '1year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          return items;
      }

      items = items.filter(item => new Date(item.date) >= cutoffDate);
    }

    return items;
  };

  const getImportanceColor = (importance?: string) => {
    switch (importance) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusBadge = (statusType?: string) => {
    if (!statusType) return null;

    const statusConfig: { [key: string]: { label: string; color: string; bgColor: string } } = {
      'introduced': { label: 'Introduced', color: '#3b82f6', bgColor: '#dbeafe' },
      'in-progress': { label: 'In Progress', color: '#f59e0b', bgColor: '#fef3c7' },
      'passed': { label: 'Passed', color: '#10b981', bgColor: '#d1fae5' },
      'failed': { label: 'Failed', color: '#ef4444', bgColor: '#fee2e2' },
      'enrolled': { label: 'Enrolled', color: '#8b5cf6', bgColor: '#ede9fe' },
      'signed': { label: 'Signed into Law', color: '#059669', bgColor: '#d1fae5' }
    };

    const config = statusConfig[statusType] || { label: statusType, color: '#6b7280', bgColor: '#f3f4f6' };

    return (
      <span
        className="status-badge"
        style={{
          color: config.color,
          backgroundColor: config.bgColor,
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '600',
          textTransform: 'uppercase',
          marginLeft: '8px'
        }}
      >
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="unified-feed-loading">
        <RefreshCw className="spinning" size={24} />
        <p>Loading comprehensive activity feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="unified-feed-error">
        <AlertCircle size={24} />
        <p>{error}</p>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    );
  }

  const filteredItems = getFilteredItems();

  return (
    <div className="unified-activity-feed">
      <div className="feed-header">
        <div className="feed-title-section">
          <h2>Comprehensive Activity Feed</h2>
          <p>All government activity affecting you - federal, state, and local</p>
        </div>
        <div className="feed-controls">
          <select
            className="time-range-selector"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="60days">Last 60 days</option>
            <option value="90days">Last 90 days</option>
            <option value="180days">Last 6 months</option>
            <option value="1year">Last year</option>
            <option value="all">All time</option>
          </select>

          <select
            className="status-selector"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="signed">Signed into Law</option>
            <option value="passed">Passed</option>
            <option value="enrolled">Enrolled</option>
            <option value="in-progress">In Progress</option>
            <option value="introduced">Introduced</option>
            <option value="failed">Failed</option>
          </select>

          <button
            className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="feed-filters">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All ({feedItems.length})
        </button>
        <button
          className={filter === 'state_bills' ? 'active' : ''}
          onClick={() => setFilter('state_bills')}
        >
          State Bills
        </button>
        <button
          className={filter === 'federal_bills' ? 'active' : ''}
          onClick={() => setFilter('federal_bills')}
        >
          Federal Bills
        </button>
        <button
          className={filter === 'vote' ? 'active' : ''}
          onClick={() => setFilter('vote')}
        >
          Votes
        </button>
        <button
          className={filter === 'regulation' ? 'active' : ''}
          onClick={() => setFilter('regulation')}
        >
          Regulations
        </button>
        <button
          className={filter === 'contract' ? 'active' : ''}
          onClick={() => setFilter('contract')}
        >
          Contracts
        </button>
        <button
          className={filter === 'event' ? 'active' : ''}
          onClick={() => setFilter('event')}
        >
          Events
        </button>
      </div>

      <div className="feed-items">
        {filteredItems.length === 0 ? (
          <div className="feed-empty">
            <AlertCircle size={24} />
            <p>No activity items found for this filter</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div key={item.id} className="feed-item">
              <div className="item-icon" style={{ color: getImportanceColor(item.importance) }}>
                {item.icon}
              </div>
              <div className="item-content">
                <div className="item-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <h3 style={{ margin: 0 }}>{item.title}</h3>
                    {item.statusType && getStatusBadge(item.statusType)}
                  </div>
                  <span className="item-source">{item.source}</span>
                </div>
                {item.description && (
                  <p className="item-description">{item.description}</p>
                )}
                {item.actionType && item.type.includes('bill') && (
                  <p className="item-action" style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>
                    Latest: {item.actionType}
                  </p>
                )}
                <div className="item-footer">
                  <div className="item-time">
                    <Clock size={14} />
                    <span>{formatRelativeTime(item.date)}</span>
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="item-link"
                    >
                      View Details →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="feed-footer">
        <p>
          Showing {filteredItems.length} items
          {statusFilter !== 'all' && ` with status: ${statusFilter}`}
          {feedItems.length > filteredItems.length && ` (filtered from ${feedItems.length} total)`}
        </p>
      </div>
    </div>
  );
};

export default UnifiedActivityFeed;