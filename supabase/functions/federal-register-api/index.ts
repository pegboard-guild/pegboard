// Supabase Edge Function: Federal Register API Proxy
// Purpose: Server-side proxy for Federal Register API to track regulations and rules
// Now with intelligent caching to reduce API calls

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const BASE_URL = 'https://www.federalregister.gov/api/v1'

// Intelligent cache TTLs based on content type
const getCacheTTL = (endpoint: string): number => {
  switch (endpoint) {
    case 'agencies':
      // Agencies rarely change
      return 86400 * 30; // 30 days
    case 'executive-orders':
      // Executive orders are stable once published
      return 86400 * 7; // 7 days
    case 'document-details':
      // Document details are immutable once published
      return 86400 * 365; // 1 year
    case 'recent-documents':
    case 'documents-for-comment':
      // Active documents update more frequently
      return 3600 * 4; // 4 hours
    case 'search':
      // Search results cache for shorter time
      return 3600 * 2; // 2 hours
    default:
      return 3600 * 6; // 6 hours default
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
  const data = await response.json()

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
    const { endpoint, params = {} } = await req.json()

    let url = ''
    const q = new URLSearchParams()

    switch (endpoint) {
      case 'recent-documents': {
        url = `${BASE_URL}/documents`

        // Add query parameters
        if (params.type) q.set('conditions[type][]', params.type)
        if (params.agency) q.set('conditions[agencies][]', params.agency)
        if (params.per_page) q.set('per_page', String(params.per_page))
        if (params.page) q.set('page', String(params.page))

        // Default to recent documents
        if (!params.publication_date) {
          const today = new Date()
          const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30))
          q.set('conditions[publication_date][gte]', thirtyDaysAgo.toISOString().split('T')[0])
        } else {
          q.set('conditions[publication_date][gte]', params.publication_date)
        }
        break
      }

      case 'documents-for-comment': {
        url = `${BASE_URL}/documents`

        // Only documents open for comment
        q.set('conditions[accepting_comments_on_regulations_dot_gov]', '1')

        if (params.per_page) q.set('per_page', String(params.per_page))
        if (params.page) q.set('page', String(params.page))
        break
      }

      case 'executive-orders': {
        url = `${BASE_URL}/documents`

        // Filter for executive orders
        q.set('conditions[type][]', 'PRESDOCU')
        q.set('conditions[presidential_document_type][]', 'executive_order')

        if (params.per_page) q.set('per_page', String(params.per_page))
        if (params.page) q.set('page', String(params.page))

        // Default to recent
        if (!params.publication_date) {
          const today = new Date()
          const oneYearAgo = new Date(today.setFullYear(today.getFullYear() - 1))
          q.set('conditions[publication_date][gte]', oneYearAgo.toISOString().split('T')[0])
        }
        break
      }

      case 'document-details': {
        if (!params.documentNumber) {
          return new Response(
            JSON.stringify({ error: 'Document number required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
        url = `${BASE_URL}/documents/${params.documentNumber}`
        break
      }

      case 'agencies': {
        url = `${BASE_URL}/agencies`
        break
      }

      case 'search': {
        url = `${BASE_URL}/documents`

        if (params.query) q.set('conditions[term]', params.query)
        if (params.agency) q.set('conditions[agencies][]', params.agency)
        if (params.type) q.set('conditions[type][]', params.type)
        if (params.per_page) q.set('per_page', String(params.per_page))
        if (params.page) q.set('page', String(params.page))
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

    // Append query string if exists
    const queryString = q.toString()
    if (queryString) {
      url += `?${queryString}`
    }

    // Create cache key from endpoint and params
    const cacheKey = `federal_register:${endpoint}:${JSON.stringify(params)}`
    const ttl = getCacheTTL(endpoint)

    // Use cached data or fetch fresh
    const result = await getCachedOrFetch(
      cacheKey,
      ttl,
      () => fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      })
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
    console.error('Federal Register API error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})