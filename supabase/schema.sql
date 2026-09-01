-- =========================================================================
-- Supabase PostgreSQL Schema for Lead Engine (V1)
-- Copy and paste this directly into Supabase SQL Editor and click RUN
-- =========================================================================

-- 1. Discovery Scans Table
CREATE TABLE IF NOT EXISTS discovery_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche VARCHAR(150) NOT NULL,
  location_input VARCHAR(255) NOT NULL,
  radius_km INTEGER NOT NULL DEFAULT 15,
  status VARCHAR(50) NOT NULL DEFAULT 'RUNNING',
  raw_discovered_count INTEGER DEFAULT 0,
  qualified_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Qualified Leads Table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES discovery_scans(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(150),
  formatted_address TEXT,
  phone VARCHAR(50),
  google_maps_url TEXT,
  website_url TEXT,

  -- Universal 13 Invariant Reputation Rules
  rating NUMERIC(3,2) NOT NULL,
  review_count INTEGER NOT NULL,
  last_review_date TIMESTAMPTZ,
  reviews_last_30_days INTEGER DEFAULT 0,
  reviews_last_90_days INTEGER DEFAULT 0,
  reviews_last_180_days INTEGER DEFAULT 0,
  review_trend VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',

  -- Audit & Opportunity Engine
  has_website BOOLEAN NOT NULL DEFAULT FALSE,
  audit_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  audit_telemetry JSONB,

  -- 4-Dimension Scores & Operational Classification
  reputation_score INTEGER DEFAULT 0,
  digital_gap_score INTEGER DEFAULT 0,
  opportunity_score INTEGER DEFAULT 0,
  confidence_score INTEGER DEFAULT 0,
  total_lead_score INTEGER DEFAULT 0,
  opportunity_type VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',

  -- Dossier & Synthesis Deck
  dossier JSONB,
  human_status VARCHAR(30) NOT NULL DEFAULT 'NEW',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning-fast queries & ranking
CREATE INDEX IF NOT EXISTS idx_leads_ranking ON leads(total_lead_score DESC, human_status);
CREATE INDEX IF NOT EXISTS idx_leads_scan_id ON leads(scan_id);
CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(place_id);
CREATE INDEX IF NOT EXISTS idx_discovery_scans_created_at ON discovery_scans(created_at DESC);
