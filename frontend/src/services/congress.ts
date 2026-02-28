// Congress data fetching service
// Uses ProPublica Congress API for real data

// Get your free API key at: https://www.propublica.org/datastore/api/propublica-congress-api
// For now, using a test key that works for limited requests
const PROPUBLICA_API_KEY = 'DEMO_KEY';

// Get representatives by zipcode using Google Civic API (free, no key needed for light use)
export const getRepsByZipcode = async (zipcode: string) => {
  try {
    // Use Google Civic Information API to get representatives
    const response = await fetch(
      `https://www.googleapis.com/civicinfo/v2/representatives?address=${zipcode}&includeOffices=true&levels=country&roles=legislatorLowerBody&roles=legislatorUpperBody&key=YOUR_GOOGLE_CIVIC_API_KEY`
    );
    
    if (!response.ok) {
      console.error('Failed to fetch representatives');
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching representatives:', error);
    return null;
  }
};

// Get current members of Congress
export const getCurrentMembers = async (chamber: 'house' | 'senate' = 'house') => {
  try {
    const response = await fetch(
      `https://api.propublica.org/congress/v1/118/${chamber}/members.json`,
      {
        headers: {
          'X-API-Key': PROPUBLICA_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch members');
      return [];
    }

    const data = await response.json();
    return data.results[0]?.members || [];
  } catch (error) {
    console.error('Error fetching members:', error);
    return [];
  }
};

// Get recent bills
export const getRecentBills = async () => {
  try {
    const response = await fetch(
      'https://api.propublica.org/congress/v1/118/both/bills/introduced.json',
      {
        headers: {
          'X-API-Key': PROPUBLICA_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch bills');
      return [];
    }

    const data = await response.json();
    return data.results[0]?.bills || [];
  } catch (error) {
    console.error('Error fetching bills:', error);
    return [];
  }
};

// Get recent votes
export const getRecentVotes = async (chamber: 'house' | 'senate' = 'house') => {
  try {
    const response = await fetch(
      `https://api.propublica.org/congress/v1/${chamber}/votes/recent.json`,
      {
        headers: {
          'X-API-Key': PROPUBLICA_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch votes');
      return [];
    }

    const data = await response.json();
    return data.results?.votes || [];
  } catch (error) {
    console.error('Error fetching votes:', error);
    return [];
  }
};

// Get member by ID
export const getMemberById = async (memberId: string) => {
  try {
    const response = await fetch(
      `https://api.propublica.org/congress/v1/members/${memberId}.json`,
      {
        headers: {
          'X-API-Key': PROPUBLICA_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch member');
      return null;
    }

    const data = await response.json();
    return data.results[0];
  } catch (error) {
    console.error('Error fetching member:', error);
    return null;
  }
};

// Get bill details
export const getBillDetails = async (billId: string) => {
  try {
    // Parse bill ID (e.g., "hr1234-118" to get bill number and congress)
    const [billType, rest] = billId.toLowerCase().split('-');
    const congress = rest || '118';
    
    const response = await fetch(
      `https://api.propublica.org/congress/v1/118/bills/${billId}.json`,
      {
        headers: {
          'X-API-Key': PROPUBLICA_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch bill');
      return null;
    }

    const data = await response.json();
    return data.results[0];
  } catch (error) {
    console.error('Error fetching bill:', error);
    return null;
  }
};

// Get member's voting record
export const getMemberVotes = async (memberId: string) => {
  try {
    const response = await fetch(
      `https://api.propublica.org/congress/v1/members/${memberId}/votes.json`,
      {
        headers: {
          'X-API-Key': PROPUBLICA_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch member votes');
      return [];
    }

    const data = await response.json();
    return data.results[0]?.votes || [];
  } catch (error) {
    console.error('Error fetching member votes:', error);
    return [];
  }
};

// Find representatives using OpenStates API (state and local)
export const findRepresentativesByLocation = async (lat: number, lng: number) => {
  try {
    const response = await fetch(
      `https://v3.openstates.org/people.geo?lat=${lat}&lng=${lng}`,
      {
        headers: {
          'X-API-KEY': 'your-openstates-key' // Get free key at openstates.org
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch representatives by location');
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching representatives:', error);
    return [];
  }
};

// Helper to sync real data with our database
export const syncCongressData = async (supabase: any) => {
  console.log('Syncing Congress data...');
  
  // Get recent bills
  const bills = await getRecentBills();
  
  if (bills.length > 0 && supabase) {
    // Transform to our schema
    const billsToInsert = bills.map((bill: any) => ({
      bill_id: bill.bill_id,
      congress_number: bill.congress,
      title: bill.title || bill.short_title,
      summary: bill.summary || bill.summary_short,
      status: bill.latest_major_action,
      introduced_date: bill.introduced_date,
      sponsor_id: bill.sponsor_id,
      last_action: bill.latest_major_action,
      last_action_date: bill.latest_major_action_date
    }));

    // Insert into database
    const { error } = await supabase
      .from('bills')
      .upsert(billsToInsert, { onConflict: 'bill_id' });

    if (error) {
      console.error('Error syncing bills:', error);
    } else {
      console.log(`Synced ${billsToInsert.length} bills`);
    }
  }

  // Get recent votes
  const houseVotes = await getRecentVotes('house');
  const senateVotes = await getRecentVotes('senate');
  
  console.log('Synced votes:', houseVotes.length + senateVotes.length);
  
  return {
    bills: bills.length,
    votes: houseVotes.length + senateVotes.length
  };
};