// Supabase Edge Function for LegiScan API integration
// Provides real-time legislative tracking for all 50 states and Congress

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const LEGISCAN_API_KEY = Deno.env.get('LEGISCAN_API_KEY')
const LEGISCAN_API_BASE = 'https://api.legiscan.com'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check for API key
    if (!LEGISCAN_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LegiScan API key not configured' }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Parse request body
    const body = await req.json()
    const {
      endpoint,
      state,
      sessionId,
      billId,
      personId,
      query,
      year,
      page
    } = body

    let data = {}

    switch (endpoint) {
      case 'session-list': {
        // Get list of available sessions for a state
        const stateParam = state || 'US' // Default to federal
        const url = `${LEGISCAN_API_BASE}/?key=${LEGISCAN_API_KEY}&op=getSessionList&state=${stateParam}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`LegiScan API error: ${response.status}`)
        }

        const result = await response.json()

        if (result.status !== 'OK') {
          throw new Error(`LegiScan API error: ${result.alert?.message || 'Unknown error'}`)
        }

        data = {
          sessions: result.sessions || [],
          state: stateParam
        }
        break
      }

      case 'bill-list': {
        // Get bills for a specific session
        if (!sessionId) {
          throw new Error('sessionId is required for bill-list')
        }

        const url = `${LEGISCAN_API_BASE}/?key=${LEGISCAN_API_KEY}&op=getMasterList&id=${sessionId}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`LegiScan API error: ${response.status}`)
        }

        const result = await response.json()

        if (result.status !== 'OK') {
          throw new Error(`LegiScan API error: ${result.alert?.message || 'Unknown error'}`)
        }

        // Process and format bills
        const bills = Object.values(result.masterlist || {}).map((bill: any) => ({
          bill_id: bill.bill_id?.toString(),
          number: bill.number,
          title: bill.title,
          description: bill.description,
          state: bill.state,
          session: bill.session,
          status: bill.status,
          status_date: bill.status_date,
          last_action_date: bill.last_action_date,
          last_action: bill.last_action,
          url: bill.url,
          state_link: bill.state_link,
          completed: bill.completed,
          sponsors: bill.sponsors || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        data = { bills, sessionId }
        break
      }

      case 'bill-details': {
        // Get detailed information about a specific bill
        if (!billId) {
          throw new Error('billId is required for bill-details')
        }

        const url = `${LEGISCAN_API_BASE}/?key=${LEGISCAN_API_KEY}&op=getBill&id=${billId}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`LegiScan API error: ${response.status}`)
        }

        const result = await response.json()

        if (result.status !== 'OK') {
          throw new Error(`LegiScan API error: ${result.alert?.message || 'Unknown error'}`)
        }

        const bill = result.bill

        data = {
          bill: {
            bill_id: bill.bill_id?.toString(),
            number: bill.number,
            title: bill.title,
            description: bill.description,
            state: bill.state,
            session: bill.session,
            status: bill.status,
            status_date: bill.status_date,
            last_action_date: bill.last_action_date,
            last_action: bill.last_action,
            url: bill.url,
            state_link: bill.state_link,
            completed: bill.completed,
            sponsors: bill.sponsors || [],
            subjects: bill.subjects || [],
            texts: bill.texts || [],
            votes: bill.votes || [],
            amendments: bill.amendments || [],
            supplements: bill.supplements || [],
            calendar: bill.calendar || [],
            history: bill.history || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
        break
      }

      case 'bill-text': {
        // Get full text of a bill
        if (!billId) {
          throw new Error('billId is required for bill-text')
        }

        const url = `${LEGISCAN_API_BASE}/?key=${LEGISCAN_API_KEY}&op=getBillText&id=${billId}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`LegiScan API error: ${response.status}`)
        }

        const result = await response.json()

        if (result.status !== 'OK') {
          throw new Error(`LegiScan API error: ${result.alert?.message || 'Unknown error'}`)
        }

        data = {
          text: result.text,
          bill_id: billId,
          retrieved_at: new Date().toISOString()
        }
        break
      }

      case 'people': {
        // Get list of legislators for a session
        if (!sessionId) {
          throw new Error('sessionId is required for people')
        }

        const url = `${LEGISCAN_API_BASE}/?key=${LEGISCAN_API_KEY}&op=getPeopleList&id=${sessionId}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`LegiScan API error: ${response.status}`)
        }

        const result = await response.json()

        if (result.status !== 'OK') {
          throw new Error(`LegiScan API error: ${result.alert?.message || 'Unknown error'}`)
        }

        const people = Object.values(result.people || {}).map((person: any) => ({
          person_id: person.people_id?.toString(),
          name: person.name,
          first_name: person.first_name,
          middle_name: person.middle_name,
          last_name: person.last_name,
          suffix: person.suffix,
          nickname: person.nickname,
          district: person.district,
          party: person.party,
          role: person.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        data = { people, sessionId }
        break
      }

      case 'person-detail': {
        // Get detailed information about a legislator
        if (!personId) {
          throw new Error('personId is required for person-detail')
        }

        const url = `${LEGISCAN_API_BASE}/?key=${LEGISCAN_API_KEY}&op=getPerson&id=${personId}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`LegiScan API error: ${response.status}`)
        }

        const result = await response.json()

        if (result.status !== 'OK') {
          throw new Error(`LegiScan API error: ${result.alert?.message || 'Unknown error'}`)
        }

        data = { person: result.person }
        break
      }

      case 'search': {
        // Search bills using LegiScan's full-text search
        if (!query) {
          throw new Error('query is required for search')
        }

        const searchState = state || 'ALL'
        const searchYear = year || new Date().getFullYear()
        const searchPage = page || 1

        const url = `${LEGISCAN_API_BASE}/?key=${LEGISCAN_API_KEY}&op=getSearch&state=${searchState}&bill=${encodeURIComponent(query)}&year=${searchYear}&page=${searchPage}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`LegiScan API error: ${response.status}`)
        }

        const result = await response.json()

        if (result.status !== 'OK') {
          throw new Error(`LegiScan API error: ${result.alert?.message || 'Unknown error'}`)
        }

        const searchResults = (result.searchresult || []).map((item: any) => ({
          bill_id: item.bill_id?.toString(),
          number: item.bill_number,
          title: item.bill_title,
          description: item.bill_description,
          state: item.state,
          year: item.year,
          relevance: item.relevance,
          url: item.url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        data = {
          results: searchResults,
          query,
          state: searchState,
          year: searchYear,
          page: searchPage,
          summary: result.summary
        }
        break
      }

      case 'sponsored-list': {
        // Get bills sponsored by a specific person
        if (!personId) {
          throw new Error('personId is required for sponsored-list')
        }

        const url = `${LEGISCAN_API_BASE}/?key=${LEGISCAN_API_KEY}&op=getSponsoredList&id=${personId}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`LegiScan API error: ${response.status}`)
        }

        const result = await response.json()

        if (result.status !== 'OK') {
          throw new Error(`LegiScan API error: ${result.alert?.message || 'Unknown error'}`)
        }

        const sponsoredBills = Object.values(result.bills || {}).map((bill: any) => ({
          bill_id: bill.bill_id?.toString(),
          number: bill.number,
          title: bill.title,
          description: bill.description,
          state: bill.state,
          session: bill.session,
          status: bill.status,
          status_date: bill.status_date,
          last_action_date: bill.last_action_date,
          last_action: bill.last_action,
          url: bill.url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        data = { bills: sponsoredBills, personId }
        break
      }

      default:
        throw new Error(`Unknown endpoint: ${endpoint}`)
    }

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('LegiScan API error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})