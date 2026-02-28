// OpenStates Bulk Data Service
// Processes downloaded YAML/JSON data from OpenStates GitHub repositories
// Used as fallback when API rate limits are exceeded

import { healthMonitor } from './dataSourceHealth';

export interface BulkLegislator {
  id: string;
  name: string;
  given_name?: string;
  family_name?: string;
  party?: string;
  current_role?: {
    title: string;
    chamber: string;
    district: string;
    jurisdiction: string;
  };
  email?: string;
  image?: string;
  links?: Array<{
    url: string;
    note?: string;
  }>;
  sources?: Array<{
    url: string;
    note?: string;
  }>;
  other_identifiers?: Array<{
    identifier: string;
    scheme: string;
  }>;
  contact_details?: Array<{
    type: string;
    value: string;
    note?: string;
  }>;
}

export interface BulkBill {
  id: string;
  identifier: string;
  title: string;
  from_organization: string;
  classification: string[];
  subject: string[];
  abstract?: string;
  created_at?: string;
  updated_at?: string;
  legislative_session?: {
    identifier: string;
    name: string;
  };
  actions?: Array<{
    date: string;
    description: string;
    classification: string[];
  }>;
  sponsorships?: Array<{
    name: string;
    entity_type: string;
    primary: boolean;
    classification: string;
  }>;
  sources?: Array<{
    url: string;
    note?: string;
  }>;
}

class OpenStatesBulkDataService {
  private legislatorCache: Map<string, BulkLegislator[]> = new Map();
  private billCache: Map<string, BulkBill[]> = new Map();
  private dataPath = '/Users/officeimac/pegboard/data/processed';
  private lastUpdate: Date | null = null;

  // Load processed legislator data from JSON files
  async loadLegislatorData(state: string): Promise<BulkLegislator[]> {
    try {
      // Check cache first
      if (this.legislatorCache.has(state)) {
        return this.legislatorCache.get(state)!;
      }

      // Read from processed JSON file
      const filePath = `${this.dataPath}/${state.toLowerCase()}-legislators.json`;

      // In browser environment, we need to fetch the file
      // For now, we'll use the all-legislators.json file that we'll serve
      const response = await fetch(`/data/processed/${state.toLowerCase()}-legislators.json`);

      if (!response.ok) {
        console.error(`Failed to load ${state} legislator data`);
        return [];
      }

      const data = await response.json();
      const legislators: BulkLegislator[] = data.legislators || [];

      console.log(`Loaded ${legislators.length} legislators for ${state} from bulk files`);
      healthMonitor.recordAttempt('openstates_bulk', true);

      this.legislatorCache.set(state, legislators);
      return legislators;
    } catch (error) {
      console.error(`Error loading bulk legislator data for ${state}:`, error);
      healthMonitor.recordAttempt('openstates_bulk', false, error?.toString());
      return [];
    }
  }

  // Load bill data from bulk files
  async loadBillData(state: string, session?: string): Promise<BulkBill[]> {
    try {
      const cacheKey = `${state}-${session || 'current'}`;
      
      if (this.billCache.has(cacheKey)) {
        return this.billCache.get(cacheKey)!;
      }

      console.log(`Loading bill data for ${state} from bulk files...`);
      
      // In production, would read from JSON/CSV files
      const bills: BulkBill[] = [];
      this.billCache.set(cacheKey, bills);
      
      return bills;
    } catch (error) {
      console.error(`Error loading bulk bill data for ${state}:`, error);
      return [];
    }
  }

  // Get all states with available data
  async getAvailableStates(): Promise<string[]> {
    // In production, would scan the data directory
    // For now, return common state codes
    return [
      'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga',
      'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md',
      'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj',
      'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc',
      'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy'
    ];
  }

  // Search legislators by name
  async searchLegislators(query: string, state?: string): Promise<BulkLegislator[]> {
    const states = state ? [state] : await this.getAvailableStates();
    const results: BulkLegislator[] = [];
    const queryLower = query.toLowerCase();

    for (const st of states) {
      const legislators = await this.loadLegislatorData(st);
      const matches = legislators.filter(leg => 
        leg.name.toLowerCase().includes(queryLower) ||
        leg.given_name?.toLowerCase().includes(queryLower) ||
        leg.family_name?.toLowerCase().includes(queryLower)
      );
      results.push(...matches);
    }

    return results;
  }

  // Get legislators by district
  async getLegislatorsByDistrict(state: string, chamber: string, district: string): Promise<BulkLegislator[]> {
    const legislators = await this.loadLegislatorData(state);
    return legislators.filter(leg => 
      leg.current_role?.chamber === chamber &&
      leg.current_role?.district === district
    );
  }

  // Get recent bills
  async getRecentBills(state: string, limit: number = 20): Promise<BulkBill[]> {
    const bills = await this.loadBillData(state);
    return bills
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, limit);
  }

  // Search bills by keyword
  async searchBills(query: string, state: string): Promise<BulkBill[]> {
    const bills = await this.loadBillData(state);
    const queryLower = query.toLowerCase();
    
    return bills.filter(bill =>
      bill.title.toLowerCase().includes(queryLower) ||
      bill.abstract?.toLowerCase().includes(queryLower) ||
      bill.subject.some(s => s.toLowerCase().includes(queryLower))
    );
  }

  // Get bill by ID
  async getBillById(billId: string, state: string): Promise<BulkBill | null> {
    const bills = await this.loadBillData(state);
    return bills.find(bill => bill.id === billId || bill.identifier === billId) || null;
  }

  // Clear cache
  clearCache() {
    this.legislatorCache.clear();
    this.billCache.clear();
    this.lastUpdate = null;
  }

  // Check if data is stale (older than 24 hours)
  isDataStale(): boolean {
    if (!this.lastUpdate) return true;
    const hoursSinceUpdate = (Date.now() - this.lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate > 24;
  }

  // Update data from GitHub (would be scheduled job in production)
  async updateData(): Promise<void> {
    try {
      console.log('Updating OpenStates bulk data from GitHub...');
      // In production:
      // 1. Git pull latest changes from openstates/people
      // 2. Process updated files
      // 3. Update cache
      this.lastUpdate = new Date();
      healthMonitor.recordAttempt('openstates_bulk', true);
    } catch (error) {
      console.error('Error updating bulk data:', error);
      healthMonitor.recordAttempt('openstates_bulk', false, error?.toString());
    }
  }

  // Get statistics about available data
  async getDataStats(): Promise<{
    states: number;
    legislators: number;
    bills: number;
    lastUpdate: Date | null;
  }> {
    const states = await this.getAvailableStates();
    let totalLegislators = 0;
    let totalBills = 0;

    this.legislatorCache.forEach((legislators) => {
      totalLegislators += legislators.length;
    });

    this.billCache.forEach((bills) => {
      totalBills += bills.length;
    });

    return {
      states: states.length,
      legislators: totalLegislators,
      bills: totalBills,
      lastUpdate: this.lastUpdate
    };
  }
}

export const openStatesBulkData = new OpenStatesBulkDataService();

// Function to use bulk data as fallback when API fails
export async function getDataWithFallback(
  apiCall: () => Promise<any>,
  fallbackCall: () => Promise<any>
): Promise<any> {
  try {
    const result = await apiCall();
    if (result && (Array.isArray(result) ? result.length > 0 : true)) {
      return result;
    }
  } catch (error) {
    console.log('API call failed, using bulk data fallback:', error);
  }
  
  return fallbackCall();
}