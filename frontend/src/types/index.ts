export interface District {
  zipcode: string;
  state: string;
  district: string | null;
  updated_at: string;
}

export interface Member {
  bioguide_id: string;
  name: string;
  state: string;
  district: string | null;
  party: string | null;
  chamber: 'house' | 'senate';
  image_url: string | null;
  website: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  // Additional fields for UI
  alignment_score?: number;
  recent_votes?: Vote[];
}

export interface Bill {
  bill_id: string;
  congress_number: number;
  title: string;
  summary: string | null;
  status: string | null;
  introduced_date: string | null;
  sponsor_id: string | null;
  last_action: string | null;
  last_action_date: string | null;
  created_at: string;
  updated_at: string;
  // Additional fields for UI
  votes?: Vote[];
  sponsor?: Member;
  totalSentiment?: Sentiment;
  localSentiment?: Sentiment;
}

export interface Vote {
  id: string;
  bill_id: string;
  member_id: string;
  vote: 'YES' | 'NO' | 'NOT_VOTING' | 'PRESENT';
  vote_date: string;
  created_at: string;
  // Additional fields for UI
  member?: Member;
  bill?: Bill;
}

export interface Peg {
  id: string;
  session_id: string;
  zipcode: string;
  target_type: 'bill' | 'member' | 'vote' | 'state_bill';
  target_id: string;
  sentiment: 'approve' | 'disapprove';
  comment: string | null;
  created_at: string;
}

export interface Attribution {
  id: string;
  member_id: string;
  zipcode: string | null;
  direct_pegs: number;
  indirect_pegs: number;
  sentiment_score: number;
  last_calculated: string;
}

export interface ActivityFeedItem {
  activity_date: string;
  activity_type: 'vote' | 'bill' | 'statement';
  member_id: string;
  member_name: string;
  party: string | null;
  state: string;
  district: string | null;
  bill_id: string | null;
  bill_title: string | null;
  bill_summary: string | null;
  vote: string | null;
  activity_id: string;
  // UI fields
  userSentiment?: 'approve' | 'disapprove' | null;
}

export interface Sentiment {
  approve: number;
  disapprove: number;
  total: number;
  percentage: number; // -100 to 100
}

export interface UserSession {
  sessionId: string;
  zipcode: string | null;
  representatives: Member[];
  settings: {
    notifications: boolean;
    theme: 'light' | 'dark';
  };
}