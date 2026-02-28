// Integrated Legislative Data Service
// Combines multiple APIs for comprehensive legislative coverage
// Server-side edge functions own caching via Supabase; browser does not write cache

import { getAllRepresentatives, EnhancedMember } from './representativeService';
// Removed client-side cache table access; rely on server edge function TTL

// Types for legislative data
export interface LegislativeBill {
  bill_id: string;
  title: string;
  description?: string;
  congress_number?: string;
  state?: string;
  status?: string;
  last_action?: string;
  last_action_date?: string;
  sponsors?: any[];
  source: 'govinfo' | 'legiscan';
  url?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityFeedItem {
  activity_id: string;
  type: 'bill' | 'vote' | 'action';
  title: string;
  description: string;
  date: string;
  member_id?: string;
  member_name?: string;
  bill_id?: string;
  source: 'govinfo' | 'legiscan' | 'civic';
  userSentiment?: 'approve' | 'disapprove';
}

export interface LegislativeSession {
  session_id: string;
  state: string;
  name: string;
  year: number;
  active: boolean;
}

// Service class for managing all legislative data with caching
export class LegislativeDataService {
  private supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  private supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  // Client-side cache disabled; server TTL enforced centrally

  // Browser no longer reads DB cache directly
  private async getCachedData(_cacheKey: string): Promise<any | null> { return null; }

  // Browser does not store to DB cache
  private async setCachedData(_cacheKey: string, _data: any, _ttlMs?: number): Promise<void> { return; }

  // Helper method for API calls with caching
  private async callAPI(functionName: string, data: any) {
    const response = await fetch(`${this.supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseKey}`,
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`${functionName} API error: ${response.status}`);
    }

    return await response.json();
  }

  // Get comprehensive representative data
  async getRepresentatives(zipcode: string): Promise<{
    federal: EnhancedMember[];
    state: EnhancedMember[];
    local: EnhancedMember[];
  }> {
    return await getAllRepresentatives(zipcode);
  }

  // Get recent federal bills from GovInfo with caching
  async getFederalBills(options: {
    congress?: string;
    pageSize?: number;
    dateIssued?: string;
  } = {}): Promise<LegislativeBill[]> {
    const cacheKey = `federal_bills_${options.congress || '119'}_${options.pageSize || 20}_${options.dateIssued || 'recent'}`;

    try {
      // Check cache first
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch fresh data
      const data = await this.callAPI('govinfo-api', {
        endpoint: 'recent-bills',
        // Prefer a rolling 30-day date; govinfo expects ISO date with time
        pageSize: options.pageSize || 20,
        dateIssued: options.dateIssued
      });

      const bills = data.bills || [];

      // Cache the result (10 minutes for federal bills)
      await this.setCachedData(cacheKey, bills, 10 * 60 * 1000);

      return bills;
    } catch (error) {
      console.error('Error fetching federal bills:', error);
      return [];
    }
  }

  // Get state bills from LegiScan with caching
  async getStateBills(state: string, options: {
    year?: number;
    pageSize?: number;
  } = {}): Promise<LegislativeBill[]> {
    const cacheKey = `state_bills_${state}_${options.year || 'latest'}_${options.pageSize || 20}`;

    try {
      // Check cache first
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      // First get available sessions for the state (cache sessions separately)
      const sessionsCacheKey = `state_sessions_${state}`;
      let sessionsData = await this.getCachedData(sessionsCacheKey);

      if (!sessionsData) {
        sessionsData = await this.callAPI('legiscan-api', {
          endpoint: 'session-list',
          state: state
        });
        // Cache sessions for 24 hours (they don't change often)
        await this.setCachedData(sessionsCacheKey, sessionsData, 24 * 60 * 60 * 1000);
      }

      if (!sessionsData.sessions || sessionsData.sessions.length === 0) {
        return [];
      }

      // Get the most recent session
      const latestSession = sessionsData.sessions
        .filter((s: any) => s.session_name && !s.special)
        .sort((a: any, b: any) => b.year_start - a.year_start)[0];

      if (!latestSession) {
        return [];
      }

      // Get bills for that session
      const billsData = await this.callAPI('legiscan-api', {
        endpoint: 'bill-list',
        sessionId: latestSession.session_id
      });

      const bills = (billsData.bills || []).slice(0, options.pageSize || 20);

      // Cache the result (15 minutes for state bills)
      await this.setCachedData(cacheKey, bills, 15 * 60 * 1000);

      return bills;
    } catch (error) {
      console.error('Error fetching state bills:', error);
      return [];
    }
  }

  // Search bills across all sources
  async searchBills(query: string, options: {
    state?: string;
    year?: number;
    source?: 'govinfo' | 'legiscan' | 'both';
  } = {}): Promise<LegislativeBill[]> {
    const results: LegislativeBill[] = [];
    const source = options.source || 'both';

    try {
      // Search LegiScan if requested
      if (source === 'legiscan' || source === 'both') {
        try {
          const legiScanData = await this.callAPI('legiscan-api', {
            endpoint: 'search',
            query: query,
            state: options.state || 'ALL',
            year: options.year || new Date().getFullYear()
          });

          if (legiScanData.results) {
            results.push(...legiScanData.results);
          }
        } catch (error) {
          console.warn('LegiScan search failed:', error);
        }
      }

      // For GovInfo, we'll need to get recent bills and filter by title
      // (GovInfo doesn't have a direct search endpoint)
      if (source === 'govinfo' || source === 'both') {
        try {
          const govInfoBills = await this.getFederalBills({ pageSize: 100 });
          const filteredBills = govInfoBills.filter(bill =>
            bill.title.toLowerCase().includes(query.toLowerCase()) ||
            (bill.description && bill.description.toLowerCase().includes(query.toLowerCase()))
          );
          results.push(...filteredBills);
        } catch (error) {
          console.warn('GovInfo search failed:', error);
        }
      }

      return results;
    } catch (error) {
      console.error('Error searching bills:', error);
      return [];
    }
  }

  // Get detailed bill information
  async getBillDetails(billId: string, source: 'govinfo' | 'legiscan'): Promise<LegislativeBill | null> {
    try {
      if (source === 'govinfo') {
        // Parse GovInfo bill ID format: BILLS-119hr1234
        const match = billId.match(/BILLS-(\d+)([a-z]+)(\d+)/);
        if (!match) return null;

        const [, congress, billType, billNumber] = match;
        const data = await this.callAPI('govinfo-api', {
          endpoint: 'bill-details',
          congress,
          billType,
          billNumber
        });

        return data.bill || null;
      } else {
        const data = await this.callAPI('legiscan-api', {
          endpoint: 'bill-details',
          billId
        });

        return data.bill || null;
      }
    } catch (error) {
      console.error('Error fetching bill details:', error);
      return null;
    }
  }

  // Generate activity feed from multiple sources with caching
  async getActivityFeed(zipcode: string, limit: number = 20): Promise<ActivityFeedItem[]> {
    const cacheKey = `activity_feed_${zipcode}_${limit}`;

    try {
      // Check cache first
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      const activities: ActivityFeedItem[] = [];

      // Get representatives for context (already cached in representativeService)
      const reps = await this.getRepresentatives(zipcode);

      // Get recent federal bills (will use cache)
      const federalBills = await this.getFederalBills({ pageSize: 10 });

      // Convert bills to activities
      federalBills.forEach(bill => {
        activities.push({
          activity_id: `bill-${bill.bill_id}`,
          type: 'bill',
          title: `New Federal Bill: ${bill.title}`,
          description: bill.description || bill.title,
          date: bill.updated_at,
          bill_id: bill.bill_id,
          source: 'govinfo'
        });
      });

      // Get state bills for the user's state (if we can determine it)
      if (reps.federal.length > 0) {
        const userState = reps.federal[0].state;
        if (userState) {
          const stateBills = await this.getStateBills(userState, { pageSize: 10 });

          stateBills.forEach(bill => {
            activities.push({
              activity_id: `state-bill-${bill.bill_id}`,
              type: 'bill',
              title: `${userState} Bill: ${bill.title}`,
              description: bill.description || bill.title,
              date: bill.updated_at,
              bill_id: bill.bill_id,
              source: 'legiscan'
            });
          });
        }
      }

      // Sort by date and limit
      const sortedActivities = activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);

      // Cache the result (5 minutes for activity feed)
      await this.setCachedData(cacheKey, sortedActivities, 5 * 60 * 1000);

      return sortedActivities;

    } catch (error) {
      console.error('Error generating activity feed:', error);
      return [];
    }
  }

  // Get trending bills (most active recently) with caching
  async getTrendingBills(zipcode: string, limit: number = 10): Promise<LegislativeBill[]> {
    const cacheKey = `trending_bills_${zipcode}_${limit}`;

    try {
      // Check cache first
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      // Get recent bills from both sources (both will use cache)
      const [federalBills, reps] = await Promise.all([
        this.getFederalBills({ pageSize: 20 }),
        this.getRepresentatives(zipcode)
      ]);

      let allBills = [...federalBills];

      // Add state bills if we can determine the state
      if (reps.federal.length > 0) {
        const userState = reps.federal[0].state;
        if (userState) {
          const stateBills = await this.getStateBills(userState, { pageSize: 20 });
          allBills = [...allBills, ...stateBills];
        }
      }

      // Sort by most recent activity and return limited results
      const trendingBills = allBills
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, limit);

      // Cache the result (10 minutes for trending bills)
      await this.setCachedData(cacheKey, trendingBills, 10 * 60 * 1000);

      return trendingBills;

    } catch (error) {
      console.error('Error fetching trending bills:', error);
      return [];
    }
  }

  // Get available sessions for a state
  async getStateSessions(state: string): Promise<LegislativeSession[]> {
    try {
      const data = await this.callAPI('legiscan-api', {
        endpoint: 'session-list',
        state
      });

      return (data.sessions || []).map((session: any) => ({
        session_id: session.session_id?.toString(),
        state: session.state,
        name: session.session_name,
        year: session.year_start,
        active: !session.archived
      }));
    } catch (error) {
      console.error('Error fetching state sessions:', error);
      return [];
    }
  }
}

// Create singleton instance
export const legislativeDataService = new LegislativeDataService();

// Convenience functions
export const getRepresentatives = (zipcode: string) =>
  legislativeDataService.getRepresentatives(zipcode);

export const getFederalBills = (options?: any) =>
  legislativeDataService.getFederalBills(options);

export const getStateBills = (state: string, options?: any) =>
  legislativeDataService.getStateBills(state, options);

export const searchBills = (query: string, options?: any) =>
  legislativeDataService.searchBills(query, options);

export const getBillDetails = (billId: string, source: 'govinfo' | 'legiscan') =>
  legislativeDataService.getBillDetails(billId, source);

export const getActivityFeed = (zipcode: string, limit?: number) =>
  legislativeDataService.getActivityFeed(zipcode, limit);

export const getTrendingBills = (zipcode: string, limit?: number) =>
  legislativeDataService.getTrendingBills(zipcode, limit);