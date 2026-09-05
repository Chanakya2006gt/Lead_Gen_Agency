# Lead Engine — Remediation Implementation Plan

**Author:** Claude (Opus 4.8) · **Date:** 2026-09-05
**Companion to:** `AUDIT_REPORT.md`
**Status:** Plan only. No code was changed to produce this. This document is the contract an implementing agent (or you) must follow exactly.

---

## How to use this document (read first)

This plan exists because the fixes touch data-integrity and security code where a careless "improvement" can silently break working behavior. Every task below is written to be **executed literally**, not interpreted. The implementing agent must obey the guardrails in the next section on **every** task.

Each task has the same shape:
- **Finding** — what's wrong (cross-ref to audit).
- **Root cause** — verified, with file:line evidence gathered during research.
- **Exact change** — the specific edits. Nothing broader.
- **Do NOT touch** — the working behavior that must survive.
- **Verify** — how to prove the fix works and nothing regressed.
- **Rollback** — how to undo.
- **Risk / effort.**

---

## GLOBAL GUARDRAILS FOR THE IMPLEMENTING AGENT (non-negotiable)

These apply to every task. Violating any one is a failed task.

1. **No fabrication of data or capability.** Do not invent review dates, ratings, metrics, benchmarks, or "reasonable defaults." If a value is unknown, it stays `null` / `"UNKNOWN"` / `"UNVERIFIED"`. This is the project's existing AD-010 / AD-032 invariant — honor it.
2. **Fix exactly what the task says. Change nothing else in the same file** unless the task lists it. No opportunistic refactors, no renames, no reformatting, no dependency bumps, no "while I'm here" edits.
3. **Read before you write.** Open and read the full target file before editing. Never reconstruct a file from memory or from a snippet in this plan — the snippets here are illustrative, the file on disk is authoritative.
4. **Preserve public shapes.** Do not change exported type names, function signatures, DB column names, JSON field names, or API request/response shapes unless the task explicitly says to. Downstream (UI, export, tests) depends on them.
5. **One task = one commit.** Small, reviewable commits with the task ID in the message. Do not batch unrelated tasks.
6. **Prove it, per task.** After each task run, in order: `npm run lint` (tsc), `npm test`, `npm run build`. For UI-affecting tasks also `npm run test:e2e`. A task is not done until these pass. Paste the actual command output into `DECISION_LOG.md` (the project's own DoD requires this).
7. **If reality contradicts this plan, STOP and report.** If a file/line referenced here doesn't match what's on disk (code drifted since 2026-09-05), do not guess — surface the discrepancy and wait. Do not "make it work" by inventing an approach.
8. **Do not touch `.env.local`, real API keys, or the live `lead_engine.db`.** Schema-migration tasks are validated against the **test** DB and a scratch copy only.
9. **No new runtime dependencies** unless a task explicitly authorizes it. (No task here requires one.)
10. **Tests are ground truth for behavior.** If a change makes a test fail, the default assumption is your change is wrong, not the test. Only edit a test when the task explicitly says the test encodes the old (wrong) behavior, and then explain why in the commit.

---

## Environment note (blocker to clear before Phase 1)

The test suite could **not** be executed during the audit: `node_modules` was installed on macOS but the audit shell ran in a Linux VM, so rollup's native binary was missing. Before starting, the implementer must run the suite **on the Mac where the repo lives** and confirm a green baseline:

```
npm run lint && npm test && npm run build && npm run test:e2e
```

Record the baseline pass/fail counts in `DECISION_LOG.md`. **You cannot claim "no regressions" without a known-good baseline.** If the baseline is already red, fix nothing else until it's green or the pre-existing failures are documented and quarantined.

---

## Research findings that ground this plan (so the agent doesn't re-litigate them)

- **Google Places API returns at most 5 reviews per place, relevance-sorted, with no chronological sort and no pagination** — confirmed against Google's own issue tracker and third-party documentation. This is an inherent API limit; it cannot be worked around by changing the request. Therefore per-scan "review velocity" is unfixable from the Google adapter and must come from the observation ledger. (Grounds Task 1.)
- **Two discovery adapters fabricate timestamps:** `ApifyMapsAdapter.ts:64` and `OutscraperAdapter.ts:40` fall back to `new Date().toISOString()` when a review has no date, i.e. missing dates silently become "today." (New finding; grounds Task 1b.)
- **Next.js App Router requires `'unsafe-inline'` for scripts unless you adopt nonce + `strict-dynamic` via middleware**, which forces dynamic rendering. `'unsafe-eval'` is **not** needed in production (React/Next only use `eval` in dev). Official Next.js guidance confirmed. (Grounds Task 5.)
- **The client calls `https://nominatim.openstreetmap.org/reverse` directly** from `ScanLauncher.tsx:144` (reverse geocode). Any `connect-src` tightening MUST allow this host or geolocation auto-detect breaks. (Grounds Task 5.)
- **OWASP confirms** the DNS-rebinding (TOCTOU) SSRF gap is real and that re-validating after connection is insufficient; true prevention requires pinning the validated IP into the actual connection. Chromium makes IP-pinning non-trivial. (Grounds Task 4.)
- **No `middleware.ts` exists** today; all 8 components are `'use client'`. (Affects Task 5 approach choice.)
- **Migration block** is `src/core/db/index.ts` lines ~120–249, ending in `catch (migErr) { // Silent fallback }` at lines 250–251, with 17 `ALTER TABLE` statements + one table rebuild. (Grounds Task 3.)

---

# PHASE 0 — Runtime crashes & first-load errors (do before everything else)

> Added after verifying a separately-proposed "Mobile UI/UX Overhaul" plan against the code on 2026-09-05. The runtime claims in that plan were confirmed against the source; the two inaccuracies it contained are corrected inline below so they are not carried into implementation. These are live errors a user hits on load, so they precede the Phase 1 correctness work.

## Task 0a — `500` on `/api/scans`: the `disposition` column can be missing after a legacy DB rebuild

**Finding (verified):** Drizzle's `schema.ts` declares `disposition` `.notNull().default("PURSUE")`, but:
- `disposition` is **not** in the `CREATE TABLE leads` DDL — it exists only as an `ALTER TABLE ADD COLUMN` at `src/core/db/index.ts:242-243`.
- The migration reads `PRAGMA table_info(leads)` **once** at `index.ts:117-118` (`existingColumns`), *before* the `leads_nullable_fix` rebuild block (`index.ts:121-193`). That rebuild's table definition **omits `disposition`**, and the `if (!existingColumns.has("disposition"))` guard at line 242 then evaluates against the **stale, pre-rebuild** column set. On the legacy path (where `rating` was `NOT NULL`, triggering the rebuild) a database can therefore end up with **no `disposition` column while the code believes it has one** → `no such column: disposition` → 500 on any `leads` query.

**⚠️ Verify the real cause before fixing (do not assume):** the code defect is proven, but nobody has confirmed your *live* `lead_engine.db` is actually missing the column (`sqlite3` was unavailable during the audit). First run `sqlite3 lead_engine.db "PRAGMA table_info(leads);"` (or a `better-sqlite3` one-liner) and confirm `disposition` is absent. If it's present, the 500 has a different cause — capture the actual server stack trace before changing anything. Fixing a theoretical cause is a guardrail-#7 stop-and-report situation.

**Exact change (once confirmed):**
1. Add `disposition TEXT NOT NULL DEFAULT 'PURSUE'` to the `CREATE TABLE IF NOT EXISTS leads` DDL in `index.ts`.
2. Add `disposition` to the `leads_nullable_fix` table definition **and** to both the `INSERT (...)` column list and the `SELECT ...` projection in that rebuild block.
3. After **any** table recreation, **re-read** `PRAGMA table_info(leads)` and recompute `existingColumns` before the idempotent `ADD COLUMN` guards run — so every column in `schema.ts` (`disposition`, `review_trend`, `rating_source`, `is_gbp_disconnected`, …) is verified against the *current* table, not the pre-rebuild snapshot.
4. Reconcile the `notNull` mismatch per **Task 6** (Drizzle says `notNull`; the ALTER adds it nullable). Do them together — they touch the same lines.

**Do NOT touch:** the boot-time `RUNNING → FAILED` sweep, the pragma/WAL setup, or other column guards. **Verify on a *copy* of `lead_engine.db`**, never the live file. `npm test` (uses `lead_engine_test.db`), `npm run build`. **Risk:** Medium (boot/DB path). **Effort:** ~2-3h (folds into Task 6).

## Task 0b — `401` spam from `/api/discovery/suggestions` on first load

**Finding (verified):** the route is gated by `verifyApiAccess(req)` at `src/app/api/discovery/suggestions/route.ts:15-16`. It returns only static, deterministic city/industry presets (no leads, no secrets), so on an unauthenticated first paint it 401s and spams the console.

**Correction to the source plan:** the proposed secondary mitigation — *"suppress `ScanLauncher` network calls when `isLocked` is true"* — targets a state that never renders. `DashboardClient` **early-returns the lock screen when `isLocked`**, so `ScanLauncher` is not mounted while locked. The 401 fires in the brief *initial* render, before `fetchScans` flips `isLocked`. So the `isLocked` guard is aimed at the wrong place.

**Exact change:** remove the `verifyApiAccess` guard from `suggestions/route.ts` (make it a public metadata helper). That alone resolves the 401 — it's the primary fix and it's correct. If you additionally want to avoid a wasted call before auth, gate the *initial* fetch in `ScanLauncher` on "have we confirmed a session," **not** on `isLocked`.

**Do NOT:** open any other route's auth. Only `suggestions` is safe to unauthenticate (verify it exposes nothing lead-specific — as of audit it does not). `npm test`, `npm run build`. **Risk:** Low. **Effort:** ~15 min.

## Task 0c — favicon `404`

**Finding (verified):** no `favicon.ico`, no `public/favicon.ico`, no `src/app/icon.*`; `public/` holds only `assets/hero-bg.jpg`. Browsers request `/favicon.ico` on every load → 404.

**Exact change:** add either a static `src/app/favicon.ico` **or** a `src/app/icon.tsx` (dynamic `ImageResponse`, 32×32, brand mark). Either satisfies Next.js's icon convention. A static `.ico` is the lower-risk option; the dynamic `icon.tsx` is fine too but keep it dependency-free and node-safe. **Do NOT** touch `hero-bg.jpg`. **Risk:** none. **Effort:** ~15 min.

## Task 0d — add an explicit `viewport` export (but for the right reason)

**Finding (verified):** `layout.tsx` has no `export const viewport`.

**Correction to the source plan:** the claim that, without it, "mobile browsers emulate a 980px desktop layout" is **wrong**. Next.js 15 already injects a sensible default `<meta name="viewport" content="width=device-width, initial-scale=1">`. Your mobile is **not** scaling at 980px today — so adding the export will **not** fix a broken mobile layout (the layout is broken by the components, addressed in Phase 4). Add the export for the things Next's default doesn't cover: `themeColor` (address-bar tint) and any `maximumScale` policy.

**Exact change:** add `export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#070A10" }` to `layout.tsx`. Reconsider `maximumScale: 5` vs accessibility (don't block pinch-zoom below 5). **Do NOT** expect this to change layout behavior. **Risk:** none. **Effort:** ~10 min.

---

# PHASE 1 — Correctness & honesty (the real defects; do right after Phase 0)

## Task 1 — Make "review velocity" honest (ledger-derived, never single-pull)

**Finding:** Audit §1. "Review momentum" is computed from ≤5 relevance-sorted API reviews; it feeds `ScoringEngine` momentum (20 pts) → 30% of the total score, and is surfaced as a "Measured customer review velocity" strength claim and a UI badge. It is statistically meaningless and violates the no-fabrication invariant.

**Root cause (verified):**
- `UniversalFilterService.evaluate()` (`src/features/qualification/UniversalFilterService.ts`, lines ~84–137) buckets `reviewsLast30/90/180Days` and derives `reviewTrend` from `business.reviews[]`, which for Google is ≤5 relevance-sorted timestamps.
- Consumed by: `ScoringEngine.calculateReputationScore` (momentum, lines 45–50), `DossierSynthesizer` (provenance line 157; strength bullet lines 168–170), `LeadMatrixTable.tsx:342` ("Velocity: {trend}"), `leads/export/route.ts:73–75`, and stored via `ScanPipelineService` (lines 287–289, 437–440, 483–486).
- The honest source already exists: the `lead_observations` ledger (`schema.ts`), which records `observedReviewCount`/`observedRating`/`observedAt` per scan. Velocity across ≥2 observations of the same lead over time is real.

**Choose ONE approach. Recommended: Approach A (safest, smallest, most honest).**

### Approach A — Demote single-pull velocity to `UNKNOWN`; compute real trend only from the ledger
1. In `UniversalFilterService.evaluate()`: keep parsing timestamps, but **stop emitting a trend from a single pull.** Concretely: continue to compute `reviewsLast30/90/180Days` **only if** they are genuinely informative — but since the sample is ≤5 and relevance-sorted, set `reviewTrend = "UNKNOWN"` whenever the data originates from a single discovery pull. The cleanest literal change: leave the bucket counts as-is (they're descriptive, not conclusive) but force `reviewTrend = "UNKNOWN"` here, and move trend derivation out of this function.
2. Add a new, small, pure function (new file `src/features/qualification/ReviewVelocityLedger.ts`) that takes the current observation + the immediately preceding ledger observation(s) for the same lead and returns a `ReviewTrend` based on **real deltas over real elapsed time** (e.g. reviews added between two observations divided by days elapsed). Return `"UNKNOWN"` when there is `< 2` observations or elapsed time is `0`.
3. In `ScanPipelineService.runPipelineJob`, inside the transaction where the preceding observation is already fetched (`latestPrecedingObservation`, ~line 380+ area), compute the ledger-based trend with the new function and write **that** to `leads.reviewTrend`. On first observation, it is `"UNKNOWN"` — correct and honest.
4. `ScoringEngine.calculateReputationScore`: momentum stays, but now only rewards a trend that is real (ledger-derived). `"UNKNOWN"` already maps to the neutral `momentumScore = 10` (line 46) — **do not change the scoring math**, just the source of `reviewTrend`.
5. `DossierSynthesizer`: the provenance field `reviewVelocityConfidence` (line 157) must become `"longitudinal"` only when the trend came from ≥2 observations, else `"unknown"`. The strength bullet (lines 168–170) must only render when trend ≠ `"UNKNOWN"`. (It already guards on `!== "UNKNOWN"`, so once single-pull trends are `"UNKNOWN"`, the false claim disappears automatically.)

**Do NOT touch:** the `reviewsLast30/90/180Days` **column names or types**; the scoring weights; the UI badge component structure (it will simply show "UNKNOWN" until a lead is scanned twice); the ledger schema.

**Verify:**
- Unit: a business scanned **once** yields `reviewTrend === "UNKNOWN"` and momentum 10. A lead with two ledger observations showing real growth yields `"GROWING"`. Add/adjust tests in `IcpDispositionMatrix`/`ScoringEngine`/a new `ReviewVelocityLedger.test.ts`. (Some existing tests may assert single-pull trend — those encode the *wrong* behavior; update them per guardrail #10 with justification.)
- `npm test`, `npm run build`, `npm run lint` green.
- Manual: run a mock scan twice and confirm the trend transitions from UNKNOWN → a real value.

**Rollback:** revert the commit; `reviewTrend` derivation returns to `UniversalFilterService`.

**Risk:** Medium (touches scoring source + tests). **Effort:** ~0.5–1 day.

> Approach B (bigger, not recommended now): fetch full review history via a paid provider (Outscraper/Apify already in the codebase) and compute true velocity. Only pursue if you're willing to pay per lookup and re-validate those adapters' data. Not required to make the product honest.

---

## Task 1b — Stop fabricating review timestamps in Apify/Outscraper adapters

**Finding:** New (surfaced during plan research). `ApifyMapsAdapter.ts:64` and `OutscraperAdapter.ts:40` do `... || new Date().toISOString()`, turning missing review dates into "now" — the exact synthetic-timestamp behavior AD-010 claims was eradicated.

**Exact change:**
- `src/features/discovery/ApifyMapsAdapter.ts` line 63–64: change the map so a review with no usable date is **dropped** (filtered out), not defaulted to now. i.e. only push `{ publishedAtDate }` when a real `r.publishedAtDate || r.date` exists.
- `src/features/discovery/OutscraperAdapter.ts` line 39–40: same — drop reviews lacking `google_order_date || snippet_date`; do not substitute `new Date()`.

**Do NOT touch:** `reviewCount` (that's the authoritative total from the provider and is correct); the rest of each adapter's mapping.

**Verify:** unit test each adapter mapping with a fixture where some reviews lack dates → those reviews are excluded, none get today's date. `npm test` green.

**Risk:** Low. **Effort:** ~1–2 hours. **Note:** with Task 1 Approach A, these timestamps no longer drive trend anyway, but leaving fabrication in place still violates the invariant and pollutes the buckets — fix it.

---

## Task 2 — Reconcile the `reviews_last_90_days >= 3` invariant (PRD §3) with code

**Finding:** Audit §2. PRD publishes a "Mandatory Review Recency" gate (`reviews_last_90_days >= 3`) that is **not implemented** in `UniversalFilterService` (only rating≥4.0 and reviews≥50 gate).

**Decision required (pick one, then make code and docs agree):**
- **Option A (recommended): delete the invariant from the PRD.** Given Google returns ≤5 relevance-sorted reviews, a `reviews_last_90_days` gate would be gating on garbage (see Task 1). Remove invariant #3's hard-threshold clause from `PRD.md §3`; keep the descriptive computation note only. This is the honest choice.
- **Option B: implement the gate** — only valid if you have a *real* recency source (ledger over time or a paid full-history provider). Do **not** implement it against the ≤5-review sample.

**Exact change (Option A):** edit `PRD.md` invariant #3 wording so it no longer states an enforced threshold. No code change.

**Do NOT:** add a gate to `UniversalFilterService` that reads single-pull buckets. That would make the product reject good leads based on noise.

**Verify:** grep confirms no code claims to enforce a 90-day gate; PRD no longer asserts one. Build/tests unaffected.

**Risk:** None (docs). **Effort:** ~15 min.

---

## Task 3 — Make schema migration fail loud, not silent

**Finding:** Audit §5. `src/core/db/index.ts` lines 250–251: the entire migration block is wrapped in `catch (migErr) { // Silent fallback }`, swallowing partial-migration failures.

**Exact change:**
- Replace the silent catch with logging that surfaces the real error, **while preserving the benign case**: SQLite throws "duplicate column name" when an `ALTER TABLE ADD COLUMN` runs against a column that already exists. The current code guards most ALTERs with `if (!existingColumns.has(...))`, so benign duplicates shouldn't occur — but to be safe, log the error with context and re-throw **only** on non-benign errors. Minimum acceptable version: `console.error("[db migration] failed:", migErr)` instead of a bare comment. Preferred: inspect `migErr.message`; if it does not include `"duplicate column name"`, re-throw so the process fails fast on a genuinely broken schema.

**Do NOT touch:** the individual `if (!existingColumns.has(...))` guards; the `CREATE TABLE IF NOT EXISTS` statements; the `leads_nullable_fix` rebuild logic; the boot-time `RUNNING → FAILED` sweep (lines ~246). Those work.

**Verify (against test/scratch DB only — never the live DB):**
- Copy `lead_engine.db` to a scratch path, point `DATABASE_URL` at the copy, boot, confirm normal boot logs no error.
- Simulate a broken migration on the scratch copy (e.g. temporarily rename a column) and confirm the process now logs/throws instead of swallowing.
- `npm test` green (tests use `lead_engine_test.db`).

**Rollback:** revert commit.

**Risk:** Low–Medium (boot path). Test on a DB copy first. **Effort:** ~1–2 hours.

---

# PHASE 2 — Security posture (honesty + safe hardening)

## Task 4 — Tell the truth about SSRF, then (optionally) actually pin the IP

**Finding:** Audit §4. `DECISION_LOG` AD-011 claims defense against DNS rebinding, but `PlaywrightAuditEngine.validateUrlSecurity` resolves DNS separately from Chromium's own resolution (TOCTOU), and the "post-navigation revalidation" runs *after* `page.goto()` already fetched from the host. OWASP confirms post-hoc revalidation is insufficient.

**Task 4a (REQUIRED, do first — honesty): rewrite the claim.**
- Edit `DECISION_LOG.md` AD-011 and `SECURITY.md §2.2` to state the real posture: pre-navigation DNS filtering blocks the common cases (typed private hostnames, literal metadata IPs, obfuscated encodings, private ranges), **but a determined DNS-rebinding attacker can still bypass it because Chromium re-resolves independently; residual risk is accepted given the local single-operator threat model.** Do not claim rebinding is prevented.
- **Do NOT weaken or remove** any existing check in `validateUrlSecurity` or `isPrivateOrRestrictedIp` — they are good and stay exactly as-is.

**Task 4b (OPTIONAL hardening — only if you want true prevention):**
- Pin the validated IP into the navigation using Chromium's `--host-resolver-rules`. After `validateUrlSecurity` resolves and approves an IP for `hostname`, launch/enter a context that maps that host to the approved IP for the duration of the audit: `MAP <hostname> <approvedIp>`. This forces Chromium to connect to the IP you validated, closing the re-resolution window. Verify HTTPS still validates (SNI/Host preserved). This requires per-audit browser/context args and careful testing — treat as a separate, well-tested change, not a quick edit.
- Note the per-link HEAD checks (`desktopContext.request.head`, ~line "5. Broken Links") share the same TOCTOU; the same pinning would need to apply or they stay best-effort. Document whichever you choose.

**Do NOT touch:** the protocol allowlist, obfuscation checks, CIDR lists, `.internal/.local/.onion` blocks, or the ephemeral-context model.

**Verify:**
- 4a: docs reviewed; no code change; build/tests unaffected.
- 4b (if done): existing SSRF tests in `AdversarialResilienceSuite`/`PlaywrightAuditEngine.test` still pass; add a test proving a host that resolves to a public IP at check-time but would rebind is still connected only to the pinned IP. Confirm normal public sites still audit correctly (no broken TLS).

**Risk:** 4a none; 4b Medium–High (can break real audits if SNI/Host handling is wrong — test thoroughly). **Effort:** 4a ~20 min; 4b ~0.5–1 day.

---

## Task 5 — Tighten CSP without breaking the app

**Finding:** Audit §4. Actual header (`next.config.ts`) is `script-src 'self' 'unsafe-inline' 'unsafe-eval'` and `connect-src 'self' http: https:` — CSP is largely defanged. SECURITY.md also mis-describes it.

**Grounded constraints (verified, respect these or you WILL break the app):**
- The app is App Router with all-client components → Next injects inline hydration scripts. You **cannot** drop `'unsafe-inline'` from `script-src` without adopting nonce + `strict-dynamic` + middleware + dynamic rendering. That's a large change (adds `middleware.ts`, forces dynamic rendering, disables static optimization).
- `'unsafe-eval'` is **not** needed in production (only dev). Safe to drop in prod.
- The client calls `https://nominatim.openstreetmap.org/reverse` (`ScanLauncher.tsx:144`). `connect-src` MUST include that host.

**Recommended change (minimal, non-breaking) — edit `next.config.ts` headers():**
- `script-src`: keep `'self' 'unsafe-inline'`; make `'unsafe-eval'` **dev-only** (`process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''`).
- `connect-src`: change `'self' http: https:` → `'self' https://nominatim.openstreetmap.org`. (Drop the blanket `http:`/`https:`.)
- Leave `style-src 'self' 'unsafe-inline'` as-is (Tailwind/inline styles need it without nonce).
- Then update `SECURITY.md §2.5` to match the header **exactly** (including `img-src ... blob:` which the doc currently omits).

**Optional (Phase 3) full hardening:** adopt the official Next.js nonce approach (middleware generates per-request nonce, `strict-dynamic`, drop `unsafe-inline` from script-src, force dynamic rendering). Only do this if the security requirement justifies losing static optimization; for a local single-operator tool it usually doesn't. If pursued, follow the Next.js CSP guide verbatim and test every page renders.

**Do NOT touch:** the other security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) — they're correct.

**Verify:**
- `npm run build` then run the app; open the dashboard, launch a scan, use **geolocation auto-detect** (exercises nominatim), open the lead drawer, run a direct URL audit. Confirm **zero CSP violations** in the browser console and all features work. This manual pass is mandatory because CSP breakage is silent in tests.
- `npm run test:e2e` green.

**Rollback:** revert `next.config.ts`.

**Risk:** Low **if** you keep the recommended minimal change and actually test geolocation. Medium if you attempt the nonce approach. **Effort:** minimal ~1–2 hours (incl. manual CSP verification); nonce approach ~1 day.

---

# PHASE 3 — Consistency & code quality (lower risk, do after Phases 1–2)

## Task 6 — Collapse to one schema source of truth

**Finding:** Audit §5. Three schemas: hand-written DDL+ALTERs in `db/index.ts`, Drizzle `schema.ts`, and dead `supabase/schema.sql` (Postgres, for a runtime that throws). `disposition` disagrees (`notNull` in Drizzle vs nullable ALTER in SQL).

**Exact change (staged, conservative):**
1. **Delete `supabase/schema.sql`** and remove Supabase/Postgres migration references from `DECISION_LOG` (AD-006/009) and `ARCHITECTURE.md`. It's dead weight for a SQLite-only runtime that explicitly throws on Postgres (`db/index.ts`).
2. **Reconcile `disposition`:** make the runtime DDL and Drizzle agree. Safest literal fix: in `schema.ts`, the column is `.notNull().default("PURSUE")` but the live column was added nullable. Either (a) change Drizzle to `.default("PURSUE")` without `.notNull()` to match reality, or (b) backfill+enforce NOT NULL via a migration. Given existing rows, (a) is lower-risk. Pick (a) unless you add a proper migration.
3. **Do not** rip out the imperative `CREATE TABLE`/`ALTER` bootstrap in one shot — it currently self-heals real user DBs. Migrating to drizzle-kit migrations is a **separate, optional** future task; if pursued, generate migrations from `schema.ts`, verify they reproduce the current live schema byte-for-byte against a copy of `lead_engine.db`, then switch. Not required now.

**Do NOT touch:** column names, the WAL/pragma setup, the boot sweep.

**Verify:** boot against a **copy** of the live DB → no errors, schema unchanged (`PRAGMA table_info(leads)` identical before/after). `npm test`, `npm run build` green.

**Risk:** Low for steps 1–2; Medium if you attempt full drizzle-kit migration (do separately). **Effort:** steps 1–2 ~2–3 hours.

---

## Task 7 — Reconcile all docs with reality

**Finding:** Audit §3. Several docs contradict the code.

**Exact changes (docs only, no code):**
- `PRD.md` §5 line 115: "PostgreSQL persistence" → SQLite (WAL). §4.1: fix adapter list to include `GooglePlacesApiAdapter` (primary) and reflect actual adapters.
- `ARCHITECTURE.md`: remove the reference to `OpportunityClassifier.ts` (file does not exist) in §1 and §2, or note it was merged into `QualificationEngine`/`OpportunityRelevanceEngine` — state whichever is true after checking the code.
- `DECISION_LOG.md`: add superseding entries (don't delete history) that mark AD-005/006/009's Postgres/Supabase decisions as **superseded by the SQLite-only workstation pivot** (reference the later "drop vercel/postgres claims" commit). Correct the "100-worker concurrency" framing to "DB-integrity verified under a 100-worker stress test; production pipeline batch size is 3."
- `SECURITY.md`: already covered by Tasks 4a/5 (SSRF posture + exact CSP).
- Test-count claims: update to the current numbers only after running the suite (Task's verify step gives them).

**Verify:** a doc-vs-code diff review; grep each corrected claim against code. No build impact.

**Risk:** None. **Effort:** ~2–3 hours.

---

## Task 8 — Remove `any` at the persistence boundary

**Finding:** Audit §5. 36 `: any` + 13 `as any`, including `dossier as any` in `ScanPipelineService` and `qualification?: any` in `BusinessDossier` (`schema.ts`).

**Exact change (scoped, incremental — do NOT chase all 49 at once):**
- Type `BusinessDossier.qualification` (`schema.ts`) with the real qualification result type instead of `any` (import from `QualificationEngine`/`OpportunityRelevanceEngine`).
- Remove the `dossier as any` casts in `ScanPipelineService` insert/update once the Drizzle `dossier` column type (`.$type<BusinessDossier>()`) lines up — the cast exists to paper over a type mismatch; fix the underlying type so the cast is unnecessary.
- Leave adapter `item: any` (external JSON) casts alone unless trivially typable — those are at genuine external boundaries and are lower value/higher risk.

**Do NOT:** change runtime behavior. This is types-only. If removing a cast surfaces a real type error, that error is information — fix the type, don't re-add `any`.

**Verify:** `npm run lint` green with fewer `any`s (`grep -c` before/after). No behavior change → `npm test`/`build` green unchanged.

**Risk:** Low–Medium (type-only, but can cascade). Do in small commits. **Effort:** ~0.5 day.

---

## Task 9 — Prune dead/confusing logic (quick, isolated)

**Finding:** Audit §5. Dead code and wrong comments.

**Exact changes:**
- `Guardrails.assertNoSyntheticProviderData`: the first clause (`rating === 4.8 && reviewCount === 120 && ...`) is fully subsumed by the second (`rating !== null && ratingSource === "UNVERIFIED"`). Remove the redundant first clause; keep the general rule. Verify existing Guardrails/data-integrity tests still pass.
- `Guardrails.assertNoDiscoveryIntentLeakage(category, discoveryNiche, categorySource)`: it ignores `category` and `discoveryNiche`. Either use them or remove them from the signature and update callers. Prefer removing unused params (smaller surface) unless a test relies on the signature.
- `ScoringEngine` comments (lines ~38, ~41): the "4.0 → 30 pts" and "50 → 10 pts" comments are arithmetically wrong (actual: 16.7 and 18.9). **Fix the comments to match the code. Do NOT change the math** — the numbers feed live scores.
- Optional: reword the "true 4D mathematical model" language in comments/`DECISION_LOG` to "weighted heuristic" for honesty. Cosmetic.

**Do NOT:** alter any scoring number, threshold, or weight.

**Verify:** `npm test`, `npm run lint`, `npm run build` green. Confirm scores for a fixture lead are byte-identical before/after (pure cleanup).

**Risk:** Low. **Effort:** ~1–2 hours.

---

## Task 10 — Merge the two disposition vocabularies

**Finding:** Audit §5. `LeadDisposition` (`schema.ts`: `...NOT_A_FIT...`) and `PursuitDecision` (`commercial/types.ts`: `...DO_NOT_PURSUE`) encode overlapping concepts.

**Exact change (careful — types flow to DB + UI):**
- Decide the single canonical vocabulary. Map the concepts explicitly (e.g. `DO_NOT_PURSUE` ≡ `NOT_A_FIT`). Keep whichever is already persisted in the `disposition` column to avoid a data migration; adapt the other layer to it.
- Introduce a single source enum and a mapping function at the boundary between the commercial engine and the lead record, rather than a risky global rename. Update all references and tests.

**Do NOT:** rename the DB column or change stored values without a migration. If stored values would change, that's a separate migration task — don't smuggle it in.

**Verify:** `npm run lint`/`test`/`build` green; existing disposition tests pass; a scan produces the same persisted `disposition` values as before for identical inputs.

**Risk:** Medium (cross-cutting types). **Effort:** ~0.5 day.

---

## Task 11 — Cancellation: make it match the docs (or fix the docs)

**Finding:** Audit §5. Docs say cancel "immediately halts active browser contexts," but the abort signal is never passed into `auditEngine.auditUrl`; a cancel waits for the current batch (up to 3 × ~8s×2) to finish.

**Choose one:**
- **Option A (docs, zero risk):** edit `RUNTIME.md §4.2` and AD-015 to say cancellation stops *new* work promptly and in-flight audits finish their current page. Honest, no code.
- **Option B (behavior):** thread `abortController.signal` into `PlaywrightAuditEngine.auditUrl` and close the active context on abort so navigations bail out. More correct, but touches the audit hot path — test that normal (non-cancelled) audits are unaffected.

**Recommended:** A now, B only if prompt cancel is a real user need.

**Do NOT:** change the batch size or the transaction abort guards (they work).

**Verify:** A — docs match behavior. B — cancel mid-scan stops within one navigation; a normal scan still audits every lead. `test:e2e` green.

**Risk:** A none; B Medium. **Effort:** A ~15 min; B ~0.5 day.

---

## Task 12 — Repo hygiene (trivial, batch last)

**Findings:** Audit §7.
- `package.json`: set `"private": true` (docs call this a private proprietary tool; prevents accidental publish). Verify nothing in tooling depends on `private:false`.
- Replace the 7 empty `catch {}` blocks in `src` with at least a `console.warn` (or a comment justifying intentional ignore). Do not change control flow.
- Checkpoint/vacuum the local DB out-of-band if the WAL is large (operational, not a code change; never run against a DB the app has open).

**Do NOT:** delete the DB files (they're the user's data), and they're already gitignored.

**Verify:** `npm run build`/`test` green.

**Risk:** Very low. **Effort:** ~1 hour.

---

# PHASE 4 — Image-forward mobile overhaul (320px–768px)

> The operator has deliberately chosen to keep the `/assets/hero-bg.jpg` background — it stays. This phase therefore **designs around and highlights the image**, not removes it. The earlier UI audit's "remove the image" note is retracted; it is replaced by the legibility-protection requirement in Task 4.0. Mobile-layout facts below were verified against the source on 2026-09-05.

## Task 4.0 — Legibility protection is mandatory when the image stays (do first in this phase)

**Why:** keeping a brightened photo (`opacity-100 contrast-[1.3] brightness-[1.25]` in `DashboardClient`) behind translucent glass panels of 10–11px low-contrast text is the readability risk the UI audit flagged. On mobile the image + glass + tiny type compound and data becomes hard to read. Keeping the image is fine; shipping unreadable data over it is not.

**Exact change (design, not removal):**
- Strengthen the scrim **behind content**, not the image itself: increase the gradient/overlay opacity in the content column, or raise the solidity of `.card-surface` over the image (e.g. a more opaque panel background on small screens) so text sits on a controlled surface while the image still frames the page.
- Treat the image as **hero framing**: let it read at the top/edges (header, lock screen, empty states) where there's little text, and place dense data (table/cards) on more opaque surfaces so the photo shows *through the chrome*, not *behind the numbers*.
- Verify contrast after: body text ≥ 4.5:1, mono badges ≥ 3:1, measured over the actual image region (not the flat canvas). This is the one hard gate for keeping the image.

**Do NOT:** remove or desaturate the image, or delete the radial glow the operator chose — adjust opacity/scrim only. **Risk:** Low. **Effort:** ~2-3h incl. contrast checks.

## Task 4.1 — Responsive layouts (verified facts)

Each item below was confirmed in the source; make the change and verify at 320 / 375 / 390 / 768px with **zero horizontal body overflow**.

- **Header** (`Header.tsx:27`, currently `px-6 py-3`): compact mobile bar — `px-4 py-2.5`, stats as concise badges, streamlined export. Keep the desktop layout at `sm:`+.
- **ExecutiveMetrics** (`ExecutiveMetrics.tsx:28`, currently `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`): change mobile to `grid-cols-2` with `p-3 sm:p-4`, so all four KPIs fit in two compact rows instead of a ~600px stack. Keep the honesty fixes from the audit — this task is layout only; do **not** re-introduce the fabricated "pipeline value" total (that's a separate honesty fix, see §3.2 of `UI_AUDIT.md`).
- **LeadMatrixTable** (`LeadMatrixTable.tsx:40` defaults `viewMode:"table"`, wraps table in `overflow-x-auto` at line 247): auto-render the card layout below `md` (`< md` → cards, `md:`+ → the existing Table/Grid toggle). Don't remove the toggle for tablet/desktop.
- **Filter pills / market tabs**: make horizontally scrollable on mobile (`overflow-x-auto no-scrollbar whitespace-nowrap`) instead of wrapping to multiple rows. `DashboardClient` market-tabs bar gets the same treatment.
- **ScanLauncher**: full-width Industry + City; put **Radius** (control exists at `ScanLauncher.tsx:499-511` — the source plan is right, and this corrects the earlier UI_AUDIT which wrongly said radius was missing) and Discovery Mode in a `grid-cols-2 gap-2`; full-width touch "Scan Market". Make the suggested-industry chips horizontally scrollable rather than 4-row wrap.
- **OpportunityCardGrid** (`OpportunityCardGrid.tsx`): `p-4 sm:p-5`, and ensure interactive targets are ≥44px tall (touch).
- **LeadInspectorDrawer**: full-screen on mobile (`w-full inset-0 max-w-none sm:max-w-xl`), `p-4 sm:p-6`, outreach tabs as `grid grid-cols-4 gap-1` instead of a cramped inline bar, sticky bottom action bar with safe-area padding. **Fold in the accessibility fixes here** (Escape-to-close, `role="dialog"`, focus trap) from `UI_AUDIT.md §4` — the drawer is already being touched, so do both at once rather than twice.
- **DashboardClient**: responsive container padding `p-3.5 sm:p-6 space-y-4 sm:space-y-5`.
- **globals.css**: add a `.no-scrollbar` utility (not currently defined) and confirm no unwanted horizontal body overflow on iOS/Android.

**Do NOT:** change the desktop (`md:`+) layouts beyond what's needed; this is additive mobile work. Keep the image (Task 4.0).

## Task 4.2 — Verification (mobile)

- Add a Playwright mobile project (`devices["iPhone 14"]`, 390×844) asserting `/` loads with **no horizontal overflow**, cards render below `md`, and the drawer opens/closes (incl. Escape). Manually check 320 / 375 / 390 / 768px.
- Confirm the Phase 0 errors are gone: `/favicon.ico` → 200, `/api/discovery/suggestions` → 200 unauthenticated, `/api/scans` → 200 with no `disposition` column error.
- Full gate: `npm run lint && npm test && npm run build && npm run test:e2e`.

**Risk:** Low–Medium (broad but additive). **Effort:** ~1–1.5 days.

---

## Execution order & dependencies

```
Baseline green suite (blocker)
        │
Phase 0 ├─ Task 0a (disposition/500 — confirm live DB first) [pairs with Task 6]
        ├─ Task 0b (suggestions 401 → public route)
        ├─ Task 0c (favicon)
        └─ Task 0d (viewport export — not a layout fix)
        │   ← live errors users hit on load; clear these first
        │
Phase 1 ├─ Task 1  (velocity → ledger)      ← highest value
        ├─ Task 1b (adapter timestamp fabrication)
        ├─ Task 2  (PRD 90-day invariant)   [after Task 1 decision]
        └─ Task 3  (migration fail-loud)     [independent]
        │
Phase 2 ├─ Task 4a (SSRF docs) + 4b optional
        └─ Task 5  (CSP tighten + doc sync)  [independent]
        │
Phase 3 ├─ Task 6  (schema single source)
        ├─ Task 7  (doc reconciliation)      [depends on 4a,5,6 for accuracy]
        ├─ Task 8  (any removal)
        ├─ Task 9  (dead code / comments)
        ├─ Task 10 (disposition merge)
        ├─ Task 11 (cancel docs/behavior)
        └─ Task 12 (hygiene)
        │
Phase 4 ├─ Task 4.0 (image-forward legibility protection) ← gate for keeping the image
        ├─ Task 4.1 (responsive layouts; folds in drawer a11y)
        └─ Task 4.2 (mobile Playwright + first-load error re-check)
```

Phases are independent enough to ship one at a time. **Do not start Phase N+1 until Phase N's suite is green and logged.**

---

## Definition of Done for the whole effort (aligns with the repo's own DoD)

The remediation is complete only when **all** hold and are recorded in `DECISION_LOG.md`:
1. `npm run lint` (tsc) — zero errors.
2. `npm test` — green; test counts updated in docs to match reality.
3. `npm run build` — clean.
4. `npm run test:e2e` — green.
5. Manual CSP pass: dashboard, scan, geolocation (nominatim), lead drawer, direct audit — **zero console CSP violations**.
6. Every doc claim touched (PRD, ARCHITECTURE, SECURITY, DECISION_LOG, RUNTIME, README) verified against code by grep.
7. No fabricated data anywhere: single-pull `reviewTrend` is `UNKNOWN`; no `new Date()` timestamp fallbacks remain.
8. Every shell command run and route exercised is logged in `DECISION_LOG.md` (the project's existing invariant).
9. No new runtime dependency added; no public type/column/API shape changed except where a task explicitly authorized it.
10. First-load is clean (Phase 0): `/favicon.ico` → 200, `/api/discovery/suggestions` → 200 unauthenticated, `/api/scans` → 200 with no `disposition` error.
11. Mobile is verified (Phase 4): a Playwright iPhone-14 project passes; no horizontal overflow at 320/375/390/768px; the hero image is retained **and** text over it meets contrast (≥4.5:1 body / ≥3:1 badges) measured over the image region.

---

## What this plan deliberately does NOT do

- It does not add PostgreSQL/Supabase back, or add serverless deployment. The SQLite-workstation pivot is the right call; the plan finishes that pivot rather than reversing it.
- It does not re-architect the pipeline, scoring model, or adapter layer. Those work.
- It does not chase every `any` or every stylistic nit — only the ones with real correctness/clarity value.
- It does not touch `.env.local`, real keys, or the live database file.
- **It does not remove the background hero image.** That was a deliberate operator choice; Phase 4 keeps it and designs around it (Task 4.0), protecting text legibility rather than deleting the image.
