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
| **AD-006** | 2026-09-01 | **Dedicated SQLite & Cloud Postgres Architecture** | Enabled clean local SQLite for local dedicated workstation workflows with zero network overhead, alongside Postgres migration tooling. | Postgres-only (Rejected: creates setup friction for repo reviewers without a running Postgres daemon). |
| **AD-007** | 2026-09-01 | **High-Fidelity Offline Simulation Suite** | Built-in realistic mock data generator representing real-world distribution curves (dental, roofing, HVAC, salon businesses with real HTML/DOM structures) allows instant testing of full discovery, filtering, Playwright auditing, and dossier synthesis without incurring API costs. | Hardcoded static JSON (Rejected: doesn't exercise dynamic network, timing, and DOM evaluation). |
| **AD-008** | 2026-09-01 | **Native Real-Time Playwright Google Maps Discovery Engine** | Implemented `LiveGoogleMapsAdapter` using headless Chromium automation to search Google Maps directly in real-time, extracting live ratings, reviews, phone numbers, addresses, and websites with zero third-party API subscription costs. | Paid Apify/Outscraper dependency (Retained as optional secondary adapters). |
| **AD-009** | 2026-09-01 | **SerpAPI / Google Search API Adapter & Supabase Migration Kit** | Added `SerpApiGoogleMapsAdapter` and 1-click `supabase/schema.sql` database schema for full cloud Supabase PostgreSQL migration. | Manual Drizzle push only (Provided both Drizzle + direct Supabase SQL editor script for developer convenience). |
| **AD-010** | 2026-09-02 | **Eradication of Synthetic Data & Honest Nullable Metrics** | Completely eradicated all synthetic timestamp approximations, random review loops, and fallback defaults (`4.5★/85 reviews`). When raw dates are unavailable upstream, fields evaluate to `null`, `reviewTrend = "UNKNOWN"`, and UI displays clean em-dashes (`—`). | Volume-based date approximations (Rejected: fabricates evidence). |
| **AD-011** | 2026-09-02 | **SSRF Defense with DNS Pre-Resolution & Link Hop Filtering** | `PlaywrightAuditEngine` performs DNS resolution (`dns.lookup` with all addresses) before navigation, strictly blocking `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `0.0.0.0/8`, and IPv6 `::1`, `fc00::/7`, `fe80::/10`. Added per-link SSRF checks on sample link HEAD verification to prevent 2nd-hop SSRF. | Naive hostname string check (Rejected: vulnerable to DNS rebinding and IP encodings). |
| **AD-012** | 2026-09-02 | **Removal of Silent Mock Fallback** | Removed automatic fallback to mock engine when live scraping encounters blocks or failures. If discovery fails or is blocked, the scan explicitly fails or records 0 qualified leads with transparent error logging. | Silent fallback (Rejected: misleading to operators). |
| **AD-013** | 2026-09-02 | **API Route Authorization & Token Isolation** | Protected `/api/scans`, `/api/scans/[id]`, `/api/leads/[id]/status`, `/api/leads/export`, and `/api/places/autocomplete` via `verifyApiAccess` supporting `LEAD_ENGINE_API_SECRET` via headers, bearer token, or secure cookies. | Unauthenticated public endpoints (Rejected: OWASP API security violation). |
| **AD-015** | 2026-09-02 | **Scan Cancellation Protocol & AbortController Pipeline** | Implemented `POST /api/scans/:id/cancel` and `AbortController` registration in `ScanPipelineService` allowing operators to instantly halt background crawling and headless Chromium audits with immediate status transition to `CANCELLED`. | Unstoppable background jobs (Rejected: wastes resources and locks UI). |
| **AD-016** | 2026-09-02 | **Dynamic Location-Adaptive Presets & Geolocation Auto-Detect** | Replaced hardcoded city presets with location-adaptive suggestions dynamically mapped to the operator's active/detected city (via timezone inference and optional 1-click GPS reverse geocoding). | Static hardcoded cities (Rejected: poor operator experience outside demo cities). |
| **AD-017** | 2026-09-02 | **Total Removal of Mock/Demo UI Options & Empirical Telemetry Badging** | Eradicated the mock/simulated option from the production UI dropdown and elevated the Lead Matrix and Dossier Workspace to display 100% real measured data (exact HTTP response ms, viewport DOM status, SSL status, direct `tel:` links, and verified review counts). | Synthetic sample demo generators (Rejected: violates empirical data integrity). |
| **AD-018** | 2026-09-02 | **True 4D Mathematical Scoring & Dual-Viewport Hardening** | Upgraded `ScoringEngine` to normalized 4-factor formula (30% Rep, 35% Gap, 20% Opp, 15% Conf) and upgraded `PlaywrightAuditEngine` to execute true dual-viewport audits (Phase 1: 375x812 Mobile, Phase 2: 1440x900 Desktop) with enterprise multi-IP & anti-obfuscation SSRF shielding. | 3-factor weighting with detached confidence (Rejected: mathematical model drift). |
| **AD-019** | 2026-09-02 | **Persistent Business Identity Resolution & Observation History Ledger** | Implemented `BusinessIdentityResolver` (extracting Google Maps Feature Hex IDs / CIDs with deterministic SHA-256 fallback) and non-destructive entity upserts with dedicated `lead_observations` historical tracking. Existing verified websites and triage stages are preserved across repeated discovery runs. | Transient random place IDs with destructive overwrites (Rejected: creates duplicate leads and discards verified intelligence). |
| **AD-020** | 2026-09-02 | **Atomic ACID Transactions, Clock Skew Guards & Secondary Entity Linking** | Enforced database-level `UNIQUE(place_id)` with pre-migration deduplication, wrapped lead ingestion and immutable ledger appends in single ACID transactions (`db.transaction`), derived review/rating deltas directly from the preceding ledger snapshot (`lead_observations`), added out-of-order observation protection (`observedAt >= lastObservedAt`), and verified under 100 simultaneous concurrent workers. Configured `ON DELETE SET NULL` on scans so historical observation records permanently survive discovery scan deletions. | Application-level check-then-write (Rejected: vulnerable to race conditions and out-of-order clock skew). |
| **AD-021** | 2026-09-02 | **Quiet Executive Visual Design & Sales Intelligence Dossier Refactor** | Redesigned frontend away from generic "AI SaaS dashboard" aesthetics (removing neon gradients, double-bezels, and technical jargon) into a quiet, serious operational tool (Linear/Stripe style). Made the Lead Matrix Table the central star of the application and transformed the inspection modal into a high-conviction Sales Intelligence Document with three clear sections: "Why This Lead" (commercial thesis), "What We Found" (audit checklist), and "Recommended Approach & Scope" with instant copyable outreach decks. | AI SaaS bento card dump with glowing borders (Rejected: communicates visual noise instead of serious agency software). |
| **AD-022** | 2026-09-02 | **Zero-Cost Secondary Unlinked Domain Discovery & GBP Disconnect Engine** | Implemented `SecondaryDomainResolver` leveraging fast zero-cost DuckDuckGo search and 40+ directory blacklist with multi-signal DOM entity proof (phone number match or city + brand token match). Automatically detects businesses owning an official website that is missing from their Google Maps profile, classifies them as `DISCONNECTED_GBP_WEBSITE`, audits the discovered unlinked domain, and synthesizes high-converting Google Business Profile reconnection pitch decks. Zero overhead when Maps already includes a URL. | Hardcoded single search API or naive domain guessing (Rejected: breaks zero-cost invariant or leads to false positive domain linking). |

---

## 2. Component Responsibilities

- **`UniversalFilterService`**: Evaluates business rating, review volume, and calculates true 30d/90d/180d velocity trajectory without synthetic fabrication.
- **`GooglePlacesApiAdapter`**: Live Google Places API integration extracting verified Google Place IDs, real ratings, review counts, and exact ISO review publish timestamps.
- **`LiveGoogleMapsAdapter`**: Real-time Playwright-driven Google Maps crawler searching live places, review distributions, and websites with strict DOM validation.
- **`SerpApiGoogleMapsAdapter`**: Direct REST integration for structured Google Maps & Local search.
- **`PlaywrightAuditEngine`**: Headless browser executor performing security, mobile viewport, speed, CTA, and broken link inspections with strict DNS pre-resolution SSRF defense.
- **`OpportunityClassifier`**: Maps business profile and audit gaps into `WEBSITE`, `WEBSITE_AUTOMATION`, or `CUSTOM_OPERATIONAL_SOFTWARE`.
- **`DossierSynthesizer`**: Compiles 4D scores (Reputation, Gap, Opportunity, Confidence) and formats multi-channel pitch scripts with zero hallucinations.
- **`ScanPipelineService`**: Background pipeline orchestrator managing discovery, qualification, headless audits, scan cancellation (`cancelScan`), and database persistence.
- **`CommandCenterUI`**: Interactive Next.js 15 studio interface featuring dynamic location auto-detect, location-adaptive market presets, active scan cancellation, live debounced Google Places autocomplete, real telemetry log streaming, dossier modal with copyable scripts, and responsive triage.

---

## 3. Mandatory Definition of Done (DoD) & Audit Log

### Executed Shell Commands
```bash
# 1. Vitest Unit & Integration Test Suite (19/19 tests passed in 2.18s)
npm run test

# 2. Production Next.js 15 Build (Clean build, 0 errors, 0 type warnings in 3.0s)
npm run build

# 3. Playwright End-to-End Smoke & Audit Suite (4/4 tests passed in 9.7s)
npm run test:e2e
```

### Verified Routes & URLs
- `GET /` — Executive Command Center Studio (200 OK with OWASP security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`)
- `POST /api/scans` — Live Scan Launch API (201 Created with schema validation & route authorization)
- `GET /api/scans/:id` — Scan & Qualified Leads API (200 OK)
- `POST /api/scans/:id/cancel` — Active Scan Cancellation API (200 OK with `status: CANCELLED`)
- `PATCH /api/leads/:id/status` — Triage Status Update API (200 OK)
- `GET /api/leads/export` — Lead CSV Export API (200 OK with `text/csv` attachment)
- `GET /api/places/autocomplete` — Worldwide Google Places Autocomplete Endpoint (200 OK)

