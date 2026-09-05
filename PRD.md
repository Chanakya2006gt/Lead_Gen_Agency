# Product Requirements Document (PRD)
## Project: Private Client Discovery & High-Conviction Lead Engine (V1)

---

## 1. Executive Summary & Vision
The **Lead Engine** is a proprietary, high-conviction client discovery, qualification, and automated auditing command center built for a solo agency founder. 

Commercial B2B lead generation and website auditing tools (such as Clay, MyWebAudit, D7 Lead Finder, and Outscraper) charge heavy monthly subscriptions and per-action credits while producing noisy, unverified bulk leads. This private engine eliminates external SaaS costs and delivers an automated pipeline that finds local businesses with **proven cash flow and active reputation momentum**, runs **deep headless technical & conversion audits**, and synthesizes **evidence-backed pitch dossiers** to close high-ticket website, automation, and custom software contracts.

---

## 2. Target Persona & User Journey
- **User / Operator**: Agency Founder / Technical Operator.
- **Goal**: Rapidly discover and qualify local businesses in any niche and geographic area, inspect their real digital & operational bottlenecks with zero guesswork, and produce actionable pitch angles.
- **Workflow Journey**:
  1. **Configure & Launch Scan**: Enter target `{ niche, location, radiusKm }` (e.g. `Dental Clinics`, `Warangal`, `15km`).
  2. **Automated Discovery & Ingestion**: Fetches Google Maps business profiles and review timestamps.
  3. **Universal Qualification Filter**: Automatically eliminates weak or dormant businesses using strict math rules.
  4. **Multi-Vector Headless Audit**: Runs Playwright headless Chromium on qualified websites across Mobile and Desktop contexts.
  5. **Opportunity Classification & Synthesis**: Categorizes business needs (`WEBSITE`, `WEBSITE_AUTOMATION`, `CUSTOM_OPERATIONAL_SOFTWARE`) and compiles a structured dossier with grounded DOM evidence.
  6. **Human Review & Action**: Operator reviews the ranked lead dossier in the command center UI, copies grounded pitch notes, and moves leads through triage stages (`NEW` → `REVIEWED` → `READY_FOR_OUTREACH` → `ARCHIVED`).

---

## 3. The 13 Core System Invariants

1. **Location-Agnostic Core**: Location, niche, and radius are input parameters to discovery; the qualification rules are universal and invariant.
2. **Hard Numeric Qualification Threshold**:
   - `rating >= 4.0` (Strictly 4.0, rejecting 3.99).
   - `review_count >= 50` (Strictly 50, rejecting 49).
   - Both conditions must be satisfied simultaneously to enter the candidate pool.
3. **Descriptive Review Recency Metrics**:
   - Computes `reviews_last_30_days`, `reviews_last_90_days`, `reviews_last_180_days`, and `last_review_date` when review timestamps are available.
4. **Longitudinal Review Velocity**:
   - Evaluates review trajectory across historical observation ledger records into `GROWING`, `STABLE`, `DECLINING`, `STALE`, or `UNKNOWN`. Single discovery pulls evaluate honestly to `UNKNOWN`.
5. **Binary Website Gate**:
   - `website == null` $\rightarrow$ Flagged immediately as **High-Priority No-Website Opportunity**.
   - `website != null` $\rightarrow$ Queued for multi-vector Headless Playwright Audit.
6. **Multi-Vector Technical & Conversion Audit**:
   - Technical: HTTPS/SSL status, mobile `<meta name="viewport">`, page load latency, HTTP errors, JS console errors.
   - UX & Usability: Mobile layout stability, navigation anchors, service clarity.
   - Conversion Journey: Primary CTA detection (`tel:`, `mailto:`, `wa.me`), booking/enquiry `<form>` and button patterns.
7. **Strict Grounded Evidence Invariant (Zero Hallucinations)**:
   - Every finding is stored as a structured tuple: `{ category, finding, evidence, selectorOrUrl, confidence }`.
   - Explicitly forbids unsubstantiated claims ("probably losing $10k/mo"). Requires empirical DOM facts ("Hero CTA button missing; mobile body width overflows viewport by 42px").
8. **Multi-Tier Opportunity Classification**:
   - `WEBSITE`: Pure digital storefront gap (no site or severely broken legacy site).
   - `WEBSITE_AUTOMATION`: Online scheduling, calendar booking, intake forms, lead capture.
   - `CUSTOM_OPERATIONAL_SOFTWARE`: High-ticket quotation/RFQ engines, WhatsApp ordering workflows, stage-locking milestones, multi-staff ERP/CRM sync.
   - `UNKNOWN`: Insufficient signals.
9. **Business Quality & Paying Capacity**:
   - Prioritizes active businesses with high cash-flow momentum (e.g. 4.8★ / 500 reviews / active 90d velocity over 4.9★ / 51 reviews / stale).
10. **Bounded AI Role (Research & Synthesis Only)**:
    - AI is restricted to structured evidence synthesis, competitor context, and pitch formulating.
    - AI is forbidden from inventing revenue, customer metrics, or fake ROI.
    - Fully operational in deterministic offline mode if API keys are absent.
11. **Human-in-the-Loop Review**:
    - AI never executes autonomous outreach. It produces an audited business dossier for human operator approval.
12. **Four-Dimensional Dynamic Scoring**:
    - $\text{Reputation Score } (0-100)$
    - $\text{Digital Gap Score } (0-100)$
    - $\text{Opportunity Score } (0-100)$
    - $\text{Confidence Score } (0-100)$
    - $\text{Total Weighted Lead Score } (0-100)$
13. **Deliberately Out of Scope for V1**:
    - ❌ Multi-tenant user auth / billing tiers (this is a private proprietary tool).
    - ❌ Automated cold spam email / WhatsApp blast bots.
    - ❌ Full blown CRM accounting & invoice generators.

---

## 4. Functional Specifications

### 4.1 Discovery & Ingestion Module
- Supports modular scraper adapters:
  - `GooglePlacesApiAdapter` (Primary official Places API).
  - `LiveGoogleMapsAdapter` (Headless Playwright Crawler).
  - `SerpApiGoogleMapsAdapter` (Structured search API).
  - `ApifyMapsAdapter` (Production API).
  - `OutscraperAdapter` (Alternative API).
  - `MockDiscoveryAdapter` (Offline / zero-cost test suite with realistic business data).
- Validates query inputs and triggers asynchronous pipeline execution with real-time status logging.

### 4.2 Universal Filter & Momentum Engine
- Evaluates raw business records against qualification gates.
- Parses ISO review timestamps and calculates 30-day, 90-day, and 180-day buckets.
- Tracks longitudinal velocity across observation ledger history.

### 4.3 Headless Playwright Audit Engine
- Launches headless Chromium instance.
- Runs audit across two viewports:
  - Mobile context (`375x812`, touch enabled, user agent iPhone/Pixel).
  - Desktop context (`1440x900`).
- Gathers network telemetry, security indicators, load speed, broken link status, and interactive CTA selectors.

### 4.4 Synthesis & Dossier Generator
- Synthesizes Playwright telemetry + review momentum into actionable pitch angles.
- Provides grounded pitch talking points, identified technical/UX bottlenecks, and suggested project scope.

### 4.5 Command Center UI
- Search & Scan Launchpad: Inputs for Niche, Location, Radius with quick presets.
- Real-time Scan Progress & Metrics: Discovered vs. Qualified vs. Audited counts.
- Ranked Lead Matrix: Data table with sorting by total lead score, filters by opportunity type, review velocity badge, and website status.
- Lead Dossier Modal / Drawer: Deep inspection view showing:
  - Reputation & Momentum breakdown.
  - Empirical Audit Findings with DOM evidence.
  - Grounded Pitch Angle & Value Proposition.
  - Triage Actions (`Mark Reviewed`, `Ready for Outreach`, `Archive`, `Copy Pitch`).

---

## 5. Non-Functional Requirements
- **Performance**: Lead scoring and local filtering under 5ms per record; Playwright audit under 8s per site with timeout protection.
- **Reliability**: Graceful handling of dead URLs, anti-bot protections, and network timeouts.
- **Data Integrity**: Local SQLite (WAL) persistence with Drizzle ORM and strict JSON schema validation.
- **Zero Hallucination Guarantee**: All audit points must match DOM/telemetry evidence.
