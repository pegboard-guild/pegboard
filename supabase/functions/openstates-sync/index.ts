// @ts-nocheck
// Supabase Edge Function: OpenStates Nightly Sync (bills only, minimal)
// Syncs recent state bills into Supabase for fast dashboard reads.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Minimal Deno type fallback for local linting
declare const Deno: { env: { get: (name: string) => string | undefined } }

const OPENSTATES_API_KEY = Deno.env.get('OPENSTATES_API_KEY') ?? ''
const BASE_URL = 'https://v3.openstates.org'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!OPENSTATES_API_KEY) return json({ error: 'Server not configured' }, 500)

    const { state = 'TX', limit = 50, session } = await safeJson(req)
    const jurisdiction = `ocd-jurisdiction/country:us/state:${String(state).toLowerCase()}/government`

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch recent bills
    const bills = await fetchOpenStates('/bills', {
      jurisdiction,
      per_page: String(limit),
      sort: 'updated_desc',
      ...(session ? { session } : {})
    })

    let upserted = 0
    for (const bill of bills.results ?? []) {
      const { error } = await supabase.from('state_bills').upsert({
        bill_id: bill.id,
        state: bill.jurisdiction?.name ?? state,
        session: bill.session ?? null,
        identifier: bill.identifier,
        title: bill.title ?? null,
        abstract: bill.abstract ?? null,
        classification: bill.classification ?? null,
        subjects: bill.subject ?? null,
        status: bill.latest_action?.description ?? null,
        introduced_date: bill.introduced_date ?? null,
        sponsor_id: bill.sponsors?.[0]?.person?.id ?? null,
        sponsor_name: bill.sponsors?.[0]?.name ?? null,
        chamber: bill.from_organization?.classification === 'upper' ? 'upper' : 'lower',
        latest_action_description: bill.latest_action?.description ?? null,
        latest_action_date: bill.latest_action?.date ?? null,
        openstates_url: bill.openstates_url ?? null,
        full_text_url: bill.sources?.[0]?.url ?? null,
        updated_at: new Date().toISOString()
      })
      if (!error) upserted++
    }

    return json({ state, fetched: bills.results?.length ?? 0, upserted })
  } catch (_err) {
    return json({ error: 'Sync failed' }, 500)
  }
})

async function fetchOpenStates(path: string, params: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'X-API-KEY': OPENSTATES_API_KEY, 'Accept': 'application/json' }
  })
  if (!res.ok) throw new Error(`OpenStates error: ${res.status}`)
  return res.json()
}

async function safeJson(req: Request): Promise<any> {
  try { return await req.json() } catch { return {} }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}


