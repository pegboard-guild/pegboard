// Supabase Edge Function: OpenStates API Proxy
// Purpose: Server-side proxy to keep API keys secure and allow limited, safe passthrough

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const BASE_URL = 'https://v3.openstates.org'
const OPENSTATES_API_KEY = Deno.env.get('OPENSTATES_API_KEY') ?? ''

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!OPENSTATES_API_KEY) {
      return json({ error: 'Server not configured' }, 500)
    }

    const { endpoint, params = {} } = await req.json()

    let path = ''
    const q = new URLSearchParams()

    switch (endpoint) {
      case 'jurisdictions': {
        path = '/jurisdictions'
        if (params.per_page) q.set('per_page', String(params.per_page))
        break
      }

      case 'bills': {
        path = '/bills'
        const allowed = ['jurisdiction', 'session', 'per_page', 'sort', 'q', 'subject', 'classification']
        for (const key of allowed) {
          if (params[key]) q.set(key, String(params[key]))
        }
        break
      }

      case 'bill-details': {
        if (!params.billId) return json({ error: 'billId required' }, 400)
        path = `/bills/${params.billId}`
        break
      }

      case 'bill-votes': {
        if (!params.billId) return json({ error: 'billId required' }, 400)
        path = `/bills/${params.billId}/votes`
        break
      }

      case 'people-geo': {
        path = '/people.geo'
        const allowed = ['lat', 'lng', 'per_page']
        for (const key of allowed) {
          if (params[key]) q.set(key, String(params[key]))
        }
        break
      }

      default:
        return json({ error: 'Unknown endpoint' }, 400)
    }

    const url = `${BASE_URL}${path}${q.toString() ? `?${q}` : ''}`
    const upstream = await fetch(url, {
      headers: {
        'X-API-KEY': OPENSTATES_API_KEY,
        'Accept': 'application/json'
      }
    })

    if (!upstream.ok) {
      return json({ error: 'Upstream error', status: upstream.status }, upstream.status)
    }

    const body = await upstream.text()
    return new Response(body, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (_err) {
    // Avoid leaking details
    return json({ error: 'Server error' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}


