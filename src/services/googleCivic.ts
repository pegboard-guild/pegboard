// Google Civic Information API Integration
// Provides complete representative data at all levels of government

import { supabase } from './supabase';

// Google Civic API Configuration
const GOOGLE_CIVIC_API_KEY = process.env.REACT_APP_GOOGLE_CIVIC_API_KEY || '';
const GOOGLE_CIVIC_BASE_URL = 'https://www.googleapis.com/civicinfo/v2';

// Types for Google Civic API responses
export interface GoogleCivicOfficial {
  name: string;
  party?: string;
  phones?: string[];
  urls?: string[];
  photoUrl?: string;
  emails?: string[];
  channels?: Array<{
    type: string;
    id: string;
  }>;
  address?: Array<{
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
  }>;
}

export interface GoogleCivicOffice {
  name: string;
  divisionId: string;
  levels?: string[];
  roles?: string[];
  officialIndices: number[];
}

export interface GoogleCivicDivision {
  name: string;
  alsoKnownAs?: string[];
  officeIndices?: number[];
}

export interface GoogleCivicResponse {
  kind: string;
  normalizedInput: {
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  divisions: {
    [key: string]: GoogleCivicDivision;
  };
  offices: GoogleCivicOffice[];
  officials: GoogleCivicOfficial[];
}

// Enhanced Member type for multi-level support
export interface EnhancedMember {
  bioguide_id: string; // Using bioguide_id for compatibility with existing schema
  member_id: string; // Alias for bioguide_id
  full_name: string;
  party: string;
  chamber?: string;
  state?: string;
  district?: string;
  office_name: string;
  level: 'federal' | 'state' | 'local';
  division_id: string;
  photo_url?: string;
  phone?: string;
  email?: string;
  website?: string;
  social_media?: {
    twitter?: string;
    facebook?: string;
    youtube?: string;
  };
  google_civic_id?: string;
  in_office: boolean;
  next_election?: string;
  created_at: string;
  updated_at: string;
}

// Determine government level from division ID and office name
function determineLevel(divisionId: string, officeName: string): 'federal' | 'state' | 'local' {
  // Federal level
  if (divisionId.includes('/country:us') && !divisionId.includes('/state:')) {
    return 'federal';
  }
  if (officeName.toLowerCase().includes('u.s.') || 
      officeName.toLowerCase().includes('united states') ||
      officeName.toLowerCase().includes('president') ||
      officeName.toLowerCase().includes('vice president')) {
    return 'federal';
  }
  
  // State level
  if (divisionId.includes('/state:') && !divisionId.includes('/place:') && !divisionId.includes('/county:')) {
    return 'state';
  }
  if (officeName.toLowerCase().includes('state ') || 
      officeName.toLowerCase().includes('governor') ||
      officeName.toLowerCase().includes('lieutenant governor') ||
      officeName.toLowerCase().includes('attorney general') ||
      officeName.toLowerCase().includes('secretary of state')) {
    return 'state';
  }
  
  // Local level (city, county, district)
  return 'local';
}

// Generate consistent bioguide ID for compatibility
function generateBioguideId(official: GoogleCivicOfficial, office: string, level: string): string {
  const namePart = official.name.toLowerCase().replace(/[^a-z]/g, '');
  const officePart = office.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
  return `${level}-${officePart}-${namePart}`.slice(0, 50);
}

// Extract chamber from office name
function extractChamber(officeName: string): string | undefined {
  if (officeName.toLowerCase().includes('senate')) return 'Senate';
  if (officeName.toLowerCase().includes('house') || officeName.toLowerCase().includes('representative')) return 'House';
  return undefined;
}

// Extract state and district from division ID
function extractStateDistrict(divisionId: string): { state?: string; district?: string } {
  const stateMatch = divisionId.match(/state:([a-z]{2})/);
  const districtMatch = divisionId.match(/cd:(\d+)/);
  
  return {
    state: stateMatch ? stateMatch[1].toUpperCase() : undefined,
    district: districtMatch ? districtMatch[1] : undefined
  };
}

// Main function to get all representatives for a zipcode
export async function getAllRepresentatives(zipcode: string): Promise<{
  federal: EnhancedMember[];
  state: EnhancedMember[];
  local: EnhancedMember[];
  raw?: GoogleCivicResponse;
}> {
  
  try {
    // Check cache first
    if (supabase) {
      const cacheKey = `civic_${zipcode}`;
      const { data: cached } = await supabase
        .from('api_cache')
        .select('data')
        .eq('cache_key', cacheKey)
        .gte('expires_at', new Date().toISOString())
        .single();
      
      if (cached?.data) {
        console.log('Using cached Google Civic data');
        return cached.data;
      }
    }
    
    // Use Supabase Edge Function
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    let response: Response;
    
    console.log('Fetching from Supabase Edge Function:', zipcode);
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/google-civic-api`;
    response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ zipcode })
    });
    
    if (!response.ok) {
      throw new Error(`Google Civic API error: ${response.status}`);
    }
    
    const data: GoogleCivicResponse = await response.json();
    
    // Process officials into enhanced members
    const allMembers: EnhancedMember[] = [];
    
    data.offices.forEach(office => {
      office.officialIndices.forEach(index => {
        const official = data.officials[index];
        const level = determineLevel(office.divisionId, office.name);
        const { state, district } = extractStateDistrict(office.divisionId);
        
        // Extract social media
        const socialMedia: any = {};
        official.channels?.forEach(channel => {
          const type = channel.type.toLowerCase();
          if (type === 'twitter') socialMedia.twitter = channel.id;
          if (type === 'facebook') socialMedia.facebook = channel.id;
          if (type === 'youtube') socialMedia.youtube = channel.id;
        });
        
        const bioguideId = generateBioguideId(official, office.name, level);
        const member: EnhancedMember = {
          bioguide_id: bioguideId,
          member_id: bioguideId, // Alias for compatibility
          full_name: official.name,
          party: official.party || 'Unknown',
          chamber: extractChamber(office.name),
          state,
          district,
          office_name: office.name,
          level,
          division_id: office.divisionId,
          photo_url: official.photoUrl,
          phone: official.phones?.[0],
          email: official.emails?.[0],
          website: official.urls?.[0],
          social_media: Object.keys(socialMedia).length > 0 ? socialMedia : undefined,
          google_civic_id: `${office.divisionId}:${index}`,
          in_office: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        allMembers.push(member);
      });
    });
    
    // Categorize by level
    const result = {
      federal: allMembers.filter(m => m.level === 'federal'),
      state: allMembers.filter(m => m.level === 'state'),
      local: allMembers.filter(m => m.level === 'local'),
      raw: data
    };
    
    // Cache the result
    if (supabase) {
      const cacheKey = `civic_${zipcode}`;
      await supabase.from('api_cache').upsert({
        cache_key: cacheKey,
        data: result,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hour cache
      });
    }
    
    // Store members in database
    if (supabase && allMembers.length > 0) {
      await supabase.from('members').upsert(
        allMembers,
        { onConflict: 'member_id' }
      );
    }
    
    console.log(`Found ${allMembers.length} total officials:`, {
      federal: result.federal.length,
      state: result.state.length,
      local: result.local.length
    });
    
    return result;
  } catch (error) {
    console.error('Error fetching Google Civic data:', error);
    
    // Return empty arrays on error
    return {
      federal: [],
      state: [],
      local: []
    };
  }
}

// Get representatives with fallback to existing data
export async function getRepresentativesWithFallback(zipcode: string): Promise<EnhancedMember[]> {
  // Try Google Civic first
  const civicData = await getAllRepresentatives(zipcode);
  
  if (civicData.federal.length > 0) {
    return [...civicData.federal, ...civicData.state, ...civicData.local];
  }
  
  // Fallback to existing members in database
  if (supabase) {
    const { data: members } = await supabase
      .from('members')
      .select('*')
      .order('level', { ascending: true })
      .order('office_name', { ascending: true });
    
    return members || [];
  }
  
  return [];
}

// Update member with voting data from Congress.gov
export async function enrichMemberWithCongressData(
  member: EnhancedMember,
  congressData: any
): Promise<EnhancedMember> {
  return {
    ...member,
    // Add Congress.gov specific fields
    ...congressData,
    // Preserve Google Civic data
    office_name: member.office_name,
    level: member.level,
    division_id: member.division_id,
    google_civic_id: member.google_civic_id
  };
}