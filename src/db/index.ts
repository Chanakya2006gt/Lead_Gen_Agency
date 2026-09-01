import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const databaseMode = process.env.DATABASE_MODE || (process.env.DATABASE_URL?.startsWith("postgres") ? "postgres" : "sqlite");
const databaseUrl = process.env.DATABASE_URL || "./lead_engine.db";

let dbInstance: any;

if (databaseMode === "postgres" && databaseUrl.startsWith("postgres")) {
  // Supabase / PostgreSQL Connection with SSL & Pooling
  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: databaseUrl.includes("sslmode=require") || databaseUrl.includes("supabase.co") ? "require" : undefined,
  });

  dbInstance = drizzlePostgres(client, { schema });
} else {
  // Local SQLite (Default / Zero-Config)
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
      place_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      formatted_address TEXT,
      phone TEXT,
      google_maps_url TEXT,
      website_url TEXT,
      rating REAL NOT NULL,
      review_count INTEGER NOT NULL,
      last_review_date TEXT,
      reviews_last_30_days INTEGER DEFAULT 0,
      reviews_last_90_days INTEGER DEFAULT 0,
      reviews_last_180_days INTEGER DEFAULT 0,
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_ranking ON leads(total_lead_score, human_status);
    CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(place_id);

    UPDATE discovery_scans SET status = 'COMPLETED' WHERE status = 'RUNNING';
  `);

  dbInstance = drizzleSqlite(sqlite, { schema });
}

export const db = dbInstance;
