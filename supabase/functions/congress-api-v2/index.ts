import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CONGRESS_API_KEY = Deno.env.get('CONGRESS_API_KEY') || '';
const API_BASE_URL = 'https://api.congress.gov/v3';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Intelligent cache strategies based on governmental cycles
const getCacheTTL = (endpoint: string): number => {
  // Parse the endpoint to determine content type
  const path = endpoint.split('?')[0].toLowerCase();

  // Members of Congress - cache until next election cycle
  if (path.includes('/member') && !path.includes('/sponsored-legislation')) {
    // Members serve 2-year (House) or 6-year (Senate) terms
    // Cache for 30 days - members rarely change mid-term
    return 86400 * 30; // 30 days
  }

  // Committee memberships - relatively stable within a session
  if (path.includes('/committee')) {
    return 86400 * 7; // 7 days
  }

  // Congress sessions - extremely stable
  if (path.includes('/congress')) {
    // Congress sessions last 2 years, cache for 90 days
    return 86400 * 90; // 90 days
  }

  // Bill text - once published, rarely changes
  if (path.includes('/text')) {
    return 86400 * 365; // 1 year - bill text is immutable once published
  }

  // Bill summaries - stable once written
  if (path.includes('/summaries')) {
    return 86400 * 30; // 30 days
  }

  // Amendments - stable once submitted
  if (path.includes('/amendment')) {
    return 86400 * 14; // 14 days
  }

  // Active legislation and recent bills - more dynamic
  if (path.includes('/bill')) {
    // Bills in current session - check more frequently
    if (path.includes('/119/') || path.includes('/118/')) { // Current Congress
      return 3600 * 6; // 6 hours for active legislation
    }
    // Older bills from previous congresses - very stable
    if (path.includes('/117/') || path.includes('/116/')) {
      return 86400 * 30; // 30 days for previous congress bills
    }
    // Default for bills
    return 3600 * 12; // 12 hours
  }

  // Sponsored legislation - updates when new bills are introduced
  if (path.includes('/sponsored-legislation')) {
    return 3600 * 24; // 24 hours
  }

  // Votes - stable once recorded
  if (path.includes('/vote')) {
    return 86400 * 365; // 1 year - votes don't change once cast
  }

  // Default fallback for unknown endpoints
  return 3600 * 4; // 4 hours default
};

// Enhanced cache implementation with intelligent TTLs
async function getCachedOrFetch(
  endpoint: string,
  fetcher: () => Promise<Response>,
  params?: Record<string, any>
): Promise<{ data: any; cached: boolean; cacheKey?: string }> {
  // Get Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    // Fallback to direct fetch if Supabase is not configured
    const response = await fetcher();
    const data = await response.json();
    return { data, cached: false };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Create stable, sorted cache key
  const sortedParams = Object.keys(params || {})
    .sort()
    .reduce((acc, key) => {
      acc[key] = params![key];
      return acc;
    }, {} as Record<string, any>);

  const cacheKey = `congress:${endpoint}?${new URLSearchParams(sortedParams)}`;

  // Generate hash for the key field (primary key)
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(cacheKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Generate params hash for metadata
  const paramsStr = JSON.stringify(sortedParams);
  const paramsBuffer = encoder.encode(paramsStr);
  const paramsHashBuffer = await crypto.subtle.digest('SHA-256', paramsBuffer);
  const paramsHashArray = Array.from(new Uint8Array(paramsHashBuffer));
  const paramsHash = paramsHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Determine appropriate TTL based on content
  const ttlSeconds = getCacheTTL(endpoint);
  const ttlHours = Math.round(ttlSeconds / 3600);

  try {
    // Check cache first using the actual schema
    console.log(`Checking cache for key: ${hashHex}`);
    const { data: cached, error } = await supabase
      .from('api_cache')
      .select('body, expires_at, last_accessed')
      .eq('cache_key', cacheKey)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Cache lookup error:', error);
    }

    const now = new Date();

    // Return cached data if still valid
    if (cached && !error && new Date(cached.expires_at) > now) {
      console.log(`Cache hit for ${endpoint} (TTL: ${ttlHours}h)`);

      // Update last accessed time
      await supabase
        .from('api_cache')
        .update({ last_accessed: now.toISOString(), hit_count: (cached.hit_count || 0) + 1 })
        .eq('cache_key', cacheKey);

      return { data: cached.body, cached: true, cacheKey: hashHex };
    }

    // Fetch fresh data
    console.log(`Cache miss for ${endpoint}, fetching fresh data (will cache for ${ttlHours}h)`);
    const response = await fetcher();

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Store in cache using the correct schema
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + ttlSeconds);

    const dataStr = JSON.stringify(data);
    const dataSize = dataStr.length;
    console.log(`Caching Congress data: key=${hashHex}, size=${dataSize}, ttl=${ttlSeconds}s`);

    const { data: upsertData, error: upsertError } = await supabase
      .from('api_cache')
      .upsert({
        key: hashHex,
        cache_key: cacheKey,
        api_name: 'congress',  // API identifier
        endpoint: endpoint.split('?')[0],  // Endpoint without params
        params_hash: paramsHash,  // Hash of parameters
        source: 'congress',
        url: `${API_BASE_URL}${endpoint}`,
        params: sortedParams,
        status: 200,
        status_code: 200,  // Explicit status code field
        size_bytes: dataSize,  // Size in bytes
        body: data,
        fetched_at: now.toISOString(),
        expires_at: expires.toISOString(),
        last_accessed: now.toISOString()
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Failed to cache data:', upsertError);
      console.error('Full error:', JSON.stringify(upsertError));
    } else {
      console.log('Successfully cached Congress data');
    }

    return { data, cached: false, cacheKey: hashHex };
  } catch (error) {
    console.error('Cache/fetch error:', error);
    // Try direct fetch as fallback
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
    const url = new URL(req.url);
    const path = url.pathname.replace('/congress-api-v2', '');

    // Build the full endpoint URL
    const endpoint = `${path}${url.search}`;

    // Build params object from query string
    const queryParams: Record<string, any> = {};
    url.searchParams.forEach((value, key) => {
      if (key !== 'api_key') {
        queryParams[key] = value;
      }
    });

    // Use cached fetch with intelligent TTLs
    const result = await getCachedOrFetch(
      endpoint,
      async () => {
        // Build upstream URL
        const upstreamUrl = new URL(`${API_BASE_URL}${path}`);

        // Copy all query parameters
        url.searchParams.forEach((value, key) => {
          if (key !== 'api_key') { // Don't duplicate api_key
            upstreamUrl.searchParams.append(key, value);
          }
        });

        // Add API key
        upstreamUrl.searchParams.append('api_key', CONGRESS_API_KEY);

        // Add format=json if not specified
        if (!upstreamUrl.searchParams.has('format')) {
          upstreamUrl.searchParams.append('format', 'json');
        }

        console.log(`Fetching from Congress.gov: ${upstreamUrl.pathname}${upstreamUrl.search}`);

        // Fetch from upstream
        return fetch(upstreamUrl.toString(), {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Pegboard/1.0'
          }
        });
      },
      queryParams
    );

    // Add cache info to response for monitoring
    const ttl = getCacheTTL(endpoint);
    const ttlHours = Math.round(ttl / 3600);
    const ttlDays = Math.round(ttl / 86400);

    // Return response with cache metadata
    // Return the full result object (with data and cached status)
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache-Status': result.cached ? 'HIT' : 'MISS',
        'X-Cache-TTL': ttlDays >= 1 ? `${ttlDays}d` : `${ttlHours}h`,
        'X-Cache-Strategy': ttl >= 86400 * 30 ? 'stable' : 'dynamic',
        'X-Cache-Key': result.cacheKey || 'none'  // Debug header
      }
    });

  } catch (error) {
    console.error('Congress API error:', error);

    // Return error response
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