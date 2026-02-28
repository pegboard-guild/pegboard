// Congress.gov API Service
// Provides real-time federal legislative data including bills, members, and votes
// API Documentation: https://api.congress.gov/

// Use Supabase Edge Function for caching and proxy
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/congress-api-v2`;

// Types for Congress.gov API responses
export interface CongressBill {
  congress: number;
  type: string; // HR, S, HJRES, SJRES, etc.
  number: string;
  title: string;
  originChamber: string;
  originChamberCode: string;
  latestAction?: {
    actionDate: string;
    text: string;
  };
  updateDate: string;
  updateDateIncludingText: string;
  url: string;
  // Extended properties when fetching bill details
  introducedDate?: string;
  committees?: any[];
  actions?: any[];
  sponsors?: CongressSponsor[];
  cosponsors?: CongressSponsor[];
  summaries?: any[];
  subjects?: any[];
  policyArea?: {
    name: string;
  };
  billStatus?: string;
  billStatusAtEnactment?: string;
  laws?: any[];
  textVersions?: CongressTextVersion[];
}

export interface CongressTextVersion {
  date: string;
  type: string;
  url: string;
  formats?: Array<{
    type: string; // PDF, XML, TXT
    url: string;
  }>;
}

export interface CongressSponsor {
  bioguideId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  party: string;
  state: string;
  district?: number;
  url: string;
}

export interface CongressMember {
  bioguideId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  state: string;
  district?: number;
  partyName: string;
  depiction?: {
    imageUrl: string;
    attribution: string;
  };
  terms?: {
    item: Array<{
      chamber: string;
      startYear: number;
      endYear?: number;
    }>;
  };
  updateDate: string;
  url: string;
  // Extended properties when fetching member details
  directOrderName?: string;
  birthYear?: string;
  deathYear?: string;
  addressInformation?: {
    officeAddress?: string;
    phoneNumber?: string;
    city?: string;
    district?: string;
    zipCode?: string;
  };
  currentMember?: boolean;
  officialWebsiteUrl?: string;
  socialMedia?: Array<{
    type: string;
    account: string;
  }>;
}

export interface CongressApiResponse<T> {
  bills?: T[];
  members?: T[];
  committees?: T[];
  actions?: T[];
  cosponsors?: T[];
  textVersions?: T[];
  bill?: T;
  member?: T;
  pagination?: {
    count: number;
    next?: string;
    prev?: string;
  };
}

// Helper function to make API calls through edge function
async function fetchFromCongress<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
  const queryParams = new URLSearchParams({
    format: 'json',
    ...params
  });

  const url = `${EDGE_FUNCTION_URL}${endpoint}?${queryParams}`;

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Congress API error: ${response.status} ${response.statusText}`);
      throw new Error(`Congress API error: ${response.status}`);
    }

    const result = await response.json();

    // Check cache status from headers or response body
    const cacheStatus = response.headers.get('x-cache-status') || response.headers.get('X-Cache-Status');
    const isCached = result.cached || cacheStatus === 'HIT';

    if (isCached) {
      console.log(`📦 Cache hit for ${endpoint}`);
    } else {
      console.log(`🌐 Fresh fetch for ${endpoint}`);
    }

    // The edge function returns {data: actualData, cached: boolean}
    // Extract the actual data
    return result.data || result;
  } catch (error) {
    console.error('Error fetching from Congress API:', error);
    throw error;
  }
}

// Get recent bills from a specific congress
export async function getRecentBills(
  congress: number = 118,
  limit: number = 20,
  offset: number = 0,
  onlyEnacted: boolean = false
): Promise<CongressBill[]> {
  try {
    console.log(`📋 Fetching ${onlyEnacted ? 'enacted' : 'recent'} bills from ${congress}th Congress`);

    const params: Record<string, any> = { limit, offset, sort: 'updateDate+desc' };

    const response = await fetchFromCongress<CongressApiResponse<CongressBill>>(
      `/bill/${congress}`,
      params
    );

    // The edge function wraps the response, so we need to extract the actual data
    console.log('Raw Congress API response:', response);

    // Handle different response structures
    let bills: CongressBill[] = [];

    if (Array.isArray(response)) {
      bills = response;
    } else if (response.bills) {
      bills = response.bills;
    }

    // Log first few bills to debug
    if (bills.length > 0) {
      console.log(`Got ${bills.length} bills from ${congress}th Congress. Sample:`, bills[0]);
    } else {
      console.warn(`No bills found for ${congress}th Congress`, response);
    }

    return bills;
  } catch (error) {
    console.error('Error fetching recent bills:', error);
    return [];
  }
}

// Get bills by type (HR, S, etc.)
export async function getBillsByType(
  congress: number = 118,
  billType: string = 'hr',
  limit: number = 20
): Promise<CongressBill[]> {
  try {
    console.log(`📋 Fetching ${billType.toUpperCase()} bills from ${congress}th Congress`);

    const response = await fetchFromCongress<CongressApiResponse<CongressBill>>(
      `/bill/${congress}/${billType.toLowerCase()}`,
      { limit, sort: 'number+desc' }
    );

    return response.bills || [];
  } catch (error) {
    console.error('Error fetching bills by type:', error);
    return [];
  }
}

// Get specific bill details
export async function getBillDetails(
  congress: number,
  billType: string,
  billNumber: string
): Promise<CongressBill | null> {
  try {
    console.log(`📄 Fetching details for ${billType.toUpperCase()} ${billNumber} (${congress}th Congress)`);

    const response = await fetchFromCongress<{ bill: CongressBill }>(
      `/bill/${congress}/${billType.toLowerCase()}/${billNumber}`
    );

    return response.bill || null;
  } catch (error) {
    console.error('Error fetching bill details:', error);
    return null;
  }
}

// Get current members of Congress
export async function getCurrentMembers(
  chamber?: 'house' | 'senate',
  limit: number = 100
): Promise<CongressMember[]> {
  try {
    console.log(`👥 Fetching current members of Congress${chamber ? ` (${chamber})` : ''}`);

    const params: Record<string, any> = {
      limit,
      currentMember: true
    };

    if (chamber) {
      params.chamber = chamber === 'house' ? 'House' : 'Senate';
    }

    const response = await fetchFromCongress<CongressApiResponse<CongressMember>>(
      '/member',
      params
    );

    return response.members || [];
  } catch (error) {
    console.error('Error fetching current members:', error);
    return [];
  }
}

// Get members by state
export async function getMembersByState(
  state: string,
  currentOnly: boolean = true
): Promise<CongressMember[]> {
  try {
    console.log(`👥 Fetching members from ${state}`);

    const response = await fetchFromCongress<CongressApiResponse<CongressMember>>(
      '/member',
      {
        limit: 250,
        currentMember: currentOnly,
        state: state.toUpperCase()
      }
    );

    return response.members || [];
  } catch (error) {
    console.error('Error fetching members by state:', error);
    return [];
  }
}

// Format bill identifier for display
export function formatBillId(bill: CongressBill): string {
  const typeMap: Record<string, string> = {
    'HR': 'H.R.',
    'S': 'S.',
    'HJRES': 'H.J.Res.',
    'SJRES': 'S.J.Res.',
    'HCONRES': 'H.Con.Res.',
    'SCONRES': 'S.Con.Res.',
    'HRES': 'H.Res.',
    'SRES': 'S.Res.'
  };

  return `${typeMap[bill.type] || bill.type} ${bill.number}`;
}

// Get Congress.gov URL for a bill
export function getBillUrl(bill: CongressBill): string {
  return `https://www.congress.gov/bill/${bill.congress}th-congress/${
    bill.originChamber.toLowerCase() === 'house' ? 'house' : 'senate'
  }-bill/${bill.number}`;
}

// Helper to determine current Congress number
export function getCurrentCongress(): number {
  const now = new Date();
  const year = now.getFullYear();
  // Congress changes every 2 years on January 3rd
  const month = now.getMonth();
  const day = now.getDate();
  const isAfterJan3 = month > 0 || (month === 0 && day >= 3);

  // 118th Congress: 2023-2024 (ends Jan 3, 2025)
  // 119th Congress: 2025-2026 (starts Jan 3, 2025)
  if (year === 2025 && !isAfterJan3) return 118;
  if (year === 2025 || year === 2026) return 119;
  if (year === 2023 || year === 2024) return 118;

  // General formula: Congress = ((year - 1789) / 2) + 1
  return Math.floor((year - 1789) / 2) + 1;
}