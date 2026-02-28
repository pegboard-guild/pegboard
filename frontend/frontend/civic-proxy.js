const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

const GOOGLE_CIVIC_API_KEY = 'AIzaSyBdQuaXgkihNPKyApEOL04gKwZgyLseMjY';
const GOOGLE_CIVIC_BASE_URL = 'https://www.googleapis.com/civicinfo/v2';

app.post('/api/civic/representatives', async (req, res) => {
  try {
    const { zipcode } = req.body;
    
    const params = new URLSearchParams({
      address: zipcode,
      key: GOOGLE_CIVIC_API_KEY,
      includeOffices: 'true',
      levels: 'country,regional,administrativeArea1,administrativeArea2,locality',
      roles: 'headOfState,headOfGovernment,deputyHeadOfGovernment,governmentOfficer,legislatorUpperBody,legislatorLowerBody'
    });
    
    const response = await fetch(`${GOOGLE_CIVIC_BASE_URL}/representatives?${params}`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Google Civic API error:', data);
      return res.status(response.status).json({ error: data });
    }
    
    // Process the data
    const processed = processGoogleCivicData(data);
    res.json(processed);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

function processGoogleCivicData(data) {
  const allMembers = [];
  
  if (!data.offices || !data.officials) {
    return {
      federal: [],
      state: [],
      local: [],
      allMembers: []
    };
  }
  
  data.offices.forEach((office) => {
    office.officialIndices?.forEach((index) => {
      const official = data.officials[index];
      if (!official) return;
      
      const level = determineLevel(office.divisionId, office.name);
      const { state, district } = extractStateDistrict(office.divisionId);
      
      // Extract social media
      const socialMedia = {};
      official.channels?.forEach((channel) => {
        const type = channel.type.toLowerCase();
        if (type === 'twitter') socialMedia.twitter = channel.id;
        if (type === 'facebook') socialMedia.facebook = channel.id;
        if (type === 'youtube') socialMedia.youtube = channel.id;
      });
      
      const bioguideId = generateBioguideId(official, office.name, level);
      const member = {
        bioguide_id: bioguideId,
        member_id: bioguideId,
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
        social_media: Object.keys(socialMedia).length > 0 ? socialMedia : null,
        google_civic_id: `${office.divisionId}:${index}`,
        in_office: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      allMembers.push(member);
    });
  });
  
  return {
    federal: allMembers.filter(m => m.level === 'federal'),
    state: allMembers.filter(m => m.level === 'state'),
    local: allMembers.filter(m => m.level === 'local'),
    raw: data
  };
}

function determineLevel(divisionId, officeName) {
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
  
  // Local level
  return 'local';
}

function generateBioguideId(official, office, level) {
  const namePart = official.name.toLowerCase().replace(/[^a-z]/g, '');
  const officePart = office.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
  return `${level}-${officePart}-${namePart}`.slice(0, 50);
}

function extractChamber(officeName) {
  if (officeName.toLowerCase().includes('senate')) return 'Senate';
  if (officeName.toLowerCase().includes('house') || officeName.toLowerCase().includes('representative')) return 'House';
  return null;
}

function extractStateDistrict(divisionId) {
  const stateMatch = divisionId.match(/state:([a-z]{2})/);
  const districtMatch = divisionId.match(/cd:(\d+)/);
  
  return {
    state: stateMatch ? stateMatch[1].toUpperCase() : undefined,
    district: districtMatch ? districtMatch[1] : undefined
  };
}

app.listen(PORT, () => {
  console.log(`Google Civic proxy server running on http://localhost:${PORT}`);
});