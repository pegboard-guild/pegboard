import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CongressMember {
  bioguide_id: string;
  name: string;
  first_name: string;
  last_name: string;
  party: string;
  state: string;
  district?: string;
  chamber: 'house' | 'senate';
  in_office: boolean;
  terms?: Array<{
    start: string;
    end: string;
    type: string;
    state: string;
    district?: string;
    party: string;
  }>;
}

interface CongressAPIResponse {
  members: CongressMember[];
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { state, district, chamber } = await req.json()
    
    if (!state) {
      return new Response(
        JSON.stringify({ error: 'State is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Congress API key from environment
    const CONGRESS_API_KEY = Deno.env.get('CONGRESS_API_KEY')
    
    const members: CongressMember[] = []
    
    // Fetch current Congress members
    const currentCongress = 118 // Update this as needed
    
    // Get House members for specific district if provided
    if (chamber === 'house' || !chamber) {
      const houseUrl = `https://api.congress.gov/v3/member?api_key=${CONGRESS_API_KEY}&currentMember=true&limit=250`
      
      try {
        const houseResponse = await fetch(houseUrl)
        if (houseResponse.ok) {
          const houseData = await houseResponse.json()
          
          // Filter for the specific state and district
          const houseMembers = houseData.members.filter((member: any) => {
            const currentTerm = member.terms?.[member.terms.length - 1]
            return currentTerm?.state === state && 
                   currentTerm?.type === 'rep' &&
                   (!district || currentTerm?.district === district)
          }).map((member: any) => ({
            bioguide_id: member.bioguideId,
            name: `${member.firstName} ${member.lastName}`,
            first_name: member.firstName,
            last_name: member.lastName,
            party: member.partyName,
            state: state,
            district: member.terms?.[member.terms.length - 1]?.district,
            chamber: 'house' as const,
            in_office: true,
            terms: member.terms
          }))
          
          members.push(...houseMembers)
        }
      } catch (error) {
        console.error('Error fetching House members:', error)
      }
    }
    
    // Get Senate members
    if (chamber === 'senate' || !chamber) {
      const senateUrl = `https://api.congress.gov/v3/member?api_key=${CONGRESS_API_KEY}&currentMember=true&limit=250`
      
      try {
        const senateResponse = await fetch(senateUrl)
        if (senateResponse.ok) {
          const senateData = await senateResponse.json()
          
          // Filter for the specific state senators
          const senateMembers = senateData.members.filter((member: any) => {
            const currentTerm = member.terms?.[member.terms.length - 1]
            return currentTerm?.state === state && currentTerm?.type === 'sen'
          }).map((member: any) => ({
            bioguide_id: member.bioguideId,
            name: `${member.firstName} ${member.lastName}`,
            first_name: member.firstName,
            last_name: member.lastName,
            party: member.partyName,
            state: state,
            district: null,
            chamber: 'senate' as const,
            in_office: true,
            terms: member.terms
          }))
          
          members.push(...senateMembers)
        }
      } catch (error) {
        console.error('Error fetching Senate members:', error)
      }
    }
    
    // If no API key configured, return error
    if (members.length === 0 && !CONGRESS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Congress API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Initialize Supabase client for caching
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Cache the response
    const cacheKey = `congress_${state}_${district || 'all'}`
    await supabase.from('api_cache').upsert({
      cache_key: cacheKey,
      data: { members },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hour cache
    })

    return new Response(
      JSON.stringify({ members }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in congress-members function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

