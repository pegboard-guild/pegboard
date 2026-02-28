import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DATASET_URL = 'https://www.dallasopendata.com/resource/ts5d-gdq6.json';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchVotes(limit: number, offset: number): Promise<Response> {
  const qp = new URLSearchParams({
    '$select': 'date,agenda_item_description,voter_name,district,vote,final_action_taken,agenda_item_number,item_type',
    '$where': 'date IS NOT NULL AND agenda_item_description IS NOT NULL',
    '$order': 'date DESC',
    '$limit': String(limit),
    '$offset': String(offset)
  });
  const headers: HeadersInit = { 'Accept': 'application/json' };
  const token = Deno.env.get('SOCRATA_APPTOKEN');
  if (token) headers['X-App-Token'] = token;
  return fetch(`${DATASET_URL}?${qp}`, { headers });
}

function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { limit = 20, offset = 0 } = await req.json().catch(() => ({ limit: 20, offset: 0 }));

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

    const params = { limit, offset };
    const paramsHash = await sha256Hex(stableStringify(params));
    const cacheKey = `dallas:council_votes:${paramsHash}`;
    const ttlSeconds = 86400; // 24h

    if (supabase) {
      const { data: cached } = await supabase
        .from('api_cache')
        .select('body, expires_at')
        .eq('key', cacheKey)
        .single();
      if (cached && new Date(cached.expires_at) > new Date()) {
        return new Response(JSON.stringify({ data: cached.body, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache-Status': 'HIT', 'X-Upstream-Status': 'cached' }
        });
      }
    }

    const resp = await fetchVotes(limit, offset);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'Upstream error', status: resp.status, body: text }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Upstream-Status': String(resp.status) } });
    }
    const data = await resp.json();

    if (supabase) {
      const expires = new Date();
      expires.setSeconds(expires.getSeconds() + ttlSeconds);
      await supabase.from('api_cache').upsert({
        key: cacheKey,
        source: 'dallas_opendata',
        url: DATASET_URL,
        params,
        status: 200,
        body: data,
        fetched_at: new Date().toISOString(),
        expires_at: expires.toISOString(),
        last_accessed: new Date().toISOString()
      });
    }

    return new Response(JSON.stringify({ data, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache-Status': 'MISS', 'X-Upstream-Status': '200' }
    });
  } catch (e) {
    console.error('dallas-council-votes error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Upstream-Status': 'error' } });
  }
});


