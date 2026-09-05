import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Initialize SQLite connection for local offline resilience & workstation builds
let dbPath = process.env.DATABASE_URL || "./lead_engine.db";

// Use dedicated test db for Vitest isolation
if (process.env.NODE_ENV === "test") {
  dbPath = "./lead_engine_test.db";
}

// Ensure sqlite directory exists
if (dbPath.startsWith("sqlite:")) {
  dbPath = dbPath.replace("sqlite:", "");
}

// Intercept Postgres URLs: Fail explicit (Workstation is SQLite on disk)
if (dbPath.startsWith("postgres://") || dbPath.startsWith("postgresql://")) {
  throw new Error("Postgres runtime is not implemented. Use a SQLite file path in DATABASE_URL.");
}

const resolvedPath = path.resolve(process.cwd(), dbPath);
const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const sqlite = new Database(resolvedPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

// Initialize and ensure table schema exists
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS discovery_scans (
    id TEXT PRIMARY KEY,
    niche TEXT NOT NULL,
    location_input TEXT NOT NULL,
    radius_km INTEGER NOT NULL DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    raw_discovered_count INTEGER DEFAULT 0,
    qualified_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    scan_id TEXT REFERENCES discovery_scans(id) ON DELETE SET NULL,
    place_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    formatted_address TEXT,
    phone TEXT,
    google_maps_url TEXT,
    rating REAL,
    review_count INTEGER,
    previous_rating REAL,
    previous_review_count INTEGER,
    last_review_date TEXT,
    reviews_last_30_days INTEGER,
    reviews_last_90_days INTEGER,
    reviews_last_180_days INTEGER,
    review_trend TEXT NOT NULL DEFAULT 'UNKNOWN',
    rating_source TEXT DEFAULT 'UNVERIFIED',
    has_website INTEGER NOT NULL DEFAULT 0,
    has_gbp_website_link INTEGER NOT NULL DEFAULT 0,
    is_gbp_disconnected INTEGER NOT NULL DEFAULT 0,
    website_url TEXT,
    gbp_website_url TEXT,
    unlinked_website_url TEXT,
    audit_status TEXT NOT NULL DEFAULT 'PENDING',
    audit_telemetry TEXT,
    reputation_score INTEGER DEFAULT 0,
    digital_gap_score INTEGER DEFAULT 0,
    opportunity_score INTEGER DEFAULT 0,
    confidence_score INTEGER DEFAULT 0,
    commercial_fit_score INTEGER DEFAULT 0,
    lead_attractiveness_score INTEGER DEFAULT 0,
    total_lead_score INTEGER DEFAULT 0,
    opportunity_type TEXT NOT NULL DEFAULT 'UNKNOWN',
    dossier TEXT,
    human_status TEXT NOT NULL DEFAULT 'NEW',
    first_observed_at TEXT,
    last_observed_at TEXT,
    observation_count INTEGER NOT NULL DEFAULT 1,
    review_count_delta INTEGER DEFAULT 0,
    rating_delta REAL DEFAULT 0,
    identity_source TEXT DEFAULT 'deterministic',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lead_observations (
    id TEXT PRIMARY KEY,
    lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
    scan_id TEXT REFERENCES discovery_scans(id) ON DELETE SET NULL,
    observed_rating REAL,
    observed_review_count INTEGER,
    observed_website_url TEXT,
    observed_phone TEXT,
    observed_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_leads_scan_id ON leads(scan_id);
  CREATE INDEX IF NOT EXISTS idx_leads_total_lead_score ON leads(total_lead_score DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_opportunity_type ON leads(opportunity_type);
  CREATE INDEX IF NOT EXISTS idx_leads_human_status ON leads(human_status);
  CREATE INDEX IF NOT EXISTS idx_observations_lead ON lead_observations(lead_id);
  CREATE INDEX IF NOT EXISTS idx_observations_time ON lead_observations(observed_at);
`);

// Self-healing migration for nullable fields & incremental columns
try {
  const columns = sqlite.prepare("PRAGMA table_info(leads)").all() as { name: string; notnull: number }[];
  const existingColumns = new Set(columns.map((c) => c.name));
  const ratingCol = columns.find((c) => c.name === "rating");

  if (ratingCol && ratingCol.notnull === 1) {
    sqlite.exec(`
      CREATE TABLE leads_nullable_fix (
        id TEXT PRIMARY KEY,
        scan_id TEXT REFERENCES discovery_scans(id) ON DELETE SET NULL,
        place_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT,
        formatted_address TEXT,
        phone TEXT,
        google_maps_url TEXT,
        rating REAL,
        review_count INTEGER,
        previous_rating REAL,
        previous_review_count INTEGER,
        last_review_date TEXT,
        reviews_last_30_days INTEGER,
        reviews_last_90_days INTEGER,
        reviews_last_180_days INTEGER,
        review_trend TEXT NOT NULL DEFAULT 'UNKNOWN',
        rating_source TEXT DEFAULT 'UNVERIFIED',
        has_website INTEGER NOT NULL DEFAULT 0,
        has_gbp_website_link INTEGER NOT NULL DEFAULT 0,
        is_gbp_disconnected INTEGER NOT NULL DEFAULT 0,
        website_url TEXT,
        gbp_website_url TEXT,
        unlinked_website_url TEXT,
        audit_status TEXT NOT NULL DEFAULT 'PENDING',
        audit_telemetry TEXT,
        reputation_score INTEGER DEFAULT 0,
        digital_gap_score INTEGER DEFAULT 0,
        opportunity_score INTEGER DEFAULT 0,
        confidence_score INTEGER DEFAULT 0,
        commercial_fit_score INTEGER DEFAULT 0,
        lead_attractiveness_score INTEGER DEFAULT 0,
        total_lead_score INTEGER DEFAULT 0,
        opportunity_type TEXT NOT NULL DEFAULT 'UNKNOWN',
        dossier TEXT,
        human_status TEXT NOT NULL DEFAULT 'NEW',
        first_observed_at TEXT,
        last_observed_at TEXT,
        observation_count INTEGER NOT NULL DEFAULT 1,
        review_count_delta INTEGER DEFAULT 0,
        rating_delta REAL DEFAULT 0,
        identity_source TEXT DEFAULT 'deterministic',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO leads_nullable_fix (
        id, scan_id, place_id, name, category, formatted_address, phone, google_maps_url,
        rating, review_count, previous_rating, previous_review_count, last_review_date,
        reviews_last_30_days, reviews_last_90_days, reviews_last_180_days, review_trend,
        has_website, has_gbp_website_link, is_gbp_disconnected, website_url, gbp_website_url,
        unlinked_website_url, audit_status, audit_telemetry, reputation_score, digital_gap_score,
        opportunity_score, confidence_score, commercial_fit_score, lead_attractiveness_score,
        total_lead_score, opportunity_type, dossier, human_status, first_observed_at,
        last_observed_at, observation_count, review_count_delta, rating_delta, identity_source,
        created_at, updated_at
      )
      SELECT
        id, scan_id, place_id, name, category, formatted_address, phone, google_maps_url,
        rating, review_count, previous_rating, previous_review_count, last_review_date,
        reviews_last_30_days, reviews_last_90_days, reviews_last_180_days, review_trend,
        has_website, has_gbp_website_link, is_gbp_disconnected, website_url, gbp_website_url,
        unlinked_website_url, audit_status, audit_telemetry, reputation_score, digital_gap_score,
        opportunity_score, confidence_score, commercial_fit_score, lead_attractiveness_score,
        total_lead_score, opportunity_type, dossier, human_status, first_observed_at,
        last_observed_at, observation_count, review_count_delta, rating_delta, identity_source,
        created_at, updated_at
      FROM leads;
      DROP TABLE leads;
      ALTER TABLE leads_nullable_fix RENAME TO leads;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_place_id_unique ON leads(place_id);
    `);
  }

  if (!existingColumns.has("rating_source")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN rating_source TEXT DEFAULT 'UNVERIFIED';");
  }
  if (!existingColumns.has("previous_rating")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN previous_rating REAL;");
  }
  if (!existingColumns.has("previous_review_count")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN previous_review_count INTEGER;");
  }
  if (!existingColumns.has("last_review_date")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN last_review_date TEXT;");
  }
  if (!existingColumns.has("reviews_last_30_days")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN reviews_last_30_days INTEGER;");
  }
  if (!existingColumns.has("reviews_last_90_days")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN reviews_last_90_days INTEGER;");
  }
  if (!existingColumns.has("reviews_last_180_days")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN reviews_last_180_days INTEGER;");
  }
  if (!existingColumns.has("review_trend")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN review_trend TEXT DEFAULT 'UNKNOWN';");
  }
  if (!existingColumns.has("has_gbp_website_link")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN has_gbp_website_link INTEGER DEFAULT 0;");
  }
  if (!existingColumns.has("is_gbp_disconnected")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN is_gbp_disconnected INTEGER DEFAULT 0;");
  }
  if (!existingColumns.has("gbp_website_url")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN gbp_website_url TEXT;");
  }
  if (!existingColumns.has("unlinked_website_url")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN unlinked_website_url TEXT;");
  }
  if (!existingColumns.has("commercial_fit_score")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN commercial_fit_score INTEGER DEFAULT 0;");
  }
  if (!existingColumns.has("lead_attractiveness_score")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN lead_attractiveness_score INTEGER DEFAULT 0;");
  }
  if (!existingColumns.has("rating_delta")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN rating_delta REAL DEFAULT 0;");
  }
  if (!existingColumns.has("disposition")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN disposition TEXT DEFAULT 'PURSUE';");
  }

  // Phase 5.2: Fail stale running scans on process boot (AbortControllers do not survive reboot)
  if (process.env.NODE_ENV !== "test") {
    sqlite.exec("UPDATE discovery_scans SET status = 'FAILED' WHERE status = 'RUNNING';");
  }
} catch (migErr: any) {
  console.error("[db migration] SQLite self-healing schema migration failed:", migErr);
  if (!migErr?.message?.includes("duplicate column name")) {
    throw migErr;
  }
}

export const db = drizzleSqlite(sqlite, { schema });
