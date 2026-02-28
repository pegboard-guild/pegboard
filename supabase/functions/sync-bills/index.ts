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

    // Fetch recent bills from congress.gov API
    // Note: congress.gov API v3 requires an API key for production use
    // For MVP, we're using the public endpoints with rate limiting
    const congress = 118 // Current congress number
    const limit = 20
    
    // Fetch recent bills
    const billsResponse = await fetch(
      `https://api.congress.gov/v3/bill/${congress}?limit=${limit}&format=json`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!billsResponse.ok) {
      throw new Error(`Failed to fetch bills: ${billsResponse.status}`)
    }

    const billsData = await billsResponse.json()
    
    // Transform and prepare bills for insertion
    const bills = []
    for (const bill of billsData.bills || []) {
      // Extract bill details
      const billId = `${bill.type}-${bill.number}`
      const billDetail = {
        bill_id: billId,
        congress_number: bill.congress,
        title: bill.title || 'No title provided',
        summary: null, // Will be fetched separately if needed
        status: bill.latestAction?.text || null,
        introduced_date: bill.introducedDate || null,
        sponsor_id: null, // Will need to map to bioguide ID
        last_action: bill.latestAction?.text || null,
        last_action_date: bill.latestAction?.actionDate || null,
      }
      
      bills.push(billDetail)
    }

    // Upsert bills into database
    if (bills.length > 0) {
      const { data, error } = await supabase
        .from('bills')
        .upsert(bills, { 
          onConflict: 'bill_id',
          ignoreDuplicates: false 
        })
        .select()

      if (error) {
        console.error('Error upserting bills:', error)
        throw error
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Synced ${bills.length} bills`,
          bills: data
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
        message: 'No new bills to sync' 
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
    console.error('Error in sync-bills function:', error)
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