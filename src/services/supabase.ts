import { createClient } from '@supabase/supabase-js';
import type { 
  District, 
  Member, 
  Bill, 
  Vote, 
  Peg, 
  Attribution, 
  ActivityFeedItem, 
  Sentiment 
} from '../types';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'placeholder-key';

// Only create client if we have real credentials
export const supabase = (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) 
  ? null as any 
  : createClient(supabaseUrl, supabaseAnonKey);

// Make supabase available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}

// Helper function to calculate sentiment
export const calculateSentiment = (pegs: Pick<Peg, 'sentiment'>[]): Sentiment => {
  const approve = pegs.filter(p => p.sentiment === 'approve').length;
  const disapprove = pegs.filter(p => p.sentiment === 'disapprove').length;
  const total = pegs.length;
  const percentage = total > 0 
    ? Math.round(((approve - disapprove) / total) * 100)
    : 0;

  return {
    approve,
    disapprove,
    total,
    percentage
  };
};


// Get district information from zipcode
export const getDistrict = async (zipcode: string): Promise<District | null> => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('districts')
    .select('*')
    .eq('zipcode', zipcode)
    .single();

  if (error) {
    console.error('Error fetching district:', error);
    return null;
  }

  return data;
};

// No mock data - always use real API data

// Get user's representatives based on zipcode
export const getMyReps = async (zipcode: string): Promise<Member[]> => {
  // Always return empty array if no Supabase - let the Dashboard fetch real data
  if (!supabase) {
    return [];
  }

  // First get the district
  const district = await getDistrict(zipcode);
  if (!district) return [];

  // Then get the representatives
  const { data: reps, error } = await supabase
    .from('members')
    .select('*')
    .or(
      district.district 
        ? `and(state.eq.${district.state},district.eq.${district.district}),and(state.eq.${district.state},chamber.eq.senate)`
        : `state.eq.${district.state},chamber.eq.senate`
    );

  if (error) {
    console.error('Error fetching representatives:', error);
    return [];
  }

  return reps || [];
};

// No mock activity - always use real API data

// Get personalized activity feed
export const getActivityFeed = async (
  zipcode: string, 
  limit: number = 20,
  offset: number = 0
): Promise<ActivityFeedItem[]> => {
  // Return empty array if no Supabase - let Dashboard fetch real data
  if (!supabase) {
    return [];
  }

  const reps = await getMyReps(zipcode);
  const repIds = reps.map(r => r.bioguide_id);

  if (repIds.length === 0) return [];

  const { data, error } = await supabase
    .from('activity_feed')
    .select('*')
    .in('member_id', repIds)
    .range(offset, offset + limit - 1)
    .order('activity_date', { ascending: false });

  if (error) {
    console.error('Error fetching activity feed:', error);
    return [];
  }

  return data || [];
};

// Get bills with pagination
export const getBills = async (
  limit: number = 20,
  offset: number = 0,
  filter?: {
    status?: string;
    sponsor_id?: string;
    search?: string;
  }
): Promise<Bill[]> => {
  let query = supabase
    .from('bills')
    .select('*, sponsor:members!bills_sponsor_id_fkey(*)')
    .range(offset, offset + limit - 1)
    .order('introduced_date', { ascending: false });

  if (filter?.status) {
    query = query.eq('status', filter.status);
  }
  if (filter?.sponsor_id) {
    query = query.eq('sponsor_id', filter.sponsor_id);
  }
  if (filter?.search) {
    query = query.or(`title.ilike.%${filter.search}%,summary.ilike.%${filter.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching bills:', error);
    return [];
  }

  return data || [];
};

// Get bill with vote information
export const getBillWithVotes = async (
  billId: string, 
  zipcode?: string
): Promise<Bill & { votes: Vote[]; totalSentiment: Sentiment; localSentiment?: Sentiment } | null> => {
  // Get bill with votes
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .select(`
      *,
      sponsor:members!bills_sponsor_id_fkey(*),
      votes (
        *,
        member:members!votes_member_id_fkey(*)
      )
    `)
    .eq('bill_id', billId)
    .single();

  if (billError || !bill) {
    console.error('Error fetching bill:', billError);
    return null;
  }

  // Get sentiment for this bill
  const { data: pegs } = await supabase
    .from('pegs')
    .select('sentiment')
    .eq('target_type', 'bill')
    .eq('target_id', billId);

  const totalSentiment = calculateSentiment(pegs || []);

  // Get local sentiment if zipcode provided
  let localSentiment: Sentiment | undefined;
  if (zipcode) {
    const { data: localPegs } = await supabase
      .from('pegs')
      .select('sentiment')
      .eq('target_type', 'bill')
      .eq('target_id', billId)
      .eq('zipcode', zipcode);

    localSentiment = calculateSentiment(localPegs || []);
  }

  return {
    ...bill,
    totalSentiment,
    localSentiment
  };
};

// Add a peg (user opinion)
export const addPeg = async (peg: Omit<Peg, 'id' | 'created_at'>): Promise<Peg | null> => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('pegs')
    .insert([peg])
    .select()
    .single();

  if (error) {
    console.error('Error adding peg:', error);
    return null;
  }

  // Trigger attribution recalculation (in a real app, this would be an edge function)
  if (data) {
    // For MVP, we'll just log this
    console.log('Attribution calculation triggered for peg:', data.id);
  }

  return data;
};

// Get member with attribution score
export const getMemberWithAttribution = async (
  memberId: string,
  zipcode?: string
): Promise<Member & { attribution?: Attribution } | null> => {
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('*')
    .eq('bioguide_id', memberId)
    .single();

  if (memberError || !member) {
    console.error('Error fetching member:', memberError);
    return null;
  }

  if (zipcode) {
    const { data: attribution } = await supabase
      .from('attribution')
      .select('*')
      .eq('member_id', memberId)
      .eq('zipcode', zipcode)
      .single();

    return {
      ...member,
      attribution: attribution || undefined
    };
  }

  return member;
};

// Subscribe to real-time updates
export const subscribeToFeed = (
  zipcode: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`feed-${zipcode}`)
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'votes' 
      },
      async (payload: any) => {
        // Check if this vote is from user's reps
        const reps = await getMyReps(zipcode);
        const repIds = reps.map(r => r.bioguide_id);
        if (repIds.includes(payload.new.member_id)) {
          callback(payload);
        }
      }
    )
    .subscribe();
};

// Get user's peg history
export const getUserPegs = async (
  sessionId: string,
  limit: number = 50
): Promise<Peg[]> => {
  const { data, error } = await supabase
    .from('pegs')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching user pegs:', error);
    return [];
  }

  return data || [];
};

// Get alignment score between user and representative
export const getAlignmentScore = async (
  sessionId: string,
  memberId: string
): Promise<number> => {
  if (!supabase) {
    return 0;
  }

  // Get all bills the member voted on
  const { data: memberVotes } = await supabase
    .from('votes')
    .select('bill_id, vote')
    .eq('member_id', memberId);

  if (!memberVotes || memberVotes.length === 0) return 0;

  // Get user's pegs on those bills
  const billIds = memberVotes.map((v: any) => v.bill_id);
  const { data: userPegs } = await supabase
    .from('pegs')
    .select('target_id, sentiment')
    .eq('session_id', sessionId)
    .eq('target_type', 'bill')
    .in('target_id', billIds);

  if (!userPegs || userPegs.length === 0) return 0;

  // Calculate alignment
  let aligned = 0;
  let total = 0;

  userPegs.forEach((peg: any) => {
    const vote = memberVotes.find((v: any) => v.bill_id === peg.target_id);
    if (vote) {
      total++;
      const voteAligns = 
        (peg.sentiment === 'approve' && vote.vote === 'YES') ||
        (peg.sentiment === 'disapprove' && vote.vote === 'NO');
      if (voteAligns) aligned++;
    }
  });

  return total > 0 ? Math.round((aligned / total) * 100) : 0;
};


// Get trending bills (most pegged)
export const getTrendingBills = async (
  limit: number = 10,
  zipcode?: string
): Promise<(Bill & { peg_count: number })[]> => {
  if (!supabase) {
    return [];
  }

  let query = supabase
    .from('pegs')
    .select('target_id')
    .eq('target_type', 'bill');

  if (zipcode) {
    query = query.eq('zipcode', zipcode);
  }

  const { data: pegs } = await query;

  if (!pegs || pegs.length === 0) return [];

  // Count pegs per bill
  const pegCounts = pegs.reduce((acc: any, peg: any) => {
    acc[peg.target_id] = (acc[peg.target_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get top bills
  const topBillIds = Object.entries(pegCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, limit)
    .map(([id]) => id);

  const { data: bills } = await supabase
    .from('bills')
    .select('*, sponsor:members!bills_sponsor_id_fkey(*)')
    .in('bill_id', topBillIds);

  if (!bills) return [];

  // Add peg counts and sort
  return bills
    .map((bill: any) => ({
      ...bill,
      peg_count: pegCounts[bill.bill_id] || 0
    }))
    .sort((a: any, b: any) => b.peg_count - a.peg_count);
};