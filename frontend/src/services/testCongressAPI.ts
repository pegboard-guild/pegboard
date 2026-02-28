// Test Congress.gov API directly
const CONGRESS_API_KEY = process.env.REACT_APP_CONGRESS_API_KEY || '';
const CONGRESS_API_BASE = 'https://api.congress.gov/v3';
const CURRENT_CONGRESS = 118;

// Test function to verify API access
export const testCongressAPI = async () => {
  console.log('Testing Congress.gov API...');
  
  try {
    // Test 1: Get current members
    const membersUrl = `${CONGRESS_API_BASE}/member?api_key=${CONGRESS_API_KEY}&limit=5&format=json`;
    console.log('Fetching members from:', membersUrl);
    
    const membersResponse = await fetch(membersUrl);
    console.log('Members response status:', membersResponse.status);
    
    if (membersResponse.ok) {
      const membersData = await membersResponse.json();
      console.log('Members data:', membersData);
    } else {
      console.error('Members fetch failed:', await membersResponse.text());
    }
    
    // Test 2: Get recent bills
    const billsUrl = `${CONGRESS_API_BASE}/bill/${CURRENT_CONGRESS}?api_key=${CONGRESS_API_KEY}&limit=5&format=json`;
    console.log('Fetching bills from:', billsUrl);
    
    const billsResponse = await fetch(billsUrl);
    console.log('Bills response status:', billsResponse.status);
    
    if (billsResponse.ok) {
      const billsData = await billsResponse.json();
      console.log('Bills data:', billsData);
    } else {
      console.error('Bills fetch failed:', await billsResponse.text());
    }
    
    // Test 3: Get Texas delegation
    const texasUrl = `${CONGRESS_API_BASE}/member/congress/${CURRENT_CONGRESS}/TX?api_key=${CONGRESS_API_KEY}&format=json`;
    console.log('Fetching Texas delegation from:', texasUrl);
    
    const texasResponse = await fetch(texasUrl);
    console.log('Texas response status:', texasResponse.status);
    
    if (texasResponse.ok) {
      const texasData = await texasResponse.json();
      console.log('Texas delegation:', texasData);
      
      // Filter for district 32 (Dallas area)
      if (texasData.members) {
        const dallas = texasData.members.filter((m: any) => 
          m.district === '32' || m.district === '30' || m.district === '24' || !m.district
        );
        console.log('Dallas area representatives:', dallas);
      }
    } else {
      console.error('Texas fetch failed:', await texasResponse.text());
    }
    
  } catch (error) {
    console.error('API test error:', error);
  }
};

// Call test function when module loads
testCongressAPI();