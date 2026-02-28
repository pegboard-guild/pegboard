// Federal Register API Integration
// Tracks federal regulations, executive orders, and public notices
// Part of api.data.gov ecosystem

import { supabase } from './supabase';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'placeholder-key';

export interface FederalDocument {
  document_number: string;
  title: string;
  type: 'Rule' | 'Proposed Rule' | 'Notice' | 'Presidential Document' | 'Executive Order';
  abstract: string;
  publication_date: string;
  effective_date?: string;
  agencies: Array<{
    name: string;
    id: string;
    slug: string;
  }>;
  docket_ids: string[];
  topics: string[];
  html_url: string;
  pdf_url: string;
  public_comment_url?: string;
  comment_end_date?: string;
  regulation_id?: string;
}

export interface ExecutiveOrder {
  document_number: string;
  executive_order_number: string;
  title: string;
  signing_date: string;
  publication_date: string;
  disposition_notes?: string;
  president: {
    name: string;
    identifier: string;
  };
  full_text_url: string;
  pdf_url: string;
}

export interface PublicInspectionDocument {
  document_number: string;
  title: string;
  type: string;
  filed_at: string;
  publication_date: string;
  agencies: string[];
  num_pages: number;
  docket_ids: string[];
}

export interface AgencyInfo {
  name: string;
  slug: string;
  id: string;
  description: string;
  url: string;
  recent_articles_count: number;
  parent_agency?: {
    name: string;
    id: string;
  };
}

// Get recent federal documents (rules, notices, etc.)
export async function getRecentDocuments(options?: {
  agencies?: string[];
  documentType?: string;
  perPage?: number;
}): Promise<FederalDocument[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/federal-register-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'recent-documents',
        params: {
          type: options?.documentType,
          agency: options?.agencies?.[0],
          per_page: options?.perPage || 20
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Federal Register API error: ${response.status}`);
    }

    const data = await response.json();

    return (data.results || []).map((doc: any) => ({
      document_number: doc.document_number,
      title: doc.title,
      type: doc.type,
      abstract: doc.abstract,
      publication_date: doc.publication_date,
      effective_date: doc.effective_date,
      agencies: doc.agencies,
      docket_ids: doc.docket_ids || [],
      topics: doc.topics || [],
      html_url: doc.html_url,
      pdf_url: doc.pdf_url,
      public_comment_url: doc.regulations_dot_gov_info?.comments_url,
      comment_end_date: doc.comment_close_date,
      regulation_id: doc.regulation_id_number
    }));
  } catch (error) {
    console.error('Error fetching federal documents:', error);
    return [];
  }
}

// Get documents open for public comment
export async function getDocumentsOpenForComment(): Promise<FederalDocument[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/federal-register-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'documents-for-comment',
        params: {
          per_page: 50
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Federal Register API error: ${response.status}`);
    }

    const data = await response.json();

    return (data.results || []).map((doc: any) => ({
      document_number: doc.document_number,
      title: doc.title,
      type: doc.type,
      abstract: doc.abstract,
      publication_date: doc.publication_date,
      effective_date: doc.effective_date,
      agencies: doc.agencies,
      docket_ids: doc.docket_ids || [],
      topics: doc.topics || [],
      html_url: doc.html_url,
      pdf_url: doc.pdf_url,
      public_comment_url: doc.regulations_dot_gov_info?.comments_url,
      comment_end_date: doc.comment_close_date,
      regulation_id: doc.regulation_id_number
    }));
  } catch (error) {
    console.error('Error fetching documents for comment:', error);
    return [];
  }
}

// Get executive orders
export async function getExecutiveOrders(limit: number = 10): Promise<ExecutiveOrder[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/federal-register-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'executive-orders',
        params: {
          per_page: limit
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Federal Register API error: ${response.status}`);
    }

    const data = await response.json();

    return (data.results || []).map((order: any) => ({
      document_number: order.document_number,
      executive_order_number: order.executive_order_number,
      title: order.title,
      signing_date: order.signing_date,
      publication_date: order.publication_date,
      disposition_notes: order.disposition_notes,
      president: {
        name: order.president?.name || 'Unknown',
        identifier: order.president?.identifier || ''
      },
      full_text_url: order.html_url,
      pdf_url: order.pdf_url
    }));
  } catch (error) {
    console.error('Error fetching executive orders:', error);
    return [];
  }
}

// Get public inspection documents (upcoming publications)
export async function getPublicInspectionDocuments(): Promise<PublicInspectionDocument[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/federal-register-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'recent-documents',
        params: {
          per_page: 20
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Federal Register API error: ${response.status}`);
    }

    const data = await response.json();

    return (data.results || []).filter((doc: any) => doc.public_inspection_issue).map((doc: any) => ({
      document_number: doc.document_number,
      title: doc.title,
      type: doc.type,
      filed_at: doc.filed_at,
      publication_date: doc.publication_date,
      agencies: doc.agencies?.map((a: any) => a.name) || [],
      num_pages: doc.num_pages || 0,
      docket_ids: doc.docket_ids || []
    }));
  } catch (error) {
    console.error('Error fetching public inspection documents:', error);
    return [];
  }
}

// Search federal documents
export async function searchDocuments(query: string, options?: {
  agencies?: string[];
  documentType?: string;
  dateRange?: { start: string; end: string };
  perPage?: number;
}): Promise<FederalDocument[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/federal-register-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'search',
        params: {
          query,
          agency: options?.agencies?.[0],
          type: options?.documentType,
          per_page: options?.perPage || 20
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Federal Register API error: ${response.status}`);
    }

    const data = await response.json();

    return (data.results || []).map((doc: any) => ({
      document_number: doc.document_number,
      title: doc.title,
      type: doc.type,
      abstract: doc.abstract,
      publication_date: doc.publication_date,
      effective_date: doc.effective_date,
      agencies: doc.agencies,
      docket_ids: doc.docket_ids || [],
      topics: doc.topics || [],
      html_url: doc.html_url,
      pdf_url: doc.pdf_url,
      public_comment_url: doc.regulations_dot_gov_info?.comments_url,
      comment_end_date: doc.comment_close_date,
      regulation_id: doc.regulation_id_number
    }));
  } catch (error) {
    console.error('Error searching federal documents:', error);
    return [];
  }
}

// Get agencies list
export async function getAgencies(): Promise<AgencyInfo[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/federal-register-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'agencies',
        params: {}
      })
    });

    if (!response.ok) {
      throw new Error(`Federal Register API error: ${response.status}`);
    }

    const data = await response.json();

    return (data || []).map((agency: any) => ({
      name: agency.name,
      slug: agency.slug,
      id: agency.id,
      description: agency.description || '',
      url: agency.url || '',
      recent_articles_count: agency.recent_articles_count || 0,
      parent_agency: agency.parent_agency
    }));
  } catch (error) {
    console.error('Error fetching agencies:', error);
    return [];
  }
}

// Get document details
export async function getDocumentDetails(documentNumber: string): Promise<FederalDocument | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/federal-register-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: 'document-details',
        params: {
          documentNumber
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Federal Register API error: ${response.status}`);
    }

    const doc = await response.json();

    return {
      document_number: doc.document_number,
      title: doc.title,
      type: doc.type,
      abstract: doc.abstract,
      publication_date: doc.publication_date,
      effective_date: doc.effective_date,
      agencies: doc.agencies,
      docket_ids: doc.docket_ids || [],
      topics: doc.topics || [],
      html_url: doc.html_url,
      pdf_url: doc.pdf_url,
      public_comment_url: doc.regulations_dot_gov_info?.comments_url,
      comment_end_date: doc.comment_close_date,
      regulation_id: doc.regulation_id_number
    };
  } catch (error) {
    console.error('Error fetching document details:', error);
    return null;
  }
}