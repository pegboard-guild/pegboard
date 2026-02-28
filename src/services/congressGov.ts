// Official Congress.gov API Service
// Documentation: https://api.congress.gov/

import { Member, Bill, ActivityFeedItem } from '../types';

const CONGRESS_API_KEY = 'Lf0akx2PpcE4vdBxJHSjWwRa6aVBkIsSXBEAY2RA';
const CONGRESS_API_BASE = 'https://api.congress.gov/v3';
const CURRENT_CONGRESS = 118;

// Helper to add API key to requests
const apiUrl = (endpoint: string) => {
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${CONGRESS_API_BASE}${endpoint}${separator}api_key=${CONGRESS_API_KEY}`;
};

// Get current members by state and district
export const getMembersByState = async (state: string, district?: string) => {
  try {
    // Get all members for the state
    const response = await fetch(
      apiUrl(`/member/congress/${CURRENT_CONGRESS}/${state.toUpperCase()}`)
    );
    
    if (!response.ok) {
      console.error('Failed to fetch members from Congress.gov');
      return [];
    }

    const data = await response.json();
    const members: Member[] = [];

    // Process members
    if (data.members) {
      data.members.forEach((member: any) => {
        // Filter for current chamber members
        const memberData: Member = {
          bioguide_id: member.bioguideId,
          name: member.name,
          state: state.toUpperCase(),
          district: member.district || null,
          party: member.partyName?.charAt(0) || 'I',
          chamber: member.chamber?.toLowerCase() || 'house',
          image_url: member.depiction?.imageUrl || null,
          website: null,
          phone: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Add senator or matching district representative
        if (!district || !member.district || member.district === district) {
          members.push(memberData);
        }
      });
    }

    return members;
  } catch (error) {
    console.error('Error fetching members:', error);
    return [];
  }
};

// Get recent bills
export const getRecentBills = async (limit: number = 20): Promise<Bill[]> => {
  try {
    const response = await fetch(
      apiUrl(`/bill/${CURRENT_CONGRESS}?limit=${limit}&format=json`)
    );

    if (!response.ok) {
      console.error('Failed to fetch bills from Congress.gov');
      return [];
    }

    const data = await response.json();
    const bills: Bill[] = [];

    if (data.bills) {
      for (const bill of data.bills) {
        bills.push({
          bill_id: `${bill.type}-${bill.number}`,
          congress_number: CURRENT_CONGRESS,
          title: bill.title,
          summary: null, // Will need separate API call for full details
          status: bill.latestAction?.text || 'Unknown',
          introduced_date: bill.introducedDate,
          sponsor_id: null,
          last_action: bill.latestAction?.text,
          last_action_date: bill.latestAction?.actionDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    return bills;
  } catch (error) {
    console.error('Error fetching bills:', error);
    return [];
  }
};

// Get bill details including summary
export const getBillDetails = async (billType: string, billNumber: string): Promise<Bill | null> => {
  try {
    const response = await fetch(
      apiUrl(`/bill/${CURRENT_CONGRESS}/${billType.toLowerCase()}/${billNumber}`)
    );

    if (!response.ok) {
      console.error('Failed to fetch bill details');
      return null;
    }

    const data = await response.json();
    const bill = data.bill;

    if (!bill) return null;

    // Get summary if available
    let summary = null;
    if (bill.summaries?.count > 0) {
      const summaryResponse = await fetch(
        apiUrl(`/bill/${CURRENT_CONGRESS}/${billType.toLowerCase()}/${billNumber}/summaries`)
      );
      
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = summaryData.summaries?.[0]?.text || null;
      }
    }

    return {
      bill_id: `${billType.toUpperCase()}-${billNumber}`,
      congress_number: CURRENT_CONGRESS,
      title: bill.title,
      summary: summary,
      status: bill.latestAction?.text || 'Unknown',
      introduced_date: bill.introducedDate,
      sponsor_id: bill.sponsors?.[0]?.bioguideId || null,
      last_action: bill.latestAction?.text,
      last_action_date: bill.latestAction?.actionDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching bill details:', error);
    return null;
  }
};

// Get member details
export const getMemberDetails = async (bioguideId: string): Promise<Member | null> => {
  try {
    const response = await fetch(
      apiUrl(`/member/${bioguideId}`)
    );

    if (!response.ok) {
      console.error('Failed to fetch member details');
      return null;
    }

    const data = await response.json();
    const member = data.member;

    if (!member) return null;

    return {
      bioguide_id: member.bioguideId,
      name: member.directOrderName || member.officialName,
      state: member.state,
      district: member.district || null,
      party: member.partyName?.charAt(0) || 'I',
      chamber: member.terms?.[0]?.chamber?.toLowerCase() || 'house',
      image_url: member.depiction?.imageUrl || null,
      website: member.officialWebsiteUrl || null,
      phone: member.addressInformation?.phoneNumber || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching member details:', error);
    return null;
  }
};

// Get votes on a specific bill
export const getBillVotes = async (billType: string, billNumber: string) => {
  try {
    // Note: Congress.gov API doesn't directly provide roll call votes in the same way
    // You'd need to fetch from the amendments/actions endpoints and parse roll calls
    const response = await fetch(
      apiUrl(`/bill/${CURRENT_CONGRESS}/${billType.toLowerCase()}/${billNumber}/actions`)
    );

    if (!response.ok) {
      console.error('Failed to fetch bill actions');
      return [];
    }

    const data = await response.json();
    // Parse actions for vote information
    // This would require more complex parsing of action text
    
    return [];
  } catch (error) {
    console.error('Error fetching bill votes:', error);
    return [];
  }
};

// Search for members by zipcode (using state mapping)
export const getMembersByZipcode = async (zipcode: string, state: string, district?: string) => {
  const members: Member[] = [];
  
  try {
    // Get senators for the state
    const senatorsResponse = await fetch(
      apiUrl(`/member/congress/${CURRENT_CONGRESS}/${state}/senate`)
    );
    
    if (senatorsResponse.ok) {
      const senatorsData = await senatorsResponse.json();
      if (senatorsData.members) {
        senatorsData.members.forEach((senator: any) => {
          members.push({
            bioguide_id: senator.bioguideId,
            name: senator.name,
            state: state.toUpperCase(),
            district: null,
            party: senator.partyName?.charAt(0) || 'I',
            chamber: 'senate',
            image_url: senator.depiction?.imageUrl || null,
            website: null,
            phone: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        });
      }
    }

    // Get house representative for the district
    if (district) {
      const houseResponse = await fetch(
        apiUrl(`/member/congress/${CURRENT_CONGRESS}/${state}/house`)
      );
      
      if (houseResponse.ok) {
        const houseData = await houseResponse.json();
        if (houseData.members) {
          const districtRep = houseData.members.find((rep: any) => 
            rep.district === district
          );
          
          if (districtRep) {
            members.push({
              bioguide_id: districtRep.bioguideId,
              name: districtRep.name,
              state: state.toUpperCase(),
              district: district,
              party: districtRep.partyName?.charAt(0) || 'I',
              chamber: 'house',
              image_url: districtRep.depiction?.imageUrl || null,
              website: null,
              phone: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      }
    }

    return members;
  } catch (error) {
    console.error('Error fetching members by zipcode:', error);
    return members;
  }
};

// Generate activity feed from bills and members
export const generateActivityFromBills = (
  bills: Bill[], 
  members: Member[]
): ActivityFeedItem[] => {
  const activities: ActivityFeedItem[] = [];
  
  // Create mock activity for recent bills
  bills.forEach(bill => {
    if (bill.last_action_date) {
      activities.push({
        activity_date: bill.last_action_date,
        activity_type: 'bill',
        member_id: bill.sponsor_id || '',
        member_name: 'Congress',
        party: null,
        state: '',
        district: null,
        bill_id: bill.bill_id,
        bill_title: bill.title,
        bill_summary: bill.summary,
        vote: null,
        activity_id: `bill-${bill.bill_id}`
      });
    }
  });
  
  return activities.sort((a, b) => 
    new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime()
  );
};