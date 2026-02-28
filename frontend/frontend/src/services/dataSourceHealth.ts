// Data Source Health Monitor
// Tracks which APIs are working and provides fallback strategies

export interface DataSourceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastSuccess: Date | null;
  lastAttempt: Date | null;
  successRate: number;
  errorMessage?: string;
  fallbackSource?: string;
}

export class DataSourceHealthMonitor {
  private static instance: DataSourceHealthMonitor;
  private sourceStatuses: Map<string, DataSourceStatus>;
  private readonly CACHE_KEY = 'pegboard_source_health';

  private constructor() {
    this.sourceStatuses = new Map();
    this.initializeSources();
    this.loadFromCache();
  }

  static getInstance(): DataSourceHealthMonitor {
    if (!DataSourceHealthMonitor.instance) {
      DataSourceHealthMonitor.instance = new DataSourceHealthMonitor();
    }
    return DataSourceHealthMonitor.instance;
  }

  private initializeSources() {
    const sources: DataSourceStatus[] = [
      {
        name: 'openstates',
        status: 'degraded', // Rate limited - 250 req/day on free tier
        lastSuccess: new Date(),
        lastAttempt: new Date(),
        successRate: 0.95,
        errorMessage: 'Rate limited - exceeded 250 daily requests',
        fallbackSource: 'cached_data'
      },
      {
        name: 'congress.gov',
        status: 'down',
        lastSuccess: null,
        lastAttempt: new Date(),
        successRate: 0,
        errorMessage: 'API down since August 2025',
        fallbackSource: 'govtrack_bulk'
      },
      {
        name: 'library_of_congress',
        status: 'down',
        lastSuccess: null,
        lastAttempt: new Date(),
        successRate: 0,
        errorMessage: 'API down since August 25, 2025',
        fallbackSource: 'govtrack_bulk'
      },
      {
        name: 'propublica_congress',
        status: 'down',
        lastSuccess: null,
        lastAttempt: new Date(),
        successRate: 0,
        errorMessage: 'Permanently discontinued July 10, 2024',
        fallbackSource: 'library_of_congress'
      },
      {
        name: 'govinfo',
        status: 'degraded',
        lastSuccess: new Date(),
        lastAttempt: new Date(),
        successRate: 0.3,
        errorMessage: 'Inconsistent responses, requires API key',
        fallbackSource: 'govtrack_bulk'
      },
      {
        name: 'usaspending',
        status: 'healthy',
        lastSuccess: new Date(),
        lastAttempt: new Date(),
        successRate: 0.8,
        fallbackSource: 'cached_data'
      },
      {
        name: 'federal_register',
        status: 'healthy',
        lastSuccess: new Date(),
        lastAttempt: new Date(),
        successRate: 0.9,
        fallbackSource: 'cached_data'
      },
      {
        name: 'govtrack_bulk',
        status: 'healthy',
        lastSuccess: new Date(),
        lastAttempt: new Date(),
        successRate: 0.95,
        errorMessage: 'Bulk data downloads, not real-time API',
        fallbackSource: 'cached_data'
      },
      {
        name: 'theunitedstates_io',
        status: 'healthy',
        lastSuccess: new Date(),
        lastAttempt: new Date(),
        successRate: 0.9,
        errorMessage: 'GitHub-hosted datasets',
        fallbackSource: 'cached_data'
      },
      {
        name: 'openstates_bulk',
        status: 'healthy',
        lastSuccess: new Date(),
        lastAttempt: new Date(),
        successRate: 1.0,
        errorMessage: 'Local bulk data from GitHub clone',
        fallbackSource: 'cached_data'
      }
    ];

    sources.forEach(source => {
      this.sourceStatuses.set(source.name, source);
    });
  }

  recordAttempt(sourceName: string, success: boolean, errorMessage?: string) {
    const source = this.sourceStatuses.get(sourceName);
    if (!source) return;

    source.lastAttempt = new Date();

    if (success) {
      source.lastSuccess = new Date();
      source.errorMessage = undefined;
    } else {
      source.errorMessage = errorMessage;
    }

    // Update success rate (rolling average of last 10 attempts)
    const weight = 0.1;
    source.successRate = source.successRate * (1 - weight) + (success ? 1 : 0) * weight;

    // Update status based on success rate
    if (source.successRate > 0.8) {
      source.status = 'healthy';
    } else if (source.successRate > 0.3) {
      source.status = 'degraded';
    } else {
      source.status = 'down';
    }

    this.saveToCache();
  }

  getSourceStatus(sourceName: string): DataSourceStatus | undefined {
    return this.sourceStatuses.get(sourceName);
  }

  getAllStatuses(): DataSourceStatus[] {
    return Array.from(this.sourceStatuses.values());
  }

  getHealthySource(dataType: 'federal' | 'state' | 'local'): string | null {
    const sourcePriority = {
      federal: ['propublica', 'govinfo', 'congress.gov'],
      state: ['openstates', 'ballotpedia'],
      local: ['openstates', 'legistar']
    };

    const sources = sourcePriority[dataType];

    for (const sourceName of sources) {
      const source = this.sourceStatuses.get(sourceName);
      if (source && source.status !== 'down') {
        return sourceName;
      }
    }

    return null;
  }

  private saveToCache() {
    const data = Array.from(this.sourceStatuses.entries());
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
  }

  private loadFromCache() {
    const cached = localStorage.getItem(this.CACHE_KEY);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        data.forEach(([key, value]: [string, DataSourceStatus]) => {
          // Convert date strings back to Date objects
          if (value.lastSuccess) value.lastSuccess = new Date(value.lastSuccess);
          if (value.lastAttempt) value.lastAttempt = new Date(value.lastAttempt);
          this.sourceStatuses.set(key, value);
        });
      } catch (e) {
        console.error('Failed to load source health cache:', e);
      }
    }
  }

  generateHealthReport(): string {
    const statuses = this.getAllStatuses();
    const healthy = statuses.filter(s => s.status === 'healthy').length;
    const degraded = statuses.filter(s => s.status === 'degraded').length;
    const down = statuses.filter(s => s.status === 'down').length;

    return `Data Source Health Report:
    ✅ Healthy: ${healthy}
    ⚠️ Degraded: ${degraded}
    ❌ Down: ${down}

    ${statuses.map(s =>
      `${this.getStatusEmoji(s.status)} ${s.name}: ${s.status} (${Math.round(s.successRate * 100)}% success rate)`
    ).join('\n    ')}`;
  }

  private getStatusEmoji(status: 'healthy' | 'degraded' | 'down'): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'down': return '❌';
    }
  }
}

export const healthMonitor = DataSourceHealthMonitor.getInstance();