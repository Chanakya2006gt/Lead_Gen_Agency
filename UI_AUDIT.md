# Lead Engine — Brutal UI Audit

**Auditor:** Claude (Opus 4.8) · **Date:** 2026-09-05
**Companion to:** `AUDIT_REPORT.md`, `IMPLEMENTATION_PLAN.md`
**Scope:** Source-level UI audit of `src/app/{layout,page,globals.css}` and all 8 components. No code changed.
**Method note:** I could not run the dev server in this environment (the Mac-installed `node_modules` — native `better-sqlite3` and rollup binaries — won't execute in the Linux VM, and I won't reinstall into your folder). So this is a read of the actual JSX/CSS against your own `DESIGN.md`, not a live pixel review. Where I say "contrast likely fails," that's a code-based estimate, not a measured value — verify with a contrast tool in-browser.

---

## 0. Verdict

The UI is **competent and dense, with genuinely good bones in the inspector drawer** — but it has drifted so far from its own `DESIGN.md` that the design spec is now fiction, and it carries the **same honesty problem as the backend, except here it's pointed at your prospects**: the outreach copy contains an invented ROI number ("captures 15-25 more client inquiries a month"), and the dashboard shows a fabricated "pipeline value" as hard currency. On top of that, the accessibility section of `DESIGN.md` (§8) describes a keyboard-and-screen-reader-friendly app that **does not exist** — no Escape-to-close, no `Cmd+K`, no focusable rows, no ARIA, no dialog role.

Visually it's a B-. As an honest, accessible, spec-compliant product it's a C. The drawer alone is a B+.

The single most important sentence: **your product's whole pitch is "zero hallucination, empirical evidence only" — and the UI hands the user a message template that tells prospects a made-up number.** Fix that first.

---

## 1. What's actually good (credit where due)

- **The inspector drawer is the best part of the app.** Clear IA (Why This Lead → Commercial Economics → Audit Telemetry → Outreach Decks → Triage), and the **"OUTREACH GATED" state** (when `pitch.outreachAllowed === false`) is a real integrity feature — it refuses to manufacture a pitch when there's no evidenced problem. That's the honesty ethos actually showing up in the UI.
- **Concrete evidence badges** ("No SSL", "Desktop Only", "Missing Viewport", latency in ms) match `DESIGN.md`'s "concrete evidence, not hype labels" principle. This is done well.
- **Honest unverified-data handling.** When Google isn't verified, the UI shows "Direct URL Audit (Unverified Google)" instead of fake stars. Matches AD-032. Good.
- **Provenance badges** (Google Verified / Maps DOM / Website Detected / User Specified) surface data lineage in the drawer — a genuinely sophisticated touch most tools skip.
- **Sensible density and utility**: filter pills with live counts, table/grid toggle, search across name/address/category, per-button loading spinners, a dismissible error banner in `ScanLauncher`.
- Correct use of `stopPropagation` on nested links/buttons inside clickable rows/cards.

---

## 2. Design-vs-spec drift (the spec is no longer describing this app)

### 2.1 The specified fonts are never loaded — the whole typography system is fictional
`DESIGN.md` §4.3 and §9 specify Inter/Geist Sans + Geist Mono with `tabular-nums`, and the entire "strict monospace tabular numerals for all scores/ratings/latencies" principle depends on it. **`layout.tsx` imports no font** (no `next/font`, no `@font-face`, grep-confirmed). So every `font-mono` falls back to the OS default monospace and `font-sans` to system-ui. Your carefully specified quantitative type system renders in whatever mono font the viewer's OS ships — inconsistent across machines, and none of it is Geist. The one feature the design leans hardest on (numbers feeling deliberate) is unenforced.

### 2.2 Four different "canvas" colors; the token system is unused
- `DESIGN.md` §4.1: canvas `#080A0F`, surface `#0D111A` (opaque), border `rgba(255,255,255,0.08)`.
- `globals.css`: canvas `#070A10`, surfaces **translucent** `rgba(10,15,29,0.45)`, border `0.16`/`0.18`.
- `layout.tsx` body: `bg-[#0B0F17]`.
- `Header.tsx`: `bg-[#0A0E17]/80`. `DashboardClient`: `#070A10`. Autocomplete dropdown: `#0F172A`. Selected card: `#0F1422`.

That's **four+ canvas values and a scatter of one-off surface hexes**. The CSS variables in `globals.css` don't match `DESIGN.md`, and almost nothing in the components uses the variables anyway — every panel hardcodes arbitrary Tailwind values (`bg-slate-900/60`, `black/40`, `#0A0D14`…). You have a documented three-layer token system and an implemented design that ignores it.

### 2.3 `ScoreGauge` thresholds and colors contradict the spec
- `DESIGN.md` §6: ≥80 emerald, 60–79 **indigo**, <60 slate.
- `ScoreGauge.tsx`: ≥75 emerald, 50–74 **amber**, <50 slate.

Different breakpoints **and** different colors. Worse, amber is your semantic color for "gap/absence" (No Website, Desktop Only) per §4.2 — so amber now means both "medium score" and "missing website," muddying the very color system §4.2 claims is "strictly to encode information."

### 2.4 The banned glassmorphism is the base surface of the entire app
`DESIGN.md` §2 bans "floating glassmorphic blobs" and AD-021 claims you "removed glassmorphism." Reality: `.card-surface` is literally `backdrop-filter: blur(14px)` + inset highlight + big shadow, and **it's applied to every panel** — launcher, metrics, banner, table, cards, lock screen. `Header` adds `backdrop-blur-xl`. This is glassmorphism as the foundation, not its removal.

### 2.5 A cinematic hero photo + radial glow sits behind a data terminal
`DashboardClient` renders a full-bleed `/assets/hero-bg.jpg` at `opacity-100 contrast-[1.3] brightness-[1.25]` plus a `bg-radial from-indigo-500/10` ambient glow, behind everything. `DESIGN.md`'s core promise is "deep matte void, zero eye-strain, zero visual slop." A brightened photographic wallpaper under translucent glass panels of small low-contrast mono text is the exact opposite — and it actively hurts readability of the data, which is the whole point of the app.

### 2.6 `DESIGN.md` names components that don't exist
§9 lists `LeadDossierModal.tsx` (actual: `LeadInspectorDrawer.tsx`) and `LiveTerminal.tsx` (actual: `LivePipelineBanner.tsx`). Neither documented file exists. And the "collapsible background telemetry stream" / "real telemetry log streaming" (README, DESIGN §9) is vaporware — the reality is a two-number counter banner updated by 2-second polling. No log stream anywhere.

---

## 3. Honesty problems that reach the customer (fix first)

### 3.1 Invented ROI baked into outreach copy
`LeadInspectorDrawer` WhatsApp draft: *"…how fixing this captures **15-25 more client inquiries a month**…"*. This is a fabricated quantified outcome with zero basis, inserted into a message the operator sends to a real prospect. PRD invariant #10 says "AI is forbidden from inventing revenue, customer metrics, or fake ROI," and `OutreachClaimValidator` exists specifically to purge unfounded claims — but it doesn't catch this hardcoded string. This is the backend's velocity-fabrication problem, except now it's in the words your user puts in front of a customer. Remove the number or make it a range the user fills in.

### 3.2 "Est. Pipeline Scope" is a made-up total shown as hard currency
`ExecutiveMetrics` sums hardcoded per-lead INR values (₹65k/₹25k/₹20k/₹15k/₹12k) and renders the sum as a precise currency figure (e.g. "₹4,15,000"). It's an unvalidated projection presented as a metric — the kind of "invented telemetry" your own project rules ban ("Zero invented telemetry metrics"). It also duplicates, and slightly disagrees with, the scope ranges shown on the cards (card says "₹8k–₹15k", the sum uses ₹12k). At minimum label it clearly as a rough estimate and reconcile the numbers with the commercial engine rather than hardcoding them in the component.

### 3.3 Hardcoded personal/locale defaults leak into a "location-agnostic" tool
- `ScanLauncher.getInitialCityFromTimezone()` defaults **and** falls back to `"Warangal, Telangana, India"` for India and for any unknown timezone. Every India user and every unrecognized locale starts pinned to one small city.
- `LeadInspectorDrawer` outreach fallback signs off as **"Chanakya"** / "Agency Growth Partners" when env vars are unset.

These are the founder's specifics leaking into the product surface. Fine for a private tool, but they contradict the "location-agnostic universal" framing and would embarrass in any shared/demo use.

### 3.4 Fake version label
`Header` shows `v2.4`; `DESIGN.md` §5.1 wanted `v2.4 Production`; `package.json` says `1.0.0`. The version chip is decorative fiction. Small, but it's the same "hype label" the design doc bans.

---

## 4. Accessibility — `DESIGN.md` §8 describes an app that doesn't exist

§8 claims WCAG 2.2 AA, full keyboard nav (`Tab`/`Enter`/`Escape`/`Cmd+K`), semantic tables with ARIA, and screen-reader support. Actual state:

- **Modal/drawer is not accessible.** No `role="dialog"`, no `aria-modal`, no focus trap, no focus-on-open, no return-focus-on-close, and **Escape does nothing** (no key handler) despite §8 explicitly promising it. The backdrop isn't click-to-close either — mouse users must hit the small X. A keyboard user can tab *past* the drawer into the page behind it.
- **`Cmd+K` doesn't exist.** No keydown listener anywhere. Specified in §5.2 and §8; not implemented.
- **Table rows aren't keyboard-reachable.** Rows are `<tr onClick>` (not focusable, no `role`/`tabindex`). §8's "Tab cycles through leads, Enter opens dossier" is false. There's an "Inspect" button per row (focusable — so there *is* a path), but the row-click model isn't announced and isn't the documented behavior.
- **Market tabs and autocomplete items are `<div onClick>`** — not focusable, no keyboard selection, no arrow-key navigation on the city dropdown.
- **No semantic table affordances.** Plain `<th>` with no `scope="col"`; no `aria-label` on score badges or icon buttons. §8's "semantic tables with aria-label attributes" is not done. Icon-only buttons (refresh, delete X, view toggles) rely on `title` only, which is not a reliable accessible name.
- **Contrast likely fails AA in places.** Lots of `text-slate-500`/`text-slate-400` at `text-[10px]`/`[11px]` on translucent surfaces **over a brightened photo**. `slate-500` on your dark surfaces is roughly ~3.5:1 — under the 4.5:1 AA threshold for body text — and the hero image makes it worse where panels are translucent. Verify in-browser, but the §8 "≥4.5:1 all body copy" claim is doubtful as built.
- **10–11px type everywhere.** The terminal density is intentional, but 10px mono for meaningful data (counts, deltas, badges) is below comfortable/accessible minimums.

Net: §8 is aspirational documentation, not a description of the build. Either implement it or stop claiming it.

---

## 5. UX gaps

- **Silent failures everywhere.** In `DashboardClient`, every fetch failure is just `console.error` — scan launch failure (outside the launcher), status update failure, cancel failure, delete failure all produce **no user-visible feedback**. The user clicks, nothing happens, no error. Only `ScanLauncher` has an error banner.
- **Destructive actions are rough.** Deleting a market is a one-click `X` on the tab with **no confirmation** (cascade removes the scan; observations survive via `ON DELETE SET NULL`, but the user doesn't know that). "Clear History" uses a native `window.prompt("Type DESTROY_ALL")` — jarring, blocks the page, and clashes with the "quiet executive tool" aesthetic. Native prompt/confirm also can't be styled and read as unfinished.
- **Provider dropdown offers options that silently fail.** `ScanLauncher` lets the user pick "Live" (requires `ALLOW_UNSAFE_MAPS_SCRAPE`), "SerpAPI", "Apify" (require keys) with **no indication they're gated**. Selecting one and scanning just errors out. No affordance, no disabled state, no "requires key" hint.
- **Documented radius control is missing.** `DESIGN.md` §5.2 specifies a 10/15/25km radius selector; the discovery form has none — `radiusKm` is hardcoded to 15 in state and never settable from the UI.
- **Polling is chatty and disruptive.** During a scan, `DashboardClient` polls **both** `/api/scans/:id` and `/api/scans` every 2s, refetching all leads and re-running the table's filter/sort/render each time. Mid-interaction (scrolling, a hovered row) this causes churn, and it re-runs the drawer's heavy string/classifier builds every 2s if it's open. Consider incremental updates or a longer interval.
- **Two different empty states** for the same "no leads" concept (table version: Sparkles + "…for this filter"; grid version: `py-20`, different copy). Pick one.
- **First-run has no guidance.** With zero scans, the user sees a launcher, empty metric cards (all zeros / "—"), and an empty table. No onboarding hint beyond the empty-state line inside the table.

---

## 6. Front-end code quality

- **A redundant control kept only for tests.** The website-filter `<select>` in `LeadMatrixTable` is commented *"Retained for Test & Automation Compatibility."* It duplicates the pill filters and can compound confusingly with them. UI driven by test IDs rather than users is a smell — fix the tests, remove the dead control.
- **Invalid Tailwind class silently dropping padding.** `py-0.2` appears on the count badges (`LeadMatrixTable`) — `0.2` isn't a valid spacing token, so the class is ignored and the intended vertical padding never applies. Should be `py-0.5`.
- **`next/image` imported but unused;** the full-screen hero uses a raw `<img>` (twice), foregoing Next's image optimization on the single largest asset on the page.
- **Duplicated logic.** `renderOpportunityBadge`/`renderBadge` is copy-pasted between `LeadMatrixTable` and `OpportunityCardGrid`; the triage-status pill styling is duplicated too. Extract once.
- **`any` in the UI layer.** `auditTelemetry as any`, `dossier as any`, `onStatusChange(leadId, status: any)`. The drawer also declares two props for one job (`onStatusChange` **and** `onUpdateStatus`, resolved via `||`) — `onUpdateStatus` is dead (only `onStatusChange` is passed).
- **No memoization of expensive per-render work.** The drawer rebuilds all outreach strings and runs `BusinessModelClassifier.classify` + `OutreachClaimValidator.validate` on every render (including every 2s poll re-render while open). Wrap in `useMemo` keyed on `lead`.
- **Duplicated magic numbers.** Scope ranges (₹8k–₹15k, ₹18k–₹35k) and the estimated-value fallback (`₹18,000 – ₹35,000`) are hardcoded in `ExecutiveMetrics`, `LeadInspectorDrawer`, and the synthesizer — three copies to drift.

---

## 7. Responsive (`DESIGN.md` §7 largely unimplemented)

§7 specifies tablet sub-row collapsing and a mobile card view with swipeable scripts and direct-call triggers. Reality: the table just gets `overflow-x-auto` (horizontal scroll on mobile — the opposite of "cards replace wide rows"), the grid view exists but **isn't auto-selected on small screens**, and there's no swipe interaction. `ExecutiveMetrics` and the launcher do stack responsively (good), and the drawer is `w-full` on mobile (fine). But the documented mobile triage experience isn't there.

---

## 8. Prioritized fixes

**Do first (honesty — these reach customers/your credibility):**
1. Remove the invented "15-25 more client inquiries a month" from the WhatsApp draft (and audit all outreach templates for other fabricated numbers). (§3.1)
2. Label "Est. Pipeline Scope" as a rough estimate and reconcile its hardcoded numbers with the commercial engine, or drop the summed total. (§3.2)

**Do soon (accessibility — you're claiming AA you don't have):**
3. Drawer: add `role="dialog"`/`aria-modal`, Escape-to-close, backdrop click-to-close, focus trap + focus management. (§4)
4. Make table rows / market tabs / autocomplete items keyboard-operable (real buttons or `role`+`tabindex`+key handlers); add `scope="col"` and `aria-label`s on icon buttons and score badges. (§4)
5. Verify and fix text contrast (raise muted-text colors / min font size), and reconsider the hero image behind data. (§2.5, §4)

**Do next (UX):**
6. Surface fetch errors to the user (toast/banner) instead of `console.error`. (§5)
7. Add a confirm to per-market delete; replace `window.prompt` clear-all with a styled modal. (§5)
8. Gate/disable provider options that need keys/flags, with a hint. (§5)
9. Add the documented radius control (or remove it from the spec). (§5)

**Then (consistency / quality):**
10. Load the actual Geist fonts via `next/font`, or change the spec. (§2.1)
11. Reconcile the design tokens: one canvas color, one surface treatment, use the CSS variables (or delete them). Update `DESIGN.md` component names. (§2.2, §2.6)
12. Align `ScoreGauge` thresholds/colors with `DESIGN.md` (or update the doc), and stop overloading amber. (§2.3)
13. Decide on glassmorphism honestly — either embrace it in the spec or actually flatten the surfaces. (§2.4)
14. Fix `py-0.2`, remove the unused `next/image` import and the test-only select, de-dupe the badge renderers, `useMemo` the drawer's derived copy, remove the dead `onUpdateStatus` prop and the `any`s. (§6)
15. Move hardcoded founder/city/scope defaults into config; don't ship "Warangal"/"Chanakya" as fallbacks. (§3.3)

---

## 9. One-paragraph summary

The inspector drawer shows what this app can be — evidence-first, with a real integrity gate that refuses to fabricate pitches. But the rest of the UI undercuts that: it invents an ROI number inside the message your user sends to prospects, shows a made-up pipeline total as hard currency, and ships an accessibility spec (`DESIGN.md` §8) that the code doesn't honor — no Escape, no `Cmd+K`, no focusable rows, no ARIA, likely sub-AA contrast, all over a brightened hero photo the design philosophy explicitly forbids. None of it is hard to fix. Kill the fabricated numbers, make the drawer and table keyboard-accessible, reconcile the design tokens/fonts with reality, and this becomes the "quiet, serious intelligence terminal" the spec keeps promising.
