import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BASE_URL = 'https://v3.openstates.org';
const OPENSTATES_API_KEY = Deno.env.get('OPENSTATES_API_KEY') || '';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Intelligent cache TTLs for state/local government data
const getCacheTTL = (endpoint: string): number => {
  const path = endpoint.toLowerCase();

  // Jurisdictions - very stable, changes only with redistricting
  if (path.includes('jurisdictions')) {
    return 86400 * 90; // 90 days
  }

  // People/legislators - very stable, serve 2-4 year terms
  if (path.includes('/people')) {
    // State legislators serve multi-year terms, rarely change except elections
    return 86400 * 60; // 60 days - only changes: death, resignation, or elections
  }

  // Bills - depends on legislative session
  if (path.includes('/bills')) {
    // Check if it's a specific bill (rarely changes once introduced)
    if (path.match(/\/bills\/[^\/]+$/)) {
      return 86400 * 14; // 14 days for specific bills - text rarely changes after introduction
    }
    // Bill search/list - only updates when new bills introduced
    return 86400 * 1; // 24 hours for bill lists during session
  }

  // Votes - immutable once recorded
  if (path.includes('/votes')) {
    return 86400 * 365; // 1 year - votes don't change
  }

  // Events/hearings - very dynamic
  if (path.includes('/events')) {
    return 3600 * 2; // 2 hours for events
  }

  // Committees - relatively stable
  if (path.includes('/committees')) {
    return 86400 * 14; // 14 days
  }

  // Default fallback
  return 3600 * 6; // 6 hours default
};

// Enhanced cache implementation
async function getCachedOrFetch(
  endpoint: string,
  params: any,
  fetcher: () => Promise<Response>
): Promise<{ data: any; cached: boolean }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    const response = await fetcher();
    const data = await response.json();
    return { data, cached: false };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Create cache key including params
  const paramStr = JSON.stringify(params);
  const cacheKey = `openstates:${endpoint}:${paramStr}`;

  // Generate hash for key field (primary key in the cache table)
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(cacheKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const ttlSeconds = getCacheTTL(endpoint);
  const ttlHours = Math.round(ttlSeconds / 3600);

  try {
    // Check cache first using the actual schema
    console.log(`Checking cache for OpenStates: ${endpoint}`);
    const { data: cached, error } = await supabase
      .from('api_cache')
      .select('body, expires_at, last_accessed')
      .eq('key', hashHex)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Cache lookup error:', error);
    }

    const now = new Date();

    // Return cached data if still valid
    if (cached && !error && new Date(cached.expires_at) > now) {
      console.log(`Cache hit for ${endpoint} (TTL: ${ttlHours}h)`);

      // Update last accessed time
      await supabase
        .from('api_cache')
        .update({
          last_accessed: now.toISOString()
        })
        .eq('key', hashHex);

      return { data: cached.body, cached: true };
    }

    // Fetch fresh data
    console.log(`Cache miss for ${endpoint}, fetching fresh data`);
    const response = await fetcher();

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Store in cache using the correct schema
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + ttlSeconds);

    const dataSize = JSON.stringify(data).length;
    console.log(`Caching OpenStates data: key=${hashHex}, size=${dataSize}, ttl=${ttlSeconds}s`);

    const { error: upsertError } = await supabase
      .from('api_cache')
      .upsert({
        key: hashHex,
        source: 'openstates',
        url: `${BASE_URL}/${endpoint}`,
        params: params,
        status: 200,
        body: data,
        fetched_at: now.toISOString(),
        expires_at: expires.toISOString(),
        last_accessed: now.toISOString()
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Failed to cache data:', upsertError);
    } else {
      console.log('Successfully cached OpenStates data');
    }

    return { data, cached: false };
  } catch (error) {
    console.error('Cache/fetch error:', error);
    const response = await fetcher();
    const data = await response.json();
    return { data, cached: false };
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!OPENSTATES_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server not configured', cached: false }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { endpoint, params = {} } = await req.json();

    // Build the API path based on endpoint
    let path = '';
    const q = new URLSearchParams();

    switch (endpoint) {
      case 'jurisdictions': {
        path = '/jurisdictions';
        if (params.per_page) q.set('per_page', String(params.per_page));
        break;
      }

      case 'bills': {
        path = '/bills';
        const allowed = ['jurisdiction', 'session', 'per_page', 'sort', 'q', 'subject', 'classification'];
        for (const key of allowed) {
          if (params[key]) q.set(key, String(params[key]));
        }
        break;
      }

      case 'bill-details': {
        if (!params.billId) {
          return new Response(
            JSON.stringify({ error: 'billId required', cached: false }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        path = `/bills/${params.billId}`;
        break;
      }

      case 'legislators': {
        path = '/people';
        const allowed = ['jurisdiction', 'lat', 'lng', 'district', 'page', 'per_page'];
        for (const key of allowed) {
          if (params[key]) q.set(key, String(params[key]));
        }
        break;
      }

      case 'legislator-detail': {
        if (!params.id) {
          return new Response(
            JSON.stringify({ error: 'legislator id required', cached: false }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        path = `/people/${params.id}`;
        break;
      }

      case 'committees': {
        // Get committees for a jurisdiction
        if (!params.jurisdiction) {
          return new Response(
            JSON.stringify({ error: 'jurisdiction required', cached: false }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        path = '/committees';
        q.set('jurisdiction', params.jurisdiction);
        if (params.per_page) q.set('per_page', String(params.per_page));
        break;
      }

      case 'events': {
        // Get events for a jurisdiction
        if (!params.jurisdiction) {
          return new Response(
            JSON.stringify({ error: 'jurisdiction required', cached: false }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        path = '/events';
        q.set('jurisdiction', params.jurisdiction);
        if (params.per_page) q.set('per_page', String(params.per_page));
        if (params.start_date__gte) q.set('start_date__gte', params.start_date__gte);
        if (params.start_date__lte) q.set('start_date__lte', params.start_date__lte);
        if (params.sort) q.set('sort', params.sort);
        break;
      }

      case 'people-geo': {
        // Get legislators by geographic location
        if (!params.lat || !params.lng) {
          return new Response(
            JSON.stringify({ error: 'lat and lng required', cached: false }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        path = '/people.geo';
        q.set('lat', String(params.lat));
        q.set('lng', String(params.lng));
        if (params.per_page) q.set('per_page', String(params.per_page));
        break;
      }

      case 'people': {
        // Search people/legislators
        path = '/people';
        const allowedParams = ['jurisdiction', 'name', 'party', 'chamber', 'current_role', 'per_page'];
        for (const key of allowedParams) {
          if (params[key]) q.set(key, String(params[key]));
        }
        break;
      }

      default: {
        return new Response(
          JSON.stringify({ error: `Unknown endpoint: ${endpoint}`, cached: false }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Use cached fetch
    const fullPath = q.toString() ? `${path}?${q}` : path;

    const result = await getCachedOrFetch(
      fullPath,
      params,
      async () => {
        const url = `${BASE_URL}${fullPath}`;
        console.log(`Fetching from OpenStates: ${url}`);

        return fetch(url, {
          headers: {
            'X-API-KEY': OPENSTATES_API_KEY,
            'Accept': 'application/json'
          }
        });
      }
    );

    // Get cache info for headers
    const ttl = getCacheTTL(fullPath);
    const ttlHours = Math.round(ttl / 3600);
    const ttlDays = Math.round(ttl / 86400);

    // Return response with cache metadata
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache-Status': result.cached ? 'HIT' : 'MISS',
        'X-Cache-TTL': ttlDays >= 1 ? `${ttlDays}d` : `${ttlHours}h`,
        'X-Cache-Strategy': ttl >= 86400 * 30 ? 'stable' : 'dynamic'
      }
    });

  } catch (error) {
    console.error('OpenStates API error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        cached: false,
        data: null
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});