import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

export interface CacheOptions {
  ttlSeconds: number;
  swrSeconds?: number;
  immutable?: boolean;
  tags?: string[];
}

export interface CacheResult {
  data: any;
  cached: boolean;
  status: number;
  headers?: Record<string, string>;
}

// Helper functions
function stableStringify(obj: any): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function logCacheEvent(
  supabase: any,
  kind: string,
  apiName: string,
  endpoint: string,
  paramsHash: string,
  status: number
): Promise<void> {
  try {
    await supabase
      .from('api_cache_events')
      .insert({
        kind,
        api_name: apiName,
        endpoint,
        params_hash: paramsHash,
        status
      });
  } catch (e) {
    console.error('Failed to log cache event:', e);
  }
}

async function incrementHitCount(supabase: any, key: string): Promise<void> {
  try {
    await supabase.rpc('increment_hit_count', { cache_key: key });
  } catch (e) {
    console.error('Failed to increment hit count:', e);
  }
}

async function revalidateInBackground(
  apiName: string,
  endpoint: string,
  params: Record<string, any>,
  fetcher: () => Promise<Response>,
  opts: CacheOptions
): Promise<void> {
  // Fire and forget - don't await
  setTimeout(async () => {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const paramsHash = await sha256Hex(stableStringify(params));
      const cacheKey = `${apiName}:${endpoint}:${paramsHash}`;
      const lockKey = `cache_lock:${cacheKey}`;

      // Try to acquire lock
      const { data: lockAcquired } = await supabase.rpc('cache_try_lock', { k: lockKey });

      if (!lockAcquired) {
        return; // Someone else is already revalidating
      }

      try {
        const response = await fetcher();
        const data = await response.json();
        const expiry = new Date();
        expiry.setSeconds(expiry.getSeconds() + opts.ttlSeconds);

        await supabase
          .from('api_cache')
          .upsert({
            key: cacheKey,
            api_name: apiName,
            endpoint: endpoint,
            params_hash: paramsHash,
            data: data,
            expires_at: opts.immutable ? '9999-12-31' : expiry.toISOString(),
            etag: response.headers.get('etag'),
            last_modified: response.headers.get('last-modified'),
            status_code: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            tags: opts.tags || [],
            size_bytes: JSON.stringify(data).length,
            refresh_strategy: opts.immutable ? 'immutable' : (opts.swrSeconds ? 'swr' : 'ttl')
          });

        await logCacheEvent(supabase, 'revalidate', apiName, endpoint, paramsHash, response.status);
      } finally {
        await supabase.rpc('cache_unlock', { k: lockKey });
      }
    } catch (e) {
      console.error('Background revalidation failed:', e);
    }
  }, 0);
}

export async function cachedFetch(
  apiName: string,
  endpoint: string,
  params: Record<string, any>,
  fetcher: () => Promise<Response>,
  opts: CacheOptions
): Promise<CacheResult> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const paramsHash = await sha256Hex(stableStringify(params));
  const cacheKey = `${apiName}:${endpoint}:${paramsHash}`;

  // 1. Check cache first
  const { data: cached, error: cacheError } = await supabase
    .from('api_cache')
    .select('*')
    .eq('api_name', apiName)
    .eq('endpoint', endpoint)
    .eq('params_hash', paramsHash)
    .single();

  if (cacheError && cacheError.code !== 'PGRST116') {
    console.error('Cache lookup error:', cacheError);
  }

  const now = new Date();

  // 2. Fresh cache hit
  if (cached && new Date(cached.expires_at) > now) {
    await logCacheEvent(supabase, 'hit', apiName, endpoint, paramsHash, 200);
    await incrementHitCount(supabase, cached.key);
    return {
      data: cached.data,
      cached: true,
      status: cached.status_code || 200,
      headers: cached.headers
    };
  }

  // 3. Stale-while-revalidate
  if (cached && opts.swrSeconds) {
    const swrExpiry = new Date(cached.expires_at);
    swrExpiry.setSeconds(swrExpiry.getSeconds() + opts.swrSeconds);

    if (swrExpiry > now) {
      // Return stale immediately, revalidate in background
      await logCacheEvent(supabase, 'stale', apiName, endpoint, paramsHash, 200);

      // Background revalidation (non-blocking)
      revalidateInBackground(apiName, endpoint, params, fetcher, opts);

      return {
        data: cached.data,
        cached: true,
        status: cached.status_code || 200,
        headers: cached.headers
      };
    }
  }

  // 4. Try to acquire lock (prevent stampede)
  const lockKey = `cache_lock:${cacheKey}`;
  const { data: lockAcquired } = await supabase.rpc('cache_try_lock', { k: lockKey });

  if (!lockAcquired && cached) {
    // Someone else is fetching, return stale if available
    console.log('Lock not acquired, returning stale data');
    return {
      data: cached.data,
      cached: true,
      status: cached.status_code || 200,
      headers: cached.headers
    };
  }

  try {
    // 5. Fetch with conditional headers
    const headers: HeadersInit = {};
    if (cached?.etag) headers['If-None-Match'] = cached.etag;
    if (cached?.last_modified) headers['If-Modified-Since'] = cached.last_modified;

    const response = await fetcher();

    // 6. Handle 304 Not Modified
    if (response.status === 304 && cached) {
      const newExpiry = new Date();
      newExpiry.setSeconds(newExpiry.getSeconds() + opts.ttlSeconds);

      await supabase
        .from('api_cache')
        .update({
          expires_at: newExpiry.toISOString(),
          last_accessed: now.toISOString()
        })
        .eq('key', cached.key);

      await logCacheEvent(supabase, 'revalidate', apiName, endpoint, paramsHash, 304);
      return {
        data: cached.data,
        cached: false,
        status: 304,
        headers: cached.headers
      };
    }

    // 7. Store new data
    const data = await response.json();
    const expiry = new Date();
    expiry.setSeconds(expiry.getSeconds() + opts.ttlSeconds);

    await supabase
      .from('api_cache')
      .upsert({
        key: cacheKey,
        api_name: apiName,
        endpoint: endpoint,
        params_hash: paramsHash,
        data: data,
        expires_at: opts.immutable ? '9999-12-31' : expiry.toISOString(),
        etag: response.headers.get('etag'),
        last_modified: response.headers.get('last-modified'),
        status_code: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        tags: opts.tags || [],
        size_bytes: JSON.stringify(data).length,
        refresh_strategy: opts.immutable ? 'immutable' : (opts.swrSeconds ? 'swr' : 'ttl'),
        last_accessed: now.toISOString(),
        hit_count: 0
      });

    await logCacheEvent(supabase, 'miss', apiName, endpoint, paramsHash, response.status);
    return {
      data,
      cached: false,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    };

  } catch (error) {
    // Log error and rethrow
    await logCacheEvent(supabase, 'error', apiName, endpoint, paramsHash, 500);
    throw error;
  } finally {
    // Always release lock
    try {
      await supabase.rpc('cache_unlock', { k: lockKey });
    } catch (e) {
      console.error('Failed to release lock:', e);
    }
  }
}

// Cache invalidation helpers
export async function invalidateByTag(tag: string): Promise<number> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data } = await supabase.rpc('cache_invalidate_by_tag', { tag });
  return data || 0;
}

export async function invalidateByPattern(apiName: string, endpointPattern: string): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  await supabase
    .from('api_cache')
    .delete()
    .eq('api_name', apiName)
    .like('endpoint', endpointPattern);
}

// Cache warming
export async function warmCache(
  apiName: string,
  endpoint: string,
  params: Record<string, any>,
  fetcher: () => Promise<Response>,
  opts: CacheOptions
): Promise<void> {
  // Force a cache miss to populate cache
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const paramsHash = await sha256Hex(stableStringify(params));

  // Delete existing cache entry
  await supabase
    .from('api_cache')
    .delete()
    .eq('api_name', apiName)
    .eq('endpoint', endpoint)
    .eq('params_hash', paramsHash);

  // Fetch and cache
  await cachedFetch(apiName, endpoint, params, fetcher, opts);
}