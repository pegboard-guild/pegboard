// USASpending API Integration
// Tracks government spending, contracts, grants, and financial assistance
// Part of api.data.gov ecosystem

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'placeholder-key';

export interface SpendingByLocation {
  total_obligations: number;
  total_outlays: number;
  face_value_of_loans: number;
  population: number;
  per_capita: number;
  award_count: number;
}

export interface FederalAccount {
  account_name: string;
  account_number: string;
  managing_agency: string;
  budgetary_resources: number;
  obligations_incurred: number;
  outlays: number;
  unobligated_balance: number;
}

export interface Award {
  award_id: string;
  recipient_name: string;
  awarding_agency: string;
  award_amount: number;
  award_type: 'contract' | 'grant' | 'loan' | 'direct_payment' | 'other';
  description: string;
  start_date: string;
  end_date: string;
  place_of_performance: {
    state: string;
    city: string;
    zip: string;
    congressional_district: string;
  };
}

export interface AgencySpending {
  agency_name: string;
  abbreviation: string;
  total_obligations: number;
  total_outlays: number;
  total_budgetary_resources: number;
  congressional_justification_url?: string;
}

export interface SpendingByProgram {
  program_name: string;
  program_number: string;
  total_obligations: number;
  total_outlays: number;
  award_count: number;
  recipient_count: number;
}

// Get spending data for a specific zipcode/district
export async function getSpendingByZipcode(zipcode: string): Promise<SpendingByLocation> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/usaspending-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'spending-by-zipcode',
        params: { zipcode }
      })
    });
    try {
      const cacheStatus = response.headers.get('X-Cache-Status');
      if (cacheStatus) {
        console.log(`[USASpending] spending-by-zipcode → cache=${cacheStatus}`);
      }
    } catch (_) {}

    if (!response.ok) {
      console.warn(`[USASpending] spending-by-zipcode error: ${response.status}`);
      return {
        total_obligations: 0,
        total_outlays: 0,
        face_value_of_loans: 0,
        population: 0,
        per_capita: 0,
        award_count: 0
      };
    }

    const data = await response.json();
    return data.results?.[0] || {
      total_obligations: 0,
      total_outlays: 0,
      face_value_of_loans: 0,
      population: 0,
      per_capita: 0,
      award_count: 0
    };
  } catch (error) {
    console.error('Error fetching spending by zipcode:', error);
    return {
      total_obligations: 0,
      total_outlays: 0,
      face_value_of_loans: 0,
      population: 0,
      per_capita: 0,
      award_count: 0
    };
  }
}

// Get recent awards for a congressional district
export async function getAwardsByDistrict(state: string, district: string): Promise<Award[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/usaspending-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'awards-by-district',
        params: { state, district }
      })
    });
    try {
      const cacheStatus = response.headers.get('X-Cache-Status');
      if (cacheStatus) {
        console.log(`[USASpending] awards-by-district → cache=${cacheStatus}`);
      }
    } catch (_) {}

    if (!response.ok) {
      console.warn(`[USASpending] awards-by-district error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results.map((item: any) => ({
      award_id: item['Award ID'] || item.award_id || '',
      recipient_name: item['Recipient Name'] || item.recipient_name || 'Unknown Recipient',
      awarding_agency: item['Awarding Agency'] || item.awarding_agency || 'Unknown Agency',
      award_amount: (item['Total Obligation'] ?? item['Award Amount'] ?? item.award_amount ?? 0),
      award_type: (item['Award Type'] || item.award_type || 'other').toLowerCase(),
      description: item['Description'] || item.description || '',
      start_date: item['Start Date'] || item.start_date || new Date().toISOString(),
      end_date: item['End Date'] || item.end_date || null,
      place_of_performance: {
        state: item['Place of Performance State'] || item.place_of_performance_state || state,
        city: item['Place of Performance City'] || item.place_of_performance_city || '',
        zip: item['Place of Performance Zip'] || item.place_of_performance_zip || '',
        congressional_district: item['Place of Performance Congressional District'] || item.place_of_performance_cd || ''
      }
    }));
  } catch (error) {
    console.error('Error fetching awards by district:', error);
    return [];
  }
}

// Get spending by federal agency
export async function getSpendingByAgency(fiscalYear?: number): Promise<AgencySpending[]> {
  const year = fiscalYear || new Date().getFullYear();

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/usaspending-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'agency-spending',
        params: { fiscalYear: year }
      })
    });
    try {
      const cacheStatus = response.headers.get('X-Cache-Status');
      if (cacheStatus) {
        console.log(`[USASpending] agency-spending → cache=${cacheStatus}`);
      }
    } catch (_) {}

    if (!response.ok) {
      console.warn(`[USASpending] agency-spending error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    // spending_by_category returns results with aggregated amounts per agency
    const items = (data.results || data.children || data.agencies || []) as any[];
    if (!items.length) {
      console.warn('[USASpending] agency-spending returned no items');
    }
    return items.slice(0, 10).map((row: any) => ({
      agency_name: row.agency_name || row.name || row.label || 'Agency',
      abbreviation: row.abbreviation || row.code || '',
      total_obligations: row.obligated_amount || row.total_obligations || row.amount || 0,
      total_outlays: row.outlay_amount || row.total_outlays || 0,
      total_budgetary_resources: row.budget_authority_amount || row.total_budgetary_resources || 0,
      congressional_justification_url: row.congressional_justification_url
    }));
  } catch (error) {
    console.error('Error fetching agency spending:', error);
    return [];
  }
}

// Get federal spending trends over time
export async function getSpendingTrends(months: number = 12): Promise<{
  labels: string[];
  obligations: number[];
  outlays: number[];
}> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/usaspending-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'spending-trends',
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      })
    });
    try {
      const cacheStatus = response.headers.get('X-Cache-Status');
      if (cacheStatus) {
        console.log(`[USASpending] spending-trends → cache=${cacheStatus}`);
      }
    } catch (_) {}

    if (!response.ok) {
      console.warn(`[USASpending] spending-trends error: ${response.status}`);
      return { labels: [], obligations: [], outlays: [] };
    }

    const data = await response.json();

    return {
      labels: (data.results || []).map((item: any) => item.time_period?.fiscal_year + '-' + item.time_period?.month),
      obligations: (data.results || []).map((item: any) => item.obligations || 0),
      outlays: (data.results || []).map((item: any) => item.outlays || 0)
    };
  } catch (error) {
    console.error('Error fetching spending trends:', error);
    return {
      labels: [],
      obligations: [],
      outlays: []
    };
  }
}

// Get disaster/emergency spending
export async function getDisasterSpending(): Promise<{
  total: number;
  by_state: { state: string; amount: number }[];
  by_disaster: { name: string; amount: number; code: string }[];
}> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/usaspending-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'disaster-spending',
        params: {}
      })
    });
    try {
      const cacheStatus = response.headers.get('X-Cache-Status');
      if (cacheStatus) {
        console.log(`[USASpending] disaster-spending → cache=${cacheStatus}`);
      }
    } catch (_) {}

    if (!response.ok) {
      console.warn(`[USASpending] disaster-spending error: ${response.status}`);
      return { total: 0, by_state: [], by_disaster: [] };
    }

    const data = await response.json();

    return {
      total: data.total_budget_authority,
      by_state: data.states?.map((s: any) => ({
        state: s.code,
        amount: s.total_obligations
      })) || [],
      by_disaster: data.disasters?.map((d: any) => ({
        name: d.title,
        amount: d.total_obligations,
        code: d.code
      })) || []
    };
  } catch (error) {
    console.error('Error fetching disaster spending:', error);
    return {
      total: 0,
      by_state: [],
      by_disaster: []
    };
  }
}

// Search for specific contracts or grants
export async function searchAwards(query: string, awardType?: string): Promise<Award[]> {
  try {
    const filters: any = {
      keywords: [query],
      time_period: [
        {
          start_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last year
          end_date: new Date().toISOString().split('T')[0]
        }
      ]
    };

    if (awardType) {
      filters.award_type_codes = [awardType];
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/usaspending-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'search-awards',
        params: {
          filters,
          limit: 25
        }
      })
    });
    try {
      const cacheStatus = response.headers.get('X-Cache-Status');
      if (cacheStatus) {
        console.log(`[USASpending] search-awards → cache=${cacheStatus}`);
      }
    } catch (_) {}

    if (!response.ok) {
      console.warn(`[USASpending] search-awards error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.results || []).map((item: any) => ({
      award_id: item['Award ID'],
      recipient_name: item['Recipient Name'],
      awarding_agency: item['Awarding Agency'],
      award_amount: item['Total Obligation'],
      award_type: item['Award Type']?.toLowerCase() || 'other',
      description: item['Description'],
      start_date: item['Start Date'],
      end_date: item['End Date'],
      place_of_performance: {
        state: '',
        city: '',
        zip: '',
        congressional_district: ''
      }
    }));
  } catch (error) {
    console.error('Error searching awards:', error);
    return [];
  }
}