import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const result: any = {
      env_check: {
        has_url: !!supabaseUrl,
        has_key: !!supabaseKey,
        url_value: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing'
      }
    };

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Test 1: Check if api_cache table exists
      const { data: tables, error: tableError } = await supabase
        .from('api_cache')
        .select('key')
        .limit(1);

      result.table_check = {
        exists: !tableError,
        error: tableError?.message || null
      };

      // Test 2: Try to insert a test record
      const testKey = `test:${Date.now()}`;
      const { data: inserted, error: insertError } = await supabase
        .from('api_cache')
        .insert({
          key: testKey,
          data: { test: true },
          expires_at: new Date(Date.now() + 3600000).toISOString()
        })
        .select()
        .single();

      result.insert_test = {
        success: !insertError,
        error: insertError?.message || null,
        key: inserted?.key || null
      };

      // Test 3: Try to read it back
      if (inserted) {
        const { data: read, error: readError } = await supabase
          .from('api_cache')
          .select('key, data')
          .eq('key', testKey)
          .single();

        result.read_test = {
          success: !readError,
          error: readError?.message || null,
          data: read || null
        };

        // Clean up
        await supabase
          .from('api_cache')
          .delete()
          .eq('key', testKey);
      }

      // Test 4: Count existing cache entries
      const { count, error: countError } = await supabase
        .from('api_cache')
        .select('*', { count: 'exact', head: true })
        .like('key', 'congress:%');

      result.cache_status = {
        congress_entries: count || 0,
        error: countError?.message || null
      };
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error',
        stack: error.stack
      }, null, 2),
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