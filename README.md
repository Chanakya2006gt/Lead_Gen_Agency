# ⚡ Lead Engine — High-Conviction B2B Client Discovery & Technical Audit Workstation

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Headless_Audits-green?logo=playwright)](https://playwright.dev/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.38-orange?logo=drizzle)](https://orm.drizzle.team/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-emerald?logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> An open-source, high-conviction client discovery and qualification engine. Finds high-reputation local operating businesses in real-time, executes headless Chromium DOM audits (mobile & desktop), classifies technical software opportunities, and synthesizes surgical, evidence-backed multi-channel pitch decks (Cold Email, WhatsApp, Phone Gatekeeper scripts).

---

## 🌟 Key Capabilities

* **🌐 Real-Time Discovery Engine**: Search any city and niche via native Playwright headless browser scraping or dedicated REST APIs (SerpAPI, Apify, Outscraper).
* **🛡️ 13 Core Invariant Rules**: Mathematical qualification gates ($\ge 4.0★$ rating, $\ge 50$ reviews, 30d/90d/180d recency velocity curves).
* **🔍 Headless Chromium DOM Auditor**: Dual-viewport mobile (`375x812`) & desktop (`1440x900`) inspection detecting broken viewports, layout overflow, missing booking funnels, broken anchors, and SSL status.
* **📊 4D Mathematical Scoring**: Evaluates leads across Reputation Velocity, Digital Surface Gap, Opportunity Leverage, and DOM Confidence.
* **🎯 Surgical Pitch Studio**: Instantly formats empirical outreach copy (Cold Email, WhatsApp Voice Note angles, Front-Desk Gatekeeper scripts, and Technical Deliverables blueprints).
* **💾 Dual Database Engine**: Zero-config local **SQLite** out-of-the-box or **Supabase / PostgreSQL** for cloud hosting.

---

## 🚀 Quickstart (Run Locally in 2 Minutes)

### 1. Clone the Repository
```bash
git clone https://github.com/Chanakya2006gt/Lead_Gen_Agency.git
cd Lead_Gen_Agency
```

### 2. Install Dependencies & Playwright Browser
```bash
npm install
npx playwright install chromium
```

### 3. Setup Environment Variables
```bash
cp .env.example .env.local
```
*(By default, it uses zero-config local SQLite. To use Supabase, paste your Supabase connection string into `.env.local`)*

### 4. Start the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deploying to Vercel / Cloud

1. Push this repository to your GitHub account.
2. Go to [Vercel](https://vercel.com/) and import the repository.
3. In Vercel Project Settings, add your **Environment Variables**:
   - `DATABASE_MODE=postgres`
   - `DATABASE_URL=your_supabase_connection_pooling_uri`
   - `SERPAPI_API_KEY=your_optional_serpapi_key`
4. Click **Deploy**.

---

## 🗄️ Setting Up Supabase (Optional)

1. Create a free project at [supabase.com](https://supabase.com/).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Copy and paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **RUN**.
4. In Supabase **Project Settings $\rightarrow$ Database**, copy the **Connection Pooling URI** and paste it as `DATABASE_URL` in `.env.local`.

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
MIT License. Free to use, modify, and distribute for personal and commercial agency acquisition.
