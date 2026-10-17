"""
Block Detection and Domain Cooldown Module for ClearClick AI.
Implements detection of anti-bot challenge walls, CAPTCHAs, HTTP access denials,
empty page detection, and polite per-domain cooldowns.
"""

import time
import re
import logging
from typing import Tuple, Optional, Dict
from urllib.parse import urlparse

from ..config.scan_settings import (
    BLOCK_PHRASES,
    BLOCKED_DOMAIN_COOLDOWN_MINUTES,
    MIN_VISIBLE_TEXT_CHARS,
)
from ..schema import PageStatus

logger = logging.getLogger("clearclick.crawler.block_detector")


class DomainCooldownTracker:
    """Tracks domain cooldowns when a domain blocks automated access."""

    def __init__(self):
        self._cooldowns: Dict[str, float] = {}

    def _normalize_domain(self, domain_or_url: str) -> str:
        if "://" in domain_or_url:
            parsed = urlparse(domain_or_url)
            host = parsed.hostname or domain_or_url
        else:
            host = domain_or_url
        return host.lower().strip()

    def is_domain_blocked(self, domain_or_url: str) -> Tuple[bool, float]:
        """
        Check if a domain is currently in cooldown.
        Returns: (is_blocked, remaining_seconds)
        """
        domain = self._normalize_domain(domain_or_url)
        expires_at = self._cooldowns.get(domain)
        if not expires_at:
            return False, 0.0

        now = time.time()
        remaining = expires_at - now
        if remaining > 0:
            return True, remaining
        else:
            # Expired, clean up
            del self._cooldowns[domain]
            return False, 0.0

    def record_block(
        self,
        domain_or_url: str,
        cooldown_minutes: float = BLOCKED_DOMAIN_COOLDOWN_MINUTES,
    ) -> None:
        """Put a domain into cooldown to avoid repeated requests to a blocking host."""
        domain = self._normalize_domain(domain_or_url)
        expires_at = time.time() + (cooldown_minutes * 60.0)
        self._cooldowns[domain] = expires_at
        logger.warning(
            f"Domain '{domain}' recorded in cooldown for {cooldown_minutes} minutes."
        )

    def clear(self) -> None:
        """Clear all cooldown records (useful in tests)."""
        self._cooldowns.clear()


# Global tracker instance
domain_cooldown_tracker = DomainCooldownTracker()


def detect_page_block(
    http_status: Optional[int],
    title: str = "",
    visible_text: str = "",
    html_content: str = "",
    has_interactive_elements: bool = False,
) -> Tuple[PageStatus, str]:
    """
    Analyzes HTTP status, page title, visible text, and HTML structure
    to detect bot walls, CAPTCHAs, authentication barriers, or empty pages.

    Returns: (page_status, status_reason)
    """
    # 1. HTTP Status Code Checks
    if http_status == 401:
        return "needs_login", "Authentication barrier (HTTP 401 Unauthorized)"
    if http_status == 403:
        return "blocked", "Access forbidden by server or anti-bot firewall (HTTP 403)"
    if http_status == 429:
        return "blocked", "Rate limited or blocked by server (HTTP 429 Too Many Requests)"
    if http_status == 503:
        # Check if 503 is an anti-bot challenge (e.g. Cloudflare)
        combined_text = f"{title}\n{visible_text}\n{html_content[:2000]}".lower()
        if any(phrase in combined_text for phrase in BLOCK_PHRASES):
            return "blocked", "Anti-bot challenge barrier (HTTP 503 Service Unavailable)"
        return "error", "Server unavailable (HTTP 503)"
    if http_status is not None and http_status >= 400:
        if http_status == 404:
            return "invalid_url", "Page not found (HTTP 404)"
        return "error", f"HTTP error {http_status}"

    # 2. Text and Title Bot Wall Phrases
    text_to_check = f"{title}\n{visible_text}".lower()
    for phrase in BLOCK_PHRASES:
        if phrase in text_to_check:
            return "blocked", f"Bot protection challenge page detected: '{phrase}'"

    # Also inspect HTML comments/markers if visible text is sparse
    if html_content:
        html_lower = html_content[:4000].lower()
        for phrase in ("cf-browser-verification", "challenge-platform", "cf-spinner", "datadome", "perimeterx"):
            if phrase in html_lower:
                return "blocked", f"Bot protection challenge script detected: '{phrase}'"

    # 3. Check for login-redirect or auth barrier
    login_patterns = [
        r"\bsign in to continue\b",
        r"\blogin to your account\b",
        r"\bplease log in\b",
        r"\bauthentication required\b",
    ]
    for pattern in login_patterns:
        if re.search(pattern, text_to_check, re.IGNORECASE):
            return "needs_login", "Page requires user authentication or login"

    # 4. Check for Empty or Near-Empty Content
    # If the page has interactive elements (inputs, buttons, forms), it is not an empty bot wall
    if has_interactive_elements:
        return "ok", "Page loaded successfully"

    if html_content and re.search(r"<(input|button|form|select)\b", html_content, re.IGNORECASE):
        return "ok", "Page loaded successfully"

    stripped_text = visible_text.strip()
    if len(stripped_text) < MIN_VISIBLE_TEXT_CHARS:
        return "empty", f"Page has insufficient visible content ({len(stripped_text)} characters)"

    return "ok", "Page loaded successfully"
