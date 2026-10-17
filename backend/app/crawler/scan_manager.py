"""
Multi-Page Scan Engine and Job Manager for ClearClick AI.
Runs polite, queued multi-page site audits:
- Concurrency 1 per domain with polite inter-request delay
- Background async runner with cancel support and timeouts
- Partial result persistence after each page finishes
- Cross-page element fingerprinting for site-wide UI elements
- Grouped findings across pages
- Per-scan AI budget enforcement with ai_skipped_budget status
"""

import asyncio
import time
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Set, Tuple
from collections import defaultdict
from urllib.parse import urlparse

from ..schema import (
    Scan,
    ScanPage,
    GroupedFinding,
    Coverage,
    Finding,
    PageData,
    ScanAIStatus,
    PageStatus,
)
from ..config.scan_settings import (
    SCAN_USER_AGENT,
    REQUEST_DELAY_SECONDS,
    PER_DOMAIN_CONCURRENCY,
    MAX_PAGES_ANALYSED,
    MAX_AI_PAGES,
    PER_PAGE_TIMEOUT,
    PER_SITE_TIMEOUT,
    PER_SCAN_TIMEOUT,
    SCAN_AI_CALL_BUDGET,
    BLOCKED_DOMAIN_COOLDOWN_MINUTES,
)
from ..config.thresholds import SEVERITY_MAPPING
from ..extract.playwright_extractor import PageExtractor
from ..detectors.consent import ConsentDetector
from ..detectors.hidden_charges import HiddenChargesDetector
from ..detectors.cancellation import CancellationDetector
from ..ai.text_analysis import AITextDetector
from ..ai.vision_analysis import AIVisionDetector
from ..crawler.discovery import DiscoveryEngine, normalize_url
from ..crawler.block_detector import domain_cooldown_tracker, detect_page_block

logger = logging.getLogger("clearclick.crawler.scan_manager")


class ScanManager:
    """Manages active, completed, and queued multi-page site scans."""

    def __init__(self):
        self._scans: Dict[str, Scan] = {}
        self._cancel_events: Dict[str, asyncio.Event] = {}
        self._domain_locks: Dict[str, asyncio.Lock] = {}
        self._domain_last_request: Dict[str, float] = {}

        # Shared detectors
        self.consent_detector = ConsentDetector()
        self.charges_detector = HiddenChargesDetector()
        self.cancel_detector = CancellationDetector()
        self.ai_text_detector = AITextDetector()
        self.ai_vision_detector = AIVisionDetector()

    def _get_domain(self, url: str) -> str:
        parsed = urlparse(url)
        return (parsed.hostname or url).lower().strip()

    def _get_domain_lock(self, domain: str) -> asyncio.Lock:
        if domain not in self._domain_locks:
            self._domain_locks[domain] = asyncio.Lock()
        return self._domain_locks[domain]

    def create_scan(
        self,
        root_url: str,
        include_ai: bool = True,
        max_pages: Optional[int] = None,
        max_ai_pages: Optional[int] = None
    ) -> Scan:
        """Initializes a new Scan record and registers its cancellation event."""
        scan_id = f"scan_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        cfg_snapshot = {
            "user_agent": SCAN_USER_AGENT,
            "request_delay_seconds": REQUEST_DELAY_SECONDS,
            "per_domain_concurrency": PER_DOMAIN_CONCURRENCY,
            "max_pages_analysed": max_pages or MAX_PAGES_ANALYSED,
            "max_ai_pages": max_ai_pages or MAX_AI_PAGES,
            "scan_ai_call_budget": SCAN_AI_CALL_BUDGET,
            "include_ai": include_ai,
        }

        scan = Scan(
            scan_id=scan_id,
            root_url=normalize_url(root_url),
            status="queued",
            created_at=now_iso,
            config_snapshot=cfg_snapshot,
            pages=[],
            grouped_findings=[],
            coverage=Coverage(),
        )

        self._scans[scan_id] = scan
        self._cancel_events[scan_id] = asyncio.Event()
        return scan

    def get_scan(self, scan_id: str) -> Optional[Scan]:
        return self._scans.get(scan_id)

    def cancel_scan(self, scan_id: str) -> Optional[Scan]:
        """Signals cancellation to an active scan."""
        scan = self._scans.get(scan_id)
        if not scan:
            return None

        event = self._cancel_events.get(scan_id)
        if event:
            event.set()

        if scan.status in ("queued", "running"):
            scan.status = "cancelled"
            scan.completed_at = datetime.now(timezone.utc).isoformat()

        return scan

    async def start_scan_background(self, scan_id: str) -> None:
        """Launches background scan task."""
        asyncio.create_task(self._run_scan_job(scan_id))

    async def _polite_domain_wait(self, domain: str) -> None:
        """Enforces polite delay between requests to the same domain."""
        now = time.monotonic()
        last_req = self._domain_last_request.get(domain, 0.0)
        elapsed = now - last_req
        if elapsed < REQUEST_DELAY_SECONDS:
            await asyncio.sleep(REQUEST_DELAY_SECONDS - elapsed)
        self._domain_last_request[domain] = time.monotonic()

    def _compute_coverage(
        self,
        pages: List[ScanPage],
        ai_calls_used: int
    ) -> Coverage:
        """Computes live coverage metrics across candidate and analysed pages."""
        pages_discovered = len(pages)
        pages_analysed = sum(1 for p in pages if p.decision == "will_analyse" and p.page_status == "ok")
        pages_blocked = sum(1 for p in pages if p.page_status == "blocked")
        pages_needs_login = sum(1 for p in pages if p.page_status == "needs_login")
        pages_ai_analysed = sum(1 for p in pages if p.ai_status == "ran")

        skipped_counts: Dict[str, int] = defaultdict(int)
        for p in pages:
            if p.skipped_reason:
                skipped_counts[p.skipped_reason] += 1

        key_categories = {"pricing", "cart", "checkout", "signup", "cancel", "consent"}
        key_found = sorted(list(set(p.page_type for p in pages if p.page_type in key_categories)))
        key_reached = sorted(list(set(
            p.page_type for p in pages
            if p.page_type in key_categories and p.page_status == "ok"
        )))

        return Coverage(
            pages_discovered=pages_discovered,
            pages_analysed=pages_analysed,
            pages_skipped_by_reason=dict(skipped_counts),
            pages_blocked=pages_blocked,
            pages_needs_login=pages_needs_login,
            pages_ai_analysed=pages_ai_analysed,
            ai_calls_used=ai_calls_used,
            key_page_types_found=key_found,
            key_page_types_reached=key_reached,
        )

    def _group_findings(self, pages: List[ScanPage]) -> List[GroupedFinding]:
        """Collates identical findings detected across multiple pages into single grouped entries."""
        groups: Dict[str, Dict[str, Any]] = {}

        for p in pages:
            for f in p.findings:
                # Group key: category + type + evidence quote snippet
                quote_snippet = f.evidence.strip().lower()[:50]
                fp = f"{f.category}::{f.type}::{quote_snippet}"

                if fp not in groups:
                    groups[fp] = {
                        "category": f.category,
                        "type": f.type,
                        "severity": SEVERITY_MAPPING.get(f.type, f.severity),
                        "confidence": f.confidence,
                        "evidence": f.evidence,
                        "why": f.why,
                        "safer_alternative": f.safer_alternative,
                        "source": f.source,
                        "element_fingerprint": f"fp_{abs(hash(fp)) % 1000000:06x}",
                        "pages": set(),
                        "page_types": set(),
                        "sample_bbox": f.bbox,
                    }

                groups[fp]["pages"].add(p.url)
                groups[fp]["page_types"].add(p.page_type)

        result: List[GroupedFinding] = []
        for g in groups.values():
            result.append(GroupedFinding(
                category=g["category"],
                type=g["type"],
                severity=g["severity"],
                confidence=g["confidence"],
                evidence=g["evidence"],
                why=g["why"],
                safer_alternative=g["safer_alternative"],
                source=g["source"],
                element_fingerprint=g["element_fingerprint"],
                pages=sorted(list(g["pages"])),
                page_types=sorted(list(g["page_types"])),
                sample_bbox=g["sample_bbox"],
            ))

        return result

    async def _run_scan_job(self, scan_id: str) -> None:
        """Executes the full scan lifecycle as a queued background job."""
        scan = self._scans.get(scan_id)
        if not scan:
            return

        cancel_event = self._cancel_events.get(scan_id, asyncio.Event())
        scan.status = "running"
        root_url = scan.root_url
        domain = self._get_domain(root_url)
        domain_lock = self._get_domain_lock(domain)

        max_pages = scan.config_snapshot.get("max_pages_analysed", MAX_PAGES_ANALYSED)
        max_ai_pages = scan.config_snapshot.get("max_ai_pages", MAX_AI_PAGES)
        include_ai = scan.config_snapshot.get("include_ai", True)

        ai_calls_used = 0
        element_cache: Dict[str, List[Finding]] = {}  # Site-wide element fingerprint findings

        start_time = time.monotonic()

        try:
            # Check domain cooldown before proceeding
            is_blocked, remaining = domain_cooldown_tracker.is_domain_blocked(domain)
            if is_blocked:
                scan.status = "completed"
                scan.error_message = f"Domain '{domain}' is currently in cooldown ({round(remaining / 60, 1)}m remaining)"
                scan.completed_at = datetime.now(timezone.utc).isoformat()
                return

            # Step 1: Initial Discovery (robots.txt, sitemaps, initial root URL extraction)
            async with domain_lock:
                await self._polite_domain_wait(domain)
                root_page_data = await PageExtractor.extract_from_url_or_html(url=root_url)

            # Discover and score candidate pages
            landing_links = [
                {"href": l.href, "text": l.text} for l in root_page_data.links if l.href
            ]
            discovered_pages = DiscoveryEngine.discover_and_rank(
                root_url=root_url,
                landing_links=landing_links,
                max_pages_analysed=max_pages
            )

            scan.pages = discovered_pages
            scan.coverage = self._compute_coverage(scan.pages, ai_calls_used)

            # Step 2: Sequential Analysis (1 page at a time per domain)
            ai_analysed_count = 0

            for idx, page in enumerate(scan.pages):
                # Check cancellation token
                if cancel_event.is_set():
                    scan.status = "cancelled"
                    break

                # Check scan and site timeouts
                elapsed = time.monotonic() - start_time
                if elapsed > PER_SITE_TIMEOUT or elapsed > PER_SCAN_TIMEOUT:
                    logger.warning(f"Scan {scan_id} timeout limit reached ({elapsed:.1f}s)")
                    break

                if page.decision != "will_analyse":
                    continue

                # Check if domain was blocked mid-scan
                is_blocked, _ = domain_cooldown_tracker.is_domain_blocked(domain)
                if is_blocked:
                    page.decision = "skipped_cap"
                    page.skipped_reason = "skipped_blocked_domain"
                    page.page_status = "blocked"
                    page.status_reason = "Skipped: domain blocked automated crawler"
                    continue

                # Fetch and extract page using PageExtractor with politeness delay and lock
                async with domain_lock:
                    await self._polite_domain_wait(domain)

                    # For root page, reuse root_page_data if available
                    if page.url == root_url and root_page_data:
                        pdata = root_page_data
                    else:
                        pdata = await PageExtractor.extract_from_url_or_html(url=page.url)

                page.page_status = pdata.page_status
                page.status_reason = pdata.status_reason
                page.screenshot_base64 = pdata.screenshot_base64
                page.page_title = pdata.title

                # If page is blocked or failed, do NOT analyse or score as clean
                if pdata.page_status != "ok":
                    page.findings = []
                    page.ai_status = "not_run"
                    page.ai_status_message = f"AI not run on {pdata.page_status} page"
                    scan.coverage = self._compute_coverage(scan.pages, ai_calls_used)
                    continue

                # Run Deterministic Rule Detectors (Zero API calls)
                rule_findings: List[Finding] = []
                rule_findings.extend(self.consent_detector.detect(pdata))
                rule_findings.extend(self.charges_detector.detect(pdata))
                rule_findings.extend(self.cancel_detector.detect(pdata))

                # Site-wide element fingerprint deduplication
                for el in pdata.buttons + pdata.links:
                    fp = f"{el.tag}::{getattr(el, 'role', '')}::{el.text.strip().lower()[:80]}"
                    if fp in element_cache:
                        for cached_f in element_cache[fp]:
                            if cached_f not in rule_findings:
                                rule_findings.append(cached_f)
                    else:
                        element_cache[fp] = [f for f in rule_findings if f.element_id == el.element_id]

                # Run AI Detectors if enabled, eligible, and within budget
                ai_findings: List[Finding] = []
                if include_ai:
                    if ai_analysed_count < max_ai_pages and ai_calls_used < SCAN_AI_CALL_BUDGET:
                        text_findings, text_status, text_msg = await self.ai_text_detector.detect(pdata)
                        if text_status in ("ran", "completed"):
                            ai_calls_used += 1

                        vision_findings: List[Finding] = []
                        has_interactive = bool(pdata.buttons or pdata.links or pdata.prices)
                        if text_status in ("ran", "completed") and pdata.screenshot_base64 and has_interactive and ai_calls_used < SCAN_AI_CALL_BUDGET:
                            vision_findings, v_status, v_msg = await self.ai_vision_detector.detect(pdata)
                            if v_status in ("ran", "completed"):
                                ai_calls_used += 1

                        ai_findings = text_findings + vision_findings
                        page.ai_status = "ran"
                        page.ai_status_message = text_msg
                        ai_analysed_count += 1
                    else:
                        page.ai_status = "ai_skipped_budget"
                        page.ai_status_message = "AI skipped: per-scan call budget ceiling reached"
                else:
                    page.ai_status = "not_run"
                    page.ai_status_message = "AI disabled by user configuration"

                # Consolidate findings for this page
                from ..main import consolidate_findings
                page.findings = consolidate_findings(rule_findings, ai_findings)

                # Update live coverage immediately after this page finishes (partial reports survive)
                scan.coverage = self._compute_coverage(scan.pages, ai_calls_used)

            # Step 3: Compute Grouped Findings Across All Finished Pages
            scan.grouped_findings = self._group_findings(scan.pages)

            if scan.status != "cancelled":
                scan.status = "completed"

        except Exception as e:
            logger.exception(f"Unhandled error during scan {scan_id}: {e}")
            scan.status = "failed"
            scan.error_message = str(e)
        finally:
            scan.completed_at = datetime.now(timezone.utc).isoformat()
            scan.coverage = self._compute_coverage(scan.pages, ai_calls_used)
            # Clean up cancellation event
            if scan_id in self._cancel_events:
                del self._cancel_events[scan_id]


# Global singleton scan manager instance
scan_manager = ScanManager()
