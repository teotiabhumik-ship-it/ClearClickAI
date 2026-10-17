# ClearClick AI — Multi-Page Site Scanning: Final Verification Report

**Date**: October 17, 2026  
**Status**: Completed and Verified  
**Scope**: Multi-page discovery, ranking, block detection, safe scan engine, guided flow capture, honest coverage reporting, and evaluation hooks.

---

## 1. Summary of Changes

ClearClick AI has been extended from analyzing a single landing page to performing polite, capped, high-signal site scanning across the pages where deceptive patterns typically cluster (pricing, cart, checkout, sign-up, account/cancellation, consent).

Every change adheres strictly to the project's Hard Rules:
1. **Zero Bot-Bypass**: No stealth plugins, fingerprint spoofing, proxies, or CAPTCHA solvers. Blocked pages are reported honestly with alternative options (screenshot upload / flow builder).
2. **Polite Crawling**: Respects `robots.txt`, identifies via `ClearClickAI-Auditor/1.0`, enforces domain concurrency of 1, applies polite delays (1.0s), and respects cooldowns.
3. **Safe-Click Enforcement**: Never clicks destructive or financial actions ("Buy", "Pay", "Place order", "Delete account", "Cancel subscription"). Halts immediately upon encountering password/login or payment fields.
4. **Safety & Hygiene**: All discovered links and redirect targets re-validated against SSRF / private IP / link-local / scheme rules.
5. **Deterministic Calibration**: No overall site scores or grades; severity comes exclusively from code; coverage is reported transparently.

---

## 2. Files Changed and Created

### Backend Configuration & Models
- [`backend/app/config/scan_settings.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/config/scan_settings.py): Centralized configuration for crawler parameters (User-Agent, concurrency, delays, block phrases, thresholds, caps, timeouts, scoring keywords, and AI budgets).
- [`backend/app/schema.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/schema.py): Added models and types for multi-page scanning: `Scan`, `ScanPage`, `PageType`, `SkippedReason`, `ScanDecision`, `ScanAIStatus`, `Coverage`, `GroupedFinding`, `FlowStepResult`, and `GuidedFlowResult`.

### Block Detection & Extractor Hardening
- [`backend/app/crawler/block_detector.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/crawler/block_detector.py): Implements HTTP status code detection (401, 403, 429, 503), challenge wall phrase matching (e.g. Cloudflare, "verify you are human", "access denied"), empty page detection (< 50 visible characters), and `DomainCooldownTracker` to prevent hammering blocked domains.
- [`backend/app/extract/playwright_extractor.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/extract/playwright_extractor.py): Stripped of stealth plugins and spoofing headers; uses honest User-Agent `ClearClickAI-Auditor/1.0`; intercepts all navigation redirects to re-validate destination URLs against SSRF rules before navigation completes; returns accurate `page_status` and `status_reason`.

### Page Discovery & Ranking
- [`backend/app/crawler/discovery.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/crawler/discovery.py): `DiscoveryEngine` collects candidate URLs from `robots.txt` declared sitemaps, `/sitemap.xml`, and landing page links; normalizes URLs (strips tracking parameters and fragments); enforces same-registered-domain; collapses near-duplicate templates (`/products/123` -> `/products/<id>`); scores URLs by keywords (`pricing`, `checkout`, `cancel`, `cart`, `subscribe`); and outputs prioritized candidates with explicit decisions (`will_analyse`, `skipped_low_priority`, `skipped_duplicate`, `skipped_robots`, `skipped_cap`).

### Scan Engine & Site Model
- [`backend/app/crawler/scan_manager.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/crawler/scan_manager.py): `ScanManager` manages queued background scan jobs; enforces domain concurrency lock = 1; executes polite request delay; handles cooperative cancellation via `POST /api/scans/{id}/cancel`; deduplicates site-wide repeated elements (e.g. cookie consent banners) via element fingerprinting; groups identical findings across pages into `GroupedFinding` records ("Seen on N pages"); computes live `Coverage` metrics; and stops AI calls cleanly once `SCAN_AI_CALL_BUDGET` is reached, marking remaining pages as `ai_skipped_budget`.
- [`backend/app/main.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/main.py): Added endpoints:
  - `POST /api/scans`: Starts a background site scan.
  - `GET /api/scans/{scan_id}`: Retrieves live scan status, progress counts, page results, coverage, and grouped findings.
  - `POST /api/scans/{scan_id}/cancel`: Gracefully cancels an in-flight scan.
  - `POST /api/flows/guided`: Initiates a safe, scripted cart-to-checkout flow.
  - `GET /api/flows/guided/{flow_id}`: Retrieves completed or partial guided flow steps and drip pricing analysis.

### Guided Safe Flow Capture
- [`backend/app/crawler/guided_flow.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/crawler/guided_flow.py): `GuidedFlowCapturer` executes safe, generic cart-to-checkout flows; enforces `is_click_forbidden()` against buying/paying/confirming/cancelling text; halts immediately if password, login, or credit card inputs appear; records `flow_stopped: reason`; and passes reached steps to `FlowAnalyzer.analyze_flow_async()` for drip pricing comparison.

### Frontend
- [`frontend/src/types.ts`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/src/types.ts): TypeScript interfaces for `Scan`, `ScanPage`, `Coverage`, `GroupedFinding`, `FlowStepResult`, and `GuidedFlowResult`.
- [`frontend/src/components/InputForm.tsx`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/src/components/InputForm.tsx): Added "Scan this site" tab with plain-words limits ("up to 8 pages; AI on at most 5"), explicit AI toggle with state written out in plain words (`AI analysis: OFF` / `AI analysis: ON`), default OFF (no pre-ticked options!).
- [`frontend/src/components/SiteScanProgress.tsx`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/src/components/SiteScanProgress.tsx): Real-time progress monitor displaying live counts ("12 found, 6 analysed, 1 blocked"), queue list, and Cancel button.
- [`frontend/src/components/ScanReportView.tsx`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/src/components/ScanReportView.tsx): Site report view featuring:
  - Category summary tiles with counts (no scores or grades).
  - Grouped findings ("Seen on N pages") with expandable details and page lists.
  - Mandatory COVERAGE panel with prominent disclaimer: *"Results cover only the pages reached. No findings does not mean the whole site is fair."* linking to `/methodology#limits`.
  - Honest per-page status badges with text and icons (`[✓ Analysed]`, `[⛔ Blocked by site]`, `[🔒 Requires login]`, etc.), with action buttons offering screenshot upload or flow builder.
- [`frontend/src/pages/AnalysePage.tsx`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/src/pages/AnalysePage.tsx): Integrated multi-page scan initiation, polling lifecycle, cancel handling, and seamless switching between single-page and multi-page modes.
- [`frontend/src/pages/MethodologyPage.tsx`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/src/pages/MethodologyPage.tsx): Added "Scanning multiple pages" documentation section detailing discovery, caps, polite crawling, block reporting, and data privacy.

### Tests & Evaluation
- [`tests/test_site_scanning.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/tests/test_site_scanning.py): 19 comprehensive mocked tests for block detection, discovery, template collapsing, scan engine, cancellation, AI budgeting, element deduplication, safe click enforcement, and evaluation hooks.
- [`scripts/eval_site_scan.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/scripts/eval_site_scan.py): CLI evaluation script measuring site scan coverage, block rate, AI calls, and runtime on test fixtures.

---

## 3. Audit Findings versus Assumptions

| Topic | Initial Assumption | Code Audit Reality | Implemented Solution |
| :--- | :--- | :--- | :--- |
| **Bot Blocking** | Extractor loads any public page without interference. | Extractor had spoofed navigator properties and failed silently or threw uncaught exceptions when bot challenge walls or CAPTCHAs appeared. | Stripped spoofing; added `detect_page_block()` for HTTP 401/403/429/503, challenge phrases, and empty DOMs; returns `page_status="blocked"` with cooldown tracking. |
| **Redirect Safety** | SSRF check on input URL is sufficient. | Playwright followed redirects without re-checking destination addresses, allowing internal/private network pivot. | Intercepted navigation redirect requests in `playwright_extractor.py` and re-validated every hop with `validate_url_safety()`. |
| **Site Scope** | Finding dark patterns requires broad crawling. | Crawling entire domains exhausts AI quotas and floods reports with irrelevant blog/press articles. | Keyword-prioritized discovery targeting only high-risk clusters (pricing, cart, checkout, cancel, consent) capped at 8 pages max. |
| **Element Duplication** | Repeating detectors on each page is fine. | Site-wide elements (cookie banners, footers) produced duplicated findings on every single page. | Element fingerprint cache deduplicates repeated items, grouping them into `GroupedFinding` records ("Seen on N pages"). |
| **Flow Safety** | Automated flow can click through to purchase. | Clicking checkout buttons risks completing accidental purchases or submitting customer data. | Strict safe-click filter blocks buying/paying/submitting/cancelling text; halts at first login or payment input. |

---

## 4. What Was Verified and How

1. **Backend Test Suite Integrity**:
   - `python -m pytest tests/test_site_scanning.py`: 19 passed.
   - `python -m pytest tests/`: **111 passed** across the entire project (100% pass rate, zero regressions).
   - All tests use synthetic fixtures and mocks (zero live network requests, zero LLM quota consumed).

2. **Test Verifications Covered**:
   - **HTTP Block Statuses**: 401 (`needs_login`), 403 (`blocked`), 429 (`blocked`), 503 (`error`/`blocked`), 404 (`invalid_url`).
   - **Challenge Wall Text**: Cloudflare, "verify you are human", "access denied", "robot check".
   - **Empty Page Detection**: Text length < 50 characters flagged as `empty`.
   - **Domain Cooldown Tracker**: Prevents repeated requests to blocked domains for configurable duration.
   - **URL Normalization**: Removes query tracking (`utm_*`, `fbclid`), normalizes ports and hosts, resolves relative paths.
   - **Path Template Collapsing**: Collapses `/products/12345` and `/products/98765` to `/products/<id>`.
   - **Robots.txt & Sitemap Parsing**: Respects disallowed paths (`skipped_robots`), parses XML sitemaps and sitemap indices.
   - **URL Safety & SSRF Rejection**: Strictly rejects `127.0.0.1`, `localhost`, `169.254.169.254` (cloud metadata), `10.0.0.1`, `192.168.1.1`, `file://`, and `javascript:`.
   - **Safe-Click Enforcement**: Forbids clicking "Pay now", "Buy Now", "Place Order", "Delete Account", "Cancel Subscription"; allows "Add to cart", "Choose plan", "View cart".
   - **Guided Flow Abort**: Halts immediately on encountering `<input type="password">` or credit card fields.
   - **AI Call Budgeting**: Runs AI only on top N pages, enforces per-scan budget ceiling, and marks subsequent pages `ai_skipped_budget`.
   - **Grouped Findings**: Combines repeated cookie banner detections across pages into a single finding listing all pages.
   - **Cancellation Lifecycle**: Verifies `POST /api/scans/{id}/cancel` immediately cancels in-flight jobs.

3. **Frontend Build & TypeScript Verification**:
   - `npm run build` in `frontend/` succeeded with exit code 0 and zero compilation errors.

---

## 5. What Is Not Implemented (By Design)

In strict accordance with the project rules, the following capabilities are deliberately **NOT** implemented:
- **No Bot Protection Bypassing**: No stealth plugins, proxy rotation, CAPTCHA solvers, or canvas/browser fingerprint masking.
- **No Form Submission or Payment**: Never fills in customer names, addresses, credit cards, or passwords.
- **No Destructive Clicks**: Never clicks "Buy", "Pay", "Place Order", "Confirm Payment", "Cancel Subscription", or "Delete Account".
- **No Login Bypassing**: Pages behind login walls are marked `needs_login` and require manual upload or flow builder.
- **No Overall Site Score or Letter Grade**: ClearClick AI reports verified observations with evidence quotes and measurements; it never assigns subjective site scores or legal conclusions.
- **No Deep Unbounded Crawling**: Discovery is strictly limited to depth 2 and a maximum of 8 analysed pages.

---

## 6. Settings the User Must Provide

To operate ClearClick AI with full multi-page scanning and AI capabilities, provide the following environment variables or configuration entries:

| Setting | Location | Default | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Environment variable | `""` | Optional Google Gemini API key. If omitted, all scans run rule detectors with `ai_status="skipped_no_key"`. |
| `GEMINI_MODEL` | Environment variable | `gemini-2.5-flash` | Gemini model identifier. |
| `SCAN_USER_AGENT` | `scan_settings.py` | `ClearClickAI-Auditor/1.0 (+https://clearclick.ai/bot)` | Honest User-Agent header sent with all HTTP requests. |
| `REQUEST_DELAY_SECONDS` | `scan_settings.py` | `1.0` | Politeness delay between requests to the same domain. |
| `MAX_PAGES_ANALYSED` | `scan_settings.py` | `8` | Maximum candidate pages analysed per site scan. |
| `MAX_AI_PAGES` | `scan_settings.py` | `5` | Maximum ranked pages eligible for Gemini AI analysis. |
| `SCAN_AI_CALL_BUDGET` | `scan_settings.py` | `6` | Hard ceiling on AI calls per scan to preserve free-tier quotas. |
| `BLOCKED_DOMAIN_COOLDOWN_MINUTES` | `scan_settings.py` | `30` | Cooldown duration before a blocked domain can be scanned again. |

---

## 7. Exact Data Stored for a Scan and Retention Policy

The Privacy and Methodology pages can truthfully state the following storage policies:

1. **What is Stored During a Scan**:
   - `scan_id`: A randomly generated unique identifier (`scan_<uuid>`).
   - `root_url`: The normalized URL submitted for scanning.
   - `pages`: List of scanned pages containing URL, page type, HTTP status, AI status, and detected findings.
   - `coverage`: Numerical counts (discovered, analysed, blocked, needs login, AI calls).
   - `grouped_findings`: Deduplicated findings with element fingerprints, quotes, and bounding boxes.
   - `screenshots`: In-memory temporary base64 screenshots used for bounding box rendering and visual cross-checks.

2. **What is NEVER Stored or Transmitted**:
   - API keys, user session tokens, cookies, HTTP authorization headers, or customer secrets.
   - Personal information entered into forms (all form submission is blocked).

3. **Retention & Lifetime**:
   - **Scan Job Data**: Kept exclusively in server memory (`ScanManager._scans`) for the duration of the server process. No persistent database writes occur unless explicitly exported.
   - **AI Response Cache**: Cached locally on disk (`backend/app/ai/cache/`) keyed strictly by `hash(clean_text + prompt_version + model_name)`. The cache contains only public element quotes and detector outputs, with no credentials or user identifiers.

---

## 8. Manual Test Checklist Using Local Demo Sites

To manually test the complete site scanning feature without calling third-party sites:

### Test 1: Polite Multi-Page Scan
1. Start the backend: `python -m uvicorn backend.app.main:app --port 8000`.
2. Start the frontend: `cd frontend && npm run dev`.
3. Open `http://localhost:5173`.
4. Switch to the **"Scan this site"** tab. Verify limits are clearly written: *"Up to 8 pages; AI on at most 5"*. Verify AI toggle is explicitly labelled (`AI analysis: OFF`).
5. Run a scan against a local demo server with multiple pages (`/pricing`, `/cart`, `/checkout`, `/blog`).
6. Observe progress screen: live counts increment, queue shows discovered paths, Cancel button cancels promptly.
7. Observe finished report: Category summary tiles show counts (no scores), grouped findings show *"Seen on N pages"*, and the mandatory **Coverage** panel displays reached vs skipped pages.

### Test 2: Block Detection & Graceful Fallback
1. Configure a local route to return HTTP 403 or HTML containing `"Attention Required! | Cloudflare"`.
2. Run a site scan targeting this route.
3. Verify the page is immediately marked `[⛔ Blocked by site]` with human-readable reason.
4. Verify the page is **never** analysed or reported as clean.
5. Verify the report provides action buttons for **Screenshot Upload** and **Flow Builder**.

### Test 3: Safe-Click Flow Enforcement
1. Trigger a guided flow via `POST /api/flows/guided` targeting a local page with an "Add to Cart" button and a subsequent page with `<input type="password">` or a "Pay Now" button.
2. Verify the engine clicks "Add to cart" but refuses to click "Pay Now" and halts upon detecting the password input with reason `"flow_stopped: encountered authentication or password field"`.

---

## 9. Evaluation Script Execution (Phase 7)

To evaluate multi-page scanning coverage across your own test sites:

```bash
python scripts/eval_site_scan.py --sites http://localhost:8080/shop1 http://localhost:8080/shop2 --output scan_eval_results.json
```

**Reminder**: Only run the evaluation script against mock servers or domains you own or have explicit authorization to scan.

<!-- GOAL_COMPLETE -->
