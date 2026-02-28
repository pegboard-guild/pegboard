import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Database, HardDrive, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import '../styles/CacheStatus.css';

interface CacheStats {
  fresh_entries: number;
  expired_entries: number;
  total_size_bytes: number;
}

interface CacheEvent {
  bucket: string;
  kind: string;
  api_name: string;
  n: number;
  avg_status: number;
}

export const CacheStatus: React.FC = () => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [events, setEvents] = useState<CacheEvent[]>([]);
  const [hitRate, setHitRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadCacheStats();
    const interval = setInterval(loadCacheStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadCacheStats = async () => {
    try {
      // Get cache statistics
      const { data: statsData, error: statsError } = await supabase
        .from('cache_stats')
        .select('*')
        .single();

      if (statsError) {
        console.error('Error loading cache stats:', statsError);
      } else {
        setStats(statsData);
      }

      // Get cache events for hit rate calculation
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: eventsData, error: eventsError } = await supabase
        .from('cache_event_rollup')
        .select('*')
        .gte('bucket', twentyFourHoursAgo);

      if (eventsError) {
        console.error('Error loading cache events:', eventsError);
      } else if (eventsData) {
        setEvents(eventsData);

        // Calculate hit rate
        const hits = eventsData
          .filter((e: CacheEvent) => e.kind === 'hit')
          .reduce((sum: number, e: CacheEvent) => sum + e.n, 0);
        const misses = eventsData
          .filter((e: CacheEvent) => e.kind === 'miss')
          .reduce((sum: number, e: CacheEvent) => sum + e.n, 0);
        const total = hits + misses;

        if (total > 0) {
          setHitRate((hits / total) * 100);
        }
      }
    } catch (error) {
      console.error('Error loading cache status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getHitRateColor = (rate: number): string => {
    if (rate >= 80) return '#10b981'; // Green
    if (rate >= 60) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const getApiBreakdown = () => {
    const breakdown: { [key: string]: { hits: number; misses: number } } = {};

    events.forEach(event => {
      if (!event.api_name) return;

      if (!breakdown[event.api_name]) {
        breakdown[event.api_name] = { hits: 0, misses: 0 };
      }

      if (event.kind === 'hit') {
        breakdown[event.api_name].hits += event.n;
      } else if (event.kind === 'miss') {
        breakdown[event.api_name].misses += event.n;
      }
    });

    return Object.entries(breakdown).map(([api, data]) => ({
      api,
      ...data,
      hitRate: data.hits + data.misses > 0
        ? (data.hits / (data.hits + data.misses) * 100).toFixed(1)
        : '0.0'
    }));
  };

  if (loading) {
    return (
      <div className="cache-status loading">
        <Activity className="spin" size={20} />
        <span>Loading cache status...</span>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="cache-status">
      <div className="cache-status-header" onClick={() => setShowDetails(!showDetails)}>
        <div className="cache-status-summary">
          <Database size={16} />
          <span className="cache-label">Cache:</span>
          <span
            className="cache-hit-rate"
            style={{ color: getHitRateColor(hitRate) }}
          >
            {hitRate.toFixed(1)}% hit rate
          </span>
          <span className="cache-size">
            {formatBytes(stats.total_size_bytes)}
          </span>
        </div>
        <button className="cache-toggle">
          {showDetails ? '▼' : '▶'}
        </button>
      </div>

      {showDetails && (
        <div className="cache-details">
          <div className="cache-stats-grid">
            <div className="cache-stat">
              <div className="stat-label">Fresh Entries</div>
              <div className="stat-value">{stats.fresh_entries.toLocaleString()}</div>
            </div>
            <div className="cache-stat">
              <div className="stat-label">Expired</div>
              <div className="stat-value">{stats.expired_entries.toLocaleString()}</div>
            </div>
            <div className="cache-stat">
              <div className="stat-label">Total Size</div>
              <div className="stat-value">{formatBytes(stats.total_size_bytes)}</div>
            </div>
            <div className="cache-stat">
              <div className="stat-label">24h Hit Rate</div>
              <div
                className="stat-value"
                style={{ color: getHitRateColor(hitRate) }}
              >
                {hitRate.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="cache-api-breakdown">
            <h4>API Performance (24h)</h4>
            <table className="cache-table">
              <thead>
                <tr>
                  <th>API</th>
                  <th>Hits</th>
                  <th>Misses</th>
                  <th>Hit Rate</th>
                </tr>
              </thead>
              <tbody>
                {getApiBreakdown().map(api => (
                  <tr key={api.api}>
                    <td>{api.api}</td>
                    <td>{api.hits.toLocaleString()}</td>
                    <td>{api.misses.toLocaleString()}</td>
                    <td>
                      <span style={{ color: getHitRateColor(parseFloat(api.hitRate)) }}>
                        {api.hitRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cache-info">
            <AlertCircle size={14} />
            <span>
              Cache improves performance by {Math.round(hitRate)}% and reduces API costs.
              Data is refreshed using stale-while-revalidate strategy.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CacheStatus;