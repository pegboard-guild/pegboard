-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Zipcode to district mapping
CREATE TABLE districts (
  zipcode VARCHAR(5) PRIMARY KEY,
  state VARCHAR(2) NOT NULL,
  district VARCHAR(10),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Congressional members
CREATE TABLE members (
  bioguide_id VARCHAR(10) PRIMARY KEY,
  name TEXT NOT NULL,
  state VARCHAR(2) NOT NULL,
  district VARCHAR(10), -- NULL for senators
  party VARCHAR(1),
  chamber VARCHAR(10) NOT NULL, -- 'house' or 'senate'
  image_url TEXT,
  website TEXT,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bills from congress.gov
CREATE TABLE bills (
  bill_id VARCHAR(20) PRIMARY KEY,
  congress_number INTEGER,
  title TEXT NOT NULL,
  summary TEXT,
  status VARCHAR(50),
  introduced_date DATE,
  sponsor_id VARCHAR(10) REFERENCES members(bioguide_id),
  last_action TEXT,
  last_action_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- How members voted
CREATE TABLE votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bill_id VARCHAR(20) REFERENCES bills(bill_id),
  member_id VARCHAR(10) REFERENCES members(bioguide_id),
  vote VARCHAR(20) NOT NULL, -- 'YES', 'NO', 'NOT_VOTING', 'PRESENT'
  vote_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(bill_id, member_id)
);

-- User opinions
CREATE TABLE pegs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id TEXT NOT NULL,
  zipcode VARCHAR(5) NOT NULL,
  target_type VARCHAR(20) NOT NULL, -- 'bill', 'member', 'vote'
  target_id TEXT NOT NULL,
  sentiment VARCHAR(10) NOT NULL, -- 'approve', 'disapprove'
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Calculated attribution scores
CREATE TABLE attribution (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id VARCHAR(10) REFERENCES members(bioguide_id),
  zipcode VARCHAR(5),
  direct_pegs INTEGER DEFAULT 0,
  indirect_pegs INTEGER DEFAULT 0,
  sentiment_score DECIMAL(3,2), -- -1.00 to 1.00
  last_calculated TIMESTAMP DEFAULT NOW(),
  UNIQUE(member_id, zipcode)
);

-- Real-time activity feed view
CREATE VIEW activity_feed AS
SELECT 
  v.vote_date as activity_date,
  'vote' as activity_type,
  v.member_id,
  m.name as member_name,
  m.party,
  m.state,
  m.district,
  v.bill_id,
  b.title as bill_title,
  b.summary as bill_summary,
  v.vote,
  v.id as activity_id
FROM votes v
JOIN members m ON v.member_id = m.bioguide_id
JOIN bills b ON v.bill_id = b.bill_id
ORDER BY v.vote_date DESC, v.created_at DESC;

-- Index for performance
CREATE INDEX idx_votes_date ON votes(vote_date DESC);
CREATE INDEX idx_pegs_session ON pegs(session_id);
CREATE INDEX idx_pegs_zipcode ON pegs(zipcode);
CREATE INDEX idx_attribution_member_zip ON attribution(member_id, zipcode);