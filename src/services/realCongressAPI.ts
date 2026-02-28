// Service to fetch REAL Congress data through Supabase Edge Functions
// This gets actual, current data from Congress.gov API

import { Member, Bill, ActivityFeedItem } from '../types';

// Use Supabase Edge Function in production, local proxy as fallback
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://yurdvlcxednoaikrljbh.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const USE_SUPABASE = SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('placeholder');

const API_URL = USE_SUPABASE 
  ? `${SUPABASE_URL}/functions/v1/congress-api`
  : 'http://localhost:3001';

// Get real members from Congress.gov
export async function getRealMembersByState(state: string, district?: string): Promise<Member[]> {
  try {
    const endpoint = USE_SUPABASE ? API_URL : `${API_URL}/api/members-by-state`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (USE_SUPABASE) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    }
    
    const body = USE_SUPABASE 
      ? JSON.stringify({ endpoint: 'members-by-state', state, district })
      : JSON.stringify({ state, district });
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch members: ${response.status}`);
    }

    const data = await response.json();
    console.log('Real Congress.gov members:', data.members);
    return data.members || [];
  } catch (error) {
    console.error('Error fetching real members:', error);
    throw error;
  }
}

// Get real bills from Congress.gov
export async function getRealBills(): Promise<Bill[]> {
  try {
    let response;
    
    if (USE_SUPABASE) {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ endpoint: 'recent-bills' })
      });
    } else {
      response = await fetch(`${API_URL}/api/recent-bills`);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch bills: ${response.status}`);
    }

    const data = await response.json();
    console.log('Real Congress.gov bills:', data.bills);
    return data.bills || [];
  } catch (error) {
    console.error('Error fetching real bills:', error);
    throw error;
  }
}

// Generate activity feed from real data
export function generateRealActivityFeed(
  members: Member[], 
  bills: Bill[]
): ActivityFeedItem[] {
  const activities: ActivityFeedItem[] = [];
  
  // Create activity items from real bills
  bills.slice(0, 10).forEach(bill => {
    // For each bill, show activity from our representatives
    members.forEach(member => {
      if (bill.last_action_date) {
        activities.push({
          activity_date: bill.last_action_date,
          activity_type: 'bill',
          member_id: member.bioguide_id,
          member_name: member.name,
          party: member.party,
          state: member.state,
          district: member.district,
          bill_id: bill.bill_id,
          bill_title: bill.title,
          bill_summary: bill.summary,
          vote: null, // Real votes would come from a votes endpoint
          activity_id: `${bill.bill_id}-activity`
        });
      }
    });
  });
  
  // Sort by date, most recent first
  return activities.sort((a, b) => 
    new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime()
  ).slice(0, 20);
}