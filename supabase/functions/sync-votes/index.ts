import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body for specific bill ID if provided
    const { billId } = await req.json().catch(() => ({ billId: null }))

    let votesToSync = []

    if (billId) {
      // Fetch votes for a specific bill
      // Note: This would require parsing congressional roll call votes
      // For MVP, we'll simulate with sample data
      console.log(`Fetching votes for bill: ${billId}`)
      
      // In production, you would fetch from:
      // https://api.congress.gov/v3/bill/{congress}/{billType}/{billNumber}/actions
      // Then parse roll call votes from the actions
      
      // For now, return sample vote data
      votesToSync = generateSampleVotes(billId)
    } else {
      // Fetch recent votes from all bills
      // This would typically involve fetching recent roll calls
      // from https://api.congress.gov/v3/nomination
      
      // For MVP, generate sample recent votes
      const { data: recentBills } = await supabase
        .from('bills')
        .select('bill_id')
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentBills) {
        for (const bill of recentBills) {
          votesToSync.push(...generateSampleVotes(bill.bill_id))
        }
      }
    }

    // Insert votes into database
    if (votesToSync.length > 0) {
      const { data, error } = await supabase
        .from('votes')
        .upsert(votesToSync, { 
          onConflict: 'bill_id,member_id',
          ignoreDuplicates: true 
        })
        .select()

      if (error) {
        console.error('Error upserting votes:', error)
        throw error
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Synced ${votesToSync.length} votes`,
          votes: data
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'No new votes to sync' 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in sync-votes function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      }
    )
  }
})

// Helper function to generate sample votes (for MVP)
function generateSampleVotes(billId: string) {
  // Sample member IDs from our seed data
  const memberIds = [
    'D000399', // Danny K. Davis
    'G000586', // Jesús García
    'K000385', // Robin Kelly
    'Q000023', // Mike Quigley
    'R000515', // Bobby Rush
    'S001190', // Bradley Schneider
    'F000454', // Bill Foster
    'C001117', // Sean Casten
    'N000189', // Marie Newman
    'S001208', // Jan Schakowsky
    'D000563', // Dick Durbin
    'D000622', // Tammy Duckworth
  ]

  const voteOptions = ['YES', 'NO', 'NOT_VOTING', 'PRESENT']
  const votes = []

  // Generate random votes for some members
  const votingMembers = memberIds.slice(0, Math.floor(Math.random() * 5) + 3)
  
  for (const memberId of votingMembers) {
    votes.push({
      bill_id: billId,
      member_id: memberId,
      vote: voteOptions[Math.floor(Math.random() * 2)], // Mostly YES/NO
      vote_date: new Date().toISOString().split('T')[0]
    })
  }

  return votes
}