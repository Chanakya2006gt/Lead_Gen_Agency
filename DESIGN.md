# DESIGN SPECIFICATION: Lead Engine
### Opportunity-First Intelligence Terminal & Evidence Architecture

---

## 1. Executive Vision & Core Philosophy

The Lead Engine is **not** a generic CRUD admin panel or an AI marketing mockup. It is a **professional intelligence and research workstation** designed for agency operators, technical consultants, and business development leads.

### The Core Promise
> **"Input a market location and business vertical → Surface high-conviction commercial opportunities, back them with empirical technical evidence, and provide immediate outreach execution."**

### The Design Language
**"Google Maps intelligence × Financial research terminal × Modern developer tooling."**

* **Dense, calm, precise, and highly scannable.**
* **Zero visual slop**: No decorative neon gradients, no double-bezels, no floating glassmorphic blobs, and no artificial hype labels.
* **Numbers feel deliberate**: Numerical scores, review velocities, and HTTP latencies are given prime visual weight.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     THE PRIMARY OBJECT ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  TRADITIONAL SCRAPER (WRONG):                                              │
│  Business Entity ──► Contact Info ──► Ratings ──► Raw Dump                  │
│                                                                             │
│  LEAD ENGINE INTELLIGENCE TERMINAL (CORRECT):                              │
│  OPPORTUNITY ──► EMPIRICAL EVIDENCE ──► BUSINESS ENTITY ──► ACTIONABLE DECK │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Current UI Audit & Anti-Patterns to Ban

| Anti-Pattern | Why It Is Banned | Enforced Replacement |
| :--- | :--- | :--- |
| **Glowing AI SaaS Borders** | Creates visual fatigue; looks like an unvalidated prototype. | Crisp hairline borders (`border-white/[0.08]`) on dark matte surfaces. |
| **Double-Bezel Cards (Doppelrand)** | Wastes 24–40px of screen real estate per component. | Single flat structured surfaces with clean inner padding. |
| **Business-First Mindset** | Forces the operator to manually inspect every lead to find an angle. | **Opportunity-first classification**: Lead Matrix highlights the exact commercial angle (e.g. *Unlinked GBP Site*, *Desktop-Only Mobile UX*, *Custom Operations Software*). |
| **Proportional Font for Metrics** | Causes layout shift during live sorting and makes comparisons difficult. | **Strict Monospace Tabular Numerals (`font-mono` / `tabular-nums`)** for scores, ratings, review counts, timestamps, domains, and latencies. |
| **Generic Marketing Slop Labels** | "DOM Fact Confidence", "4-Dimension Metric Bento Cards" damage credibility. | Concrete evidence: *"Missing `<meta name='viewport'>`"*, *"No SSL Certificate"*, *"317 reviews on Maps but domain disconnected"*. |

---

## 3. Four-Layer Information Architecture & Mental Model

The entire interface follows a strict four-layer cognitive hierarchy that guides the operator from macro market scanning to micro deal closing:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: DISCOVERY WORKSPACE                                                │
│ "Where and what are we searching?"                                          │
│ Location (e.g. Hyderabad) │ Vertical (Dental Clinics) │ Radius (15 km)      │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 2: QUALIFICATION LEDGER                                               │
│ "Which businesses meet our 13 Universal Invariants?"                        │
│ 87 Discovered ──► 24 Qualified (★ 4.8+, Active Review Velocity)             │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 3: OPPORTUNITY CLASSIFICATION                                        │
│ "Why does this lead represent a high-ticket commercial deal?"                │
│ • 7 Disconnected GBP Assets  • 9 Broken Mobile Viewports  • 8 Operations Ops│
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 4: ACTIONABLE SALES DOSSIER                                           │
│ "How do we immediately convert this opportunity?"                          │
│ 1-Click Cold Email │ WhatsApp Hook │ Gatekeeper Phone Script │ Scope Value   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Visual System & Token Architecture

### 4.1 Surface & Structural Tokens

```css
### 4.1 Surface & Structural Tokens

```css
:root {
  /* Canvas & Atmospheric Backgrounds */
  --bg-canvas: #070A10;        /* Deep matte void, zero eye-strain */
  --bg-surface: #0D111A;       /* Structural card surface */
  --bg-subsurface: #0A0D14;    /* Inset table rows, toolbar bars */
  --bg-elevated: #131824;      /* Modals, popovers, active selection */

  /* Atmospheric Wallpaper Overlay Rules */
  /* Wallpaper (/assets/hero-bg.jpg) is anchored with backdrop blur and calibrated opacity, */
  /* paired with .card-surface (bg-[#0D111A]/85 backdrop-blur-md) ensuring >= 4.5:1 text contrast */

  /* Borders & Dividers */
  --border-subtle: rgba(255, 255, 255, 0.05);
  --border-default: rgba(255, 255, 255, 0.08);
  --border-focus: #6366F1;

  /* Typography Colors */
  --text-primary: #F1F5F9;     /* 95% White - Headlines, scores, titles */
  --text-secondary: #94A3B8;   /* Slate 400 - Subtitles, metadata, labels */
  --text-muted: #64748B;       /* Slate 500 - Timestamps, table headers */
}
```

### 4.2 State & Semantic Accents

Accents are used **strictly to encode information**, never as decorative background clutter:

* **Neutral Intelligence Accent (`#6366F1` - Indigo)**: Active scan pings, primary CTA anchors, selected table rows.
* **Positive Momentum / High Action (`#10B981` / `#22C55E` - Emerald/Lime)**: High-conviction scores ($\ge 80$), `GROWING` review velocity, `READY_FOR_OUTREACH` triage status.
* **Commercial Opportunity / Disconnected GBP (`#A855F7` - Purple)**: Discovered official websites disconnected from Google Maps profiles.
* **High-Ticket Absence / Gaps (`#F59E0B` - Amber)**: Complete lack of website, missing online booking, missing mobile CTA.
* **Structural Failure / Security Warning (`#F43F5E` - Rose)**: Missing responsive viewport, layout overflow, missing SSL, broken links.

### 4.3 Typography Scale & Font Pairings

* **Display & Body**: `Geist Sans` (`font-sans`), `-webkit-font-smoothing: antialiased`.
* **Quantitative Data & Code**: `Geist Mono` (`font-mono`) with `tabular-nums`.

```text
┌────────────────────┬──────────┬────────────┬─────────────┬──────────────────┐
│ Role               │ Size     │ Weight     │ Font Family │ Usage            │
├────────────────────┼──────────┼────────────┼─────────────┼──────────────────┤
│ Lead Score Hero    │ 28–32px  │ Bold (700) │ font-mono   │ Score gauges     │
│ Opportunity Header │ 18–20px  │ Bold (700) │ font-sans   │ Dossier modal H1 │
│ Business Title     │ 14–15px  │ Semi (600) │ font-sans   │ Table rows       │
│ Quantitative Data  │ 12–13px  │ Med (500)  │ font-mono   │ Reviews, lat, ph │
│ Field Label / Tag  │ 10–11px  │ Semi (600) │ font-mono   │ Badges, headers  │
└────────────────────┴──────────┴────────────┴─────────────┴──────────────────┘
```

---

## 5. Component Specifications

### 5.1 Top Bar & Header (`Header.tsx`)
* **Layout**: Full-width fixed header, height `56px`, `bg-[#080A0F]/90`, `backdrop-blur-md`, bottom border `1px solid rgba(255,255,255,0.08)`.
* **Left**: Engine identity icon + title (`LEAD ENGINE`) + environment chip (`v1.0.0 (Workstation)`).
* **Right**: Real-time stats summary (`Total Discovered`, `Qualified`, `High-Conviction`) in monospace + accessible `Export CSV` button.

### 5.2 Discovery Workspace & HUD (`ScanLauncher.tsx`)
* **Layout**: Compact horizontal command bar with integrated preset chips.
* **Inputs**:
  * Location Input with Google Places Autocomplete dropdown and Escape handling.
  * Category / Niche Input with instant keyboard focus (`Cmd+K` / `Ctrl+K`).
  * Radius selector (10km / 15km / 25km).
  * Annotated Provider selection (Official Places, Scrape Opt-in, etc.).
  * `Scan Market` button with active pulse spinner and instant cancel control.
* **Dynamic Market Chips**: Auto-detects operator timezone (e.g. Mumbai / IST vs New York) and suggests 4 1-click presets (e.g. *Dental Clinics*, *Cosmetic Surgery*, *Commercial HVAC*, *High-End Salons*).

### 5.3 Executive Metrics Strip (`ExecutiveMetrics.tsx`)
* Four high-contrast KPI cards: Total Discovered, Qualified Leads, High-Conviction Targets (score >= 70), and Avg Health Score.
* Grounded benchmark ranges replacing fabricated currency totals.

### 5.4 The Lead Matrix Table (`LeadMatrixTable.tsx`) & Grid (`OpportunityCardGrid.tsx`)
The centerpiece of the application. High density, zero fluff, instant filtering:

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Search & Filters: [ Q Search business/location... ] [ All Opportunities ▾ ] [ All Websites ▾ ] [ Sort ▾]│
├──────┬─────────────────────────┬──────────────┬──────────────────┬─────────────────┬──────────┬────────┤
│Score │ Business Entity         │ Reputation   │ Digital Presence │ Opportunity     │ Stage    │ Action │
├──────┼─────────────────────────┼──────────────┼──────────────────┼─────────────────┼──────────┼────────┤
│ 88   │ Sowjanya Dental Hosp    │ ★ 4.9 (317)  │ ⚠ Unlinked Site  │ Unlinked GBP    │ READY    │ [View] │
│      │ Himayatnagar, Hyderabad │ +14 new      │ sowjanyadental.in│ Local SEO Scope │          │        │
│ 84   │ Apollo White Dental     │ ★ 4.8 (192)  │ apollowhite.com  │ Booking Auto    │ REVIEWED │ [View] │
│      │ Jubilee Hills, Hyderabad│ +6 new       │ ⚠ Desktop Only   │ Speed + Intake  │          │        │
│ 79   │ Dr. Smile Dental Care   │ ★ 4.7 (84)   │ ✕ Zero Website   │ Full Storefront │ NEW      │ [View] │
│      │ Banjara Hills, Hyderabad│ Steady       │ Missing on Maps  │ Web Build Scope │          │        │
└──────┴─────────────────────────┴──────────────┴──────────────────┴─────────────────┴──────────┴────────┘
```
* Table rows support full keyboard interaction (`tabIndex={0}`, `Enter`/`Space` to inspect).
* Card grid provides responsive fallback with `OpportunityBadge.tsx` unification.

### 5.5 Sales Intelligence Dossier Drawer (`LeadInspectorDrawer.tsx`)
Built on `@radix-ui/react-dialog` for focus trapping, backdrop click, and `Escape`-to-close:

1. **Header**: Business Name + Category + Direct Maps Link + Verified Review Summary.
2. **Section 1: WHY THIS LEAD (Commercial Thesis)**: Bulleted arguments derived directly from verified Google evidence and audit telemetry.
3. **Section 2: WHAT WE FOUND**: Clean 6-point technical audit checklist (Website Presence, Mobile UX, SSL Encryption, 24/7 Booking Intake, 1-Tap CTA, Server Latency).
4. **Section 3: RECOMMENDED APPROACH & SCOPE**:
   * Grounded Commercial Economics Grid (Scale, Ceiling, Recommended Build, Care).
   * Multi-Channel Outreach Tabs with 1-click clipboard copy:
     * **WhatsApp Instant Hook**: Grounded conversation starter with direct `wa.me` 1-click launch button (zero fabricated ROI claims).
     * **Cold Email Deck**: Model-aware outreach draft referencing verified reviews and actual audit findings.
     * **Phone Gatekeeper Script**: Front-desk operator script referencing verified Google review counts.
     * **Technical Scope**: Deliverable specifications ready for client SOW.
5. **Footer Triage Workflow**: `NEW`, `REVIEWED`, `READY FOR OUTREACH`, `ARCHIVED`.

---

## 6. Scoring & Evidence Visualization

Numerical indicators must be immediately understandable without reading lengthy explanations:

* **Score Badge (`ScoreGauge.tsx`)**:
  * Score $\ge 80$: Emerald background (`bg-emerald-500/15 text-emerald-300 border-emerald-500/30`).
  * Score $60–79$: Indigo background (`bg-indigo-500/15 text-indigo-300 border-indigo-500/30`).
  * Score $< 60$: Slate background (`bg-slate-800 text-slate-400 border-slate-700`).
* **Opportunity Badges (`OpportunityBadge.tsx`)**:
  * Clean semantic color mapping for `UNLINKED_GBP_SITE`, `DESKTOP_ONLY_MOBILE_UX`, `ZERO_WEBSITE_LISTING`, `CRITICAL_SECURITY_GAP`, etc.

---

## 7. Responsive & Viewport Rules

* **Desktop Workstation (1280px–1920px)**: Primary operational view. Full table density, multi-column dossier layout, zero horizontal page scrolling.
* **Tablet (768px–1024px)**: Table collapses secondary metadata into expandable sub-rows; dossier modal stacks tabs cleanly.
* **Mobile (375px–480px)**: Fast triage view. Opportunity card grid replaces wide table rows, swipeable outreach scripts, direct phone call triggers.

---

## 8. Accessibility & Compliance Standards

* **WCAG 2.2 AA Contrast Ratio**: All body copy meets $\ge 4.5:1$ contrast against dark translucent surfaces; all quantitative mono badges meet $\ge 3:1$.
* **Keyboard Navigation**: `Tab` cycles through leads, `Enter` / `Space` opens drawer/cards, `Escape` closes drawers and dialogs, `Cmd+K` / `Ctrl+K` focuses discovery search bar.
* **Screen Reader Support**: Semantic HTML tables (`<thead>`, `<tbody>`, `<th> scope="col"`, `aria-label` attributes on score gauges, filters, and action buttons).
* **Modal Architecture**: Accessible `@radix-ui/react-dialog` implementation for `LeadInspectorDrawer` and destructive confirmation modals.

---

## 9. File Structure & Component Mapping

```text
src/
├── app/
│   ├── globals.css              # Dark terminal CSS variables, translucent HUD card utility classes
│   ├── layout.tsx               # Root layout with Geist Sans & Geist Mono fonts
│   └── page.tsx                 # Main Command Center Entrypoint
├── components/
│   ├── Header.tsx               # Executive Top Bar & System Health HUD
│   ├── ScanLauncher.tsx         # Discovery Command Bar & Market Presets
│   ├── ExecutiveMetrics.tsx     # KPI Strip with Grounded Commercial Benchmarks
│   ├── LeadMatrixTable.tsx      # Central Opportunity Matrix Table (Accessible Rows)
│   ├── OpportunityCardGrid.tsx  # Responsive Opportunity Card Grid View
│   ├── OpportunityBadge.tsx     # Unified Semantic Opportunity Badge
│   ├── LeadInspectorDrawer.tsx  # Accessible Sales Intelligence Dossier Drawer (Radix)
│   ├── ScoreGauge.tsx           # Monospace Quantitative Score Indicator
│   ├── LivePipelineBanner.tsx   # Real-Time Telemetry Progress Banner
│   └── DashboardClient.tsx      # State Coordinator, Toast Engine, & Wallpaper Layer
```
