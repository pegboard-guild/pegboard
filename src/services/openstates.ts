// OpenStates API Integration
// Provides state legislature data including bills, legislators, and votes

import { supabase } from './supabase';

// OpenStates API Configuration
const OPENSTATES_API_KEY = process.env.REACT_APP_OPENSTATES_API_KEY || '';
const BASE_URL = 'https://v3.openstates.org';

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

// Helper function to make API calls
async function openStatesAPI<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  if (!OPENSTATES_API_KEY) {
    console.warn('OpenStates API key not configured');
    throw new Error('OpenStates API key not configured');
  }

  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      'X-API-KEY': OPENSTATES_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`OpenStates API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Get all jurisdictions (states)
export async function getJurisdictions(): Promise<OpenStatesJurisdiction[]> {
  try {
    const data = await openStatesAPI<{ results: OpenStatesJurisdiction[] }>('/jurisdictions');
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
    subject?: string;
    classification?: string;
    searchQuery?: string;
  }
): Promise<OpenStatesBill[]> {
  try {
    const jurisdictionId = STATE_JURISDICTION_MAP[state] || state;
    const params: Record<string, string> = {
      jurisdiction: jurisdictionId,
      per_page: String(options?.limit || 20),
      sort: 'updated_desc'
    };

    if (options?.session) params.session = options.session;
    if (options?.subject) params.subject = options.subject;
    if (options?.classification) params.classification = options.classification;
    if (options?.searchQuery) params.q = options.searchQuery;

    const data = await openStatesAPI<{ results: OpenStatesBill[] }>('/bills', params);
    return data.results;
  } catch (error) {
    console.error('Error fetching state bills:', error);
    return [];
  }
}

// Get state legislators by location
export async function getStateLegislatorsByLocation(lat: number, lon: number): Promise<OpenStatesLegislator[]> {
  try {
    const data = await openStatesAPI<{ results: OpenStatesLegislator[] }>('/people.geo', {
      lat: String(lat),
      lng: String(lon)
    });
    return data.results;
  } catch (error) {
    console.error('Error fetching state legislators:', error);
    return [];
  }
}

// Get specific bill details
export async function getBillDetails(billId: string): Promise<OpenStatesBill | null> {
  try {
    const data = await openStatesAPI<OpenStatesBill>(`/bills/${billId}`);
    return data;
  } catch (error) {
    console.error('Error fetching bill details:', error);
    return null;
  }
}

// Get votes for a bill
export async function getBillVotes(billId: string): Promise<OpenStatesVote[]> {
  try {
    const data = await openStatesAPI<{ results: OpenStatesVote[] }>(`/bills/${billId}/votes`);
    return data.results;
  } catch (error) {
    console.error('Error fetching bill votes:', error);
    return [];
  }
}

// Get legislator details
export async function getLegislatorDetails(personId: string): Promise<OpenStatesLegislator | null> {
  try {
    const data = await openStatesAPI<OpenStatesLegislator>(`/people/${personId}`);
    return data;
  } catch (error) {
    console.error('Error fetching legislator details:', error);
    return null;
  }
}

// Get legislator voting record
export async function getLegislatorVotes(personId: string, limit: number = 50): Promise<OpenStatesVote[]> {
  try {
    const data = await openStatesAPI<{ results: OpenStatesVote[] }>(`/people/${personId}/votes`, {
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
  const currentYear = new Date().getFullYear();
  // Texas legislature meets in odd years
  const sessionYear = currentYear % 2 === 0 ? currentYear - 1 : currentYear;
  
  // Check if we're in 2025 (89th session)
  const session = sessionYear >= 2025 ? '89' : '88';
  
  return getStateBills('TX', {
    session,
    limit: 50
  });
}

export async function getTexasLegislatorsByZipcode(zipcode: string): Promise<OpenStatesLegislator[]> {
  // For Dallas (75205), approximate coordinates
  // In production, use a geocoding service
  const locations: { [key: string]: { lat: number; lon: number } } = {
    '75205': { lat: 32.8134, lon: -96.7965 } // Highland Park, Dallas
  };

  const coords = locations[zipcode];
  if (!coords) {
    console.warn(`No coordinates found for zipcode ${zipcode}`);
    return [];
  }

  return getStateLegislatorsByLocation(coords.lat, coords.lon);
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
  getJurisdictions,
  getStateBills,
  getStateLegislatorsByLocation,
  getBillDetails,
  getBillVotes,
  getLegislatorDetails,
  getLegislatorVotes,
  getTexasActiveBills,
  getTexasLegislatorsByZipcode,
  syncStateBills,
  getStateActivityFeed
};