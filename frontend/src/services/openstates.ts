// OpenStates API Integration
// Provides state legislature data including bills, legislators, and votes

import { supabase } from './supabase';

// OpenStates API Configuration (now proxied through Supabase Edge Functions)

// Supabase Edge Function (proxy) configuration
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const OPENSTATES_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/openstates-api-v2` : '';

// Types for OpenStates API responses
export interface OpenStatesLegislator {
  id: string;
  name: string;
  given_name?: string;
  family_name?: string;
  party?: string;
  current_role?: {
    title: string;
    district: string;
    chamber: 'upper' | 'lower';
    jurisdiction: string;
  };
  jurisdiction?: {
    id: string;
    name: string;
    classification: string;
  };
  email?: string;
  image?: string;
  extras?: {
    phone?: string;
    website?: string;
  };
}

export interface OpenStatesBill {
  id: string;
  identifier: string; // Bill number like "HB 1234"
  title: string;
  abstract?: string;
  classification: string[];
  subject: string[];
  session: string;
  jurisdiction: {
    id: string;
    name: string;
    classification: string;
  };
  from_organization: {
    name: string;
    classification: string;
  };
  introduced_date?: string;
  latest_action?: {
    date: string;
    description: string;
    classification: string[];
  };
  sponsors?: Array<{
    name: string;
    person?: {
      id: string;
      name: string;
    };
    classification: string;
  }>;
  openstates_url: string;
  sources?: Array<{
    url: string;
    note: string;
  }>;
}

export interface OpenStatesVote {
  id: string;
  identifier: string;
  motion_text: string;
  start_date: string;
  result: 'pass' | 'fail';
  chamber: 'upper' | 'lower';
  yes_count: number;
  no_count: number;
  absent_count: number;
  abstain_count: number;
  bill?: {
    id: string;
    identifier: string;
  };
  votes?: Array<{
    option: 'yes' | 'no' | 'absent' | 'abstain' | 'not voting' | 'excused';
    voter_name: string;
    voter?: {
      id: string;
      name: string;
    };
  }>;
}

export interface OpenStatesJurisdiction {
  id: string;
  name: string;
  classification: string;
  division_id: string;
  url: string;
  latest_update: string;
  feature_flags: string[];
}

export interface OpenStatesCommittee {
  id: string;
  name: string;
  classification: string;
  chamber: 'upper' | 'lower';
  jurisdiction: {
    id: string;
    name: string;
    classification: string;
  };
  parent?: {
    id: string;
    name: string;
  };
  memberships?: Array<{
    person: {
      id: string;
      name: string;
    };
    role: string;
    start_date?: string;
    end_date?: string;
  }>;
}

export interface OpenStatesEvent {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  timezone: string;
  location?: {
    name?: string;
    address?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  media?: Array<{
    type: string;
    url: string;
    note?: string;
  }>;
  agenda?: Array<{
    description?: string;
    order: number;
    subjects?: string[];
    bills?: Array<{
      id: string;
      identifier: string;
    }>;
  }>;
  participants?: Array<{
    person?: {
      id: string;
      name: string;
    };
    organization?: {
      id: string;
      name: string;
    };
    note?: string;
  }>;
}

// State name to jurisdiction ID mapping
const STATE_JURISDICTION_MAP: { [key: string]: string } = {
  'AL': 'ocd-jurisdiction/country:us/state:al/government',
  'AK': 'ocd-jurisdiction/country:us/state:ak/government',
  'AZ': 'ocd-jurisdiction/country:us/state:az/government',
  'AR': 'ocd-jurisdiction/country:us/state:ar/government',
  'CA': 'ocd-jurisdiction/country:us/state:ca/government',
  'CO': 'ocd-jurisdiction/country:us/state:co/government',
  'CT': 'ocd-jurisdiction/country:us/state:ct/government',
  'DE': 'ocd-jurisdiction/country:us/state:de/government',
  'FL': 'ocd-jurisdiction/country:us/state:fl/government',
  'GA': 'ocd-jurisdiction/country:us/state:ga/government',
  'HI': 'ocd-jurisdiction/country:us/state:hi/government',
  'ID': 'ocd-jurisdiction/country:us/state:id/government',
  'IL': 'ocd-jurisdiction/country:us/state:il/government',
  'IN': 'ocd-jurisdiction/country:us/state:in/government',
  'IA': 'ocd-jurisdiction/country:us/state:ia/government',
  'KS': 'ocd-jurisdiction/country:us/state:ks/government',
  'KY': 'ocd-jurisdiction/country:us/state:ky/government',
  'LA': 'ocd-jurisdiction/country:us/state:la/government',
  'ME': 'ocd-jurisdiction/country:us/state:me/government',
  'MD': 'ocd-jurisdiction/country:us/state:md/government',
  'MA': 'ocd-jurisdiction/country:us/state:ma/government',
  'MI': 'ocd-jurisdiction/country:us/state:mi/government',
  'MN': 'ocd-jurisdiction/country:us/state:mn/government',
  'MS': 'ocd-jurisdiction/country:us/state:ms/government',
  'MO': 'ocd-jurisdiction/country:us/state:mo/government',
  'MT': 'ocd-jurisdiction/country:us/state:mt/government',
  'NE': 'ocd-jurisdiction/country:us/state:ne/government',
  'NV': 'ocd-jurisdiction/country:us/state:nv/government',
  'NH': 'ocd-jurisdiction/country:us/state:nh/government',
  'NJ': 'ocd-jurisdiction/country:us/state:nj/government',
  'NM': 'ocd-jurisdiction/country:us/state:nm/government',
  'NY': 'ocd-jurisdiction/country:us/state:ny/government',
  'NC': 'ocd-jurisdiction/country:us/state:nc/government',
  'ND': 'ocd-jurisdiction/country:us/state:nd/government',
  'OH': 'ocd-jurisdiction/country:us/state:oh/government',
  'OK': 'ocd-jurisdiction/country:us/state:ok/government',
  'OR': 'ocd-jurisdiction/country:us/state:or/government',
  'PA': 'ocd-jurisdiction/country:us/state:pa/government',
  'RI': 'ocd-jurisdiction/country:us/state:ri/government',
  'SC': 'ocd-jurisdiction/country:us/state:sc/government',
  'SD': 'ocd-jurisdiction/country:us/state:sd/government',
  'TN': 'ocd-jurisdiction/country:us/state:tn/government',
  'TX': 'ocd-jurisdiction/country:us/state:tx/government',
  'UT': 'ocd-jurisdiction/country:us/state:ut/government',
  'VT': 'ocd-jurisdiction/country:us/state:vt/government',
  'VA': 'ocd-jurisdiction/country:us/state:va/government',
  'WA': 'ocd-jurisdiction/country:us/state:wa/government',
  'WV': 'ocd-jurisdiction/country:us/state:wv/government',
  'WI': 'ocd-jurisdiction/country:us/state:wi/government',
  'WY': 'ocd-jurisdiction/country:us/state:wy/government'
};

// Note: Direct API calls removed - now using Supabase Edge Function proxy for security

// Helper to route via Supabase Edge Function proxy
async function openStatesViaEdge<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  if (!OPENSTATES_FN_URL || !SUPABASE_ANON_KEY) {
    throw new Error('OpenStates function not configured');
  }

  const res = await fetch(OPENSTATES_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ endpoint, params: params || {} })
  });

  // Surface server-side cache status in devtools for observability
  try {
    const cacheStatus = res.headers.get('X-Cache-Status');
    const cacheTTL = res.headers.get('X-Cache-TTL');
    const cacheStrategy = res.headers.get('X-Cache-Strategy');
    if (cacheStatus) {
      console.log(`[OpenStates] ${endpoint} → cache=${cacheStatus} ttl=${cacheTTL} strategy=${cacheStrategy}`);
    }
  } catch (_) {
    // ignore header read issues
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Unknown error' }));
    console.error(`OpenStates API error ${res.status}:`, errorBody);

    if (res.status === 429) {
      throw new Error('Rate limit exceeded - OpenStates API key may not be configured');
    }
    throw new Error(`OpenStates proxy error: ${res.status} - ${errorBody.error || 'Unknown error'}`);
  }

  const result = await res.json();

  // The edge function returns {data, cached} wrapper, extract the data
  if (result && typeof result === 'object' && 'data' in result) {
    return result.data as T;
  }

  return result;
}

// Get all jurisdictions (states)
export async function getJurisdictions(): Promise<OpenStatesJurisdiction[]> {
  try {
    const data = await openStatesViaEdge<{ results: OpenStatesJurisdiction[] }>('jurisdictions');
    return data.results;
  } catch (error) {
    console.error('Error fetching jurisdictions:', error);
    return [];
  }
}

// Get state bills
export async function getStateBills(
  state: string,
  options?: {
    session?: string;
    limit?: number;
    page?: number;
    subject?: string;
    classification?: string;
    searchQuery?: string;
  }
): Promise<OpenStatesBill[]> {
  try {
    const jurisdictionId = STATE_JURISDICTION_MAP[state] || state;
    const params: Record<string, string> = {
      jurisdiction: jurisdictionId,
      per_page: String(Math.min(options?.limit ?? 20, 20)),
      sort: 'updated_desc'
    };

    if (options?.session) params.session = options.session;
    if (options?.page) params.page = String(options.page);
    if (options?.subject) params.subject = options.subject;
    if (options?.classification) params.classification = options.classification;
    if (options?.searchQuery) params.q = options.searchQuery;

    console.log('Fetching bills with params:', params);
    const data = await openStatesViaEdge<{ results: OpenStatesBill[]; details?: string }>('bills', params);
    console.log('OpenStates API response:', data);

    // Check for rate limit error
    if (data.details && data.details.includes('Exceeded limit')) {
      console.warn('OpenStates API rate limit exceeded. The free tier allows only 10 requests per hour.');
      // Return empty array for now, but could implement caching strategy here
      return [];
    }

    return data.results || [];
  } catch (error) {
    console.error('Error fetching state bills:', error);
    return [];
  }
}

// Get state legislators by location
export async function getStateLegislatorsByLocation(lat: number, lon: number): Promise<OpenStatesLegislator[]> {
  try {
    const data = await openStatesViaEdge<{ results: OpenStatesLegislator[] }>('people-geo', {
      lat: String(lat),
      lng: String(lon),
      per_page: '50'
    });

    // Filter to only return state legislators (not federal)
    const stateLegislators = data.results.filter(legislator =>
      legislator.current_role &&
      legislator.jurisdiction?.classification === 'state'
    );

    return stateLegislators;
  } catch (error) {
    console.error('Error fetching state legislators:', error);
    return [];
  }
}

// Get ALL legislators by location (state and federal)
export async function getAllLegislatorsByLocation(lat: number, lon: number): Promise<OpenStatesLegislator[]> {
  try {
    const data = await openStatesViaEdge<{ results: OpenStatesLegislator[] }>('people-geo', {
      lat: String(lat),
      lng: String(lon),
      per_page: '50'
    });

    // Check if we got valid data
    if (!data || !data.results) {
      console.error('Invalid response from OpenStates API:', data);
      return [];
    }

    // Return all legislators with current roles (both state and federal)
    const allLegislators = data.results.filter(legislator =>
      legislator.current_role
    );

    console.log(`Found ${allLegislators.length} legislators from OpenStates for coordinates ${lat}, ${lon}`);
    return allLegislators;
  } catch (error) {
    console.error('Error fetching all legislators:', error);
    // If it's a 429 error, show a more helpful message
    if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
      console.error('⚠️ OpenStates API rate limit exceeded. Please configure an API key in Supabase Edge Functions.');
    }
    return [];
  }
}

// Get committees by jurisdiction
export async function getCommittees(state: string): Promise<OpenStatesCommittee[]> {
  try {
    const jurisdictionId = STATE_JURISDICTION_MAP[state] || state;
    const data = await openStatesViaEdge<{ results: OpenStatesCommittee[] }>('committees', {
      jurisdiction: jurisdictionId,
      per_page: '100'
    });
    return data.results;
  } catch (error) {
    console.error('Error fetching committees:', error);
    return [];
  }
}

// Get committee details by ID
export async function getCommitteeDetails(committeeId: string): Promise<OpenStatesCommittee | null> {
  try {
    const data = await openStatesViaEdge<OpenStatesCommittee>('committee-details', { committeeId });
    return data;
  } catch (error) {
    console.error('Error fetching committee details:', error);
    return null;
  }
}

// Get events by jurisdiction
export async function getEvents(state: string, options?: {
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<OpenStatesEvent[]> {
  try {
    const jurisdictionId = STATE_JURISDICTION_MAP[state] || state;
    const params: Record<string, string> = {
      jurisdiction: jurisdictionId,
      per_page: String(options?.limit || 50),
      sort: 'start_date'
    };

    if (options?.startDate) params.start_date__gte = options.startDate;
    if (options?.endDate) params.start_date__lte = options.endDate;

    const data = await openStatesViaEdge<{ results: OpenStatesEvent[] }>('events', params);
    return data.results;
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

// Get event details by ID
export async function getEventDetails(eventId: string): Promise<OpenStatesEvent | null> {
  try {
    const data = await openStatesViaEdge<OpenStatesEvent>('event-details', { eventId });
    return data;
  } catch (error) {
    console.error('Error fetching event details:', error);
    return null;
  }
}

// Get detailed jurisdiction metadata
export async function getJurisdictionDetails(jurisdictionId: string): Promise<OpenStatesJurisdiction | null> {
  try {
    const data = await openStatesViaEdge<OpenStatesJurisdiction>('jurisdiction-details', { jurisdictionId });
    return data;
  } catch (error) {
    console.error('Error fetching jurisdiction details:', error);
    return null;
  }
}

// Enhanced people search
export async function searchPeople(options: {
  name?: string;
  state?: string;
  party?: string;
  chamber?: 'upper' | 'lower';
  currentRole?: boolean;
  limit?: number;
}): Promise<OpenStatesLegislator[]> {
  try {
    const params: Record<string, string> = {
      per_page: String(options.limit || 50)
    };

    if (options.name) params.name = options.name;
    if (options.state) {
      const jurisdictionId = STATE_JURISDICTION_MAP[options.state] || options.state;
      params.jurisdiction = jurisdictionId;
    }
    if (options.party) params.party = options.party;
    if (options.chamber) params.chamber = options.chamber;
    if (options.currentRole !== undefined) params.current_role = String(options.currentRole);

    const data = await openStatesViaEdge<{ results: OpenStatesLegislator[] }>('people', params);
    return data.results;
  } catch (error) {
    console.error('Error searching people:', error);
    return [];
  }
}

// Enhanced bill search with more criteria
export async function searchBills(options: {
  state?: string;
  session?: string;
  chamber?: 'upper' | 'lower';
  sponsor?: string;
  subject?: string;
  classification?: string;
  status?: string;
  searchQuery?: string;
  limit?: number;
  sort?: 'updated_desc' | 'created_desc' | 'first_action_date' | 'last_action_date';
}): Promise<OpenStatesBill[]> {
  try {
    const params: Record<string, string> = {
      per_page: String(options.limit || 20),
      sort: options.sort || 'updated_desc'
    };

    if (options.state) {
      const jurisdictionId = STATE_JURISDICTION_MAP[options.state] || options.state;
      params.jurisdiction = jurisdictionId;
    }
    if (options.session) params.session = options.session;
    if (options.chamber) params.chamber = options.chamber;
    if (options.sponsor) params.sponsor = options.sponsor;
    if (options.subject) params.subject = options.subject;
    if (options.classification) params.classification = options.classification;
    if (options.status) params.status = options.status;
    if (options.searchQuery) params.q = options.searchQuery;

    const data = await openStatesViaEdge<{ results: OpenStatesBill[] }>('bills', params);
    return data.results;
  } catch (error) {
    console.error('Error searching bills:', error);
    return [];
  }
}

// Get specific bill details
export async function getBillDetails(billId: string): Promise<OpenStatesBill | null> {
  try {
    const data = await openStatesViaEdge<OpenStatesBill>('bill-details', { billId });
    return data;
  } catch (error) {
    console.error('Error fetching bill details:', error);
    return null;
  }
}

// Get votes for a bill
export async function getBillVotes(billId: string): Promise<OpenStatesVote[]> {
  try {
    const data = await openStatesViaEdge<{ results: OpenStatesVote[] }>('bill-votes', { billId });
    return data.results;
  } catch (error) {
    console.error('Error fetching bill votes:', error);
    return [];
  }
}

// Get legislator details
export async function getLegislatorDetails(personId: string): Promise<OpenStatesLegislator | null> {
  try {
    const data = await openStatesViaEdge<OpenStatesLegislator>('legislator-details', { personId });
    return data;
  } catch (error) {
    console.error('Error fetching legislator details:', error);
    return null;
  }
}

// Get legislator voting record
export async function getLegislatorVotes(personId: string, limit: number = 50): Promise<OpenStatesVote[]> {
  try {
    const data = await openStatesViaEdge<{ results: OpenStatesVote[] }>('legislator-votes', {
      personId,
      per_page: String(limit)
    });
    return data.results;
  } catch (error) {
    console.error('Error fetching legislator votes:', error);
    return [];
  }
}

// Texas-specific functions
export async function getTexasActiveBills(): Promise<OpenStatesBill[]> {
  // Get recent bills without session filtering to include all recent activity
  // This includes regular sessions (88, 89) and special sessions (881, 882, 891, 892, etc.)
  return getStateBills('TX', {
    limit: 100  // Increased limit to get more bills
    // No session filter - get all recent bills sorted by updated_desc
  });
}

export async function getStateLegislatorsByZipcode(zipcode: string): Promise<OpenStatesLegislator[]> {
  try {
    // Use a free geocoding service to get coordinates for any US zipcode
    const coords = await getCoordinatesForZipcode(zipcode);
    if (!coords) {
      console.warn(`Could not geocode zipcode ${zipcode}`);
      return [];
    }

    return getStateLegislatorsByLocation(coords.lat, coords.lon);
  } catch (error) {
    console.error('Error getting legislators for zipcode:', error);
    return [];
  }
}

export async function getAllLegislatorsByZipcode(zipcode: string): Promise<OpenStatesLegislator[]> {
  try {
    // Use a free geocoding service to get coordinates for any US zipcode
    const coords = await getCoordinatesForZipcode(zipcode);
    if (!coords) {
      console.warn(`Could not geocode zipcode ${zipcode}`);
      return [];
    }

    return getAllLegislatorsByLocation(coords.lat, coords.lon);
  } catch (error) {
    console.error('Error getting all legislators for zipcode:', error);
    return [];
  }
}

// Helper function to get coordinates for any US zipcode
async function getCoordinatesForZipcode(zipcode: string): Promise<{ lat: number; lon: number } | null> {
  try {
    // Use zippopotam.us - a free geocoding API
    const response = await fetch(`https://api.zippopotam.us/us/${zipcode}`);
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        lat: parseFloat(place.latitude),
        lon: parseFloat(place.longitude)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error geocoding zipcode:', error);
    return null;
  }
}

// Sync state bills to database
export async function syncStateBills(state: string, session?: string): Promise<void> {
  try {
    console.log(`Syncing ${state} bills...`);
    
    const bills = await getStateBills(state, { 
      session,
      limit: 100 
    });

    for (const bill of bills) {
      // Store bill in database
      const { error: billError } = await supabase
        .from('state_bills')
        .upsert({
          bill_id: bill.id,
          state: bill.jurisdiction.name,
          session: bill.session,
          identifier: bill.identifier,
          title: bill.title,
          abstract: bill.abstract,
          classification: bill.classification,
          subjects: bill.subject,
          status: bill.latest_action?.description,
          introduced_date: bill.introduced_date,
          sponsor_id: bill.sponsors?.[0]?.person?.id,
          sponsor_name: bill.sponsors?.[0]?.name,
          chamber: bill.from_organization.classification === 'upper' ? 'upper' : 'lower',
          latest_action_description: bill.latest_action?.description,
          latest_action_date: bill.latest_action?.date,
          openstates_url: bill.openstates_url,
          full_text_url: bill.sources?.[0]?.url,
          updated_at: new Date().toISOString()
        });

      if (billError) {
        console.error('Error storing bill:', billError);
        continue;
      }

      // Store sponsors
      if (bill.sponsors) {
        for (const sponsor of bill.sponsors) {
          await supabase
            .from('state_bill_sponsors')
            .upsert({
              bill_id: bill.id,
              legislator_id: sponsor.person?.id,
              legislator_name: sponsor.name,
              sponsor_type: sponsor.classification === 'primary' ? 'primary' : 'cosponsor'
            });
        }
      }

      // Fetch and store votes
      const votes = await getBillVotes(bill.id);
      for (const vote of votes) {
        if (vote.votes) {
          for (const individualVote of vote.votes) {
            await supabase
              .from('state_votes')
              .upsert({
                vote_event_id: vote.id,
                bill_id: bill.id,
                legislator_id: individualVote.voter?.id,
                legislator_name: individualVote.voter_name,
                vote_value: individualVote.option,
                vote_date: vote.start_date,
                motion_text: vote.motion_text,
                chamber: vote.chamber,
                passed: vote.result === 'pass',
                yes_count: vote.yes_count,
                no_count: vote.no_count,
                absent_count: vote.absent_count
              });
          }
        }
      }
    }

    console.log(`Synced ${bills.length} bills for ${state}`);
  } catch (error) {
    console.error('Error syncing state bills:', error);
  }
}

// Get state activity feed for a zipcode
export async function getStateActivityFeed(zipcode: string): Promise<any[]> {
  try {
    // Get state from zipcode
    const { data: districtData } = await supabase
      .from('districts')
      .select('state')
      .eq('zipcode', zipcode)
      .single();

    if (!districtData?.state) {
      console.warn('No state found for zipcode:', zipcode);
      return [];
    }

    // Get recent state bills
    const { data: stateBills } = await supabase
      .from('state_bills')
      .select('*')
      .eq('state', districtData.state)
      .order('latest_action_date', { ascending: false })
      .limit(20);

    return stateBills || [];
  } catch (error) {
    console.error('Error fetching state activity feed:', error);
    return [];
  }
}

// Export for use in components
export const OpenStates = {
  // Jurisdictions
  getJurisdictions,
  getJurisdictionDetails,

  // People/Legislators
  getStateLegislatorsByLocation,
  getAllLegislatorsByLocation,
  getStateLegislatorsByZipcode,
  getAllLegislatorsByZipcode,
  getLegislatorDetails,
  getLegislatorVotes,
  searchPeople,

  // Bills
  getStateBills,
  searchBills,
  getBillDetails,
  getBillVotes,
  getTexasActiveBills,

  // Committees
  getCommittees,
  getCommitteeDetails,

  // Events
  getEvents,
  getEventDetails,

  // Sync and Activity
  syncStateBills,
  getStateActivityFeed
};