// Supabase Edge Function: USASpending API Proxy
// Purpose: Server-side proxy for USASpending.gov API to track government spending
// Now with intelligent caching to reduce API calls

// @ts-ignore - Deno runtime import for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Inline CORS headers to avoid cross-directory import issues during deploy
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const BASE_URL = 'https://api.usaspending.gov/api/v2'

// Intelligent cache TTLs based on data volatility
const getCacheTTL = (endpoint: string): number => {
  switch (endpoint) {
    case 'agency-spending':
      // Agency spending updates quarterly
      return 86400 * 7; // 7 days
    case 'federal-accounts':
      // Federal accounts are relatively stable
      return 86400 * 14; // 14 days
    case 'disaster-spending':
      // Disaster spending can update frequently during active disasters
      return 3600 * 6; // 6 hours
    case 'spending-by-zipcode':
    case 'awards-by-district':
      // Location-based spending updates periodically
      return 3600 * 12; // 12 hours
    case 'spending-trends':
      // Historical trends are stable
      return 86400 * 3; // 3 days
    case 'search-awards':
      // Search results cache for shorter time
      return 3600 * 4; // 4 hours
    default:
      return 3600 * 8; // 8 hours default
  }
}

// Cache implementation using Supabase
async function getCachedOrFetch(
  cacheKey: string,
  ttl: number,
  fetcher: () => Promise<Response>
): Promise<{ data: any; cached: boolean }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    // Fallback to direct fetch if Supabase not configured
    const response = await fetcher()
    const data = await response.json()
    return { data, cached: false }
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Check cache first
  const { data: cachedData, error: cacheError } = await supabase
    .from('api_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .single()

  if (!cacheError && cachedData && new Date(cachedData.expires_at) > new Date()) {
    console.log(`✅ Cache hit: ${cacheKey}`)

    // Update hit count
    await supabase
      .from('api_cache')
      .update({
        hit_count: (cachedData.hit_count || 0) + 1,
        last_accessed: new Date().toISOString()
      })
      .eq('cache_key', cacheKey)

    return { data: cachedData.data, cached: true }
  }

  console.log(`🔄 Cache miss or expired: ${cacheKey}`)

  // Fetch fresh data
  const response = await fetcher()
  const contentType = response.headers.get('content-type') || ''
  let data: any
  if (contentType.includes('application/json')) {
    data = await response.json()
  } else {
    const text = await response.text()
    try { data = JSON.parse(text) } catch { data = { error: 'Upstream returned non-JSON', preview: text.slice(0, 400) } }
  }

  // Store in cache
  const expiresAt = new Date(Date.now() + ttl * 1000)
  await supabase.from('api_cache').upsert({
    cache_key: cacheKey,
    data: data,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    hit_count: 0,
    last_accessed: new Date().toISOString()
  })

  return { data, cached: false }
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Simple retry helper for transient upstream errors
    const fetchWithRetry = async (
      input: Request | URL | string,
      init: RequestInit,
      retries = 2,
      baseDelayMs = 400,
      attemptTimeoutMs = 12000,
    ): Promise<Response> => {
      let attempt = 0
      while (true) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), attemptTimeoutMs)
        try {
          const res = await fetch(input, { ...init, signal: controller.signal })
          clearTimeout(timer)
          if ([429, 500, 502, 503, 504].includes(res.status) && attempt < retries) {
            const jitter = Math.floor(Math.random() * 100)
            const delay = baseDelayMs * Math.pow(3, attempt) + jitter
            await new Promise((r) => setTimeout(r, delay))
            attempt++
            continue
          }
          return res
        } catch (err) {
          clearTimeout(timer)
          if (attempt < retries) {
            const jitter = Math.floor(Math.random() * 100)
            const delay = baseDelayMs * Math.pow(3, attempt) + jitter
            await new Promise((r) => setTimeout(r, delay))
            attempt++
            continue
          }
          throw err
        }
      }
    }
    const { endpoint, params = {} } = await req.json()

    let url = ''
    let method = 'GET'
    let body: string | null = null

    switch (endpoint) {
      case 'spending-by-zipcode': {
        url = `${BASE_URL}/search/spending_by_geography/`
        method = 'POST'
        body = JSON.stringify({
          scope: 'place_of_performance',
          geo_layer: 'county',
          filters: {
            recipient_locations: [
              {
                country: 'USA',
                zip: params.zipcode
              }
            ],
            time_period: [
              {
                start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0]
              }
            ]
          }
        })
        break
      }

      case 'awards-by-district': {
        url = `${BASE_URL}/search/spending_by_award/`
        method = 'POST'
        const state = String(params.state || '').toUpperCase()
        const rawDistrict = String(params.district ?? '')
        const districtOnly = rawDistrict.replace(/\D/g, '')
        const paddedDistrict = (districtOnly || '00').padStart(2, '0')
        body = JSON.stringify({
          filters: {
            place_of_performance_locations: [
              {
                country: 'USA',
                state,
                district: paddedDistrict
              }
            ],
            time_period: [
              {
                start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0]
              }
            ]
          },
          // Keep the field list minimal; API may reject extraneous fields
          fields: [
            'Award ID',
            'Recipient Name',
            'Awarding Agency',
            'Award Amount',
            'Award Type',
            'Description',
            'Start Date',
            'End Date',
            'Place of Performance'
          ],
          page: 1,
          limit: 50
        })
        break
      }

      case 'agency-spending': {
        // Aggregate by awarding agency for the requested fiscal year using a stable endpoint
        const fiscalYear = params.fiscalYear || new Date().getFullYear()
        url = `${BASE_URL}/search/spending_by_category/`
        method = 'POST'
        body = JSON.stringify({
          category: 'agency',
          filters: {
            // Use FY form which this endpoint accepts consistently
            time_period: [ { fy: String(fiscalYear) } ],
            subawards: false
          },
          limit: 50,
          page: 1,
          sort: 'amount',
          order: 'desc'
        })
        break
      }

      case 'disaster-spending': {
        url = `${BASE_URL}/disaster/overview/`
        method = 'GET'
        break
      }

      case 'federal-accounts': {
        url = `${BASE_URL}/federal_accounts/`
        method = 'POST'
        body = JSON.stringify({
          filters: {
            fy: params.fiscalYear || new Date().getFullYear()
          },
          limit: 100
        })
        break
      }

      case 'spending-trends': {
        url = `${BASE_URL}/spending_over_time/`
        method = 'POST'
        body = JSON.stringify({
          group: 'month',
          filters: {
            time_period: [
              {
                start_date: params.start_date,
                end_date: params.end_date
              }
            ]
          }
        })
        break
      }

      case 'search-awards': {
        url = `${BASE_URL}/search/spending_by_award/`
        method = 'POST'
        // Normalize common filter shapes from the client
        const incoming = params.filters || {}
        const filters = {
          ...incoming,
          // accept keyword_search or keywords
          keywords: incoming.keywords || incoming.keyword_search || [],
        }
        body = JSON.stringify({
          filters,
          fields: [
            'Award ID',
            'Recipient Name',
            'Awarding Agency',
            'Total Obligation',
            'Award Type',
            'Description',
            'Start Date',
            'End Date'
          ],
          page: 1,
          limit: params.limit || 25,
          sort: 'Total Obligation',
          order: 'desc'
        })
        break
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid endpoint' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    }

    if (body) {
      options.body = body
    }

    // Create cache key from endpoint and params
    const cacheKey = `usaspending:${endpoint}:${JSON.stringify(params)}`
    const ttl = getCacheTTL(endpoint)

    // Use cached data or fetch fresh
    const result = await getCachedOrFetch(
      cacheKey,
      ttl,
      () => fetchWithRetry(url, options)
    )

    return new Response(
      JSON.stringify(result.data),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache-Status': result.cached ? 'HIT' : 'MISS'
        }
      }
    )

  } catch (error) {
    console.error('USASpending API error:', error)
    // Return empty shape to avoid breaking the UI, while surfacing error text
    return new Response(
      JSON.stringify({ results: [], error: (error as any)?.message || 'Internal error' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})