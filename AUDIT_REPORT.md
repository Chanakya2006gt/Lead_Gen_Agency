# Lead Engine — Brutal Technical Audit

**Auditor:** Claude (Opus 4.8) · **Date:** 2026-09-05
**Repo:** `Lead_Gen_Agency` (local workstation build) · **Stack:** Next.js 15 (App Router, React 19), TypeScript (strict), better-sqlite3 + Drizzle, Playwright, Zod, Tailwind 4
**Scope:** Read-only analysis. No code changed. `.env.local` was not opened per instruction; secret-exposure was assessed via `.gitignore` and git history instead.

---

## 0. Verdict up front

This is a **genuinely above-average solo project** wearing a **wildly oversized marketing costume**. The engineering underneath is real — proper SSRF filtering, ACID transactions, an observation ledger, timing-safe auth, a clean adapter pattern, 127 test cases, working CI. That already puts it ahead of 90% of "lead gen tool" repos.

But it is drowning in **self-congratulatory language that the code does not earn**, it has **one load-bearing data-quality lie** (review "velocity" computed from ≤5 non-chronological reviews), a **documented core invariant that isn't implemented**, **three competing sources of schema truth**, and enough **doc-vs-reality drift** that the documentation is now actively misleading in places. The security model is decent for a local single-user tool but has a real SSRF gap it explicitly claims to have solved.

Grade: **B / B-**. The gap between the code (a solid B) and the docs (which describe an A+ enterprise system) is the single biggest problem here.

---

## 1. The most important problem: fabricated confidence in "review velocity"

This is the finding that matters most because the entire product thesis is "find businesses with **active reputation momentum**," and that signal is broken.

**What the docs claim:** "longitudinal review velocity curves" (README), "Review Trend Velocity" as core invariant #4 (PRD), momentum feeding 20% of the reputation score.

**What actually happens:**
- `GooglePlacesApiAdapter` pulls `places.reviews` from the Google Places API. The Places API returns **at most 5 reviews per place**, and by default they are sorted by **"most relevant," not chronological**.
- `UniversalFilterService.evaluate()` (lines ~97–135) computes `reviewsLast30Days / 90 / 180` and a `GROWING/STABLE/DECLINING/STALE` trend **from those ≤5 timestamps**.
- So a business with 2,000 reviews has its "90-day review velocity" computed from a relevance-sorted sample of 5. The resulting trend is **statistically meaningless noise dressed up as a longitudinal signal**, and it flows into `ScoringEngine.calculateReputationScore` (momentum = up to 20 pts) → 30% of the total lead score.

**The irony:** `DECISION_LOG` AD-010 proudly announces "Eradication of Synthetic Data & Honest Nullable Metrics." But drawing a "momentum trajectory" from 5 relevance-ranked reviews is arguably *worse* than a null — it's real data producing a fake conclusion, which is harder to catch than an obvious fabrication. The honesty invariant is violated in spirit by the flagship feature.

**Blunt version:** the "reputation momentum engine" is theater on top of a 5-row sample. Either compute velocity **only** across your own repeated scans (the `lead_observations` ledger — which is the honest, correct way and you already built the table for it), or drop the per-period buckets entirely and stop marketing "velocity curves."

---

## 2. A documented core invariant is simply not implemented

PRD §3, Invariant #3 ("Mandatory Review Recency") states the qualification gate includes **`reviews_last_90_days >= 3`**.

Grep of `UniversalFilterService` (the only qualification gate): the code enforces `rating >= 4.0` and `reviewCount >= 50` and **nothing else**. There is **no `reviews_last_90_days >= 3` gate anywhere**. The recency numbers are computed and stored, but never used to accept/reject a lead.

So a "core system invariant" published in your PRD is fiction. Either it was removed and the PRD wasn't updated, or it was never built. Given #1 above (velocity data is garbage), *not* gating on it is accidentally the right call — but the doc still lies.

---

## 3. Documentation has drifted into actively misleading territory

You have an unusual amount of documentation for a solo project (PRD, ARCHITECTURE, SECURITY, DESIGN, DECISION_LOG, README, RUNTIME). That's a strength in intent. But several docs now contradict the code:

| Claim | Where | Reality |
|---|---|---|
| "PostgreSQL persistence with Drizzle ORM" | PRD §5 (line 115) | SQLite-only. `core/db/index.ts` **throws** on any `postgres://` URL. |
| Adapters are Apify / Outscraper / Mock | PRD §4.1 | Primary adapter is `GooglePlacesApiAdapter`, not even listed. |
| `OpportunityClassifier.ts` | ARCHITECTURE §1 & §2 | **File does not exist.** Never created (or deleted without updating docs). |
| `CSP: connect-src 'self'` | SECURITY.md §2.5 | Actual header is `connect-src 'self' http: https:` — i.e. connect to *anything*. |
| CSP omits `blob:` in img-src | SECURITY.md | Actual config includes `blob:`. |
| "Immediately halt active browser contexts and database writes" (cancel) | RUNTIME.md §4.2, AD-015 | Cancellation is checked *between* batches and *before* writes; a running audit is **not** interrupted (see #5). |
| "verified under 100 simultaneous concurrent workers" / "100-worker concurrency hardening" | AD-020, commit msgs | Production pipeline runs `BATCH_SIZE = 3`. The 100 is a test-only stress scenario. |
| "103 tests across 23 test files" | AD-034 | Actually 27 files / ~127 cases now — stale, but at least *understated*. |

Individually minor. Collectively, the docs can no longer be trusted as a description of the system, which defeats the purpose of writing them. The DECISION_LOG also contains **mutually contradictory decisions left standing**: AD-005 ("PostgreSQL + Drizzle"), AD-006 ("SQLite & Cloud Postgres"), AD-009 ("Supabase migration kit") vs. the later reality that Postgres throws. A decision log should supersede, not accumulate contradictions.

---

## 4. Security: solid for the threat model, with one real gap and some overselling

**The good (genuinely):**
- Timing-safe auth via SHA-256 digest + `crypto.timingSafeEqual` (`verifyAccess.ts`). Hashing both sides to fixed 32 bytes correctly avoids the length-leak footgun. Correct.
- Fail-closed default: no secret + not explicitly `ALLOW_INSECURE_LOCAL_AUTH` in non-prod → 401.
- Every mutating **and** reading API route calls `verifyApiAccess` first.
- `httpOnly` + `SameSite=Strict` cookies; CSRF is well-mitigated for a same-site local tool.
- SSRF filtering is above-average: protocol allowlist, numeric/hex/octal IP obfuscation blocks, cloud-metadata hostnames, `.internal/.local/.onion` blocks, multi-address DNS resolution, comprehensive private-range CIDRs (v4 + v6, IPv4-mapped v6, CGNAT, link-local), and a per-link second-hop check before HEAD requests.
- CSV formula-injection sanitization in the export route.
- No secrets in git history — only `.env.example` is tracked; `.env.local` and all `*.db` are correctly gitignored.

**The real gap — SSRF is still vulnerable to DNS rebinding (TOCTOU), which AD-011 explicitly claims to have beaten:**
- `validateUrlSecurity()` does `dns.lookup()` and checks the IPs. Then Playwright/Chromium navigates and does its **own, separate DNS resolution**. Between the check and the fetch, an attacker-controlled domain can rebind to `169.254.169.254` / `10.x` etc. The two resolutions are independent → classic time-of-check/time-of-use hole.
- The "post-navigation revalidation" re-checks `page.url()` **after `page.goto()` has already completed** — i.e. after the request to the internal host has already been sent and the response already received into the browser context. You're detecting the breach after it happened, not preventing it.
- AD-011's rationale literally says the naive approach was rejected because it's "vulnerable to DNS rebinding." Your approach is *also* vulnerable to DNS rebinding. You claimed to solve the exact bug you still have.
- For a **local single-operator tool auditing arbitrary URLs the operator types**, the practical risk is low. But don't write in the decision log that you defeated an attack you didn't.

**Other security notes:**
- **The session cookie IS the plaintext secret.** `login/route.ts` sets `lead_engine_token = configuredSecret.trim()`. It's not a derived session token — it's the master password sitting in a cookie for 30 days. `httpOnly`/`SameSite` protect it well, but there's no rotation, no revocation, and any leak (a proxy log, the `unsafe-inline` XSS surface below) hands over the real secret, not a disposable token.
- **CSP is substantially defanged.** `script-src` includes both `'unsafe-inline'` and `'unsafe-eval'`, and `connect-src` allows `http:` and `https:` (any host). That combination means CSP provides little XSS protection and no meaningful exfiltration control. Applied globally including production. (Some of this is Next.js dev ergonomics, but it's shipped as the prod policy.)
- `login/route.ts` returns **500** when the secret is unconfigured in prod, while SECURITY.md/verifyAccess describe a fail-closed **401**. Minor inconsistency but it's the auth path.

---

## 5. Architecture & code quality

**Real strengths — call these out honestly:**
- Clean DDD-ish feature modularization (`discovery / auditor / qualification / commercial / synthesis / pipeline / identity`) with an `IDiscoveryAdapter` interface and six interchangeable adapters. This is textbook and well done.
- The **observation ledger** (`lead_observations`) with non-destructive upserts, deltas derived from the *preceding ledger row* rather than the mutable lead row, an out-of-order/clock-skew guard (`observedAt >= lastObservedAt`), and authoritative `observationCount` recomputed from the ledger — this is thoughtful, correct data modeling that most people wouldn't bother with.
- Real ACID: the lead upsert + ledger append + count sync are wrapped in a single `db.transaction`, with a re-check that the scan still exists (handles delete-during-scan). Good.
- Provider-neutral `DiscoveryPlan` with budget caps to prevent query/quota explosion. Good separation.
- `Guardrails.ts` as runtime invariant assertions is a nice idea in principle.

**The weaknesses:**

- **Three sources of schema truth, guaranteed to drift.** (1) Hand-written `CREATE TABLE` + a long `ALTER TABLE` self-healing block in `core/db/index.ts`; (2) the Drizzle `schema.ts`; (3) `supabase/schema.sql` (full Postgres DDL for a runtime that throws on Postgres — pure dead weight). They already disagree: `disposition` is `.notNull().default("PURSUE")` in Drizzle but added as a **nullable** `TEXT DEFAULT 'PURSUE'` via ALTER in the raw SQL. `drizzle-kit` is a dependency but migrations are hand-rolled as imperative `if (!existingColumns.has(...))` checks. Pick one. For SQLite-on-disk, drizzle-kit migrations or a single DDL file — not all three.

- **Silent migration failure.** The entire self-healing migration block ends in `catch (migErr) { // Silent fallback }`. A partially-applied schema migration will be swallowed with zero signal, leaving the DB in an inconsistent state that surfaces later as a confusing query error. At minimum log it; ideally fail loud on boot.

- **Cancellation is not "immediate."** `AbortController` is checked between batches and before the transaction, but the signal is **never passed into `auditEngine.auditUrl`**. A cancel during a batch still waits for up to 3 concurrent audits (each ~8s nav × 2 viewports + link HEADs) to finish. The docs' "immediately halt active browser contexts" is false. Wire the signal into Playwright (`page.goto` supports abort via context close) if you want the claim to be true.

- **Background job model is fragile by construction.** `executeScan` fires `runPipelineJob(...).catch(...)` as an unawaited floating promise and tracks `AbortController`s in an in-process `Map`. This only works because you pivoted to "long-lived local process." It's an acceptable choice for the stated scope, but it means: a crash mid-scan orphans everything (mitigated by the boot-time `RUNNING → FAILED` sweep), and the whole thing is fundamentally incompatible with the serverless/Vercel deployment the earlier docs/DECISION_LOG still reference in places.

- **`any` leaks in a codebase advertised as strict.** 36 `: any` + 13 `as any` (49 total), including `dossier as any` casts sprinkled through the pipeline and `qualification?: any` right in the `BusinessDossier` type. `strict: true` in tsconfig is undercut every time you cast the most important payloads to `any`. The types are the product's contract; don't `any` them away at the persistence boundary.

- **Two overlapping disposition vocabularies.** `LeadDisposition` (`PURSUE | PURSUE_LOW_TOUCH | NURTURE | NOT_A_FIT | INSUFFICIENT_EVIDENCE`) in `schema.ts` and `PursuitDecision` (`... | DO_NOT_PURSUE`) in `commercial/types.ts`. `DO_NOT_PURSUE` and `NOT_A_FIT` are the same concept in two enums. Taxonomy sprawl — pick one vocabulary for "should I pursue this."

- **Guardrails contain dead / confused logic:**
  - `assertNoSyntheticProviderData`: the first clause (`rating === 4.8 && reviewCount === 120 && source === 'UNVERIFIED'`) is fully subsumed by the second (`rating !== null && source === 'UNVERIFIED'`). The specific-magic-number check is unreachable dead code.
  - `assertNoDiscoveryIntentLeakage(category, discoveryNiche, categorySource)` ignores two of its three parameters and only looks at `categorySource`. Misleading signature.
  These read like LLM-generated "defensive" code that was never pruned.

- **`ScoringEngine` comments contradict its own math.** `calculateReputationScore` says "Maps 4.0 → 30 pts" but `((4.0-3.5)/1.5)*50 = 16.7`, not 30. Volume comment says "50 → 10 pts" but `log10(50)/log10(500)*30 = 18.9`, not 10. The code may be fine; the comments are wrong and will mislead the next person (you, in three months). Also `confidenceScore` conflates "audit finding confidence" with "confidence in the lead," and a no-website lead gets `confidenceScore = 100` **and** `digitalGapScore = 100` simultaneously, double-inflating its total.

- **The "4D Mathematical Scoring Model" is a weighted average of hand-tuned heuristics.** Nothing wrong with a `0.30/0.35/0.20/0.15` weighted sum — it's a reasonable heuristic. But calling it a "true 4D mathematical model" (AD-018) with LaTeX in the PRD oversells a `Σ wᵢsᵢ`. The weights are uncalibrated magic numbers; there's no validation that they predict anything. Present it as what it is: a defensible heuristic ranking.

- **Naming inflation is pervasive and it hurts you.** "Enterprise SSRF defense," "kinetic depth," "double-bezel hardware enclosures," "100-worker concurrency hardening," "10-layer commercial reasoning engine," "true 4D mathematical synthesis," "adversarial resilience suite." This language raises reviewer expectations to a level the (good, but normal) code can't meet, which makes solid work read as overclaiming. Tone it down and the same code reads as more credible, not less.

---

## 6. Tests, build, CI

- **Typecheck: clean.** `tsc --noEmit` passes with zero errors (verified — ran in 3.8s).
- **Test suite: could not be executed in this environment.** `node_modules` was installed on macOS and `device_bash` runs in a Linux VM, so rollup's native binary (`@rollup/rollup-linux-arm64-gnu`) is missing and vitest won't boot. I did **not** reinstall (that would modify your folder). This is an environment artifact, not a project defect — it runs on your Mac. Static count: **27 test files, ~127 cases**, including adversarial/concurrency/data-integrity suites. That's a serious test investment for a solo project.
- **CI is real and reasonable:** `ci.yml` runs lint → playwright install → vitest → build → e2e, with artifact upload on failure. `security.yml` runs TruffleHog (verified-only) + `npm audit --audit-level=high` weekly. Good hygiene.
- **Caveat I couldn't clear:** because I couldn't run vitest, I can't confirm the suite actually *passes* today — only that it typechecks and that CI is configured to gate on it. Your own Definition-of-Done mandates a green Playwright + audit run be logged; the DECISION_LOG's DoD section should contain the actual last-run command output, and you should confirm CI is green on `main`.

---

## 7. Repo hygiene / smaller stuff

- **`lead_engine.db`, `-wal`, `-shm`, and the test DBs are sitting in the working tree** (~4MB WAL files). Correctly gitignored, so not committed, but they're live in the folder and the WAL is large — worth a periodic checkpoint/vacuum.
- `package.json` has `"private": false` and `"version": "1.0.0"` for a tool the docs repeatedly call "private proprietary." If it's private, set `"private": true` so you can't accidentally `npm publish` it.
- 27 `console.*` calls and 7 empty `catch {}` blocks in `src`. For a local tool, console logging is fine, but the empty catches (e.g. in `cancelScan`, cookie parsing) silently swallow failures.
- `mapSemanticCategoryToGoogleType` covers ~9 categories and returns `undefined` for the rest — fine, but the granular `SemanticCategory` refactor bragged about in AD-031 still falls back to plain text search for most inputs.
- Good touches worth keeping: boot-time stale-scan sweep, `ON DELETE SET NULL` so observation history survives scan deletion, per-link SSRF before HEAD, `serverExternalPackages` for `better-sqlite3`/`playwright`.

---

## 8. Prioritized fix list

**Fix now (correctness / honesty):**
1. Kill or correct the review-velocity signal. Either compute momentum from your own `lead_observations` history, or remove the 30/90/180 buckets and the "velocity curves" language. Right now it's a fabricated signal in your headline feature. (§1)
2. Either implement the `reviews_last_90_days >= 3` gate or delete it from the PRD. Stop publishing invariants you don't enforce. (§2)
3. Make the migration block fail loud (or at least log). Silent schema-migration failure is a data-corruption time bomb. (§5)

**Fix soon (security / integrity):**
4. Rewrite AD-011 to state the real SSRF posture (TOCTOU/rebinding still possible) or actually pin the resolved IP into the navigation. Don't claim a defense you don't have. (§4)
5. Tighten the production CSP: drop `unsafe-eval`, scope `connect-src`. (§4)
6. Collapse to one schema source of truth; delete `supabase/schema.sql` or make it a real, maintained target. (§5)
7. Pass the abort signal into the audit engine so cancel is actually prompt (or fix the docs). (§5)

**Fix eventually (quality):**
8. Reconcile the docs to reality (PostgreSQL claim, missing `OpportunityClassifier`, adapter list, test counts) — one pass. (§3)
9. Remove `any` casts at the persistence boundary; type the dossier/qualification payloads. (§5)
10. Prune dead Guardrails logic; fix the wrong ScoringEngine comments. (§5)
11. Merge the two disposition enums. (§5)
12. Delete the marketing adjectives from code comments and the decision log. The code is good enough to speak plainly. (§5)

---

## 9. One-paragraph summary

The bones are good — real adapter architecture, a correct observation ledger with ACID upserts, above-average SSRF filtering, timing-safe auth, working CI, and a substantial test suite. But the project systematically **describes itself as more than it is**: a headline "review velocity" signal computed from a 5-review sample, a PRD invariant that isn't implemented, an SSRF defense that claims to beat the exact attack it's still vulnerable to, three disagreeing schema definitions, and docs that now contradict the code in a half-dozen places. Cut the overclaiming, fix the velocity signal and the silent migration, reconcile the docs, and this goes from "impressive-looking but can't-be-trusted-at-face-value" to "quietly solid."
