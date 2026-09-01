# DECISION LOG: Lead Engine (V1)
### Project Source of Truth & Persistent Memory

---

## 1. Architectural & Technical Decisions

| ID | Timestamp | Decision | Rationale | Alternatives Considered |
| :--- | :--- | :--- | :--- | :--- |
| **AD-001** | 2026-09-01 | **Private Agency Founder Tooling vs. Multi-Tenant SaaS** | The operator is building this proprietary engine for their own agency acquisition pipeline to avoid expensive recurring SaaS subscriptions ($300–$1500+/mo across Clay, MyWebAudit, D7, Outscraper). Multi-tenancy and billing bloat are excluded in V1 in favor of speed and raw utility. | Multi-tenant SaaS with Stripe billing (Rejected: out of scope, adds unnecessary friction for solo agency workflow). |
| **AD-002** | 2026-09-01 | **Location-Agnostic Universal Filter** | Search parameters (`niche`, `location`, `radiusKm`) are inputs to discovery, whereas qualification criteria (`rating >= 4.0`, `review_count >= 50`) are universal mathematical invariants. | Hardcoding geographic rules in filtering (Rejected: destroys reusability across different cities/countries). |
| **AD-003** | 2026-09-01 | **Headless Playwright Dual-Viewport Audit** | Using headless Chromium to inspect real rendered DOM across mobile (`375x812`) and desktop (`1440x900`) viewports provides true empirical facts (horizontal overflow, viewport meta presence, interactive button targets, real latency) that static regex or basic HTTP GET scrapers miss. | Static cheerio/curl HTML parser (Rejected: misses client-side rendered SPAs, computed CSS overflow, and real DOM interactions). |
| **AD-004** | 2026-09-01 | **Deterministic Fallback for AI Synthesis** | Guarantee 100% offline availability and zero crash risk if OpenAI/Gemini API keys are absent or rate-limited. System formulates high-conviction pitch angles using rule-based synthesis directly bound to audit telemetry findings. | Pure LLM dependency (Rejected: fragile, costs API credits, risks timeouts). |
| **AD-005** | 2026-09-01 | **PostgreSQL + Drizzle ORM Schema with JSONB Telemetry** | Drizzle ORM provides strict TypeScript types, zero-overhead queries, and native JSONB storage for dynamic audit findings and synthesis dossiers. | Prisma / TypeORM (Rejected: heavier runtime footprint, complex migrations). |
| **AD-006** | 2026-09-01 | **Dual-Engine DB Support (Supabase PostgreSQL / Local SQLite)** | Enabled native dynamic database adapter supporting Supabase Cloud PostgreSQL connection pooling via `postgres` driver and local zero-config SQLite via `better-sqlite3`. | Postgres-only (Rejected: creates setup friction for repo reviewers without a running Postgres daemon). |
| **AD-007** | 2026-09-01 | **High-Fidelity Offline Simulation Suite** | Built-in realistic mock data generator representing real-world distribution curves (dental, roofing, HVAC, salon businesses with real HTML/DOM structures) allows instant testing of full discovery, filtering, Playwright auditing, and dossier synthesis without incurring API costs. | Hardcoded static JSON (Rejected: doesn't exercise dynamic network, timing, and DOM evaluation). |
| **AD-008** | 2026-09-01 | **Upsert OnConflict Handling for Repeated Scans** | Configured `onConflictDoUpdate` indexed on `leads.place_id` to allow operators to refresh scan data for the same business place ID without SQL unique constraint collisions. | Simple insert or replace (Rejected: replace would drop existing triage history). |
| **AD-009** | 2026-09-01 | **Native Real-Time Playwright Google Maps Discovery Engine** | Implemented `LiveGoogleMapsAdapter` using headless Chromium automation to search Google Maps directly in real-time, extracting live ratings, reviews, phone numbers, addresses, and websites with zero third-party API subscription costs. | Paid Apify/Outscraper dependency (Retained as optional secondary adapters). |
| **AD-010** | 2026-09-01 | **SerpAPI / Google Search API Adapter & Supabase Migration Kit** | Added `SerpApiGoogleMapsAdapter` and 1-click `supabase/schema.sql` database schema for full cloud Supabase PostgreSQL migration. | Manual Drizzle push only (Provided both Drizzle + direct Supabase SQL editor script for developer convenience). |

---

## 2. Component Responsibilities

- **`UniversalFilterService`**: Evaluates business rating, review volume, and calculates 30d/90d/180d velocity trajectory.
- **`LiveGoogleMapsAdapter`**: Real-time Playwright-driven Google Maps crawler searching live places, review distributions, and websites.
- **`SerpApiGoogleMapsAdapter`**: Direct REST integration for structured Google Maps & Local search.
- **`PlaywrightAuditEngine`**: Headless browser executor performing security, mobile viewport, speed, CTA, and broken link inspections with SSRF defense.
- **`OpportunityClassifier`**: Maps business profile and audit gaps into `WEBSITE`, `WEBSITE_AUTOMATION`, or `CUSTOM_OPERATIONAL_SOFTWARE`.
- **`DossierSynthesizer`**: Compiles 4D scores (Reputation, Gap, Opportunity, Confidence) and formats multi-channel pitch scripts with zero hallucinations.
- **`ScanPipelineService`**: Asynchronous background pipeline orchestrator managing discovery, qualification, headless audits, and database persistence.
- **`CommandCenterUI`**: Interactive Next.js 15 studio interface for launching live scans, filtering lead tables, inspecting dossiers, copying multi-channel scripts (Cold Email, WhatsApp, Phone Gatekeeper, Technical Scope), and updating triage states.

---

## 3. Mandatory Definition of Done (DoD) & Audit Log

### Executed Shell Commands
```bash
# 1. Install dependencies including Supabase & Postgres drivers
npm install postgres @supabase/supabase-js

# 2. Vitest Unit & Integration Test Suite (16 tests passed)
npm run test

# 3. Playwright End-to-End Smoke & Audit Suite (4 tests passed in 14.5s)
npm run test:e2e

# 4. Production Next.js Build (0 errors, 0 type warnings)
npm run build
```

### Verified Routes & URLs
- `GET /` — Executive Command Center Studio (200 OK with OWASP security headers)
- `POST /api/scans` — Live Scan Launch API (201 Created)
- `GET /api/scans/:id` — Scan & Qualified Leads API (200 OK)
- `PATCH /api/leads/:id/status` — Triage Status Update API (200 OK)
- `GET /api/leads/export` — Lead CSV Export API (200 OK with `text/csv` attachment)
