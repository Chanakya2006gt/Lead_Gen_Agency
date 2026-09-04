# Workstation Runtime Architecture & Operational Model

## 1. Operating Model

**Lead Engine** is a **local-first, single-operator client acquisition workstation**.

- **Runtime Process**: Long-lived Node.js process hosting Next.js 15 App Router.
- **Database**: Local SQLite on disk via `better-sqlite3` and `drizzle-orm` (WAL mode enabled, thread-safe busy timeouts).
- **Headless Browser**: Local Chromium instance via `playwright` executing empirical DOM audits and discovery.
- **State & Concurrency**: Single-operator process model with cancelable `AbortController` job handles.

> [!IMPORTANT]
> This application is designed as a private workstation, not a multi-tenant SaaS or serverless cloud deployment. Cloud PostgreSQL and Vercel serverless environments are deferred / not implemented.

---

## 2. Standard Start Path

```bash
# 1. Clone the repository
git clone https://github.com/Chanakya2006gt/Lead_Gen_Agency.git
cd Lead_Gen_Agency

# 2. Configure Environment
cp .env.example .env.local

# 3. Install Dependencies & Chromium
npm install
npx playwright install chromium

# 4. Start Local Development Workstation
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Environment Configuration & Invariants

| Variable | Description | Required | Default |
|---|---|---|---|
| `DATABASE_URL` | Filepath to local SQLite database | No | `./lead_engine.db` |
| `LEAD_ENGINE_API_SECRET` | Secret key for API authentication and session cookies | Recommended | Unset (Fails closed in prod) |
| `ALLOW_INSECURE_LOCAL_AUTH` | Allow unauthenticated API access during local dev (`true`/`false`) | No | `false` |
| `GOOGLE_MAPS_API_KEY` | Official Google Places API Key (Primary discovery engine) | Recommended | Unset |
| `ALLOW_UNSAFE_MAPS_SCRAPE` | Explicit opt-in flag for Live Google Maps scraping (`true`/`false`) | No | `false` |
| `PLAYWRIGHT_NO_SANDBOX` | Pass `--no-sandbox` flag to Chromium (used in containerized CI) | No | `0` |

---

## 4. Pipeline Lifecycle & Process Resilience

1. **Process Restart Recovery**: On startup, any scan marked as `RUNNING` is automatically transitioned to `FAILED` (process restarted), preventing orphaned locks.
2. **Cancellation**: In-flight scans can be stopped via the UI or `POST /api/scans/:id/cancel`. Abort signals immediately halt active browser contexts and database writes.
3. **Fail-Closed Security**: Unauthenticated requests are rejected with `401 Unauthorized` unless `ALLOW_INSECURE_LOCAL_AUTH=true` in local development.
