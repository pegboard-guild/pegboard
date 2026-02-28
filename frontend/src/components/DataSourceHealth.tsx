import React, { useEffect, useState } from 'react';
import { healthMonitor, DataSourceStatus } from '../services/dataSourceHealth';
import '../styles/DataSourceHealth.css';

const DataSourceHealth: React.FC = () => {
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const loadHealthStatus = () => {
      const statuses = healthMonitor.getAllStatuses();
      setSources(statuses);
      setLastUpdate(new Date());
    };

    loadHealthStatus();
    const interval = setInterval(loadHealthStatus, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'degraded':
        return '⚠️';
      case 'down':
        return '❌';
    }
  };

  const getStatusColor = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy':
        return '#22c55e';
      case 'degraded':
        return '#f59e0b';
      case 'down':
        return '#ef4444';
    }
  };

  const healthySources = sources.filter(s => s.status === 'healthy').length;
  const degradedSources = sources.filter(s => s.status === 'degraded').length;
  const downSources = sources.filter(s => s.status === 'down').length;

  return (
    <div className="data-source-health">
      <div className="health-header">
        <h2>Data Source Status</h2>
        <p className="last-update">Last updated: {lastUpdate.toLocaleTimeString()}</p>
      </div>

      <div className="health-summary">
        <div className="summary-item healthy">
          <span className="count">{healthySources}</span>
          <span className="label">Healthy</span>
        </div>
        <div className="summary-item degraded">
          <span className="count">{degradedSources}</span>
          <span className="label">Degraded</span>
        </div>
        <div className="summary-item down">
          <span className="count">{downSources}</span>
          <span className="label">Down</span>
        </div>
      </div>

      <div className="sources-grid">
        {sources.map((source) => (
          <div key={source.name} className={`source-card ${source.status}`}>
            <div className="source-header">
              <span className="status-icon">{getStatusIcon(source.status)}</span>
              <h3>{source.name.replace(/_/g, ' ').toUpperCase()}</h3>
            </div>
            
            <div className="source-details">
              <div className="status-badge" style={{ backgroundColor: getStatusColor(source.status) }}>
                {source.status}
              </div>
              
              <div className="success-rate">
                <span className="rate-label">Success Rate:</span>
                <span className="rate-value">{Math.round(source.successRate * 100)}%</span>
              </div>

              {source.errorMessage && (
                <div className="error-message">
                  {source.errorMessage}
                </div>
              )}

              {source.fallbackSource && (
                <div className="fallback">
                  <span className="fallback-label">Fallback:</span>
                  <span className="fallback-value">{source.fallbackSource.replace(/_/g, ' ')}</span>
                </div>
              )}

              <div className="timestamps">
                {source.lastSuccess && (
                  <div className="timestamp">
                    <span className="timestamp-label">Last Success:</span>
                    <span className="timestamp-value">
                      {new Date(source.lastSuccess).toLocaleString()}
                    </span>
                  </div>
                )}
                {source.lastAttempt && (
                  <div className="timestamp">
                    <span className="timestamp-label">Last Attempt:</span>
                    <span className="timestamp-value">
                      {new Date(source.lastAttempt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="health-footer">
        <h3>Current Strategy</h3>
        <ul className="strategy-list">
          <li><strong>Primary Sources:</strong> USASpending, Federal Register (via api.data.gov)</li>
          <li><strong>Representative Data:</strong> OpenStates API (rate limited), TheUnitedStates.io GitHub datasets</li>
          <li><strong>Bill Data:</strong> GovTrack.us bulk downloads, GovInfo API (when available)</li>
          <li><strong>Fallback Strategy:</strong> Cached data, bulk downloads, GitHub-hosted datasets</li>
        </ul>
        <p className="strategy-note">
          Note: Multiple government APIs are currently experiencing outages. We're using alternative data sources
          and cached information where possible. Consider upgrading to OpenStates Pro ($30/month) for better coverage.
        </p>
      </div>
    </div>
  );
};

export default DataSourceHealth;