# System Architecture Document
## Project: Private Client Discovery & High-Conviction Lead Engine (V1)

---

## 1. High-Level Architecture Overview

The system is architected as a modular, pipeline-driven engine with decoupled layers for **Data Discovery**, **Qualification Filtering**, **Headless Auditing**, **Synthesis & Scoring**, **Persistence**, and **Command Center Presentation**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Command Center UI (Next.js 15 App)                   │
│      [Launch Scan] ── [Lead Matrix Table] ── [Lead Dossier Inspector]   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Trigger / Query
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     API & Pipeline Controller Layer                     │
│               POST /api/scans  |  GET /api/scans/:id/leads              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│ Discovery Ingestion Adapters  │               │   Universal Invariant Filter  │
│  - ApifyMapsAdapter           │ ──Raw Data──► │   - Rating >= 4.0             │
│  - OutscraperAdapter          │               │   - Review Count >= 50        │
│  - MockDiscoveryAdapter       │               │   - 30d/90d/180d Momentum     │
└───────────────────────────────┘               └───────────────┬───────────────┘
                                                                │
                                     ┌──────────────────────────┴──────────────────────────┐
                                     ▼ website == null                                     ▼ website != null
                      ┌──────────────────────────────┐                      ┌──────────────────────────────┐
                      │ No-Website Fast Track Handler│                      │ Playwright Audit Engine      │
                      │ - Sets Status = NO_WEBSITE   │                      │ - Mobile (375x812) Viewport  │
                      │ - Max Digital Gap Score      │                      │ - Desktop (1440x900) Viewport│
                      │ - Immediate Priority         │                      │ - SSL/DOM/CTA/Speed Telemetry│
                      └──────────────┬───────────────┘                      └──────────────┬───────────────┘
                                     │                                                     │
                                     └──────────────────────────┬──────────────────────────┘
                                                                ▼
                                                ┌───────────────────────────────┐
                                                │ Synthesis & Scoring Engine    │
                                                │ - 4D Dynamic Score Math       │
                                                │ - Operational Opportunity Tier│
                                                │ - AI / Deterministic Dossier  │
                                                └───────────────┬───────────────┘
                                                                │
                                                                ▼
                                                ┌───────────────────────────────┐
                                                │ PostgreSQL (Drizzle ORM)      │
                                                │ - discovery_scans table       │
                                                │ - leads table (JSONB dossiers)│
                                                └───────────────────────────────┘
```

---

## 2. Core Components & Subsystems

### 2.1 Discovery & Adapter Layer (`src/services/discovery/`)
- **`DiscoveryAdapter` Interface**: Defines contract `discover(params: DiscoveryParams): Promise<RawBusinessRecord[]>`.
- **`ApifyMapsAdapter`**: Connects to Apify Google Maps & Reviews Actor.
- **`OutscraperAdapter`**: Alternative connector for Outscraper Maps API.
- **`MockDiscoveryAdapter`**: Built-in high-fidelity synthetic fixture adapter generating real-world business distributions for local testing without API credit consumption.

### 2.2 Universal Filter & Recency Engine (`src/services/filter/`)
- **`UniversalFilterService`**:
  - Validates `rating >= 4.0` and `review_count >= 50`.
  - Parses review timestamps to compute:
    - $\text{reviews}_{30\text{d}}$, $\text{reviews}_{90\text{d}}$, $\text{reviews}_{180\text{d}}$, and $\text{last\_review\_date}$.
  - Computes velocity trajectory:
    - $R_v = \frac{\text{reviews}_{30\text{d}} \times 3}{\text{reviews}_{90\text{d}} + 0.001}$
    - Maps to `GROWING`, `STABLE`, `DECLINING`, `STALE`, `UNKNOWN`.

### 2.3 Headless Playwright Audit Engine (`src/services/auditor/`)
- **`PlaywrightAuditEngine`**:
  - Manages browser pools and isolated browser contexts.
  - Context 1: **Mobile** (`viewport: { width: 375, height: 812 }`, `isMobile: true`, `hasTouch: true`).
  - Context 2: **Desktop** (`viewport: { width: 1440, height: 900 }`).
  - Captures:
    1. **Security & Protocol**: HTTPS active, valid SSL, redirect chain.
    2. **Mobile UX**: Presence of `<meta name="viewport">`, horizontal scroll/overflow detection via `document.documentElement.scrollWidth > window.innerWidth`.
    3. **Performance**: DOM Content Loaded, First Paint, TTFB, navigation timing.
    4. **Conversion Elements**:
       - `tel:` links (`a[href^="tel:"]`).
       - `mailto:` links (`a[href^="mailto:"]`).
       - WhatsApp chat triggers (`a[href*="wa.me"]`, `a[href*="api.whatsapp.com"]`).
       - Contact / Booking forms (`form`, `button` with keywords: book, schedule, appointment, quote, contact, enquiry).
    5. **DOM Health**: Broken link verification on top navigation, console/runtime error interception.
  - Outputs structured, type-safe `AuditTelemetry`.

### 2.4 Scoring & Classification Engine (`src/services/scoring/`)
- **Scoring Formulas (Normalized 0 – 100)**:
  - **Reputation Score** ($S_{\text{rep}}$):
    $$S_{\text{rep}} = \min(100, (\text{rating} - 4.0) \times 50 + \min(30, \text{review\_count} \times 0.05) + \text{velocityBonus})$$
  - **Digital Gap Score** ($S_{\text{gap}}$):
    - No website: $100$
    - With website: $\sum \text{penalty}(\text{SSL missing}, \text{no viewport}, \text{no CTAs}, \text{slow speed}, \text{broken links})$
  - **Opportunity Score** ($S_{\text{opp}}$):
    - Evaluates business niche complexity (e.g. Clinic/Dental/Contractor = high operational leverage) + lack of digital systems.
  - **Evidence Confidence Score** ($S_{\text{conf}}$):
    - Percentage of audit telemetry points with empirical DOM proof ($1.0 = 100\%$).
  - **Total Lead Score** ($S_{\text{total}}$):
    $$S_{\text{total}} = 0.35 \times S_{\text{rep}} + 0.30 \times S_{\text{gap}} + 0.20 \times S_{\text{opp}} + 0.15 \times S_{\text{conf}}$$

### 2.5 AI & Grounded Dossier Synthesizer (`src/services/synthesis/`)
- **`DossierSynthesizer`**:
  - Classifies into `WEBSITE`, `WEBSITE_AUTOMATION`, `CUSTOM_OPERATIONAL_SOFTWARE`.
  - **LLM Mode**: Uses structured JSON schema with OpenAI/Gemini to produce tailored pitch angles.
  - **Deterministic Rule-Based Fallback**: Formulates exact pitch angles and bottlenecks directly from audit telemetry when API keys are unconfigured, guaranteeing 100% offline uptime.

---

## 3. Data Flow & State Machine

```
[Start Scan]
     │
     ▼
[STATUS: RUNNING] ──► Ingest Google Maps records
     │
     ▼
[Filter Engine] ────► Reject unqualified (rating < 4.0 or reviews < 50)
     │
     ├─► [website == null] ──► Set NO_WEBSITE ──► Compute Dossier ──► [STATUS: COMPLETED]
     │
     └─► [website != null] ──► Playwright Audit ──► Compute Dossier ──► [STATUS: COMPLETED]
                                    │ (on network crash / timeout)
                                    ▼
                               [STATUS: AUDIT_FAILED with fallback dossier]
```

---

## 4. Database Schema Specification

```
┌─────────────────────────────────────────────────────────────┐
│                      discovery_scans                        │
├─────────────────────────────────────────────────────────────┤
│ id: UUID (PK)                                               │
│ niche: VARCHAR(100)                                         │
│ location_input: VARCHAR(150)                                │
│ radius_km: INT                                              │
│ status: VARCHAR(50) [RUNNING | COMPLETED | FAILED]          │
│ raw_discovered_count: INT                                   │
│ qualified_count: INT                                        │
│ created_at: TIMESTAMP WITH TIME ZONE                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ 1:N
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                          leads                              │
├─────────────────────────────────────────────────────────────┤
│ id: UUID (PK)                                               │
│ scan_id: UUID (FK -> discovery_scans.id)                    │
│ place_id: VARCHAR(255) [UNIQUE]                             │
│ name: VARCHAR(255)                                          │
│ category: VARCHAR(150)                                      │
│ formatted_address: TEXT                                     │
│ phone: VARCHAR(50)                                          │
│ google_maps_url: TEXT                                       │
│ website_url: TEXT                                           │
│ rating: NUMERIC(3,2)                                        │
│ review_count: INT                                           │
│ last_review_date: TIMESTAMP                                 │
│ reviews_last_30_days: INT                                   │
│ reviews_last_90_days: INT                                   │
│ reviews_last_180_days: INT                                  │
│ review_trend: VARCHAR(20) [GROWING|STABLE|DECLINING|STALE]  │
│ has_website: BOOLEAN                                        │
│ audit_status: VARCHAR(20) [PENDING|NO_WEBSITE|AUDITED|FAILED│
│ audit_telemetry: JSONB                                      │
│ reputation_score: INT                                       │
│ digital_gap_score: INT                                      │
│ opportunity_score: INT                                      │
│ confidence_score: INT                                       │
│ total_lead_score: INT                                       │
│ opportunity_type: VARCHAR(30)                               │
│ dossier: JSONB                                              │
│ human_status: VARCHAR(30) [NEW|REVIEWED|OUTREACH|ARCHIVED]  │
│ created_at: TIMESTAMP WITH TIME ZONE                        │
│ updated_at: TIMESTAMP WITH TIME ZONE                        │
└─────────────────────────────────────────────────────────────┘
```
