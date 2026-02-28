import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DistrictInfo {
  state: string;
  district?: string;
  city: string;
  zipcode: string;
  latitude: number;
  longitude: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { zipcode } = await req.json()
    
    if (!zipcode) {
      return new Response(
        JSON.stringify({ error: 'Zipcode is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 1: Get coordinates from zipcode using free API
    const geoResponse = await fetch(`https://api.zippopotam.us/us/${zipcode}`)
    if (!geoResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Invalid zipcode' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    const geoData = await geoResponse.json()
    const state = geoData.places[0]?.['state abbreviation']
    const city = geoData.places[0]?.['place name']
    const latitude = parseFloat(geoData.places[0]?.['latitude'])
    const longitude = parseFloat(geoData.places[0]?.['longitude'])
    
    if (!state || !latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: 'Could not determine location from zipcode' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 2: Get congressional district from Who Represents API (free)
    let district: string | undefined
    
    try {
      // Try WhoRepresents.us API (free)
      const whoRepsResponse = await fetch(
        `https://whorepresents.us/api/lookup?lat=${latitude}&lng=${longitude}`
      )
      
      if (whoRepsResponse.ok) {
        const whoRepsData = await whoRepsResponse.json()
        if (whoRepsData.house && whoRepsData.house.district) {
          district = whoRepsData.house.district.toString()
        }
      }
    } catch (error) {
      console.warn('WhoRepresents API failed:', error)
    }
    
    // Step 3: Fallback to Represent.us API if available
    if (!district) {
      try {
        const representResponse = await fetch(
          `https://represent.opennorth.ca/boundaries/?contains=${latitude},${longitude}`
        )
        
        if (representResponse.ok) {
          const representData = await representResponse.json()
          const congressionalBoundary = representData.objects?.find((boundary: any) => 
            boundary.boundary_set_name?.includes('congressional') || 
            boundary.boundary_set_name?.includes('house')
          )
          
          if (congressionalBoundary?.external_id) {
            const districtMatch = congressionalBoundary.external_id.match(/(\d+)/)
            if (districtMatch) {
              district = districtMatch[1]
            }
          }
        }
      } catch (error) {
        console.warn('Represent.us API failed:', error)
      }
    }
    
    // Step 4: If still no district, try Census.gov Geocoder API
    if (!district) {
      try {
        const censusResponse = await fetch(
          `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${longitude}&y=${latitude}&benchmark=Public_AR_Current&vintage=Current_Current&layers=8&format=json`
        )
        
        if (censusResponse.ok) {
          const censusData = await censusResponse.json()
          const geographies = censusData.result?.geographies
          const congressionalDistricts = geographies?.['116th Congressional Districts'] || 
                                      geographies?.['117th Congressional Districts'] ||
                                      geographies?.['118th Congressional Districts']
          
          if (congressionalDistricts && congressionalDistricts.length > 0) {
            const cd = congressionalDistricts[0]
            if (cd.CD) {
              // Convert to number and back to string to remove leading zeros
              district = parseInt(cd.CD, 10).toString()
            }
          }
        }
      } catch (error) {
        console.warn('Census API failed:', error)
      }
    }
    
    // If no district found, we can't proceed
    if (!district) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not determine congressional district for this location',
          state,
          city,
          zipcode,
          latitude,
          longitude
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const result: DistrictInfo = {
      state,
      district,
      city,
      zipcode,
      latitude,
      longitude
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in district-lookup function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})