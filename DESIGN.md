# Design System & UI Specification
## Project: Private Client Discovery & High-Conviction Lead Engine (V1)

---

## 1. Visual Identity & Creative Direction

The Lead Engine is a high-density, command-center intelligence dashboard. It avoids generic consumer-app fluff, loud gradients, and unnecessary whitespace in favor of a sleek, dark-slate **Executive Intelligence Terminal** aesthetic.

- **Design Philosophy**: High information density, clear visual hierarchy, immediate status legibility, tactile feedback, and anti-slop restraint.
- **Tone**: Precise, authoritative, surgical, private-agency workstation.

---

## 2. Color Palette & Semantic Tokens

### 2.1 Base Colors (Dark Mode First)
- **Background Root**: `bg-[#0B0F17]` (Deep Obsidian / Midnight Navy)
- **Surface Elevated (Cards, Tables, Modals)**: `bg-[#131B2A]` / `bg-[#1A2337]`
- **Borders & Dividers**: `border-[#26354D]` / `border-[#1F2B3F]`
- **Text Primary**: `text-slate-100` (`#F1F5F9`)
- **Text Secondary**: `text-slate-400` (`#94A3B8`)
- **Text Muted / Footnotes**: `text-slate-500` (`#64748B`)

### 2.2 Brand & Accents
- **Primary Accent (Indigo/Cobalt)**: `#6366F1` / `hover:#4F46E5` (Active states, primary CTA, scan trigger)
- **High-Priority Fire Accent (Amber/Orange)**: `#F59E0B` / `#D97706` (No-website high-conviction flag)
- **Reputation Momentum (Emerald)**: `#10B981` (GROWING review velocity, rating >= 4.8★)
- **Warning / Stale (Amber/Yellow)**: `#FBBF24` (STALE review velocity, missing mobile viewport)
- **Destructive / Error (Rose/Red)**: `#F43F5E` (Broken links, unhandled JS errors, HTTP failures)
- **Opportunity Tier Badges**:
  - `WEBSITE`: `bg-sky-500/10 text-sky-400 border-sky-500/30`
  - `WEBSITE_AUTOMATION`: `bg-indigo-500/10 text-indigo-400 border-indigo-500/30`
  - `CUSTOM_OPERATIONAL_SOFTWARE`: `bg-emerald-500/10 text-emerald-400 border-emerald-500/30`

---

## 3. Typography Hierarchy

- **Primary Sans Font**: `Inter, system-ui, -apple-system, sans-serif`
- **Monospace Font (Telemetry, Scores, Selectors, Timestamps)**: `JetBrains Mono, Menlo, monospace`

| Scale | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `display` | `28px` (`1.75rem`) | `36px` | `700` | Command Center Header / Metrics Summary |
| `title` | `20px` (`1.25rem`) | `28px` | `600` | Modal Titles, Section Headers |
| `body-bold` | `14px` (`0.875rem`) | `20px` | `600` | Business Names, Table Column Headers |
| `body` | `14px` (`0.875rem`) | `20px` | `400` | Findings, Dossier Pitch copy, Table cell text |
| `mono-code` | `12px` (`0.75rem`) | `16px` | `500` | DOM Selectors, Timestamps, Place IDs |
| `badge` | `11px` (`0.6875rem`)| `14px` | `600` | Velocity Badges, Score Badges, Opportunity Tags |

---

## 4. UI Component Architecture & Layout Standards

### 4.1 Global Command Header
- Status indicator with active scan telemetry.
- Global metrics counter: Total Scanned, Qualified Candidates, High-Priority Opportunities, Closed/Contacted.

### 4.2 Discovery & Scan Trigger Bar
- Compact, multi-field inline form:
  - `Niche Input` (with autocomplete presets: Dental, HVAC, Solar, Luxury Salons, Auto Detailing).
  - `Location Input` (City / State).
  - `Radius Slider / Input` (5km – 50km).
  - `Source Toggle` (Apify / Outscraper / Offline Fixture Mock).
  - `Launch Discovery Button` with animated spinner during execution.

### 4.3 Audited Lead Matrix (Data Table)
- High-density, sortable, and filterable table:
  - Columns:
    1. **Rank & Lead Score** (0–100 circular gauge or colored pill).
    2. **Business Name & Niche** (with direct Google Maps link).
    3. **Reputation & Momentum** (Rating + Review count + Velocity Badge: `GROWING`, `STABLE`, `STALE`).
    4. **Digital Surface** (Website URL status or `NO WEBSITE 🔥` badge).
    5. **Opportunity Classification** (`WEBSITE`, `WEBSITE+AUTO`, `CUSTOM SYSTEM`).
    6. **Triage Status** (`NEW`, `REVIEWED`, `READY FOR OUTREACH`, `ARCHIVED`).
    7. **Action Button** ("Inspect Dossier" trigger).

### 4.4 Lead Dossier Inspector (Slide-Over Drawer / Modal)
- **Top Bar**: Business name, category, rating summary, overall score breakdown (Reputation, Gap, Opportunity, Confidence).
- **Reputation Momentum Card**: Breakdown of 30d/90d/180d review counts and last review timestamp.
- **Headless Audit Findings List**:
  - Structured cards for each finding with empirical evidence snippet, DOM selector, and confidence badge.
- **Grounded Pitch Angle Card**:
  - Core recommended angle.
  - Bulleted operational bottlenecks.
  - Suggested project scope & estimated deal value range ($2.5k – $15k+).
  - 1-Click "Copy Pitch to Clipboard" button.
- **Triage Action Controls**: Quick buttons to mark status (`Reviewed`, `Ready for Outreach`, `Archive`).
