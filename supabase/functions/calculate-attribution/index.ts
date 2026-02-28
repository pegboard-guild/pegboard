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

    // Parse request body
    const { peg_id, member_id, zipcode } = await req.json()

    // If peg_id is provided, process attribution for that specific peg
    if (peg_id) {
      // Get the peg details
      const { data: peg, error: pegError } = await supabase
        .from('pegs')
        .select('*')
        .eq('id', peg_id)
        .single()

      if (pegError || !peg) {
        throw new Error('Peg not found')
      }

      // If the peg is for a bill, find all members who voted on it
      if (peg.target_type === 'bill') {
        const { data: votes } = await supabase
          .from('votes')
          .select('member_id, vote')
          .eq('bill_id', peg.target_id)

        if (votes) {
          // Calculate attribution for each member who voted
          for (const vote of votes) {
            await updateMemberAttribution(
              supabase,
              vote.member_id,
              peg.zipcode,
              peg.sentiment,
              vote.vote
            )
          }
        }
      } else if (peg.target_type === 'member') {
        // Direct peg on a member
        await updateMemberAttribution(
          supabase,
          peg.target_id,
          peg.zipcode,
          peg.sentiment,
          null
        )
      }
    }

    // If member_id and zipcode are provided, recalculate full attribution
    if (member_id && zipcode) {
      await recalculateFullAttribution(supabase, member_id, zipcode)
    }

    // If only zipcode is provided, recalculate for all members in that area
    if (zipcode && !member_id) {
      // Get all representatives for this zipcode
      const { data: district } = await supabase
        .from('districts')
        .select('state, district')
        .eq('zipcode', zipcode)
        .single()

      if (district) {
        const { data: members } = await supabase
          .from('members')
          .select('bioguide_id')
          .or(
            district.district 
              ? `and(state.eq.${district.state},district.eq.${district.district}),and(state.eq.${district.state},chamber.eq.senate)`
              : `state.eq.${district.state},chamber.eq.senate`
          )

        if (members) {
          for (const member of members) {
            await recalculateFullAttribution(supabase, member.bioguide_id, zipcode)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Attribution calculated successfully'
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
    console.error('Error in calculate-attribution function:', error)
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

async function updateMemberAttribution(
  supabase: any,
  memberId: string,
  zipcode: string,
  sentiment: string,
  vote: string | null
) {
  // Get current attribution
  const { data: currentAttribution } = await supabase
    .from('attribution')
    .select('*')
    .eq('member_id', memberId)
    .eq('zipcode', zipcode)
    .single()

  let directPegs = currentAttribution?.direct_pegs || 0
  let indirectPegs = currentAttribution?.indirect_pegs || 0

  // Update peg counts
  if (vote) {
    // Indirect peg (through bill vote)
    indirectPegs++
  } else {
    // Direct peg on member
    directPegs++
  }

  // Calculate new sentiment score
  // For MVP, simple calculation: approve = +1, disapprove = -1
  const totalPegs = directPegs + indirectPegs
  const sentimentValue = sentiment === 'approve' ? 1 : -1
  
  let newScore = currentAttribution?.sentiment_score || 0
  if (totalPegs > 0) {
    // Weighted average with more weight on direct pegs
    const weight = vote ? 0.5 : 1.0
    newScore = ((newScore * (totalPegs - 1)) + (sentimentValue * weight)) / totalPegs
    newScore = Math.max(-1, Math.min(1, newScore)) // Clamp between -1 and 1
  }

  // Upsert attribution
  const { error } = await supabase
    .from('attribution')
    .upsert({
      member_id: memberId,
      zipcode: zipcode,
      direct_pegs: directPegs,
      indirect_pegs: indirectPegs,
      sentiment_score: newScore,
      last_calculated: new Date().toISOString()
    }, {
      onConflict: 'member_id,zipcode'
    })

  if (error) {
    console.error('Error updating attribution:', error)
  }
}

async function recalculateFullAttribution(
  supabase: any,
  memberId: string,
  zipcode: string
) {
  // Get all pegs for this member in this zipcode
  const { data: directPegs } = await supabase
    .from('pegs')
    .select('sentiment')
    .eq('target_type', 'member')
    .eq('target_id', memberId)
    .eq('zipcode', zipcode)

  // Get all bill pegs where this member voted
  const { data: memberVotes } = await supabase
    .from('votes')
    .select('bill_id, vote')
    .eq('member_id', memberId)

  let indirectPegCount = 0
  let totalSentiment = 0

  if (memberVotes) {
    const billIds = memberVotes.map(v => v.bill_id)
    
    const { data: billPegs } = await supabase
      .from('pegs')
      .select('target_id, sentiment')
      .eq('target_type', 'bill')
      .in('target_id', billIds)
      .eq('zipcode', zipcode)

    if (billPegs) {
      indirectPegCount = billPegs.length
      
      // Calculate sentiment based on vote alignment
      billPegs.forEach(peg => {
        const vote = memberVotes.find(v => v.bill_id === peg.target_id)
        if (vote) {
          // If user approved bill and member voted YES, positive sentiment
          // If user disapproved bill and member voted NO, positive sentiment
          const aligned = 
            (peg.sentiment === 'approve' && vote.vote === 'YES') ||
            (peg.sentiment === 'disapprove' && vote.vote === 'NO')
          
          totalSentiment += aligned ? 0.5 : -0.5 // Indirect pegs have less weight
        }
      })
    }
  }

  // Calculate direct peg sentiment
  const directPegCount = directPegs?.length || 0
  directPegs?.forEach(peg => {
    totalSentiment += peg.sentiment === 'approve' ? 1 : -1
  })

  // Calculate final score
  const totalPegs = directPegCount + indirectPegCount
  const sentimentScore = totalPegs > 0 
    ? Math.max(-1, Math.min(1, totalSentiment / totalPegs))
    : 0

  // Update attribution
  const { error } = await supabase
    .from('attribution')
    .upsert({
      member_id: memberId,
      zipcode: zipcode,
      direct_pegs: directPegCount,
      indirect_pegs: indirectPegCount,
      sentiment_score: sentimentScore,
      last_calculated: new Date().toISOString()
    }, {
      onConflict: 'member_id,zipcode'
    })

  if (error) {
    console.error('Error recalculating attribution:', error)
  }
}