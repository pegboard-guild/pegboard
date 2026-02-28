// GovTrack.us and TheUnitedStates.io Data Service
// Fallback data sources using bulk downloads and GitHub-hosted datasets
// GovTrack provides bulk data downloads: https://www.govtrack.us/developers/data
// TheUnitedStates.io provides GitHub-hosted datasets: https://theunitedstates.io/
// Now with Supabase caching for API efficiency

import { healthMonitor } from './dataSourceHealth';
import { supabase } from '../supabaseClient';

export interface GovTrackLegislator {
  id: {
    bioguide: string;
    thomas?: string;
    lis?: string;
    govtrack?: number;
    opensecrets?: string;
    votesmart?: number;
    fec?: string[];
    cspan?: number;
    wikipedia?: string;
    house_history?: number;
    ballotpedia?: string;
    maplight?: number;
    icpsr?: number;
    wikidata?: string;
    google_entity_id?: string;
  };
  name: {
    first: string;
    last: string;
    official_full: string;
    middle?: string;
    nickname?: string;
    suffix?: string;
  };
  bio: {
    birthday: string;
    gender: string;
    religion?: string;
  };
  terms: Array<{
    type: 'sen' | 'rep';
    start: string;
    end: string;
    state: string;
    district?: number;
    party: string;
    url?: string;
    address?: string;
    phone?: string;
    fax?: string;
    contact_form?: string;
    office?: string;
    state_rank?: string;
    rss_url?: string;
  }>;
}

export interface GovTrackBill {
  bill_id: string;
  bill_type: string;
  number: number;
  congress: number;
  introduced_at: string;
  updated_at: string;
  sponsor_id?: string;
  sponsor?: {
    bioguide_id: string;
    name: string;
    state: string;
    title: string;
  };
  cosponsors?: Array<{
    bioguide_id: string;
    name: string;
    sponsored_at: string;
    withdrawn_at?: string;
  }>;
  official_title?: string;
  popular_title?: string;
  short_title?: string;
  summary?: {
    as: string;
    date: string;
    text: string;
  };
  subjects?: string[];
  subjects_top_term?: string;
  related_bills?: Array<{
    bill_id: string;
    identified_by: string;
    reason: string;
    type: string;
  }>;
  actions?: Array<{
    acted_at: string;
    action_code?: string;
    committees?: string[];
    references?: any[];
    status?: string;
    text: string;
    type: string;
  }>;
  history?: {
    active: boolean;
    active_at?: string;
    awaiting_signature: boolean;
    enacted: boolean;
    enacted_at?: string;
    house_passage_result?: string;
    house_passage_result_at?: string;
    senate_cloture_result?: string;
    senate_cloture_result_at?: string;
    senate_passage_result?: string;
    senate_passage_result_at?: string;
    vetoed: boolean;
    vetoed_at?: string;
  };
  committees?: Array<{
    activity: string[];
    committee: string;
    committee_id: string;
    referral_date?: string;
    subcommittee?: string;
    subcommittee_id?: string;
  }>;
  amendments?: any[];
}

export interface USIOCommittee {
  type: string;
  name: string;
  url?: string;
  minority_url?: string;
  thomas_id?: string;
  house_committee_id?: string;
  senate_committee_id?: string;
  jurisdiction?: string;
  jurisdiction_source?: string;
  subcommittees?: Array<{
    name: string;
    thomas_id: string;
    phone?: string;
    address?: string;
  }>;
  phone?: string;
  address?: string;
}

class GovTrackService {
  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour default TTL
  private readonly LEGISLATORS_TTL = 24 * 60 * 60 * 1000; // 24 hours for legislators
  private readonly COMMITTEES_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for committees
  private committeesCache: USIOCommittee[] | null = null;

  // Helper method to get cached data from Supabase
  private async getCachedData<T>(cacheKey: string): Promise<T | null> {
    try {
      const { data: cachedData, error } = await supabase
        .from('api_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .single();

      if (!error && cachedData && new Date(cachedData.expires_at) > new Date()) {
        console.log(`✅ Cache hit: ${cacheKey}`);

        // Update hit count
        await supabase
          .from('api_cache')
          .update({
            hit_count: (cachedData.hit_count || 0) + 1,
            last_accessed: new Date().toISOString()
          })
          .eq('cache_key', cacheKey);

        return cachedData.data as T;
      }
    } catch (err) {
      console.warn('Cache check failed:', err);
    }
    return null;
  }

  // Helper method to store data in Supabase cache
  private async setCachedData<T>(cacheKey: string, data: T, ttlMs: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlMs);
      await supabase.from('api_cache').upsert({
        cache_key: cacheKey,
        data: data as any,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        hit_count: 0,
        last_accessed: new Date().toISOString()
      });
      console.log(`💾 Cached: ${cacheKey} (TTL: ${ttlMs}ms)`);
    } catch (err) {
      console.warn('Cache storage failed:', err);
    }
  }

  // Fetch current legislators from TheUnitedStates.io GitHub
  async getCurrentLegislators(): Promise<GovTrackLegislator[]> {
    const cacheKey = 'govtrack:legislators:current';

    try {
      // Check cache first
      const cached = await this.getCachedData<GovTrackLegislator[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await fetch(
        'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.json'
      );

      if (!response.ok) {
        healthMonitor.recordAttempt('theunitedstates_io', false, `HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();

      // Cache the result
      await this.setCachedData(cacheKey, data, this.LEGISLATORS_TTL);

      healthMonitor.recordAttempt('theunitedstates_io', true);
      return data;
    } catch (error) {
      console.error('Error fetching legislators:', error);
      healthMonitor.recordAttempt('theunitedstates_io', false, error?.toString());

      // Try to return stale cached data if available
      const staleCache = await this.getCachedData<GovTrackLegislator[]>(cacheKey);
      return staleCache || [];
    }
  }

  // Get legislators by state
  async getLegislatorsByState(state: string): Promise<GovTrackLegislator[]> {
    const allLegislators = await this.getCurrentLegislators();
    const stateUpper = state.toUpperCase();
    
    return allLegislators.filter(legislator => {
      const currentTerm = legislator.terms[legislator.terms.length - 1];
      return currentTerm && currentTerm.state === stateUpper;
    });
  }

  // Get legislator by bioguide ID
  async getLegislatorById(bioguideId: string): Promise<GovTrackLegislator | null> {
    const allLegislators = await this.getCurrentLegislators();
    return allLegislators.find(l => l.id.bioguide === bioguideId) || null;
  }

  // Search legislators by name
  async searchLegislators(query: string): Promise<GovTrackLegislator[]> {
    const allLegislators = await this.getCurrentLegislators();
    const queryLower = query.toLowerCase();
    
    return allLegislators.filter(legislator => {
      const fullName = legislator.name.official_full.toLowerCase();
      const lastName = legislator.name.last.toLowerCase();
      const firstName = legislator.name.first.toLowerCase();
      
      return fullName.includes(queryLower) || 
             lastName.includes(queryLower) || 
             firstName.includes(queryLower);
    });
  }

  // Fetch committees from TheUnitedStates.io
  async getCommittees(): Promise<USIOCommittee[]> {
    const cacheKey = 'govtrack:committees:current';

    try {
      // Check cache first
      const cached = await this.getCachedData<USIOCommittee[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await fetch(
        'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/committees-current.json'
      );

      if (!response.ok) {
        healthMonitor.recordAttempt('theunitedstates_io', false, `HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();

      // Cache the result
      await this.setCachedData(cacheKey, data, this.COMMITTEES_TTL);

      healthMonitor.recordAttempt('theunitedstates_io', true);
      return data;
    } catch (error) {
      console.error('Error fetching committees:', error);
      healthMonitor.recordAttempt('theunitedstates_io', false, error?.toString());

      // Try to return stale cached data if available
      const staleCache = await this.getCachedData<USIOCommittee[]>(cacheKey);
      return staleCache || [];
    }
  }

  // Fetch recent bills from GovTrack RSS/API
  async getRecentBills(limit: number = 20): Promise<GovTrackBill[]> {
    const cacheKey = `govtrack:bills:recent:${limit}`;

    try {
      // Check cache first
      const cached = await this.getCachedData<GovTrackBill[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Note: In production, we'd fetch from GovTrack RSS or bulk downloads
      // Example: https://www.govtrack.us/api/v2/bill?limit=20&order_by=-current_status_date
      // For now, returning empty array as placeholder
      healthMonitor.recordAttempt('govtrack_bulk', false, 'Bulk download not implemented');
      return [];
    } catch (error) {
      console.error('Error fetching bills:', error);
      healthMonitor.recordAttempt('govtrack_bulk', false, error?.toString());
      return [];
    }
  }

  // Fetch historical legislators (for reference)
  async getHistoricalLegislators(): Promise<GovTrackLegislator[]> {
    const cacheKey = 'govtrack:legislators:historical';

    try {
      // Check cache first (30 days for historical data)
      const cached = await this.getCachedData<GovTrackLegislator[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await fetch(
        'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-historical.json'
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      // Cache for 30 days (historical data rarely changes)
      await this.setCachedData(cacheKey, data, 30 * 24 * 60 * 60 * 1000);

      return data;
    } catch (error) {
      console.error('Error fetching historical legislators:', error);
      return [];
    }
  }

  // Get social media accounts
  async getSocialMedia(): Promise<any[]> {
    const cacheKey = 'govtrack:socialmedia:current';

    try {
      // Check cache first (24 hours for social media)
      const cached = await this.getCachedData<any[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await fetch(
        'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-social-media.json'
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      // Cache for 24 hours
      await this.setCachedData(cacheKey, data, 24 * 60 * 60 * 1000);

      return data;
    } catch (error) {
      console.error('Error fetching social media:', error);
      return [];
    }
  }

  // Get committee membership for a legislator
  async getCommitteeMembership(bioguideId: string): Promise<USIOCommittee[]> {
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/committee-membership-current.json'
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const memberCommittees: USIOCommittee[] = [];
      
      // Parse committee membership data structure
      Object.entries(data).forEach(([committeeId, members]: [string, any]) => {
        if (Array.isArray(members) && members.includes(bioguideId)) {
          // Find the committee details
          const committees = this.committeesCache || [];
          const committee = committees.find((c: any) => 
            c.thomas_id === committeeId || 
            c.senate_committee_id === committeeId ||
            c.house_committee_id === committeeId
          );
          if (committee) {
            memberCommittees.push(committee);
          }
        }
      });
      
      return memberCommittees;
    } catch (error) {
      console.error('Error fetching committee membership:', error);
      return [];
    }
  }

  // Get executive nominations data
  async getNominations(): Promise<any[]> {
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/executive-nominations.json'
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching nominations:', error);
      return [];
    }
  }

  // Dashboard aggregation
  async getDashboardData(state?: string): Promise<{
    legislators: GovTrackLegislator[];
    committees: USIOCommittee[];
    bills: GovTrackBill[];
    socialMedia: any[];
  }> {
    try {
      const [legislatorsData, committeesData, billsData, socialData] = await Promise.allSettled([
        state ? this.getLegislatorsByState(state) : this.getCurrentLegislators(),
        this.getCommittees(),
        this.getRecentBills(),
        this.getSocialMedia()
      ]);

      return {
        legislators: legislatorsData.status === 'fulfilled' ? legislatorsData.value.slice(0, 10) : [],
        committees: committeesData.status === 'fulfilled' ? committeesData.value.slice(0, 10) : [],
        bills: billsData.status === 'fulfilled' ? billsData.value : [],
        socialMedia: socialData.status === 'fulfilled' ? socialData.value.slice(0, 20) : []
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return {
        legislators: [],
        committees: [],
        bills: [],
        socialMedia: []
      };
    }
  }

  // Format legislator for display
  formatLegislatorForDisplay(legislator: GovTrackLegislator): {
    name: string;
    title: string;
    party: string;
    state: string;
    district?: string;
    phone?: string;
    website?: string;
    bioguideId: string;
  } {
    const currentTerm = legislator.terms[legislator.terms.length - 1];
    const title = currentTerm.type === 'sen' ? 'Senator' : 'Representative';
    
    return {
      name: legislator.name.official_full,
      title,
      party: currentTerm.party,
      state: currentTerm.state,
      district: currentTerm.district?.toString(),
      phone: currentTerm.phone,
      website: currentTerm.url,
      bioguideId: legislator.id.bioguide
    };
  }
}

export const govTrackService = new GovTrackService();

// Health check
export async function checkGovTrackHealth(): Promise<boolean> {
  try {
    const legislators = await govTrackService.getCurrentLegislators();
    return legislators.length > 0;
  } catch {
    return false;
  }
}