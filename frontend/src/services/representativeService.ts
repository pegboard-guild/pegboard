// Representative Service
// Integrates multiple data sources for government representatives:
// - OpenStates API for federal and state legislators
// - Local government data for city/county officials
// - Bulk data fallbacks when APIs are unavailable

import { supabase } from './supabase';

// Enhanced Member type for multi-level support
export interface EnhancedMember {
  bioguide_id: string;
  member_id: string;
  full_name: string;
  party: string;
  chamber?: string;
  state?: string;
  district?: string;
  office_name: string;
  level: 'federal' | 'state' | 'local';
  division_id: string;
  openstates_person_id?: string;
  photo_url?: string;
  phone?: string;
  email?: string;
  website?: string;
  social_media?: {
    twitter?: string;
    facebook?: string;
    youtube?: string;
  };
  in_office: boolean;
  next_election?: string;
  created_at: string;
  updated_at: string;
}

// Main function to get all representatives for a zipcode
export async function getAllRepresentatives(zipcode: string): Promise<{
  federal: EnhancedMember[];
  state: EnhancedMember[];
  local: EnhancedMember[];
  raw?: any;
}> {
  try {
    console.log('🔄 Fetching representatives from multiple sources...');
    console.log('📋 Fetching representatives for zipcode:', zipcode);
    console.log('🔍 Current environment:', window.location.hostname);

    // Check cache first - use the correct cache key format
    const cacheKey = `openstates_all_${zipcode}`;
    const keyHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(cacheKey)
    ).then(buffer =>
      Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    );

    console.log('🔑 Looking for cache with key hash:', keyHash);

    const { data: cachedData, error: cacheError } = await supabase
      .from('api_cache')
      .select('body, expires_at, last_accessed')
      .eq('key', keyHash)
      .single();

    console.log('📦 Cache query result:', {
      hasData: !!cachedData,
      hasError: !!cacheError,
      errorCode: cacheError?.code,
      errorMessage: cacheError?.message
    });

    // If we have valid cached data, use it (and enrich if needed)
    if (cachedData && !cacheError && new Date(cachedData.expires_at) > new Date()) {
      console.log('✅ Using cached OpenStates data for', zipcode);
      console.log('📊 Cached data structure:', {
        federal: cachedData.body?.federal?.length || 0,
        state: cachedData.body?.state?.length || 0,
        local: cachedData.body?.local?.length || 0
      });

      // If state reps are missing OpenStates person IDs, enrich by querying people for this zipcode
      try {
        if (cachedData.body?.state && Array.isArray(cachedData.body.state)) {
          const needEnrichment = cachedData.body.state.some((rep: EnhancedMember | any) => !rep.openstates_person_id);
          if (needEnrichment) {
            const { getAllLegislatorsByZipcode } = await import('./openstates');
            const osPeople = await getAllLegislatorsByZipcode(zipcode);
            const byName = new Map<string, any>();
            osPeople.forEach(p => byName.set((p.name || '').toLowerCase(), p));

            cachedData.body.state = cachedData.body.state.map((rep: any) => {
              if (rep.openstates_person_id) return rep;
              const match = byName.get((rep.full_name || rep.name || '').toLowerCase());
              if (match && match.id) {
                return { ...rep, openstates_person_id: match.id };
              }
              return rep;
            });

            // Write back enriched cache (soft update)
            await supabase
              .from('api_cache')
              .update({ body: cachedData.body, last_accessed: new Date().toISOString() })
              .eq('key', keyHash);
          }
        }
      } catch (enrichErr) {
        console.warn('OpenStates enrichment skipped:', enrichErr);
      }

      // Update last accessed time
      await supabase
        .from('api_cache')
        .update({
          last_accessed: new Date().toISOString()
        })
        .eq('key', keyHash);

      // Filter state representatives to only those for the specific districts
      const filteredData = { ...cachedData.body };

      // Map zipcodes to districts (for Texas)
      const districtMap: { [key: string]: { house: string, senate: string } } = {
        '75205': { house: '108', senate: '16' },  // Highland Park/University Park
        '75001': { house: '102', senate: '8' },   // Addison
        '78701': { house: '49', senate: '14' },   // Austin downtown
        '77001': { house: '146', senate: '15' },  // Houston downtown
        '78201': { house: '123', senate: '26' },  // San Antonio
        '79901': { house: '75', senate: '29' }    // El Paso
      };

      const districts = districtMap[zipcode];
      if (districts && filteredData.state && Array.isArray(filteredData.state)) {
        // Filter to only the representatives for this zipcode's districts
        filteredData.state = filteredData.state.filter((rep: EnhancedMember) => {
          const repDistrict = rep.district?.toString();
          if (rep.chamber === 'House' && repDistrict === districts.house) {
            console.log(`✅ Found House Rep for District ${districts.house}: ${rep.full_name}`);
            return true;
          }
          if (rep.chamber === 'Senate' && repDistrict === districts.senate) {
            console.log(`✅ Found Senator for District ${districts.senate}: ${rep.full_name}`);
            return true;
          }
          return false;
        });
        console.log(`🎯 Filtered state reps from ${cachedData.body.state.length} to ${filteredData.state.length} for your districts`);
      }

      // Always fetch local officials (they're not in the OpenStates cache)
      if (zipcode.startsWith('750') || zipcode.startsWith('751') || zipcode.startsWith('752') || zipcode.startsWith('753') || zipcode.startsWith('754')) {
        console.log('📍 Fetching local officials for Dallas area...');
        const { localGovernmentService } = await import('./localGovernmentService');
        const localOfficials = await localGovernmentService.getLocalOfficialsByZipcode(zipcode);

        // Convert to EnhancedMember format
        const localMembers: EnhancedMember[] = [];

        // Add city council members
        localOfficials.city.forEach((official) => {
          localMembers.push({
            bioguide_id: `local_city_${official.district || 'at_large'}`,
            member_id: `local_city_${official.district || 'at_large'}`,
            full_name: official.name,
            office_name: official.title,
            party: official.party || 'Nonpartisan',
            email: official.email,
            phone: official.phone,
            photo_url: official.image || '',
            website: official.website,
            level: 'local',
            division_id: `dallas_district_${official.district || 'at_large'}`,
            state: 'TX',
            district: official.district || '',
            chamber: 'City Council',
            in_office: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        });

        // Add county commissioners
        localOfficials.county.forEach((commissioner) => {
          localMembers.push({
            bioguide_id: `local_county_${commissioner.precinct}`,
            member_id: `local_county_${commissioner.precinct}`,
            full_name: commissioner.name,
            office_name: commissioner.precinct === 'County Judge' ? 'County Judge' : `County Commissioner Precinct ${commissioner.precinct}`,
            party: 'Nonpartisan',
            email: commissioner.email,
            phone: commissioner.phone,
            photo_url: '',
            website: commissioner.website,
            level: 'local',
            division_id: `dallas_county_precinct_${commissioner.precinct}`,
            state: 'TX',
            district: commissioner.precinct,
            chamber: 'County Commissioners Court',
            in_office: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        });

        filteredData.local = localMembers;
        console.log(`✅ Added ${localMembers.length} local officials`);
      }

      return filteredData;
    }

    console.log('🔄 Cache miss or expired, fetching fresh data...');

    // Import OpenStates functions
    const { getAllLegislatorsByZipcode } = await import('./openstates');

    // Import local government service for city/county officials
    const { localGovernmentService } = await import('./localGovernmentService');

    // Get all legislators from OpenStates API
    const allLegislators = await getAllLegislatorsByZipcode(zipcode);

    // Get local government officials (city council, county commissioners)
    const localOfficials = await localGovernmentService.getLocalOfficialsByZipcode(zipcode);

    console.log(`🔍 OpenStates API Response:`, {
      legislatorCount: allLegislators.length,
      firstLegislator: allLegislators[0] ? {
        name: allLegislators[0].name,
        title: allLegislators[0].current_role?.title,
        jurisdiction: allLegislators[0].jurisdiction?.classification
      } : 'No legislators found'
    });

    // Convert OpenStates legislators to EnhancedMember format
    const convertedMembers: EnhancedMember[] = allLegislators.map((legislator, index) => {
      // Determine level based on office title and jurisdiction
      let level: 'federal' | 'state' | 'local' = 'state';
      const title = legislator.current_role?.title?.toLowerCase() || '';

      // Categorize based on jurisdiction classification from OpenStates API
      if (legislator.jurisdiction?.classification === 'country') {
        level = 'federal';
        console.log(`✅ ${legislator.name} categorized as FEDERAL (jurisdiction: country)`);
      } else if (legislator.jurisdiction?.classification === 'state') {
        level = 'state';
        console.log(`🏛️ ${legislator.name} categorized as STATE (jurisdiction: state)`);
      } else {
        level = 'local';
        console.log(`🏛️ ${legislator.name} categorized as LOCAL (jurisdiction: ${legislator.jurisdiction?.classification || 'unknown'})`);
      }

      // Generate bioguide ID
      const namePart = legislator.name.toLowerCase().replace(/[^a-z]/g, '');
      const titlePart = (legislator.current_role?.title || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
      const bioguideId = `os-${level}-${titlePart}-${namePart}`.slice(0, 50);

      // Extract chamber from role
      let chamber: string | undefined;
      if (level === 'federal') {
        // For federal level, determine chamber from title
        if (title.includes('senator')) {
          chamber = 'Senate';
        } else if (title.includes('representative')) {
          chamber = 'House';
        }
      } else {
        // For state level, use the chamber field
        if (legislator.current_role?.chamber === 'upper') {
          chamber = 'Senate';
        } else if (legislator.current_role?.chamber === 'lower') {
          chamber = 'House';
        }
      }

      return {
        bioguide_id: bioguideId,
        member_id: bioguideId,
        full_name: legislator.name,
        party: legislator.party || 'Unknown',
        chamber,
        state: legislator.current_role?.jurisdiction?.replace('ocd-jurisdiction/country:us/state:', '').replace('/government', '').toUpperCase(),
        district: legislator.current_role?.district,
        office_name: legislator.current_role?.title || 'Unknown Office',
        level,
        division_id: legislator.current_role?.jurisdiction || '',
        openstates_person_id: legislator.id,
        photo_url: legislator.image,
        phone: legislator.extras?.phone,
        email: legislator.email,
        website: legislator.extras?.website,
        social_media: undefined,
        in_office: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    // Convert local government officials to EnhancedMember format
    const localMembers: EnhancedMember[] = [];

    // Add city council members
    localOfficials.city.forEach((official, index) => {
      localMembers.push({
        bioguide_id: `local_city_${official.district || index}`,
        member_id: `local_city_${official.district || index}`,
        full_name: official.name,
        office_name: official.title,
        party: official.party || 'Nonpartisan',
        email: official.email,
        phone: official.phone,
        photo_url: official.image || '',
        website: official.website,
        level: 'local',
        division_id: `dallas_district_${official.district || 'at_large'}`,
        state: 'TX',
        district: official.district || '',
        chamber: 'City Council',
        in_office: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });

    // Add county commissioners
    localOfficials.county.forEach((commissioner, index) => {
      localMembers.push({
        bioguide_id: `local_county_${commissioner.precinct}`,
        member_id: `local_county_${commissioner.precinct}`,
        full_name: commissioner.name,
        office_name: commissioner.precinct === 'County Judge' ? 'County Judge' : `County Commissioner Precinct ${commissioner.precinct}`,
        party: 'Nonpartisan',
        email: commissioner.email,
        phone: commissioner.phone,
        photo_url: '',
        website: commissioner.website,
        level: 'local',
        division_id: `dallas_county_precinct_${commissioner.precinct}`,
        state: 'TX',
        district: commissioner.precinct,
        chamber: 'County Commissioners Court',
        in_office: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });

    // Categorize by level and combine with local officials
    const openStatesLocal = convertedMembers.filter(m => m.level === 'local');
    const allLocalMembers = [...openStatesLocal, ...localMembers];

    const result = {
      federal: convertedMembers.filter(m => m.level === 'federal'),
      state: convertedMembers.filter(m => m.level === 'state'),
      local: allLocalMembers,
      raw: {
        source: 'OpenStates API (via Plural Policy) + Dallas Local Government Data',
        zipcode,
        totalFound: convertedMembers.length + localMembers.length,
        localOfficialsCount: localMembers.length,
        apiWorking: true
      }
    };

    console.log(`Categorized representatives:`, {
      federal: result.federal.length,
      state: result.state.length,
      local: result.local.length
    });

    // Cache the consolidated result with correct schema
    if (supabase) {
      const cacheKey = `openstates_all_${zipcode}`;

      // Generate hash for key field (same as we do when reading)
      const keyHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(cacheKey)
      ).then(buffer =>
        Array.from(new Uint8Array(buffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
      );

      const now = new Date();
      const expires = new Date();
      expires.setDate(expires.getDate() + 60); // 60 days cache

      console.log(`💾 Caching consolidated results for zipcode ${zipcode}`);

      // Use the correct cache schema
      const { error: cacheError } = await supabase.from('api_cache').upsert({
        key: keyHash,  // Use 'key' not 'cache_key'
        source: 'openstates',
        url: 'consolidated',
        params: { zipcode },
        status: 200,
        body: result,  // Use 'body' not 'data'
        fetched_at: now.toISOString(),
        expires_at: expires.toISOString(),
        last_accessed: now.toISOString()
      });

      if (cacheError) {
        console.error('Failed to cache consolidated results:', cacheError);
      } else {
        console.log('✅ Successfully cached representatives for future use');
      }
    }

    // Store members in database
    // Temporarily disabled - causing conflicts with local government data
    // TODO: Fix unique constraint handling for local officials
    /*
    if (supabase && convertedMembers.length > 0) {
      await supabase.from('members').upsert(
        convertedMembers,
        { onConflict: 'member_id' }
      );
    }
    */

    return result;
  } catch (error) {
    console.error('Error fetching representatives via OpenStates:', error);

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
  // Try OpenStates first
  const representatives = await getAllRepresentatives(zipcode);

  if (representatives.federal.length > 0 || representatives.state.length > 0) {
    return [...representatives.federal, ...representatives.state, ...representatives.local];
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

// Update member with additional data
export async function enrichMemberWithCongressData(
  member: EnhancedMember,
  congressData: any
): Promise<EnhancedMember> {
  return {
    ...member,
    // Add additional data
    ...congressData,
    // Preserve OpenStates data
    office_name: member.office_name,
    level: member.level,
    division_id: member.division_id
  };
}