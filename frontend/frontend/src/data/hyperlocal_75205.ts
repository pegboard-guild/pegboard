export type HyperlocalItemType = 'street_project' | 'public_meeting' | 'park_trail' | 'notice' | 'event';

export interface HyperlocalItem {
  id: string;
  type: HyperlocalItemType;
  title: string;
  subtitle?: string;
  start_date?: string;
  end_date?: string;
  status?: 'planned' | 'in_progress' | 'completed';
  location?: string;
  description?: string;
  url?: string;
}

// Seed data for a delightful test experience around 75205 (University Park / HP area)
export const hyperlocalNow75205: HyperlocalItem[] = [
  {
    id: 'proj-alley-university-blvd-2800',
    type: 'street_project',
    title: 'Alley Reconstruction – 2800 block, University Blvd',
    subtitle: 'Access limitations to rear garages during work hours',
    start_date: '2025-07-01',
    end_date: '2025-09-15',
    status: 'completed',
    location: '2833 University Blvd, University Park, TX 75205',
    description: 'City crews replaced alley pavement and drainage. Final walkthrough completed and access fully restored.',
  },
  {
    id: 'event-up-council-meeting',
    type: 'public_meeting',
    title: 'University Park City Council Meeting',
    subtitle: 'Agenda includes street maintenance updates and trail safety',
    start_date: '2025-10-28T18:00:00-05:00',
    location: 'City Hall, 3800 University Blvd',
    url: 'https://www.uptexas.org',
  },
  {
    id: 'trail-katy-maintenance',
    type: 'park_trail',
    title: 'Katy Trail – Surface maintenance window',
    subtitle: 'Early morning spot repairs; brief lane shifts',
    start_date: '2025-10-22',
    end_date: '2025-10-30',
    status: 'in_progress',
    location: 'Katy Trail (Knox St to SMU Blvd segments)',
    description: 'Crews addressing minor surface wear. Expect short rolling closures near work zones.',
    url: 'https://katytraildallas.org',
  },
  {
    id: 'notice-leaf-collection',
    type: 'notice',
    title: 'Fall Leaf Collection – Zone includes 75205',
    subtitle: 'Place bagged leaves curbside night before pickup',
    start_date: '2025-11-01',
    end_date: '2025-12-15',
    url: 'https://www.uptexas.org/services/leaf-collection',
  },
  {
    id: 'event-katy-trail-5k',
    type: 'event',
    title: 'Katy Trail 5K & Community Morning',
    subtitle: 'Staggered starts; family-friendly activities',
    start_date: '2025-11-08T08:00:00-06:00',
    location: 'Katy Trail – Snyder’s Union Entrance',
    url: 'https://katytraildallas.org/events',
  }
];


