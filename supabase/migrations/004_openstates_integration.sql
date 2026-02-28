-- OpenStates Integration: State Legislature Data Support
-- Adds tables and columns for state-level bills, votes, and legislators

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Update members table to include state legislators
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS state_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS openstates_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS legislative_chamber VARCHAR(20) CHECK (legislative_chamber IN ('upper', 'lower', 'unicameral'));

-- Create index for state_id lookups
CREATE INDEX IF NOT EXISTS idx_members_state_id ON members(state_id);
CREATE INDEX IF NOT EXISTS idx_members_openstates_id ON members(openstates_id);

-- State bills table
CREATE TABLE IF NOT EXISTS state_bills (
  bill_id VARCHAR(100) PRIMARY KEY,
  state VARCHAR(50) NOT NULL,
  session VARCHAR(50),
  identifier VARCHAR(50), -- Bill number like "HB 1234"
  title TEXT,
  abstract TEXT,
  classification JSONB, -- Array of bill types
  subjects JSONB, -- Array of subject tags
  status VARCHAR(100),
  introduced_date DATE,
  sponsor_id VARCHAR(100),
  sponsor_name VARCHAR(255),
  chamber VARCHAR(20), -- 'upper', 'lower', 'unicameral'
  latest_action_description TEXT,
  latest_action_date DATE,
  openstates_url TEXT,
  full_text_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for state bills
CREATE INDEX IF NOT EXISTS idx_state_bills_state ON state_bills(state);
CREATE INDEX IF NOT EXISTS idx_state_bills_session ON state_bills(state, session);
CREATE INDEX IF NOT EXISTS idx_state_bills_sponsor ON state_bills(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_state_bills_introduced ON state_bills(introduced_date DESC);
CREATE INDEX IF NOT EXISTS idx_state_bills_updated ON state_bills(updated_at DESC);

-- State votes table
CREATE TABLE IF NOT EXISTS state_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vote_event_id VARCHAR(100),
  bill_id VARCHAR(100) REFERENCES state_bills(bill_id) ON DELETE CASCADE,
  legislator_id VARCHAR(100),
  legislator_name VARCHAR(255),
  vote_value VARCHAR(20) CHECK (vote_value IN ('yes', 'no', 'absent', 'abstain', 'not voting', 'excused')),
  vote_date DATE,
  motion_text TEXT,
  chamber VARCHAR(20),
  passed BOOLEAN,
  yes_count INTEGER,
  no_count INTEGER,
  absent_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for state votes
CREATE INDEX IF NOT EXISTS idx_state_votes_bill ON state_votes(bill_id);
CREATE INDEX IF NOT EXISTS idx_state_votes_legislator ON state_votes(legislator_id);
CREATE INDEX IF NOT EXISTS idx_state_votes_date ON state_votes(vote_date DESC);
CREATE INDEX IF NOT EXISTS idx_state_votes_vote_event ON state_votes(vote_event_id);

-- State bill sponsors junction table (bills can have multiple sponsors)
CREATE TABLE IF NOT EXISTS state_bill_sponsors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bill_id VARCHAR(100) REFERENCES state_bills(bill_id) ON DELETE CASCADE,
  legislator_id VARCHAR(100),
  legislator_name VARCHAR(255),
  sponsor_type VARCHAR(50), -- 'primary', 'cosponsor'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_sponsors_bill ON state_bill_sponsors(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_sponsors_legislator ON state_bill_sponsors(legislator_id);

-- State bill actions table (track bill progress)
CREATE TABLE IF NOT EXISTS state_bill_actions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bill_id VARCHAR(100) REFERENCES state_bills(bill_id) ON DELETE CASCADE,
  action_date DATE,
  description TEXT,
  chamber VARCHAR(20),
  classification JSONB, -- Array of action types
  action_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_actions_bill ON state_bill_actions(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_actions_date ON state_bill_actions(action_date DESC);

-- Add pegs support for state bills
ALTER TABLE pegs 
ADD COLUMN IF NOT EXISTS state_bill_id VARCHAR(100) REFERENCES state_bills(bill_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pegs_state_bill ON pegs(state_bill_id);

-- Create view for state legislator voting records
CREATE OR REPLACE VIEW state_legislator_voting_record AS
SELECT 
  sv.legislator_id,
  sv.legislator_name,
  COUNT(*) as total_votes,
  COUNT(CASE WHEN sv.vote_value = 'yes' THEN 1 END) as yes_votes,
  COUNT(CASE WHEN sv.vote_value = 'no' THEN 1 END) as no_votes,
  COUNT(CASE WHEN sv.vote_value IN ('absent', 'abstain', 'not voting', 'excused') THEN 1 END) as missed_votes,
  ROUND(COUNT(CASE WHEN sv.vote_value IN ('yes', 'no') THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as participation_rate
FROM state_votes sv
GROUP BY sv.legislator_id, sv.legislator_name;

-- Function to get state activity feed
CREATE OR REPLACE FUNCTION get_state_activity_feed(
  user_state VARCHAR,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  activity_type VARCHAR,
  activity_date DATE,
  bill_id VARCHAR,
  bill_title TEXT,
  bill_identifier VARCHAR,
  action_description TEXT,
  legislator_name VARCHAR,
  vote_value VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'state_bill_action'::VARCHAR as activity_type,
    sb.latest_action_date as activity_date,
    sb.bill_id,
    sb.title as bill_title,
    sb.identifier as bill_identifier,
    sb.latest_action_description as action_description,
    sb.sponsor_name as legislator_name,
    NULL::VARCHAR as vote_value
  FROM state_bills sb
  WHERE sb.state = user_state
    AND sb.latest_action_date IS NOT NULL
  ORDER BY sb.latest_action_date DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Add Texas-specific session handling
CREATE TABLE IF NOT EXISTS texas_sessions (
  session_id VARCHAR(20) PRIMARY KEY,
  year INTEGER,
  session_type VARCHAR(20) CHECK (session_type IN ('regular', 'special')),
  special_session_number INTEGER,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false
);

-- Insert known Texas sessions
INSERT INTO texas_sessions (session_id, year, session_type, start_date, end_date, is_active) VALUES
  ('88', 2023, 'regular', '2023-01-10', '2023-05-29', false),
  ('881', 2023, 'special', '2023-05-29', '2023-05-29', false),
  ('882', 2023, 'special', '2023-06-27', '2023-07-13', false),
  ('883', 2023, 'special', '2023-10-09', '2023-11-07', false),
  ('884', 2023, 'special', '2023-11-07', '2023-12-05', false),
  ('89', 2025, 'regular', '2025-01-14', NULL, true)
ON CONFLICT (session_id) DO NOTHING;

-- Add RLS policies
ALTER TABLE state_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_bill_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_bill_actions ENABLE ROW LEVEL SECURITY;

-- Allow read access to all
CREATE POLICY "State bills are viewable by all" ON state_bills FOR SELECT USING (true);
CREATE POLICY "State votes are viewable by all" ON state_votes FOR SELECT USING (true);
CREATE POLICY "State bill sponsors are viewable by all" ON state_bill_sponsors FOR SELECT USING (true);
CREATE POLICY "State bill actions are viewable by all" ON state_bill_actions FOR SELECT USING (true);

-- Add function to get state from zipcode (using districts table)
CREATE OR REPLACE FUNCTION get_state_from_zipcode(user_zipcode VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  user_state VARCHAR;
BEGIN
  SELECT state INTO user_state
  FROM districts
  WHERE zipcode = user_zipcode
  LIMIT 1;
  
  RETURN user_state;
END;
$$ LANGUAGE plpgsql;