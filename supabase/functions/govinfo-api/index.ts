// Supabase Edge Function for GovInfo API integration
// Provides access to federal bills, laws, regulations, and documents

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

// GovInfo uses the same API key as api.data.gov
const GOVINFO_API_KEY =
  Deno.env.get('API_DATA_GOV_KEY') ||
  Deno.env.get('GOVINFO_API_KEY') ||
  '72XLT8pbvwej9U18d1al6xvkmK5Ll0fXIlxsC1Uc'
const GOVINFO_API_BASE = 'https://api.govinfo.gov'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check for API key
    if (!GOVINFO_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GovInfo API key not configured' }),
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
    const { endpoint, congress, billType, billNumber, dateIssued, pageSize, offsetMark } = body

    let data = {}

    switch (endpoint) {
      case 'bills': {
        // Get bills for a specific date or congress
        // Use date format for GovInfo API (e.g., 2024-01-01T00:00:00Z)
        const dateParam = dateIssued || '2024-01-01T00:00:00Z'
        const url = `${GOVINFO_API_BASE}/collections/BILLS/${dateParam}?api_key=${GOVINFO_API_KEY}&pageSize=${pageSize || 100}&offsetMark=${offsetMark || '*'}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`GovInfo API error: ${response.status}`)
        }

        const result = await response.json()

        // Process and format bills
        const bills = (result.packages || []).map((pkg: any) => ({
          bill_id: pkg.packageId,
          title: pkg.title,
          congress_number: pkg.congress,
          date_issued: pkg.dateIssued,
          package_link: pkg.packageLink,
          last_modified: pkg.lastModified,
          government_author: pkg.governmentAuthor1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        data = {
          bills,
          pagination: {
            count: result.count,
            message: result.message,
            nextPage: result.nextPage,
            previousPage: result.previousPage
          }
        }
        break
      }

      case 'bill-details': {
        // Get specific bill details
        if (!billType || !billNumber || !congress) {
          throw new Error('billType, billNumber, and congress are required for bill-details')
        }

        const packageId = `BILLS-${congress}${billType.toLowerCase()}${billNumber}`
        const url = `${GOVINFO_API_BASE}/packages/${packageId}/summary?api_key=${GOVINFO_API_KEY}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`GovInfo API error: ${response.status}`)
        }

        const result = await response.json()

        data = {
          bill: {
            bill_id: packageId,
            title: result.title,
            congress_number: result.congress,
            date_issued: result.dateIssued,
            summary: result.summary,
            package_link: result.packageLink,
            download_link: result.download?.premiumLink || result.download?.txtLink,
            last_modified: result.lastModified,
            government_author: result.governmentAuthor1,
            branch: result.branch,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
        break
      }

      case 'recent-bills': {
        // Get recently published bills
        const today = new Date()
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        // GovInfo expects an ISO date with time component, e.g. 2024-01-01T00:00:00Z
        const baseDate = dateIssued || thirtyDaysAgo.toISOString().split('T')[0]
        const dateFilter = baseDate.includes('T') ? baseDate : `${baseDate}T00:00:00Z`

        const url = `${GOVINFO_API_BASE}/collections/BILLS/${dateFilter}?api_key=${GOVINFO_API_KEY}&pageSize=${pageSize || 20}&offsetMark=${offsetMark || '*'}`
        console.log('GovInfo recent-bills URL:', url)
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`GovInfo API error: ${response.status}`)
        }

        const result = await response.json()

        const bills = (result.packages || []).map((pkg: any) => ({
          bill_id: pkg.packageId,
          title: pkg.title,
          congress_number: pkg.congress,
          date_issued: pkg.dateIssued,
          package_link: pkg.packageLink,
          last_modified: pkg.lastModified,
          government_author: pkg.governmentAuthor1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        data = { bills }
        break
      }

      case 'congressional-record': {
        // Get Congressional Record entries
        const url = `${GOVINFO_API_BASE}/collections/CREC?api_key=${GOVINFO_API_KEY}&pageSize=${pageSize || 50}&offsetMark=${offsetMark || '*'}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`GovInfo API error: ${response.status}`)
        }

        const result = await response.json()

        const records = (result.packages || []).map((pkg: any) => ({
          record_id: pkg.packageId,
          title: pkg.title,
          date_issued: pkg.dateIssued,
          package_link: pkg.packageLink,
          last_modified: pkg.lastModified,
          branch: pkg.branch,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        data = {
          records,
          pagination: {
            count: result.count,
            nextPage: result.nextPage,
            previousPage: result.previousPage
          }
        }
        break
      }

      case 'bill-text': {
        // Get bill full text
        if (!billType || !billNumber || !congress) {
          throw new Error('billType, billNumber, and congress are required for bill-text')
        }

        const packageId = `BILLS-${congress}${billType.toLowerCase()}${billNumber}`
        const url = `${GOVINFO_API_BASE}/packages/${packageId}/htm?api_key=${GOVINFO_API_KEY}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`GovInfo API error: ${response.status}`)
        }

        const htmlContent = await response.text()

        data = {
          bill_id: packageId,
          full_text: htmlContent,
          format: 'html',
          retrieved_at: new Date().toISOString()
        }
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
    console.error('GovInfo API error:', error)
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