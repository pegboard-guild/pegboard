// GovInfo API Service - Access full legislative text and details
// Connects to existing Supabase Edge Function for GovInfo API

import { supabase } from './supabase';

export interface GovInfoBill {
  bill_id: string;
  title: string;
  congress_number: string;
  date_issued: string;
  summary?: string;
  package_link: string;
  download_link?: string;
  last_modified: string;
  government_author: string;
  branch: string;
  created_at: string;
  updated_at: string;
}

export interface GovInfoBillText {
  bill_id: string;
  full_text: string;
  format: 'html';
  retrieved_at: string;
}

export interface GovInfoBillsResponse {
  bills: GovInfoBill[];
  pagination?: {
    count: number;
    message: string;
    nextPage?: string;
    previousPage?: string;
  };
}

// Get recent bills from GovInfo API
export async function getRecentBills(pageSize: number = 20): Promise<GovInfoBillsResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('govinfo-api', {
      body: {
        endpoint: 'recent-bills',
        pageSize
      }
    });

    if (error) {
      console.error('Error fetching recent bills:', error);
      return { bills: [] };
    }

    return data;
  } catch (error) {
    console.error('Error calling govinfo-api:', error);
    return { bills: [] };
  }
}

// Get specific bill details
export async function getBillDetails(congress: string, billType: string, billNumber: string): Promise<GovInfoBill | null> {
  try {
    const { data, error } = await supabase.functions.invoke('govinfo-api', {
      body: {
        endpoint: 'bill-details',
        congress,
        billType,
        billNumber
      }
    });

    if (error) {
      console.error('Error fetching bill details:', error);
      return null;
    }

    return data.bill;
  } catch (error) {
    console.error('Error calling govinfo-api for bill details:', error);
    return null;
  }
}

// Get full bill text - THIS IS THE KEY FEATURE FOR PEGBOARD
export async function getBillText(congress: string, billType: string, billNumber: string): Promise<GovInfoBillText | null> {
  try {
    const { data, error } = await supabase.functions.invoke('govinfo-api', {
      body: {
        endpoint: 'bill-text',
        congress,
        billType,
        billNumber
      }
    });

    if (error) {
      console.error('Error fetching bill text:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error calling govinfo-api for bill text:', error);
    return null;
  }
}

// Search bills by congress year
export async function getBillsByCongress(congress: string = '2024', pageSize: number = 50): Promise<GovInfoBillsResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('govinfo-api', {
      body: {
        endpoint: 'bills',
        congress,
        pageSize
      }
    });

    if (error) {
      console.error('Error fetching bills by congress:', error);
      return { bills: [] };
    }

    return data;
  } catch (error) {
    console.error('Error calling govinfo-api for congress bills:', error);
    return { bills: [] };
  }
}

// Get Congressional Record entries
export async function getCongressionalRecord(pageSize: number = 20): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke('govinfo-api', {
      body: {
        endpoint: 'congressional-record',
        pageSize
      }
    });

    if (error) {
      console.error('Error fetching congressional record:', error);
      return { records: [] };
    }

    return data;
  } catch (error) {
    console.error('Error calling govinfo-api for congressional record:', error);
    return { records: [] };
  }
}

// Helper function to parse bill ID from various formats
export function parseBillId(billId: string): { congress: string; billType: string; billNumber: string } | null {
  // Handle formats like:
  // BILLS-118hr1234 (GovInfo format)
  // hr1234-118 (alternative format)
  // H.R. 1234 (display format)

  const govinfoMatch = billId.match(/BILLS-(\d+)([a-z]+)(\d+)/i);
  if (govinfoMatch) {
    return {
      congress: govinfoMatch[1],
      billType: govinfoMatch[2].toUpperCase(),
      billNumber: govinfoMatch[3]
    };
  }

  const altMatch = billId.match(/([a-z]+)(\d+)-(\d+)/i);
  if (altMatch) {
    return {
      billType: altMatch[1].toUpperCase(),
      billNumber: altMatch[2],
      congress: altMatch[3]
    };
  }

  const displayMatch = billId.match(/([A-Z])\.?([A-Z])\.?\s*(\d+)/);
  if (displayMatch) {
    return {
      congress: '119', // Default to current congress
      billType: displayMatch[1] + displayMatch[2],
      billNumber: displayMatch[3]
    };
  }

  return null;
}