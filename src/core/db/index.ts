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

const sqlite = new Database(dbPath, { timeout: 30000 });

try {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 30000");
} catch {}

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
    place_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    formatted_address TEXT,
    phone TEXT,
    google_maps_url TEXT,
    website_url TEXT,
    rating REAL NOT NULL,
    review_count INTEGER NOT NULL,
    previous_rating REAL,
    previous_review_count INTEGER,
    last_review_date TEXT,
    reviews_last_30_days INTEGER,
    reviews_last_90_days INTEGER,
    reviews_last_180_days INTEGER,
    review_trend TEXT NOT NULL DEFAULT 'UNKNOWN',
    has_website INTEGER NOT NULL DEFAULT 0,
    is_gbp_disconnected INTEGER NOT NULL DEFAULT 0,
    unlinked_website_url TEXT,
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
    scan_id TEXT REFERENCES discovery_scans(id) ON DELETE SET NULL,
    observed_rating REAL NOT NULL,
    observed_review_count INTEGER NOT NULL,
    observed_website_url TEXT,
    observed_phone TEXT,
    observed_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_leads_ranking ON leads(total_lead_score, human_status);
  CREATE INDEX IF NOT EXISTS idx_leads_scan_id ON leads(scan_id);
  CREATE INDEX IF NOT EXISTS idx_observations_lead ON lead_observations(lead_id);
`);

// Defensive Pre-Migration Deduplication & Schema Evolution Helper
try {
  const tableInfo = sqlite.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
  const existingColumns = new Set(tableInfo.map((c) => c.name));

  if (!existingColumns.has("google_maps_url")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN google_maps_url TEXT;");
  }
  if (!existingColumns.has("previous_rating")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN previous_rating REAL;");
  }
  if (!existingColumns.has("previous_review_count")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN previous_review_count INTEGER;");
  }
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
  if (!existingColumns.has("is_gbp_disconnected")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN is_gbp_disconnected INTEGER NOT NULL DEFAULT 0;");
  }
  if (!existingColumns.has("unlinked_website_url")) {
    sqlite.exec("ALTER TABLE leads ADD COLUMN unlinked_website_url TEXT;");
  }

  // Pre-Migration Deduplication: Find any existing duplicate place_id rows, merge observations, and delete duplicates
  const duplicatePlaceIds = sqlite.prepare(`
    SELECT place_id, COUNT(*) as count 
    FROM leads 
    GROUP BY place_id 
    HAVING count > 1
  `).all() as { place_id: string; count: number }[];

  if (duplicatePlaceIds.length > 0) {
    for (const dup of duplicatePlaceIds) {
      const allRows = sqlite.prepare(`
        SELECT id, observation_count, updated_at 
        FROM leads 
        WHERE place_id = ? 
        ORDER BY observation_count DESC, updated_at DESC
      `).all(dup.place_id) as { id: string }[];

      if (allRows.length > 1) {
        const canonicalId = allRows[0].id;
        const duplicateIds = allRows.slice(1).map((r) => r.id);

        for (const duplicateId of duplicateIds) {
          sqlite.prepare("UPDATE lead_observations SET lead_id = ? WHERE lead_id = ?").run(canonicalId, duplicateId);
          sqlite.prepare("DELETE FROM leads WHERE id = ?").run(duplicateId);
        }
      }
    }
  }

  // Enforce DB-Level Unique Index on place_id
  sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_place_id_unique ON leads(place_id);");

  // Migrate foreign keys if needed to ensure ON DELETE SET NULL on scans
  const leadsFkList = sqlite.prepare("PRAGMA foreign_key_list(leads)").all() as { table: string; on_delete: string }[];
  const scanLeadsFk = leadsFkList.find((f) => f.table === "discovery_scans");
  if (scanLeadsFk && scanLeadsFk.on_delete === "CASCADE") {
    sqlite.exec(`
      CREATE TABLE leads_new (
        id TEXT PRIMARY KEY,
        scan_id TEXT REFERENCES discovery_scans(id) ON DELETE SET NULL,
        place_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        formatted_address TEXT,
        phone TEXT,
        google_maps_url TEXT,
        website_url TEXT,
        rating REAL NOT NULL,
        review_count INTEGER NOT NULL,
        previous_rating REAL,
        previous_review_count INTEGER,
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
      INSERT INTO leads_new SELECT * FROM leads;
      DROP TABLE leads;
      ALTER TABLE leads_new RENAME TO leads;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_place_id_unique ON leads(place_id);
    `);
  }

  const obsFkList = sqlite.prepare("PRAGMA foreign_key_list(lead_observations)").all() as { table: string; on_delete: string }[];
  const scanFk = obsFkList.find((f) => f.table === "discovery_scans");
  if (scanFk && scanFk.on_delete === "CASCADE") {
    sqlite.exec(`
      CREATE TABLE lead_observations_new (
        id TEXT PRIMARY KEY,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        scan_id TEXT REFERENCES discovery_scans(id) ON DELETE SET NULL,
        observed_rating REAL NOT NULL,
        observed_review_count INTEGER NOT NULL,
        observed_website_url TEXT,
        observed_phone TEXT,
        observed_at TEXT NOT NULL
      );
      INSERT INTO lead_observations_new (id, lead_id, scan_id, observed_rating, observed_review_count, observed_website_url, observed_phone, observed_at)
        SELECT id, lead_id, scan_id, observed_rating, observed_review_count, observed_website_url, observed_phone, observed_at FROM lead_observations;
      DROP TABLE lead_observations;
      ALTER TABLE lead_observations_new RENAME TO lead_observations;
      CREATE INDEX IF NOT EXISTS idx_observations_lead ON lead_observations(lead_id);
    `);
  }
} catch (migErr) {
  // Silent fallback
}

export const db = drizzleSqlite(sqlite, { schema });
