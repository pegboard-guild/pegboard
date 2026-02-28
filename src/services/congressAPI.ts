// Service to fetch real Congress data through Supabase Edge Functions
// This bypasses CORS by using server-side requests

import { Member, Bill } from '../types';

// You'll need to deploy the edge function and get your Supabase URL
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-anon-key';

// Call the Edge Function
async function callCongressAPI(endpoint: string, params: any = {}) {
  const url = `${SUPABASE_URL}/functions/v1/congress-api`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ endpoint, ...params })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Congress API error:', error);
    throw error;
  }
}

// Get members by state and district
export async function getRealCongressMembers(state: string, district?: string): Promise<Member[]> {
  try {
    const data = await callCongressAPI('members-by-state', { state, district });
    return data.members || [];
  } catch (error) {
    console.error('Error fetching members:', error);
    return [];
  }
}

// Get recent bills
export async function getRealCongressBills(): Promise<Bill[]> {
  try {
    const data = await callCongressAPI('recent-bills');
    return data.bills || [];
  } catch (error) {
    console.error('Error fetching bills:', error);
    return [];
  }
}

// Get bill details
export async function getRealBillDetails(billType: string, billNumber: string): Promise<Bill | null> {
  try {
    const data = await callCongressAPI('bill-details', { billType, billNumber });
    return data.bill || null;
  } catch (error) {
    console.error('Error fetching bill details:', error);
    return null;
  }
}