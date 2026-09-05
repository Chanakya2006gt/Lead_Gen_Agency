# Security & Threat Model Document
## Project: Lead Engine — Local Workstation Security & Defense Model

---

## 1. Threat Modeling & Scope

Lead Engine is designed as a **local-first, single-operator acquisition workstation**. Its security model enforces:
1. **Fail-Closed API Authentication**: Protects all discovery, audit, and data export endpoints using `LEAD_ENGINE_API_SECRET` with constant-time hash comparisons (`crypto.timingSafeEqual`) and httpOnly `SameSite=Strict` session cookies.
2. **Network & SSRF Defense**: Dual-stage Server-Side Request Forgery prevention (pre-navigation DNS resolution filtering + post-navigation redirect URL validation).
3. **Headless Browser Sandboxing & Execution Isolation**: Ephemeral browser contexts per audit, disabling web security bypasses, and strictly bounded timeouts.
4. **CSV Formula Injection Defense**: All exported spreadsheet cells starting with `= + - @ \t \r` are sanitized with single-quote prefixes.
5. **Zero Secrets Leak**: Server-side API key isolation with zero client-side Google Maps keys exposed.

---

## 2. Security Defense Invariants

### 2.1 Fail-Closed Authentication & Session Management
- **Secret Verification**: Calls to `/api/*` require either `x-engine-secret`, `Authorization: Bearer <secret>`, or the httpOnly cookie `lead_engine_token`.
- **Fail-Closed Default**: If `LEAD_ENGINE_API_SECRET` is unset, all mutating and exporting routes return `401 Unauthorized` unless `ALLOW_INSECURE_LOCAL_AUTH=true` is explicitly configured in a non-production environment.
- **Timing Attack Prevention**: Uses SHA-256 digest buffer comparison via `crypto.timingSafeEqual` to eliminate timing side-channels.

### 2.2 Dual-Stage SSRF Defense (Pre-Check + Post-Navigation Recheck)
When auditing arbitrary target URLs:
1. **Pre-Navigation Check**: Resolves all DNS A/AAAA records and rejects private/loopback/cloud metadata IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, IPv4-mapped IPv6, carrier-grade NAT).
2. **Post-Navigation Destination Recheck**: After `page.goto()`, inspects `page.url()` and HTTP response events. If any HTTP redirect (301/302/307) leads to a restricted internal/private IP or metadata endpoint, the context is immediately terminated.
3. **Strict 8,000ms Timeout**: Navigation is bounded by a hard `8,000ms` timeout.
4. **Context Isolation**: Every audit runs in an ephemeral, freshly created Playwright browser context that is destroyed immediately after inspection.
5. **Threat Model & Residual Risk**: Pre-navigation DNS filtering blocks common cases (typed private hostnames, literal metadata IPs, obfuscated encodings, private ranges). Because Chromium resolves DNS independently (TOCTOU), determined DNS-rebinding attacks represent a theoretical residual risk that is accepted under the local single-operator workstation threat model.

### 2.3 CSV Formula Injection Defense
In `/api/leads/export`, cell values are inspected. Any string beginning with dangerous spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) is automatically prefixed with `'` to neutralize formula execution in Microsoft Excel and Google Sheets.

### 2.4 Server-Side Secret Isolation
- All third-party provider keys (`GOOGLE_MAPS_API_KEY`, `SERPAPI_API_KEY`, `APIFY_API_TOKEN`, `OPENAI_API_KEY`) are accessed strictly on the server side.
- No client-side Google Maps API keys (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) are permitted in codebase files.

### 2.5 HTTP Security Headers & CSP
Every response served by the command center includes standard security headers:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' ['unsafe-eval' in dev]; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://nominatim.openstreetmap.org;`
