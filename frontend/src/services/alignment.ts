// Real alignment calculation service
// Calculates how well a citizen's views align with their representatives

import { supabase } from './supabase';

interface Vote {
  bill_id: string;
  vote: 'YES' | 'NO' | 'PRESENT' | null;
}

interface Peg {
  target_id: string;
  sentiment: 'approve' | 'disapprove';
}

// Calculate alignment between user's pegs and representative's votes
export async function calculateRealAlignment(
  sessionId: string,
  memberId: string
): Promise<number | null> {
  if (!supabase) {
    // If no Supabase, start with neutral 50%
    return 50;
  }

  try {
    // Get user's pegs (opinions on bills)
    const { data: userPegs, error: pegsError } = await supabase
      .from('pegs')
      .select('target_id, sentiment')
      .eq('session_id', sessionId)
      .eq('target_type', 'bill');

    if (pegsError || !userPegs || userPegs.length === 0) {
      // No opinions yet, start at neutral
      return 50;
    }

    // Get representative's actual votes on those same bills
    const billIds = userPegs.map((p: Peg) => p.target_id);
    const { data: repVotes, error: votesError } = await supabase
      .from('votes')
      .select('bill_id, vote')
      .eq('member_id', memberId)
      .in('bill_id', billIds);

    if (votesError || !repVotes || repVotes.length === 0) {
      // No matching votes found, return neutral
      return 50;
    }

    // Calculate alignment
    let matches = 0;
    let comparisons = 0;

    userPegs.forEach((peg: Peg) => {
      const repVote = repVotes.find((v: Vote) => v.bill_id === peg.target_id);
      if (repVote && repVote.vote !== 'PRESENT') {
        comparisons++;
        
        // User approved and rep voted YES = match
        // User disapproved and rep voted NO = match
        const userSupports = peg.sentiment === 'approve';
        const repSupports = repVote.vote === 'YES';
        
        if (userSupports === repSupports) {
          matches++;
        }
      }
    });

    // Calculate percentage
    if (comparisons === 0) return 50;
    const alignment = Math.round((matches / comparisons) * 100);
    
    // Store in attribution table for caching
    await supabase
      .from('attribution')
      .upsert({
        session_id: sessionId,
        member_id: memberId,
        alignment_score: alignment,
        total_pegs: comparisons,
        matching_pegs: matches,
        updated_at: new Date().toISOString()
      });

    return alignment;
  } catch (error) {
    console.error('Error calculating alignment:', error);
    return 50;
  }
}

// Get or calculate alignment for a member
export async function getMemberAlignment(
  sessionId: string,
  memberId: string
): Promise<number> {
  if (!supabase) return 50;

  try {
    // First check if we have a cached score
    const { data: cached, error } = await supabase
      .from('attribution')
      .select('alignment_score, updated_at')
      .eq('session_id', sessionId)
      .eq('member_id', memberId)
      .single();

    if (!error && cached) {
      // If cached score is less than 5 minutes old, use it
      const age = Date.now() - new Date(cached.updated_at).getTime();
      if (age < 5 * 60 * 1000) {
        return cached.alignment_score;
      }
    }

    // Calculate fresh alignment
    const alignment = await calculateRealAlignment(sessionId, memberId);
    return alignment || 50;
  } catch (error) {
    console.error('Error getting alignment:', error);
    return 50;
  }
}

// Initialize alignment when user starts
export function getInitialAlignment(): number {
  // Start everyone at neutral 50% until they express opinions
  return 50;
}