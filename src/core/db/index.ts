import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const isTestEnv = process.env.NODE_ENV === "test" || process.env.PLAYWRIGHT_TEST === "1";
const databaseUrl = process.env.DATABASE_URL || (isTestEnv ? "./lead_engine_test.db" : "./lead_engine.db");
const dbPath = databaseUrl.startsWith("postgres") ? path.join(process.cwd(), "lead_engine.db") : databaseUrl;

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir) && dir !== ".") {
  fs.mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath, { timeout: 10000 });
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 10000");

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
    scan_id TEXT REFERENCES discovery_scans(id) ON DELETE CASCADE,
    place_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    formatted_address TEXT,
    phone TEXT,
    google_maps_url TEXT,
    website_url TEXT,
    rating REAL NOT NULL,
    review_count INTEGER NOT NULL,
    last_review_date TEXT,
    reviews_last_30_days INTEGER,
    reviews_last_90_days INTEGER,
    reviews_last_180_days INTEGER,
    review_trend TEXT NOT NULL DEFAULT 'UNKNOWN',
    has_website INTEGER NOT NULL DEFAULT 0,
    audit_status TEXT NOT NULL DEFAULT 'PENDING',
    audit_telemetry TEXT,
    reputation_score INTEGER DEFAULT 0,
    digital_gap_score INTEGER DEFAULT 0,
    opportunity_score INTEGER DEFAULT 0,
    confidence_score INTEGER DEFAULT 0,
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
    scan_id TEXT REFERENCES discovery_scans(id) ON DELETE CASCADE,
    observed_rating REAL NOT NULL,
    observed_review_count INTEGER NOT NULL,
    observed_website_url TEXT,
    observed_phone TEXT,
    observed_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_leads_ranking ON leads(total_lead_score, human_status);
  CREATE INDEX IF NOT EXISTS idx_leads_scan_id ON leads(scan_id);
  CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(place_id);
  CREATE INDEX IF NOT EXISTS idx_observations_lead ON lead_observations(lead_id);
`);

// Graceful schema migration helper for existing SQLite databases
try {
  const tableInfo = sqlite.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
  const existingColumns = new Set(tableInfo.map((c) => c.name));

  if (!existingColumns.has("first_observed_at")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN first_observed_at TEXT;");
  }
  if (!existingColumns.has("last_observed_at")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN last_observed_at TEXT;");
  }
  if (!existingColumns.has("observation_count")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN observation_count INTEGER NOT NULL DEFAULT 1;");
  }
  if (!existingColumns.has("review_count_delta")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN review_count_delta INTEGER DEFAULT 0;");
  }
  if (!existingColumns.has("rating_delta")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN rating_delta REAL DEFAULT 0;");
  }
  if (!existingColumns.has("identity_source")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN identity_source TEXT DEFAULT 'deterministic';");
  }
} catch {
  // Pragma migration handled
}

export const db = drizzleSqlite(sqlite, { schema });
