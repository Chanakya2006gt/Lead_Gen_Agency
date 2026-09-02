-- =========================================================================
-- Supabase PostgreSQL Schema for Lead Engine (V2 - Longitudinal Hardened)
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

-- 2. Qualified Leads Table (Entity Master Record)
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
  previous_rating NUMERIC(3,2),
  previous_review_count INTEGER,
  last_review_date TIMESTAMPTZ,
  reviews_last_30_days INTEGER,
  reviews_last_90_days INTEGER,
  reviews_last_180_days INTEGER,
  review_trend VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',

  -- Audit & Opportunity Engine
  has_website BOOLEAN NOT NULL DEFAULT FALSE,
  is_gbp_disconnected BOOLEAN NOT NULL DEFAULT FALSE,
  unlinked_website_url TEXT,
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

  -- Longitudinal Observation & Entity Provenance
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observation_count INTEGER NOT NULL DEFAULT 1,
  review_count_delta INTEGER DEFAULT 0,
  rating_delta NUMERIC(3,2) DEFAULT 0,
  identity_source VARCHAR(50) DEFAULT 'deterministic',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Historical Lead Observations Table (Immutable Time-Series Ledger)
CREATE TABLE IF NOT EXISTS lead_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES discovery_scans(id) ON DELETE SET NULL,
  observed_rating NUMERIC(3,2) NOT NULL,
  observed_review_count INTEGER NOT NULL,
  observed_website_url TEXT,
  observed_phone VARCHAR(50),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning-fast queries & ranking
CREATE INDEX IF NOT EXISTS idx_leads_ranking ON leads(total_lead_score DESC, human_status);
CREATE INDEX IF NOT EXISTS idx_leads_scan_id ON leads(scan_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_place_id_unique ON leads(place_id);
CREATE INDEX IF NOT EXISTS idx_observations_lead ON lead_observations(lead_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_scans_created_at ON discovery_scans(created_at DESC);
