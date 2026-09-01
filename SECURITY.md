# Security & Threat Model Document
## Project: Private Client Discovery & High-Conviction Lead Engine (V1)

---

## 1. Threat Modeling & Security Scope

Because this is a **private, proprietary client acquisition engine** operated directly by the agency founder on a dedicated server or local machine, the security surface focuses primarily on:
1. **Network & Webhook Egress / SSRF Defense**: Preventing Server-Side Request Forgery during automated headless browser audits.
2. **Headless Browser Sandboxing & Execution Isolation**: Defending against malicious JavaScript execution, endless redirection loops, memory exhaustion, and DOM-based exploits.
3. **Data Protection & Zero Secrets Leak Invariant**: Absolute isolation of API keys (Apify, Outscraper, OpenAI, Gemini) and database credentials.
4. **Input Sanitization & Injection Defense**: Preventing SQL injection, command injection, and script injection via scraped web content.
5. **Content Security Policy (CSP) & HTTP Security Headers**: Hardening the command center frontend.

---

## 2. Security Defense Invariants

### 2.1 SSRF & Playwright Headless Browser Hardening
When crawling arbitrary target URLs:
- **Private IP Blocking**: The headless auditor will strictly reject requests targeting private/internal network ranges (`127.0.0.1`, `localhost`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254` cloud metadata endpoints).
- **Navigation Timeout Bounds**: Every page navigation is bounded by a strict `15,000ms` hard timeout.
- **Resource Download Restrictions**: Disables download of executable files (`.exe`, `.dmg`, `.sh`, `.zip`) during page inspection.
- **Isolated Contexts**: Every audit runs in an ephemeral, freshly created Playwright browser context that is completely destroyed immediately after telemetry extraction, preventing cookie or session leakage between targets.

### 2.2 Zero Secrets Leak Invariant
- All API keys, tokens, and database connection strings MUST be stored in `.env.local` and strictly excluded via `.gitignore`.
- Zero credentials or tokens shall ever be committed to git history or included in client-side bundles.
- Client-side code accesses backend data solely through Next.js server actions / API endpoints without exposing raw environment variables (`NEXT_PUBLIC_` prefixes restricted to non-sensitive UI config).

### 2.3 Input Sanitization & SQL Injection Defenses
- All database queries are executed through **Drizzle ORM** parameterized queries, mathematically eliminating raw SQL concatenation vulnerabilities.
- All user-supplied query strings (`niche`, `location`, `radiusKm`) are validated via strict Zod schemas before being passed to discovery adapters.

### 2.4 XSS & DOM Sanitization
- Scraped business titles, review snippets, and DOM texts rendered in the Command Center UI are treated as untrusted strings and safely escaped by React 19's virtual DOM.
- Raw HTML rendering (`dangerouslySetInnerHTML`) is strictly banned.

### 2.5 HTTP Security Headers
Every HTTP response served by the command center includes standard OWASP-recommended headers:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self';`
