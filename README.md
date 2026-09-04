# ⚡ Lead Engine — Local-First B2B Client Acquisition & Technical Audit Workstation

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Headless_Audits-green?logo=playwright)](https://playwright.dev/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.38-orange?logo=drizzle)](https://orm.drizzle.team/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-blue?logo=sqlite)](https://sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A local-first, single-operator client acquisition and qualification workstation. Discovers high-reputation operating businesses in real-time, executes headless Chromium DOM audits (mobile & desktop), evaluates evidence-driven commercial relevance, and determines whether an entity is worth pursuing or `NOT A FIT`.

---

## 🌟 Key Capabilities

* **🌐 Google Places Discovery**: Discovers high-reputation commercial entities via official Google Places API (with opt-in flags for specialized scrapers).
* **🛡️ Hard Qualification Gates**: Filters candidates through empirical reputation gates ($\ge 4.0★$ rating, $\ge 50$ verified reviews, plus longitudinal review velocity curves).
* **🔍 Headless Chromium DOM Auditor**: Dual-viewport mobile (`375x812`) & desktop (`1440x900`) inspection detecting broken viewports, layout overflow, missing booking funnels, broken anchors, and SSL status.
* **🧠 Evidence-Driven Qualification ("Not Your Client" Detection)**: Explicitly identifies business models (SaaS, E-commerce, Industrial, Clinic) and rejects non-fit entities (`NOT A FIT`) rather than manufacturing generic web agency gaps.
* **📊 Weighted Heuristic Scoring**: Evaluates leads across Reputation (30%), Digital Surface Gap (35%), Opportunity Fit (20%), and Evidence Confidence (15%).
* **🎯 Surgical Pitch Studio**: Formats empirical outreach copy gated by qualification (Cold Email, WhatsApp, Phone Gatekeeper scripts, and Technical WBS blueprints).
* **💾 Local SQLite on Disk**: Zero-config local **SQLite** database (`lead_engine.db`) in WAL mode with busy timeout handling.

---

## 🚀 Quickstart (Run Locally in 2 Minutes)

### 1. Clone the Repository
```bash
git clone https://github.com/Chanakya2006gt/Lead_Gen_Agency.git
cd Lead_Gen_Agency
```

### 2. Install Dependencies & Playwright Chromium
```bash
npm install
npx playwright install chromium
```

### 3. Setup Environment Variables
```bash
cp .env.example .env.local
```

### 4. Start Local Development Workstation
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Security & Workstation Authentication

1. **Workstation Secret**: Set `LEAD_ENGINE_API_SECRET=your_secure_password` in `.env.local` to lock all mutating API routes and enable httpOnly session cookies.
2. **Local Dev Bypass**: To run unauthenticated in development, set `ALLOW_INSECURE_LOCAL_AUTH=true`. In production, missing secrets fail closed with `401 Unauthorized`.
3. **SSRF Defense**: Dual-stage DNS pre-filtering and post-navigation redirect revalidation blocks access to private network ranges and cloud metadata endpoints (`169.254.169.254`).

For runtime details, see [`docs/RUNTIME.md`](docs/RUNTIME.md) and [`SECURITY.md`](SECURITY.md).

---

## 🧪 Testing & Verification

```bash
# Run Vitest unit & integration tests
npm run test

# Run Playwright end-to-end smoke tests
npm run test:e2e

# Run production build check
npm run build
```

---

## 📜 License
MIT License. See [LICENSE](LICENSE) for details.
