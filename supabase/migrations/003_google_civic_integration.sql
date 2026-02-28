-- Migration: Google Civic Information API Integration
-- Adds support for federal, state, and local officials

-- Add new columns to members table for multi-level support
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'federal',
ADD COLUMN IF NOT EXISTS office_name TEXT,
ADD COLUMN IF NOT EXISTS division_id TEXT,
ADD COLUMN IF NOT EXISTS google_civic_id TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS social_media JSONB,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS in_office BOOLEAN DEFAULT true;

-- Create indices for better query performance
CREATE INDEX IF NOT EXISTS idx_members_level ON members(level);
CREATE INDEX IF NOT EXISTS idx_members_division ON members(division_id);
CREATE INDEX IF NOT EXISTS idx_members_google_civic ON members(google_civic_id);
CREATE INDEX IF NOT EXISTS idx_members_state_level ON members(state, level);

-- Create API cache table for Google Civic responses
CREATE TABLE IF NOT EXISTS api_cache (
  cache_key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for cache expiration queries
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);

-- Add level check constraint
ALTER TABLE members 
ADD CONSTRAINT check_member_level 
CHECK (level IN ('federal', 'state', 'local'));

-- Create a view for active officials by level
CREATE OR REPLACE VIEW active_officials AS
SELECT 
  m.*,
  COALESCE(
    (SELECT COUNT(*) FROM votes v WHERE v.member_id = m.bioguide_id),
    0
  ) as vote_count,
  COALESCE(
    (SELECT COUNT(*) FROM bills b WHERE b.sponsor_id = m.bioguide_id),
    0
  ) as bills_sponsored
FROM members m
WHERE m.in_office = true
ORDER BY 
  CASE m.level 
    WHEN 'federal' THEN 1
    WHEN 'state' THEN 2
    WHEN 'local' THEN 3
  END,
  m.office_name;

-- Create materialized view for zipcode officials (for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS zipcode_officials AS
SELECT DISTINCT ON (d.zipcode, m.bioguide_id)
  d.zipcode,
  m.*
FROM districts d
JOIN members m ON (
  (m.state = d.state AND m.level = 'federal') OR
  (m.state = d.state AND m.level = 'state')
  -- Local level will be added after division_id is populated
)
WHERE m.in_office = true;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_zipcode_officials_zip 
ON zipcode_officials(zipcode);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_zipcode_officials()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY zipcode_officials;
END;
$$ LANGUAGE plpgsql;

-- Update districts table to store division IDs
ALTER TABLE districts
ADD COLUMN IF NOT EXISTS division_id TEXT,
ADD COLUMN IF NOT EXISTS divisions JSONB;

-- Create table for tracking feature availability by level
CREATE TABLE IF NOT EXISTS feature_availability (
  level TEXT PRIMARY KEY CHECK (level IN ('federal', 'state', 'local')),
  votes_enabled BOOLEAN DEFAULT false,
  bills_enabled BOOLEAN DEFAULT false,
  committees_enabled BOOLEAN DEFAULT false,
  financial_enabled BOOLEAN DEFAULT false,
  news_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default feature availability
INSERT INTO feature_availability (level, votes_enabled, bills_enabled, committees_enabled, financial_enabled, news_enabled)
VALUES 
  ('federal', true, true, false, false, false),
  ('state', false, false, false, false, false),
  ('local', false, false, false, false, false)
ON CONFLICT (level) DO NOTHING;

-- Create function to get all officials for a zipcode
CREATE OR REPLACE FUNCTION get_zipcode_officials(
  p_zipcode TEXT
)
RETURNS TABLE (
  bioguide_id TEXT,
  full_name TEXT,
  party TEXT,
  chamber TEXT,
  state TEXT,
  district TEXT,
  office_name TEXT,
  level TEXT,
  division_id TEXT,
  photo_url TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  social_media JSONB,
  in_office BOOLEAN,
  vote_count BIGINT,
  bills_sponsored BIGINT,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.bioguide_id,
    m.full_name,
    m.party,
    m.chamber,
    m.state,
    m.district,
    m.office_name,
    m.level,
    m.division_id,
    m.photo_url,
    m.phone,
    m.email,
    m.website,
    m.social_media,
    m.in_office,
    COALESCE((SELECT COUNT(*) FROM votes v WHERE v.member_id = m.bioguide_id), 0) as vote_count,
    COALESCE((SELECT COUNT(*) FROM bills b WHERE b.sponsor_id = m.bioguide_id), 0) as bills_sponsored,
    (SELECT row_to_json(f) FROM feature_availability f WHERE f.level = m.level) as features
  FROM members m
  WHERE m.bioguide_id IN (
    SELECT DISTINCT mo.bioguide_id 
    FROM zipcode_officials mo 
    WHERE mo.zipcode = p_zipcode
  )
  ORDER BY 
    CASE m.level 
      WHEN 'federal' THEN 1
      WHEN 'state' THEN 2
      WHEN 'local' THEN 3
    END,
    m.office_name;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT ON active_officials TO anon, authenticated;
GRANT SELECT ON zipcode_officials TO anon, authenticated;
GRANT SELECT ON feature_availability TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON api_cache TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_zipcode_officials TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_zipcode_officials TO authenticated;