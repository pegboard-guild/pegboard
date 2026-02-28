// Local Government Data Service
// Integrates with Dallas OpenData and other Texas local government sources
// Dallas OpenData uses Socrata API: https://www.dallasopendata.com/

import { healthMonitor } from './dataSourceHealth';

export interface LocalOfficial {
  name: string;
  title: string;
  district?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  image?: string;
  party?: string;
  termStart?: string;
  termEnd?: string;
  committees?: string[];
}

export interface CityCouncilVote {
  date: string;
  agenda_item_description: string;
  voter_name: string;
  district: string;
  vote: string;
  final_action_taken?: string;
  agenda_item_number?: string;
  item_type?: string;
}

export interface CountyCommissioner {
  name: string;
  precinct: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
}

class LocalGovernmentService {
  // Dallas City Council Members (as of 2024)
  // Source: dallascityhall.com/government/Pages/city-council.aspx
  private dallasCityCouncil: LocalOfficial[] = [
    {
      name: 'Eric L. Johnson',
      title: 'Mayor',
      email: 'mayor.johnson@dallascityhall.com',
      website: 'https://dallascityhall.com/government/citymayor',
      party: 'Republican', // Switched from Democrat in 2023
      termStart: '2019-06',
      termEnd: '2027-06'
    },
    {
      name: 'Jesse Moreno',
      title: 'Mayor Pro Tem',
      district: '2',
      email: 'jesse.moreno@dallascityhall.com'
    },
    {
      name: 'Gay Donnell Willis',
      title: 'Deputy Mayor Pro Tem',
      district: '13',
      email: 'gay.willis@dallascityhall.com'
    },
    // Districts 1-14 council members
    {
      name: 'Chad West',
      title: 'Council Member',
      district: '1',
      email: 'chad.west@dallascityhall.com'
    },
    {
      name: 'Casey Thomas II',
      title: 'Council Member',
      district: '3',
      email: 'casey.thomas@dallascityhall.com'
    },
    {
      name: 'Carolyn King Arnold',
      title: 'Council Member',
      district: '4',
      email: 'carolyn.arnold@dallascityhall.com'
    },
    {
      name: 'Jaime Resendez',
      title: 'Council Member',
      district: '5',
      email: 'jaime.resendez@dallascityhall.com'
    },
    {
      name: 'Omar Narvaez',
      title: 'Council Member',
      district: '6',
      email: 'omar.narvaez@dallascityhall.com'
    },
    {
      name: 'Adam Bazaldua',
      title: 'Council Member',
      district: '7',
      email: 'adam.bazaldua@dallascityhall.com'
    },
    {
      name: 'Tennell Atkins',
      title: 'Council Member',
      district: '8',
      email: 'tennell.atkins@dallascityhall.com'
    },
    {
      name: 'Paula Blackmon',
      title: 'Council Member',
      district: '9',
      email: 'paula.blackmon@dallascityhall.com'
    },
    {
      name: 'Kathy Stewart',
      title: 'Council Member',
      district: '10',
      email: 'kathy.stewart@dallascityhall.com'
    },
    {
      name: 'Jaynie Schultz',
      title: 'Council Member',
      district: '11',
      email: 'jaynie.schultz@dallascityhall.com'
    },
    {
      name: 'Cara Mendelsohn',
      title: 'Council Member',
      district: '12',
      email: 'cara.mendelsohn@dallascityhall.com'
    },
    {
      name: 'Paul Ridley',
      title: 'Council Member',
      district: '14',
      email: 'paul.ridley@dallascityhall.com'
    }
  ];

  // Dallas County Commissioners Court
  // Source: dallascounty.org/government/comcrt/
  private dallasCountyCommissioners: CountyCommissioner[] = [
    {
      name: 'Clay Lewis Jenkins',
      precinct: 'County Judge',
      email: 'cjenkins@dallascounty.org',
      phone: '(214) 653-7949',
      website: 'https://www.dallascounty.org/government/countyjudge/'
    },
    {
      name: 'Dr. Theresa M. Daniel',
      precinct: '1',
      email: 'commissioner1@dallascounty.org',
      phone: '(214) 653-6670',
      address: '411 Elm Street, 2nd Floor, Dallas, TX 75202'
    },
    {
      name: 'J.J. Koch',
      precinct: '2',
      email: 'commissioner2@dallascounty.org',
      phone: '(214) 653-6100',
      address: '411 Elm Street, 2nd Floor, Dallas, TX 75202'
    },
    {
      name: 'John Wiley Price',
      precinct: '3',
      email: 'commissioner3@dallascounty.org',
      phone: '(214) 653-6671',
      address: '411 Elm Street, 2nd Floor, Dallas, TX 75202'
    },
    {
      name: 'Dr. Elba Garcia',
      precinct: '4',
      email: 'commissioner4@dallascounty.org',
      phone: '(214) 653-6672',
      address: '411 Elm Street, 2nd Floor, Dallas, TX 75202'
    }
  ];

  // Get Dallas City Council members
  async getDallasCityCouncil(): Promise<LocalOfficial[]> {
    try {
      healthMonitor.recordAttempt('dallas_opendata', true);
      return this.dallasCityCouncil;
    } catch (error) {
      console.error('Error fetching Dallas City Council:', error);
      healthMonitor.recordAttempt('dallas_opendata', false, error?.toString());
      return [];
    }
  }

  // Get Dallas County Commissioners
  async getDallasCountyCommissioners(): Promise<CountyCommissioner[]> {
    try {
      return this.dallasCountyCommissioners;
    } catch (error) {
      console.error('Error fetching Dallas County Commissioners:', error);
      return [];
    }
  }

  // Fetch City Council voting records from Dallas OpenData API
  // Dataset: https://www.dallasopendata.com/Services/Dallas-City-Council-Voting-Record/ts5d-gdq6
  async getCityCouncilVotes(limit: number = 100): Promise<CityCouncilVote[]> {
    try {
      // Prefer Supabase Edge Function proxy (handles CORS, tokens, caching)
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
      const anon = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
      if (supabaseUrl && anon) {
        const res = await fetch(`${supabaseUrl}/functions/v1/dallas-council-votes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anon}` },
          body: JSON.stringify({ limit, offset: 0 })
        });
        if (res.ok) {
          const j = await res.json();
          return j.data || [];
        }
        console.warn('Edge function dallas-council-votes returned', res.status);
      }

      // Fallback direct fetch (mirror fields used by edge function)
      const endpoint = 'https://www.dallasopendata.com/resource/ts5d-gdq6.json';
      const params = new URLSearchParams({
        '$select': 'date,agenda_item_description,voter_name,district,vote,final_action_taken,agenda_item_number,item_type',
        '$where': 'date IS NOT NULL AND agenda_item_description IS NOT NULL',
        '$order': 'date DESC',
        '$limit': String(limit)
      });
      const response = await fetch(`${endpoint}?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching council votes:', error);
      return [];
    }
  }

  // Get local officials based on zipcode
  async getLocalOfficialsByZipcode(zipcode: string): Promise<{
    city: LocalOfficial[];
    county: CountyCommissioner[];
  }> {
    // Check if zipcode is in Dallas area (750xx-754xx)
    const isDallas = zipcode.startsWith('750') || 
                     zipcode.startsWith('751') || 
                     zipcode.startsWith('752') || 
                     zipcode.startsWith('753') || 
                     zipcode.startsWith('754');

    if (isDallas) {
      const [cityOfficials, countyOfficials] = await Promise.all([
        this.getDallasCityCouncil(),
        this.getDallasCountyCommissioners()
      ]);

      return {
        city: cityOfficials,
        county: countyOfficials
      };
    }

    // For other Texas cities, we'd need to add more data sources
    // For now, return empty arrays
    return {
      city: [],
      county: []
    };
  }

  // Get official by district
  getCouncilMemberByDistrict(district: string): LocalOfficial | undefined {
    return this.dallasCityCouncil.find(member => member.district === district);
  }

  // Get all local officials (city + county)
  async getAllLocalOfficials(): Promise<{
    mayor: LocalOfficial | null;
    cityCouncil: LocalOfficial[];
    countyJudge: CountyCommissioner | null;
    countyCommissioners: CountyCommissioner[];
  }> {
    const cityOfficials = await this.getDallasCityCouncil();
    const countyOfficials = await this.getDallasCountyCommissioners();

    const mayor = cityOfficials.find(o => o.title === 'Mayor') || null;
    const cityCouncil = cityOfficials.filter(o => o.title !== 'Mayor');
    const countyJudge = countyOfficials.find(o => o.precinct === 'County Judge') || null;
    const countyCommissioners = countyOfficials.filter(o => o.precinct !== 'County Judge');

    return {
      mayor,
      cityCouncil,
      countyJudge,
      countyCommissioners
    };
  }

  // Format for display
  formatOfficialForDisplay(official: LocalOfficial | CountyCommissioner): string {
    if ('district' in official) {
      return `${official.name} - District ${official.district}`;
    } else if ('precinct' in official) {
      return `${official.name} - Precinct ${official.precinct}`;
    }
    return official.name;
  }
}

export const localGovernmentService = new LocalGovernmentService();

// Helper to check if service is available
export async function checkLocalGovernmentHealth(): Promise<boolean> {
  try {
    const officials = await localGovernmentService.getDallasCityCouncil();
    return officials.length > 0;
  } catch {
    return false;
  }
}