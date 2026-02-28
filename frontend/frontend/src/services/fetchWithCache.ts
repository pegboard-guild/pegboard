// fetchWithCache.ts
// Universal API caching layer per ChatGPT5 Pro's recommendation

import { supabase } from '../supabaseClient';

interface CacheConfig {
  source: string;  // 'openstates', 'congress', 'fec', etc.
  ttlSeconds?: number;  // Override default TTL
  forceRefresh?: boolean;  // Bypass cache
}

interface CacheResult<T> {
  data: T | null;
  error: string | null;
  cacheHit: boolean;
  expiresAt: Date | null;
}

/**
 * Generate stable cache key from source, URL, and params
 * Using browser-compatible hashing
 */
async function generateCacheKey(source: string, url: string, params: any = {}): Promise<string> {
  // Normalize params by sorting keys
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as any);

  const keyData = {
    source,
    url,
    params: sortedParams
  };

  // Use Web Crypto API for browser-compatible hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(keyData));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Fetch data with automatic caching through Supabase
 */
export async function fetchWithCache<T = any>(
  url: string,
  config: CacheConfig,
  fetchOptions: RequestInit = {}
): Promise<CacheResult<T>> {
  const cacheKey = await generateCacheKey(config.source, url, fetchOptions.body);

  // Skip cache if forced refresh
  if (!config.forceRefresh) {
    // Try to get from cache first
    const { data: cached, error: cacheError } = await supabase
      .rpc('get_cached_api_response', {
        p_key: cacheKey,
        p_source: config.source,
        p_url: url,
        p_params: fetchOptions.body || {}
      });

    if (cached && cached.length > 0 && cached[0].cache_hit) {
      const result = cached[0];
      return {
        data: result.body as T,
        error: result.error,
        cacheHit: true,
        expiresAt: result.expires_at ? new Date(result.expires_at) : null
      };
    }
  }

  // Cache miss or forced refresh - fetch from API
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers
      }
    });

    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');

    let data: T | null = null;
    let error: string | null = null;

    if (response.ok) {
      data = await response.json();
    } else {
      error = `HTTP ${response.status}: ${response.statusText}`;
    }

    // Get TTL from config or database
    let ttlSeconds = config.ttlSeconds;
    if (!ttlSeconds) {
      const { data: ttlData } = await supabase
        .rpc('get_cache_ttl', {
          p_source: config.source,
          p_url: url
        });
      ttlSeconds = ttlData || 3600;  // Default 1 hour
    }

    // Store in cache
    await supabase.rpc('store_api_response', {
      p_key: cacheKey,
      p_source: config.source,
      p_url: url,
      p_params: fetchOptions.body || {},
      p_status: response.status,
      p_body: data,
      p_ttl_seconds: ttlSeconds,
      p_etag: etag,
      p_last_modified: lastModified ? new Date(lastModified).toISOString() : null,
      p_error: error
    });

    return {
      data,
      error,
      cacheHit: false,
      expiresAt: new Date(Date.now() + ttlSeconds! * 1000)
    };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    // Store error in cache with shorter TTL
    await supabase.rpc('store_api_response', {
      p_key: cacheKey,
      p_source: config.source,
      p_url: url,
      p_params: fetchOptions.body || {},
      p_status: 0,
      p_body: null,
      p_ttl_seconds: 300,  // 5 minutes for errors
      p_error: errorMessage
    });

    return {
      data: null,
      error: errorMessage,
      cacheHit: false,
      expiresAt: new Date(Date.now() + 300000)
    };
  }
}

/**
 * Batch fetch with cache - useful for loading multiple resources
 */
export async function batchFetchWithCache<T = any>(
  requests: Array<{ url: string; config: CacheConfig; options?: RequestInit }>,
  maxConcurrent: number = 3
): Promise<Array<CacheResult<T>>> {
  const results: Array<CacheResult<T>> = [];

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < requests.length; i += maxConcurrent) {
    const batch = requests.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(req => fetchWithCache<T>(req.url, req.config, req.options))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Prefetch and warm cache for common queries
 */
export async function warmCache(source: string, urls: string[]): Promise<void> {
  const requests = urls.map(url => ({
    url,
    config: { source },
    options: {}
  }));

  await batchFetchWithCache(requests, 5);
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats() {
  const { data: stats } = await supabase
    .from('api_cache_stats')
    .select('*');

  const { data: hitRate } = await supabase
    .from('api_cache_hit_rate')
    .select('*');

  return {
    stats,
    hitRate
  };
}

/**
 * Clear expired cache entries
 */
export async function purgeExpiredCache(): Promise<void> {
  await supabase.rpc('purge_api_cache');
}

// Export helper to check if we should use bulk for a partition
export async function shouldUseBulk(partitionId: string): Promise<boolean> {
  const { data } = await supabase
    .from('data_partitions')
    .select('ingest_mode')
    .eq('id', partitionId)
    .single();

  return data?.ingest_mode === 'bulk';
}