# SCAN_AUDIT.md: Multi-Page Site Scanner Architecture & Audit
**ClearClick AI — Phase 0 Read-Only Audit**
**Date:** October 17, 2026
**Scope:** Investigation of existing single-page extraction, block handling, URL security, caching, job execution, and frontend display to guide the multi-page scanning architecture.

---

## 1. Audit Findings

### a. How the Extractor Loads a Page Today
* **Files:**
  - [`backend/app/extract/playwright_extractor.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/extract/playwright_extractor.py)
  - [`backend/app/main.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/main.py#L167-L172)
* **Primary Loading Mechanism (`PageExtractor.extract_from_url_or_html`, lines 265–394):**
  - **Browser Launch & Arguments (lines 278–291):** Launches Playwright Chromium headless with flags: `--disable-blink-features=AutomationControlled`, `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-infobars`, `--ignore-certificate-errors`.
  - **Viewport (lines 268–269, 295):** Configurable `viewport_width` (default 1280px) and `viewport_height` (default 800px).
  - **Device Scale Factor (line 296):** Locked to `1.0` to preserve CSS pixel-to-coordinate mapping.
  - **User Agent & Headers (lines 297–312):** Currently uses a hardcoded desktop Chrome user agent (`"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"`) and simulated `Sec-Ch-Ua` headers.
  - **Stealth Initialization Script (lines 314–331):** Injects a browser init script modifying `navigator.webdriver`, `navigator.languages`, `navigator.plugins`, and `window.chrome`.
    > *Audit Note against Hard Rule 1 & 2:* This stealth spoofing explicitly violates Hard Rule 1 ("DO NOT circumvent bot protection. No stealth plugins, fingerprint spoofing..."). Must be removed and replaced with an honest, identifying User-Agent from config without stealth overrides.
  - **Navigation & Timeouts (lines 335–346):**
    - For HTTP/HTTPS URLs: Calls `await page.goto(url, wait_until="domcontentloaded", timeout=25000)`. Enforces a 25-second navigation timeout.
    - For local file paths (`os.path.exists(url)`, lines 340–342): Calls `await page.goto(f"file:///{abs_path.replace(os.sep, '/')}", wait_until="domcontentloaded")` with no explicit timeout (relies on Playwright's 30s default).
    - For raw HTML (`html_content`, line 344): Calls `await page.set_content(html_content, wait_until="domcontentloaded")` with no explicit timeout.
  - **Dynamic Content Waits (lines 349, 396–412):** Calls `_wait_for_dynamic_content()`, polling `COMMON_BANNER_SELECTORS` (OneTrust, Cookiebot, cookie dialogs) with `is_visible(timeout=300)`, then waits for `networkidle` with a 1200ms timeout or falls back to a 350ms stabilization delay (`page.wait_for_timeout(350)`).
  - **Child Frame / IFrame Extraction (lines 352, 414–435):** Iterates over child frames (`page.frames[1:]`) and evaluates `EXTRACTION_JS` inside each accessible frame, merging text and interactive elements into the main page collection.
  - **Screenshot Capture (lines 370–371):** `await page.screenshot(type="jpeg", quality=65, full_page=False)`.
* **Fallback Loading Mechanism (`PageExtractor._fallback_soup_extract`, lines 445–589):**
  - Used when Playwright throws an exception (line 391) or in serverless environments.
  - If `url` is HTTP/HTTPS, fetches via `urllib.request.urlopen(req, timeout=15)` (line 463) with a 15-second network timeout.
  - **User Agent in Fallback (lines 454–458):** Hardcodes desktop Chrome spoofing: `"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"` (also violates Hard Rules 1 and 2).
* **Failure Reporting:**
  - Navigation partial timeout in `goto()` logs a warning at line 339 (`logger.warning(...)`) but does not abort; execution continues into DOM evaluation and screenshot capture.
  - Launch or catastrophic evaluation exceptions are caught at line 391 (`except Exception as e:`) and silently fall back to `_fallback_soup_extract()`.
  - In `_fallback_soup_extract()`, if `urllib.request.urlopen` fails (e.g. HTTPError 403, 404, 500, or URLError timeout), it logs a warning at line 466 and parses `""` with `BeautifulSoup(html or "", "html.parser")`, returning an empty `PageData` object.
  - In [`backend/app/main.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/main.py#L167-L178): Comment claims `# 1. Extraction with Playwright (20s timeout enforced)`, but no timeout is wrapped or enforced in `main.py`. Furthermore, `main.py` never checks whether `page_data` is empty or failed; it passes empty `page_data` directly to rule detectors and AI detectors, which find 0 misleading patterns and return HTTP 200 with 0 findings. **Catastrophic failures and blocks are silently presented as clean pages.**

---

### b. How Blocks are Currently Handled (403/429, CAPTCHA, Empty Pages)
* **Status:** **Not implemented in the Python FastAPI backend.**
* **Details:**
  - **HTTP Status Codes:** In `playwright_extractor.py`, `page.goto()` returns an HTTP `Response` object, but this return value is discarded. HTTP 403 (Forbidden), 429 (Too Many Requests), or 503 (Service Unavailable) with an HTML body are treated as successfully rendered pages.
  - In `_fallback_soup_extract()`, HTTP 403/429/503 throws `urllib.error.HTTPError`, which is caught by `except Exception as fetch_e:` (line 465), logging a warning and falling through to an empty `PageData` object.
  - **Vercel Serverless Divergence:** In the Vercel TypeScript endpoints ([`api/analyze.ts`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/api/analyze.ts#L101-L106) and [`frontend/api/analyze.ts`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/api/analyze.ts#L101-L106)), commit `87e0227` added a check for HTTP 403 returning HTTP 502 with an anti-bot notice ("The target website is protected by an anti-bot firewall..."). However, this was **never ported or implemented in the Python FastAPI backend**.
  - **Challenge / CAPTCHA Pages:** Known bot walls (Cloudflare Turnstile, PerimeterX/HUMAN, Datadome, AWS WAF, reCAPTCHA/hCaptcha) and challenge phrases ("Verify you are human", "Attention Required! | Cloudflare", "Access Denied") are completely undetected in both extractors.
  - **Empty Pages:** A page returning minimal or zero visible text (<50 characters) is parsed as a valid empty page with 0 elements.
  - **Consequence:** Rule and AI detectors run on the challenge/empty page, find 0 misleading patterns, and falsely report the site as "clean" with 0 findings.
  - **Cooldown:** No domain cooldown mechanism exists anywhere; a blocked domain can be retried continuously without delay or backoff.

---

### c. Where URL Validation & Private-Address Checks Live, and Redirect Re-validation
* **Location:**
  - Defined in [`backend/app/security.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/security.py) in `validate_url_safety(url: str)` (lines 52–103).
  - Validates scheme (`http` / `https` only), checks against reserved hostnames (`localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `instance-data`, `metadata.google.internal`, `metadata`, `*.local`, `*.internal`), and resolves DNS via `socket.getaddrinfo()` to block private, loopback, carrier-grade NAT, test nets, multicast, and cloud metadata IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `100.64.0.0/10`, `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`, `255.255.255.255/32`, `::1/128`, `fc00::/7`, `fe80::/10`).
  - Invoked in [`backend/app/main.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/main.py):
    - In `analyze_page` endpoint (lines 157–162) before initiating page extraction.
    - In `analyze_flow_endpoint` (lines 278–282) for each URL in `steps_urls`.
* **Redirect Re-validation:**
  - **Not implemented.**
  - Once the initial URL passes `validate_url_safety()`, Playwright's `page.goto()` follows HTTP 301/302/303/307/308 redirects without intercepting intermediate or target URLs.
  - If a public URL redirects to an internal endpoint (e.g., `http://169.254.169.254` or `http://127.0.0.1:8000`), Playwright follows it without re-validating the target URL against `validate_url_safety()`.
  - In `_fallback_soup_extract()`, `urllib.request.urlopen()` likewise follows HTTP 301/302 redirects automatically without re-validation.
  - In `api/analyze.ts` and `frontend/api/analyze.ts`, `isPrivateIpOrHost()` (lines 15–26) only performs string checks on literal IPv4 octets without DNS resolution (vulnerable to DNS rebinding / hostnames pointing to 127.0.0.1), and `fetch()` follows redirects without re-checking.
  - Discovered links extracted from `<a>` tags on the page are not validated against SSRF rules before following.

---

### d. How Findings, AI Status, and Cache are Keyed Today, and Background Tasks
* **Findings Keying & Deduplication:**
  - Findings are defined in [`backend/app/schema.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/schema.py) (`Finding`, lines 15–58).
  - Deduplicated in `consolidate_findings()` ([`backend/app/main.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/main.py#L334-L403)) using a composite key: `dedup_key = (finding.element_id or finding.evidence[:30], finding.type)`.
  - Merges matching rule and AI findings into a single finding with `source="hybrid"` and boosted confidence `0.95`.
  - Operates strictly on a single page; does not support cross-page grouping or repeated element fingerprinting.
* **AI Status:**
  - Modelled by `AIStatus(str)` in [`backend/app/ai/client.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/ai/client.py#L37-L56) and `AnalysisReport.ai_status` in [`backend/app/schema.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/schema.py#L146-L156).
  - Values: `"ran"`, `"skipped_no_key"`, `"unavailable"`, `"limit_reached"`, `"invalid_response"`, plus legacy aliases (`"completed"`, `"not_run"`, `"failed"`).
  - Multi-page requirement `"ai_skipped_budget"` is **not implemented** in either schema or client.
* **Cache Keying:**
  - Implemented in `DiskCache` ([`backend/app/ai/client.py`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/backend/app/ai/client.py#L57-L91)).
  - Key format: `SHA256(f"{prompt_version}::{model_name}::{content}")`.
  - For text: `content` is `system_prompt\n\nuser_prompt` (lines 245–246).
  - For vision: `content` is `system_prompt\n\nuser_prompt\n\n{sha256(screenshot_base64)}` (lines 292–293).
  - Saved to disk at `.cache/ai/<sha256>.json`.
  - *Note:* This is an LLM inference result cache, not a page fetch or crawler cache.
* **Job / Background Task Mechanism:**
  - **Not implemented.**
  - Analysis runs strictly synchronously within FastAPI request handlers (`analyze_page` and `analyze_flow_endpoint`). There is no queue, no asynchronous worker manager, no scan job ID, no cancel endpoint, and no persistent store for ongoing or completed scans.

---

### e. How the Frontend Currently Shows Results and Errors for a Single Page
* **Files:**
  - [`frontend/src/pages/AnalysePage.tsx`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/src/pages/AnalysePage.tsx)
  - [`frontend/src/components/InputForm.tsx`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/src/components/InputForm.tsx)
  - [`frontend/src/components/ScreenshotViewer.tsx`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/src/components/ScreenshotViewer.tsx)
  - [`frontend/src/components/FindingsPanel.tsx`](file:///C:/Users/bhumi/.gemini/antigravity/scratch/clearclick-ai/frontend/src/components/FindingsPanel.tsx)
* **Results Display:**
  - On receiving `AnalysisReport` from `/api/analyze`, `AnalysePage` hides the input form and renders a split workspace:
    - **Header Strip (lines 238–275):** Displays audit timestamp, finding count (`"N things worth a closer look"` or `"No misleading patterns detected"`), AI status badge (`on` / `off` / `unavailable`), and engine label.
    - **Left Column (60%, lines 280–290):** `ScreenshotViewer` renders a single full-page screenshot with SVG/canvas bounding boxes corresponding to `findings[].bbox`. Clicking a box selects the finding.
    - **Right Column (40%, lines 292–304):** `FindingsPanel` renders category summary chips (consent, hidden charges, cancellation), the AI status banner with explanation, and expandable finding cards detailing severity, evidence quote, explanation ("why"), and safer alternative.
* **Error Display:**
  - Handled in `AnalysePage.tsx` (lines 176–206).
  - When an HTTP error (400 SSRF, 413, 429 rate limit, 500) occurs or fetch fails, `errorMsg` is stored in state and rendered as a dismissible alert box at the top of the page with an `AlertCircle` icon, message text, and a button to open the backend server settings modal.
  - If a blocked page returns 0 findings (current backend behavior), the UI displays "No misleading patterns detected" with a green checkmark, falsely indicating the site is clean.
  - There is no status badge indicating a block, no redirection to screenshot upload or flow builder, and no multi-page progress or coverage panel.

---

### f. What Would Break if One Analysis Produced Several Pages' Results
1. **Schema & Contract:** `AnalysisReport` contains scalar fields for a single page: `url`, `screenshot_base64`, `page_title`, flat `findings: List[Finding]`, and a single `ai_status`. It cannot represent multiple pages, skipped URLs, crawl coverage, or page types.
2. **HTTP Timeouts:** Fetching 8 pages with 20–25s Playwright timeouts sequentially in one synchronous HTTP request would take 120–200+ seconds, causing reverse proxy (Render, Cloudflare, Vercel) gateway timeouts (HTTP 504).
3. **Repeated Findings Pollution:** Site-wide elements (such as cookie consent banners, header bars, and footer links) appearing across 8 pages would be detected on every single page, resulting in 8x duplicated findings unless fingerprinted and grouped across pages.
4. **AI Quota Depletion:** If AI ran unconditionally across all pages, scanning a single site would make 8 to 16 API calls (text + vision), immediately hitting the Gemini free-tier 15 RPM rate limit and depleting daily quotas.
5. **Frontend Breakage:**
   - `ScreenshotViewer` expects one `screenshot_base64` string and cannot render screenshots across multiple pages.
   - `FindingsPanel` has no way to show which page or page type a finding belongs to.
   - There is no progress indicator, live count of discovered/analysed/blocked pages, or scan cancellation control.
   - There is no COVERAGE panel showing what was and was not checked.

---

## 2. Proposed Multi-Page Architecture & Data Models

### A. Data Models (`backend/app/schema.py`)

```python
PageStatus = Literal[
    "ok",
    "blocked",
    "needs_login",
    "empty",
    "timeout",
    "robots_disallowed",
    "invalid_url",
    "error",
]

PageType = Literal[
    "pricing",
    "cart",
    "checkout",
    "signup",
    "account",
    "cancel",
    "consent",
    "other",
]

SkippedReason = Literal[
    "skipped_low_priority",
    "skipped_duplicate",
    "skipped_robots",
    "skipped_cap",
    "skipped_blocked_domain",
]

ScanDecision = Literal[
    "will_analyse",
    "skipped_low_priority",
    "skipped_duplicate",
    "skipped_robots",
    "skipped_cap",
]

ScanAIStatus = Literal[
    "ran",
    "not_run",
    "skipped_no_key",
    "ai_skipped_budget",
    "limit_reached",
    "unavailable",
    "invalid_response",
]

class ScanPage(BaseModel):
    url: str
    page_type: PageType
    page_type_evidence: str = ""
    score: float = 0.0
    decision: ScanDecision = "will_analyse"
    page_status: PageStatus = "ok"
    status_reason: str = ""
    ai_status: ScanAIStatus = "not_run"
    ai_status_message: str = ""
    findings: List[Finding] = []
    skipped_reason: Optional[SkippedReason] = None
    screenshot_base64: Optional[str] = None
    page_title: str = ""
    discovered_from: Optional[str] = None
    depth: int = 0

class GroupedFinding(BaseModel):
    category: CategoryType
    type: str
    severity: SeverityType
    confidence: float
    evidence: str
    why: str
    safer_alternative: str
    source: SourceType
    element_fingerprint: str
    pages: List[str]  # URLs where this finding appears
    page_types: List[str]
    sample_bbox: List[float] = [0.0, 0.0, 0.0, 0.0]

class Coverage(BaseModel):
    pages_discovered: int = 0
    pages_analysed: int = 0
    pages_skipped_by_reason: Dict[str, int] = {}
    pages_blocked: int = 0
    pages_needs_login: int = 0
    pages_ai_analysed: int = 0
    ai_calls_used: int = 0
    key_page_types_found: List[str] = []
    key_page_types_reached: List[str] = []

class Scan(BaseModel):
    scan_id: str
    root_url: str
    status: Literal["queued", "running", "completed", "cancelled", "failed"]
    created_at: str
    completed_at: Optional[str] = None
    config_snapshot: Dict[str, Any]
    pages: List[ScanPage]
    grouped_findings: List[GroupedFinding] = []
    coverage: Coverage
    error_message: Optional[str] = None
```

---

### B. Proposed Configuration Module (`backend/app/config/scan_settings.py`)
Centralizes all settings required by the specification with documented defaults:

```python
# Identification (Hard Rule 1 & 2: Honest User-Agent, no stealth overrides)
USER_AGENT = "ClearClickAI-Auditor/1.0 (+https://clearclickai.com/bot; research transparency scanner)"

# Politeness and Concurrency (Hard Rule 2)
REQUEST_DELAY_SECONDS = 1.0       # Inter-request delay for polite scraping
PER_DOMAIN_CONCURRENCY = 1        # Strict limit: 1 concurrent fetch per domain

# Crawl Caps
MAX_PAGES_DISCOVERED = 50        # Max URLs gathered from sitemaps + navigation
MAX_DEPTH = 2                     # Max crawl depth from root
MAX_PAGES_ANALYSED = 8            # Max pages passed to full detector analysis
MAX_AI_PAGES = 5                  # Max top-ranked pages eligible for AI analysis

# Timeouts
PER_PAGE_TIMEOUT = 20.0           # Seconds per individual page fetch
PER_SITE_TIMEOUT = 120.0          # Total seconds allowed for an entire domain scan
PER_SCAN_TIMEOUT = 180.0          # Absolute deadline for background job
MAX_PAGE_BYTES = 2 * 1024 * 1024  # 2 MB size cap

# Block Detection
BLOCK_PHRASES = [
    "verify you are human",
    "access denied",
    "attention required! | cloudflare",
    "please enable javascript and cookies to continue",
    "security check",
    "challenge-platform",
    "cf-browser-verification",
    "ddos protection by cloudflare",
    "distil captcha",
    "perimeterx",
    "datadome",
    "captcha",
    "robot check",
]
BLOCKED_DOMAIN_COOLDOWN_MINUTES = 30

# Keyword Scoring & Page Type Inference
KEYWORD_SCORES = {
    # High Priority (+10 to +30)
    "pricing": (30, "pricing"),
    "plans": (25, "pricing"),
    "checkout": (30, "checkout"),
    "cart": (25, "cart"),
    "basket": (20, "cart"),
    "signup": (20, "signup"),
    "register": (20, "signup"),
    "subscribe": (25, "signup"),
    "billing": (25, "pricing"),
    "account": (20, "account"),
    "cancel": (30, "cancel"),
    "unsubscribe": (25, "cancel"),
    "delete-account": (25, "cancel"),
    "cookie": (15, "consent"),
    "privacy": (15, "consent"),
    # Low Priority (-10 to -30)
    "blog": (-20, "other"),
    "news": (-20, "other"),
    "press": (-20, "other"),
    "careers": (-25, "other"),
    "jobs": (-25, "other"),
    "help": (-15, "other"),
    "faq": (-10, "other"),
    "article": (-20, "other"),
}

# AI Budget
SCAN_AI_CALL_BUDGET = 6           # Max AI calls allowed per single scan
```

---

### C. Proposed Endpoints
1. `POST /api/scans`
   - Request Body: `{ "root_url": str, "include_ai": bool = True, "max_pages": Optional[int] = None }`
   - Validates root URL with `validate_url_safety()` (SSRF, scheme).
   - Checks domain cooldown against `BLOCKED_DOMAIN_COOLDOWN_MINUTES`.
   - Spawns an asynchronous background task (`asyncio.create_task`).
   - Returns 201 Created with initial `Scan` object (`status: "queued"`).
2. `GET /api/scans/{scan_id}`
   - Returns live `Scan` object with progress counts, completed pages so far, and coverage. Partial results are saved after each page finishes so mid-scan interruption leaves a usable partial report.
3. `POST /api/scans/{scan_id}/cancel`
   - Sets a cancellation event on the active scan task.
   - Flushes coverage computed from pages analysed up to cancellation and marks status as `"cancelled"`.

---

### D. Architectural Safeguards

1. **No Bot Bypassing (Hard Rule 1 & 2):**
   - Strip all stealth scripts (`navigator.webdriver` spoofing, `navigator.plugins`, `window.chrome` mocking) from `playwright_extractor.py`.
   - Remove spoofed Chrome user agent from `_fallback_soup_extract()`.
   - Send honest `USER_AGENT` from config.
   - If HTTP status is 403/429/503 or HTML contains any `BLOCK_PHRASES`, assign `page_status="blocked"` with reason, record domain in cooldown, do not analyse or score clean, and surface screenshot upload / flow-builder alternatives.
2. **Robots.txt & Sitemap Discovery:**
   - Fetch robots.txt using standard `urllib.robotparser.RobotFileParser` before fetching any path. If a path is disallowed, record `page_status="robots_disallowed"`, `decision="skipped_robots"`, and do not fetch.
   - Parse sitemap entries declared in `robots.txt` and check `sitemap.xml` (plus 1 level of sitemap index).
3. **SSRF Redirect Re-validation (Hard Rule 4):**
   - Attach a Playwright route or response listener (`page.on("response", ...)`) to inspect redirect locations (`Location` header).
   - Each redirect target and discovered URL must pass `validate_url_safety()` before navigation.
4. **Site-wide Deduplication:**
   - Fingerprint repeated elements (cookie banners, navbars, footers) via SHA256 of `tag + role + normalized_text[:80] + font_size_px + color`.
   - Cache element detector findings; reuse across pages and group in `GroupedFinding` listing all URLs and page types where detected.
5. **AI Budget Guard:**
   - AI detector runs only on top `min(max_ai_pages, 5)` ranked pages.
   - Enforce `SCAN_AI_CALL_BUDGET`. Once budget is exhausted, remaining pages set `ai_status="ai_skipped_budget"` while deterministic rules continue running on all analysed pages.

---

### E. Sample JSON of a Finished Scan

```json
{
  "scan_id": "scan_4f81c9e2b07a",
  "root_url": "https://example-shop.com",
  "status": "completed",
  "created_at": "2026-10-17T13:30:00Z",
  "completed_at": "2026-10-17T13:31:15Z",
  "config_snapshot": {
    "user_agent": "ClearClickAI-Auditor/1.0 (+https://clearclickai.com/bot; research transparency scanner)",
    "max_pages_discovered": 50,
    "max_depth": 2,
    "max_pages_analysed": 8,
    "max_ai_pages": 5,
    "scan_ai_call_budget": 6
  },
  "pages": [
    {
      "url": "https://example-shop.com/",
      "page_type": "consent",
      "page_type_evidence": "root landing page; cookie banner detected",
      "score": 15.0,
      "decision": "will_analyse",
      "page_status": "ok",
      "status_reason": "Page loaded successfully (200 OK)",
      "ai_status": "ran",
      "ai_status_message": "AI analysis completed via Gemini Flash",
      "findings": [
        {
          "category": "consent",
          "type": "unequal_button_emphasis",
          "severity": "medium",
          "confidence": 0.95,
          "evidence": "Accept All (green prominent) vs Manage Preferences (faint text)",
          "bbox": [100.0, 720.0, 1080.0, 60.0],
          "why": "Acceptance option is visually prominent while rejection or granular choices require extra interaction.",
          "safer_alternative": "Offer 'Reject All' with equal visual weight and contrast.",
          "element_id": "el_cookie_banner_1",
          "source": "hybrid"
        }
      ],
      "skipped_reason": null,
      "page_title": "Example Shop — Official Store",
      "discovered_from": null,
      "depth": 0
    },
    {
      "url": "https://example-shop.com/pricing",
      "page_type": "pricing",
      "page_type_evidence": "keyword 'pricing' in path",
      "score": 30.0,
      "decision": "will_analyse",
      "page_status": "ok",
      "status_reason": "Page loaded successfully (200 OK)",
      "ai_status": "ran",
      "ai_status_message": "AI analysis completed via Gemini Flash",
      "findings": [
        {
          "category": "hidden_charges",
          "type": "microprint_fee",
          "severity": "high",
          "confidence": 0.92,
          "evidence": "Plus $4.99/mo mandatory administration surcharge",
          "bbox": [320.0, 540.0, 240.0, 18.0],
          "why": "Recurring mandatory surcharge is separated from advertised base price in 10px text.",
          "safer_alternative": "Include all mandatory recurring fees directly in the headline price.",
          "element_id": "el_fee_note_2",
          "source": "rule"
        }
      ],
      "skipped_reason": null,
      "page_title": "Membership Plans & Pricing",
      "discovered_from": "https://example-shop.com/",
      "depth": 1
    },
    {
      "url": "https://example-shop.com/cart",
      "page_type": "cart",
      "page_type_evidence": "keyword 'cart' in path",
      "score": 25.0,
      "decision": "will_analyse",
      "page_status": "ok",
      "status_reason": "Page loaded successfully (200 OK)",
      "ai_status": "ran",
      "ai_status_message": "AI analysis completed via Gemini Flash",
      "findings": [],
      "skipped_reason": null,
      "page_title": "Your Shopping Cart",
      "discovered_from": "https://example-shop.com/",
      "depth": 1
    },
    {
      "url": "https://example-shop.com/account/cancel",
      "page_type": "cancel",
      "page_type_evidence": "keyword 'cancel' in path",
      "score": 30.0,
      "decision": "will_analyse",
      "page_status": "needs_login",
      "status_reason": "HTTP 401 or redirected to /login authentication barrier",
      "ai_status": "not_run",
      "ai_status_message": "AI not run on authentication-blocked page",
      "findings": [],
      "skipped_reason": null,
      "page_title": "Sign In to Manage Subscription",
      "discovered_from": "https://example-shop.com/",
      "depth": 1
    },
    {
      "url": "https://example-shop.com/checkout",
      "page_type": "checkout",
      "page_type_evidence": "keyword 'checkout' in path",
      "score": 30.0,
      "decision": "will_analyse",
      "page_status": "blocked",
      "status_reason": "Bot protection challenge page detected (HTTP 403 / Cloudflare Turnstile)",
      "ai_status": "not_run",
      "ai_status_message": "AI not run on blocked page",
      "findings": [],
      "skipped_reason": null,
      "page_title": "Attention Required! | Cloudflare",
      "discovered_from": "https://example-shop.com/cart",
      "depth": 2
    },
    {
      "url": "https://example-shop.com/admin/disallowed",
      "page_type": "other",
      "page_type_evidence": "sitemap entry",
      "score": 0.0,
      "decision": "skipped_robots",
      "page_status": "robots_disallowed",
      "status_reason": "Path disallowed by robots.txt",
      "ai_status": "not_run",
      "ai_status_message": "AI not run (robots.txt disallowed)",
      "findings": [],
      "skipped_reason": "skipped_robots",
      "page_title": "",
      "discovered_from": "https://example-shop.com/robots.txt",
      "depth": 1
    },
    {
      "url": "https://example-shop.com/blog/article-102",
      "page_type": "other",
      "page_type_evidence": "keyword 'blog' in path",
      "score": -20.0,
      "decision": "skipped_low_priority",
      "page_status": "empty",
      "status_reason": "Skipped due to low priority score",
      "ai_status": "not_run",
      "ai_status_message": "AI not run (skipped low priority)",
      "findings": [],
      "skipped_reason": "skipped_low_priority",
      "page_title": "",
      "discovered_from": "https://example-shop.com/",
      "depth": 1
    }
  ],
  "grouped_findings": [
    {
      "category": "consent",
      "type": "unequal_button_emphasis",
      "severity": "medium",
      "confidence": 0.95,
      "evidence": "Accept All (green prominent) vs Manage Preferences (faint text)",
      "why": "Acceptance option is visually prominent while rejection or granular choices require extra interaction.",
      "safer_alternative": "Offer 'Reject All' with equal visual weight and contrast.",
      "source": "hybrid",
      "element_fingerprint": "fp_cookie_banner_ab71d",
      "pages": [
        "https://example-shop.com/",
        "https://example-shop.com/pricing",
        "https://example-shop.com/cart"
      ],
      "page_types": [
        "consent",
        "pricing",
        "cart"
      ],
      "sample_bbox": [100.0, 720.0, 1080.0, 60.0]
    },
    {
      "category": "hidden_charges",
      "type": "microprint_fee",
      "severity": "high",
      "confidence": 0.92,
      "evidence": "Plus $4.99/mo mandatory administration surcharge",
      "why": "Recurring mandatory surcharge is separated from advertised base price in 10px text.",
      "safer_alternative": "Include all mandatory recurring fees directly in the headline price.",
      "source": "rule",
      "element_fingerprint": "fp_fee_pricing_938ec",
      "pages": [
        "https://example-shop.com/pricing"
      ],
      "page_types": [
        "pricing"
      ],
      "sample_bbox": [320.0, 540.0, 240.0, 18.0]
    }
  ],
  "coverage": {
    "pages_discovered": 18,
    "pages_analysed": 3,
    "pages_skipped_by_reason": {
      "skipped_low_priority": 11,
      "skipped_duplicate": 2,
      "skipped_robots": 1,
      "skipped_cap": 0
    },
    "pages_blocked": 1,
    "pages_needs_login": 1,
    "pages_ai_analysed": 3,
    "ai_calls_used": 3,
    "key_page_types_found": [
      "pricing",
      "cart",
      "checkout",
      "cancel",
      "consent"
    ],
    "key_page_types_reached": [
      "pricing",
      "cart",
      "consent"
    ]
  },
  "error_message": null
}
```

---
**Status:** Phase 0 audit complete. Per Hard Rule 7, stopping here for user review and approval before beginning Phase 1 code changes.
