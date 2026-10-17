"""
Multi-Page Scan Engine Settings and Configuration for ClearClick AI.
All limits, block detection phrases, politeness delays, crawler caps,
and scoring keywords are strictly centralized here.
No magic numbers or fixture-specific strings in crawler logic.
"""

from typing import List, Dict, Tuple, Set

# Identification (Hard Rule 1 & 2: Honest identifying User-Agent, no stealth overrides)
SCAN_USER_AGENT: str = (
    "ClearClickAI-Auditor/1.0 (+https://clearclickai.com/bot; research transparency scanner)"
)

# Politeness and Concurrency (Hard Rule 2)
REQUEST_DELAY_SECONDS: float = 1.0       # Polite per-domain inter-request delay
PER_DOMAIN_CONCURRENCY: int = 1          # Concurrency strictly 1 per domain

# Crawler Caps & Limits
MAX_PAGES_DISCOVERED: int = 50          # Max URLs gathered from sitemaps + navigation links
MAX_DEPTH: int = 2                       # Max crawl depth starting from root URL (0 = root)
MAX_PAGES_ANALYSED: int = 8              # Max pages passed to full detector analysis
MAX_AI_PAGES: int = 5                    # Max top-ranked pages eligible for AI analysis
MAX_PAGE_BYTES: int = 2 * 1024 * 1024    # 2 MB response size limit

# Timeouts
PER_PAGE_TIMEOUT: float = 20.0           # Seconds per individual page fetch & extraction
PER_SITE_TIMEOUT: float = 120.0          # Max total seconds allowed for an entire domain scan
PER_SCAN_TIMEOUT: float = 180.0          # Absolute deadline for the background scan job

# Bot Block Detection & Access Barriers
BLOCK_PHRASES: List[str] = [
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
    "robot check",
    "bot detection",
    "just a moment...",
    "checking your browser before accessing",
    "ray id:",
    "unusual traffic from your computer network",
    "pardon our interruption",
    "shield square",
    "incapsula incident id",
]

# Domain cooldown duration after encountering bot protection or wall
BLOCKED_DOMAIN_COOLDOWN_MINUTES: float = 30.0

# Minimum visible text characters required for a page to not be considered empty
MIN_VISIBLE_TEXT_CHARS: int = 50

# Allowed subdomains relative to the registered domain (e.g. shop.example.com for example.com)
ALLOWED_SUBDOMAINS: Set[str] = {
    "www",
    "shop",
    "store",
    "app",
    "auth",
    "checkout",
    "billing",
    "cart",
    "pay",
    "secure",
}

# AI Budget per Scan (prevents quota exhaustion on free-tier keys)
SCAN_AI_CALL_BUDGET: int = 6

# Keyword Scoring & Page Type Inference:
# Maps keyword substring in path or anchor text to (score_weight, page_type)
KEYWORD_SCORES: Dict[str, Tuple[float, str]] = {
    # High Priority (+15 to +30): Dark patterns cluster heavily here
    "pricing": (30.0, "pricing"),
    "plans": (25.0, "pricing"),
    "price": (20.0, "pricing"),
    "rates": (20.0, "pricing"),
    "checkout": (30.0, "checkout"),
    "pay": (25.0, "checkout"),
    "payment": (25.0, "checkout"),
    "cart": (25.0, "cart"),
    "basket": (20.0, "cart"),
    "bag": (15.0, "cart"),
    "signup": (25.0, "signup"),
    "register": (20.0, "signup"),
    "join": (15.0, "signup"),
    "subscribe": (25.0, "signup"),
    "subscription": (25.0, "signup"),
    "membership": (20.0, "signup"),
    "billing": (25.0, "pricing"),
    "account": (20.0, "account"),
    "profile": (15.0, "account"),
    "cancel": (30.0, "cancel"),
    "cancellation": (30.0, "cancel"),
    "unsubscribe": (25.0, "cancel"),
    "delete-account": (25.0, "cancel"),
    "opt-out": (20.0, "consent"),
    "cookie": (15.0, "consent"),
    "cookies": (15.0, "consent"),
    "privacy": (15.0, "consent"),
    "consent": (15.0, "consent"),

    # Low Priority (-10 to -30): Informational / non-transactional pages
    "blog": (-20.0, "other"),
    "news": (-20.0, "other"),
    "press": (-20.0, "other"),
    "media": (-15.0, "other"),
    "careers": (-25.0, "other"),
    "jobs": (-25.0, "other"),
    "about": (-15.0, "other"),
    "team": (-15.0, "other"),
    "contact": (-10.0, "other"),
    "help": (-15.0, "other"),
    "faq": (-10.0, "other"),
    "support": (-10.0, "other"),
    "article": (-20.0, "other"),
    "posts": (-20.0, "other"),
    "tag": (-20.0, "other"),
    "category": (-10.0, "other"),
    "author": (-25.0, "other"),
    "terms": (-5.0, "other"),
    "tos": (-5.0, "other"),
}
