"""
Unit and Integration Tests for Phases 1, 2, and 3:
- Block Detection and Graceful Failure
- Page Discovery and Ranking
- Scan Engine and Site Model
All tests use mocks / synthetic objects (zero live network or LLM quota).
"""

import pytest
import asyncio
import os
import json
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schema import Scan, ScanPage, GroupedFinding, Coverage, Finding, PageData, ExtractedElement, ExtractedCheckbox, GuidedFlowResult
from backend.app.config.scan_settings import (
    SCAN_USER_AGENT,
    BLOCK_PHRASES,
    BLOCKED_DOMAIN_COOLDOWN_MINUTES,
    MIN_VISIBLE_TEXT_CHARS,
    KEYWORD_SCORES,
)
from backend.app.crawler.block_detector import (
    detect_page_block,
    DomainCooldownTracker,
    domain_cooldown_tracker,
)
from backend.app.crawler.discovery import (
    normalize_url,
    get_registered_domain,
    is_same_registered_domain,
    score_and_classify_url,
    get_path_template,
    DiscoveryEngine,
)
from backend.app.crawler.scan_manager import ScanManager

client = TestClient(app)


# ==============================================================================
# Phase 1: Block Detection & Graceful Failure Tests
# ==============================================================================

def test_block_detection_http_status_codes():
    """Verify HTTP 401, 403, 429, 503 are mapped to the correct page_status."""
    status, reason = detect_page_block(http_status=401)
    assert status == "needs_login"
    assert "401" in reason

    status, reason = detect_page_block(http_status=403)
    assert status == "blocked"
    assert "403" in reason

    status, reason = detect_page_block(http_status=429)
    assert status == "blocked"
    assert "429" in reason

    status, reason = detect_page_block(http_status=503, title="Service Unavailable")
    assert status in ("blocked", "error")

    status, reason = detect_page_block(http_status=404)
    assert status == "invalid_url"


def test_block_detection_challenge_phrases():
    """Verify known bot challenge walls and CAPTCHAs are detected from text."""
    for phrase in ["verify you are human", "Attention Required! | Cloudflare", "access denied", "robot check"]:
        status, reason = detect_page_block(http_status=200, title=f"Security: {phrase}", visible_text="Please solve the captcha.")
        assert status == "blocked"
        assert "challenge" in reason.lower() or "bot" in reason.lower()


def test_block_detection_empty_page():
    """Verify pages with almost zero visible text are flagged as empty."""
    status, reason = detect_page_block(http_status=200, title="", visible_text="Too short")
    assert status == "empty"
    assert "insufficient" in reason.lower()


def test_domain_cooldown_tracker():
    """Verify a blocked domain enters cooldown and avoids repeated queries."""
    tracker = DomainCooldownTracker()
    test_domain = "https://blocked-store.example.com/item"

    # Initially not blocked
    is_blocked, _ = tracker.is_domain_blocked(test_domain)
    assert is_blocked is False

    # Record block
    tracker.record_block(test_domain, cooldown_minutes=10)
    is_blocked, remaining = tracker.is_domain_blocked(test_domain)
    assert is_blocked is True
    assert remaining > 0

    # Subdomains on same host share cooldown
    is_blocked_sub, _ = tracker.is_domain_blocked("blocked-store.example.com")
    assert is_blocked_sub is True

    tracker.clear()
    is_blocked_after_clear, _ = tracker.is_domain_blocked(test_domain)
    assert is_blocked_after_clear is False


@pytest.mark.asyncio
async def test_blocked_page_never_scored_as_clean_in_analyze_endpoint():
    """Verify that a blocked or failed page returned from extractor is never scored as clean."""
    blocked_page = PageData(
        url="https://bot-blocked-site.com",
        title="Attention Required!",
        visible_text="Please verify you are a human.",
        page_status="blocked",
        status_reason="Bot protection challenge page detected: 'verify you are human'"
    )

    with patch("backend.app.main.validate_url_safety", return_value=(True, "Safe")):
        with patch("backend.app.main.PageExtractor.extract_from_url_or_html", new_callable=AsyncMock) as mock_extract:
            mock_extract.return_value = blocked_page

            response = client.post("/api/analyze", json={"url": "https://bot-blocked-site.com", "include_ai": False})
            assert response.status_code == 200
            data = response.json()

            assert data["page_status"] == "blocked"
            assert len(data["findings"]) == 0
            assert data["summary_by_category"] == {"consent": 0, "hidden_charges": 0, "cancellation": 0}
            assert "couldn't access" in data["disclaimer"].lower() or "barrier" in data["status_reason"].lower()


# ==============================================================================
# Phase 2: Page Discovery & Ranking Tests
# ==============================================================================

def test_url_normalization():
    """Verify fragment and tracking parameters removal and host lowercasing."""
    raw = "HTTPS://Shop.Example.COM/Pricing/?utm_source=google&utm_medium=cpc&fbclid=123#plans"
    norm = normalize_url(raw)
    assert norm == "https://shop.example.com/pricing"

    # Trailing slash collapse
    norm_slash = normalize_url("https://example.com/cart/")
    assert norm_slash == "https://example.com/cart"

    # Relative resolution
    norm_rel = normalize_url("/checkout/step-1", base_url="https://example.com")
    assert norm_rel == "https://example.com/checkout/step-1"


def test_registered_domain_check():
    """Verify registered domain extraction and allowed subdomains."""
    root = "https://example.com"
    assert is_same_registered_domain(root, "https://shop.example.com/item") is True
    assert is_same_registered_domain(root, "https://checkout.example.com/pay") is True
    assert is_same_registered_domain(root, "https://malicious-example.com/item") is False
    assert is_same_registered_domain(root, "https://otherdomain.org") is False


def test_keyword_scoring_and_classification():
    """Verify path and anchor keywords yield accurate score and page_type."""
    score, p_type, ev = score_and_classify_url("https://example.com/pricing-plans", "View Plans")
    assert score >= 25.0
    assert p_type == "pricing"

    score, p_type, ev = score_and_classify_url("https://example.com/account/cancel-subscription", "Cancel Plan")
    assert score >= 30.0
    assert p_type == "cancel"

    score, p_type, ev = score_and_classify_url("https://example.com/cart/review", "Shopping Cart")
    assert score >= 20.0
    assert p_type == "cart"

    score, p_type, ev = score_and_classify_url("https://example.com/blog/2026/how-to-save", "Blog Post")
    assert score <= -15.0
    assert p_type == "other"


def test_path_template_collapsing():
    """Verify near-duplicate templates (e.g. numeric IDs) collapse to one pattern."""
    t1 = get_path_template("/products/12345")
    t2 = get_path_template("/products/98765")
    assert t1 == t2
    assert t1 == "/products/<id>"

    uuid_path = get_path_template("/orders/4f81c9e2-b07a-4293-8b71-294784918294/summary")
    assert "<uuid>" in uuid_path


def test_discovery_and_ranking_decisions():
    """Verify candidate ranking assigns correct decisions and caps."""
    landing_links = [
        {"href": "/pricing", "text": "Pricing Plans"},
        {"href": "/checkout", "text": "Proceed to Checkout"},
        {"href": "/cart", "text": "View Cart"},
        {"href": "/account/cancel", "text": "Cancel Subscription"},
        {"href": "/products/101", "text": "Product 101"},
        {"href": "/products/102", "text": "Product 102"},  # Should be collapsed as duplicate
        {"href": "/blog/post-1", "text": "Our Story"},      # Should be skipped low priority
    ]

    mock_rp = MagicMock()
    mock_rp.can_fetch.return_value = True

    with patch("backend.app.crawler.discovery.DiscoveryEngine.fetch_robots_txt", return_value=(mock_rp, [])):
        pages = DiscoveryEngine.discover_and_rank(
            root_url="https://example.com",
            landing_links=landing_links,
            max_pages_analysed=4
        )

        assert len(pages) > 0
        root_p = pages[0]
        assert root_p.url == "https://example.com"
        assert root_p.decision == "will_analyse"

        # Check duplicate collapsing
        dup_pages = [p for p in pages if p.decision == "skipped_duplicate"]
        assert len(dup_pages) >= 1

        # Check low priority skipping
        low_pages = [p for p in pages if p.decision == "skipped_low_priority"]
        assert len(low_pages) >= 1

        # Check analysed cap
        analysed = [p for p in pages if p.decision == "will_analyse"]
        assert len(analysed) <= 4


# ==============================================================================
# Phase 3: Scan Engine and Site Model Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_scan_lifecycle_and_background_execution():
    """Verify queued scan lifecycle, coverage computation, and grouped findings."""
    manager = ScanManager()
    scan = manager.create_scan("https://test-site.example.com", include_ai=False, max_pages=3)
    assert scan.status == "queued"

    dummy_page = PageData(
        url="https://test-site.example.com",
        title="Test Shop",
        visible_text="Base price $10. Plus $2.99 mandatory processing fee.",
        prices=[
            ExtractedElement(
                tag="p",
                text="Plus $2.99 mandatory processing fee",
                element_id="el_fee_1",
                font_size_px=10.0,
                color="#000000",
                background_color="#ffffff",
                contrast_ratio=21.0,
                id="fee_1",
                classes=[],
                bbox=[10.0, 20.0, 100.0, 20.0]
            )
        ],
        links=[
            ExtractedElement(
                tag="a",
                text="Pricing",
                href="/pricing",
                element_id="el_link_1",
                font_size_px=14.0,
                color="#000000",
                background_color="#ffffff",
                contrast_ratio=21.0,
                id="link_1",
                classes=[],
                bbox=[10.0, 50.0, 100.0, 20.0]
            )
        ]
    )

    with patch("backend.app.crawler.scan_manager.PageExtractor.extract_from_url_or_html", new_callable=AsyncMock) as mock_ext:
        mock_ext.return_value = dummy_page

        mock_rp = MagicMock()
        mock_rp.can_fetch.return_value = True
        with patch("backend.app.crawler.discovery.DiscoveryEngine.fetch_robots_txt", return_value=(mock_rp, [])):
            await manager._run_scan_job(scan.scan_id)

    updated_scan = manager.get_scan(scan.scan_id)
    assert updated_scan is not None
    assert updated_scan.status in ("completed", "running")
    assert updated_scan.coverage.pages_analysed >= 1
    assert isinstance(updated_scan.grouped_findings, list)


def test_scan_api_endpoints():
    """Verify POST /api/scans, GET /api/scans/{id}, and POST /api/scans/{id}/cancel."""
    with patch("backend.app.main.validate_url_safety", return_value=(True, "Safe")):
        with patch("backend.app.main.scan_manager.start_scan_background", new_callable=AsyncMock):
            # 1. Create Scan
            res_create = client.post("/api/scans", json={"root_url": "https://api-test-shop.com", "include_ai": False})
            assert res_create.status_code == 201
            scan_data = res_create.json()
            scan_id = scan_data["scan_id"]
            assert scan_data["status"] in ("queued", "running")

            # 2. Get Scan
            res_get = client.get(f"/api/scans/{scan_id}")
            assert res_get.status_code == 200
            assert res_get.json()["scan_id"] == scan_id

            # 3. Cancel Scan
            res_cancel = client.post(f"/api/scans/{scan_id}/cancel")
            assert res_cancel.status_code == 200
            assert res_cancel.json()["status"] == "cancelled"

            # 4. Not found scan
            res_404 = client.get("/api/scans/scan_nonexistent")
            assert res_404.status_code == 404


# ==============================================================================
# Phase 4: Guided Safe Flow Capture Tests
# ==============================================================================

def test_safe_click_rules_forbids_dangerous_actions():
    """Verify Hard Rule 3: strictly forbids clicking elements with buying/paying/cancelling text."""
    from backend.app.crawler.guided_flow import is_click_forbidden

    # Dangerous / destructive texts must be forbidden
    forbidden_samples = [
        "Pay now",
        "Pay $49.99",
        "Buy Now",
        "Place Order",
        "Complete Purchase",
        "Confirm Purchase and Pay",
        "Submit Order",
        "Confirm Payment",
        "Order now",
        "Delete Account",
        "Cancel Subscription",
    ]
    for sample in forbidden_samples:
        is_bad, reason = is_click_forbidden(sample)
        assert is_bad is True, f"Expected '{sample}' to be forbidden"
        assert "Hard Rule 3" in reason or "forbidden" in reason.lower()

    # Safe cart/plan actions must be allowed
    safe_samples = [
        "Add to cart",
        "Add to bag",
        "Choose plan",
        "Select plan",
        "View cart",
        "Proceed to checkout",
        "Review order",
    ]
    for sample in safe_samples:
        is_bad, _ = is_click_forbidden(sample)
        assert is_bad is False, f"Expected '{sample}' to be allowed"


@pytest.mark.asyncio
async def test_guided_flow_abort_on_payment_and_login_barriers():
    """Verify that GuidedFlowCapturer immediately aborts if payment or login appears."""
    from backend.app.crawler.guided_flow import GuidedFlowCapturer

    # Mock page with password field
    mock_page = AsyncMock()
    mock_page.url = "https://example.com/checkout/login"
    mock_page.query_selector = AsyncMock(side_effect=lambda sel: True if "password" in sel else None)

    page_data = PageData(url="https://example.com/checkout/login", page_status="ok")
    stop_reason = await GuidedFlowCapturer._check_abort_conditions(mock_page, page_data)
    assert stop_reason is not None
    assert "authentication or password" in stop_reason

    # Mock page with credit card input
    mock_page.query_selector = AsyncMock(side_effect=lambda sel: True if "cc-" in sel or "card" in sel else None)
    stop_reason = await GuidedFlowCapturer._check_abort_conditions(mock_page, page_data)
    assert stop_reason is not None
    assert "payment or credit card" in stop_reason


def test_guided_flow_api_endpoints():
    """Verify POST /api/flows/guided and GET /api/flows/guided/{id} endpoints."""
    mock_flow_result = GuidedFlowResult(
        flow_id="flow_test123",
        root_url="https://test-shop.com/item",
        status="completed",
        flow_stopped_reason="flow_stopped: reached checkout review screen (payment halted by safety rule)",
        steps=[],
        findings=[]
    )

    with patch("backend.app.main.validate_url_safety", return_value=(True, "Safe")):
        with patch("backend.app.crawler.guided_flow.GuidedFlowCapturer.capture_safe_flow", new_callable=AsyncMock) as mock_capture:
            mock_capture.return_value = mock_flow_result

            # Create guided flow
            res = client.post("/api/flows/guided", json={"start_url": "https://test-shop.com/item"})
            assert res.status_code == 201
            data = res.json()
            assert data["flow_id"] == "flow_test123"
            assert "payment halted" in data["flow_stopped_reason"]

            # Query guided flow
            res_get = client.get("/api/flows/guided/flow_test123")
            assert res_get.status_code == 200
            assert res_get.json()["flow_id"] == "flow_test123"


# ==============================================================================
# Phase 6: URL Safety, Budgeting, & Element Deduplication Tests
# ==============================================================================

def test_url_safety_ssrf_rejections():
    """Verify SSRF validation strictly rejects private, loopback, file://, and link-local targets."""
    from backend.app.security import validate_url_safety

    dangerous_urls = [
        "http://127.0.0.1:8000/admin",
        "http://localhost:3000",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/internal",
        "http://192.168.1.1/router",
        "file:///etc/passwd",
        "javascript:alert(1)",
    ]
    for bad_url in dangerous_urls:
        is_safe, reason = validate_url_safety(bad_url)
        assert is_safe is False
        assert any(term in reason.lower() for term in ["private", "local", "internal", "restricted", "scheme", "ssrf"])


@pytest.mark.asyncio
async def test_site_wide_element_deduplication():
    """Verify repeated elements (e.g. cookie consent banner) are consolidated once across pages."""
    manager = ScanManager()
    scan = manager.create_scan("https://dedup-shop.example.com", include_ai=False, max_pages=2)

    # Both page 1 and page 2 share the same pre-ticked cookie banner
    cookie_cb = ExtractedCheckbox(
        element_id="el_cookie_cb",
        id="cookie_consent_input",
        name="marketing_opt_in",
        checked=True,
        disabled=False,
        label="Accept all marketing tracking and partner cookies"
    )

    page1 = PageData(
        url="https://dedup-shop.example.com",
        title="Landing",
        checkboxes=[cookie_cb],
        links=[ExtractedElement(tag="a", text="Pricing", href="/pricing", element_id="el_link")]
    )
    page2 = PageData(
        url="https://dedup-shop.example.com/pricing",
        title="Pricing",
        checkboxes=[cookie_cb],
        prices=[ExtractedElement(tag="span", text="$20/mo", element_id="el_price")]
    )

    call_count = 0
    async def mock_extract(url=None, **kwargs):
        nonlocal call_count
        call_count += 1
        return page1 if "pricing" not in (url or "") else page2

    with patch("backend.app.crawler.discovery.validate_url_safety", return_value=(True, "Safe")):
        with patch("backend.app.crawler.scan_manager.PageExtractor.extract_from_url_or_html", side_effect=mock_extract):
            mock_rp = MagicMock()
            mock_rp.can_fetch.return_value = True
            with patch("backend.app.crawler.discovery.DiscoveryEngine.fetch_robots_txt", return_value=(mock_rp, [])):
                await manager._run_scan_job(scan.scan_id)

    updated = manager.get_scan(scan.scan_id)
    assert updated is not None
    assert updated.status == "completed"

    # Verify grouped findings only has ONE finding for the cookie banner, listing both pages
    cookie_findings = [f for f in updated.grouped_findings if f.type == "preticked_consent"]
    assert len(cookie_findings) == 1
    assert len(cookie_findings[0].pages) == 2


@pytest.mark.asyncio
async def test_ai_budget_enforcement():
    """Verify AI runs only on top N ranked pages and sets ai_skipped_budget on remainder."""
    manager = ScanManager()
    scan = manager.create_scan(
        "https://ai-budget-shop.com",
        include_ai=True,
        max_pages=3,
        max_ai_pages=1  # Cap AI calls to 1 page
    )

    dummy_page = PageData(
        url="https://ai-budget-shop.com",
        title="Budget Shop",
        visible_text="Product text with enough length to be valid and not considered empty.",
        links=[
            ExtractedElement(tag="a", text="Cart", href="/cart", element_id="el_1"),
            ExtractedElement(tag="a", text="Checkout", href="/checkout", element_id="el_2"),
        ]
    )

    manager.ai_text_detector.detect = AsyncMock(return_value=([], "ran", "AI text ran"))
    with patch("backend.app.crawler.discovery.validate_url_safety", return_value=(True, "Safe")):
        with patch("backend.app.crawler.scan_manager.PageExtractor.extract_from_url_or_html", new_callable=AsyncMock) as mock_ext:
            mock_ext.return_value = dummy_page

            mock_rp = MagicMock()
            mock_rp.can_fetch.return_value = True
            with patch("backend.app.crawler.discovery.DiscoveryEngine.fetch_robots_txt", return_value=(mock_rp, [])):
                await manager._run_scan_job(scan.scan_id)

    updated = manager.get_scan(scan.scan_id)
    assert updated is not None
    # Top page ran AI, subsequent pages received ai_skipped_budget
    ai_statuses = [p.ai_status for p in updated.pages if p.decision == "will_analyse"]
    assert "ran" in ai_statuses
    assert "ai_skipped_budget" in ai_statuses
    assert updated.coverage.pages_ai_analysed == 1


# ==============================================================================
# Phase 7: Evaluation Script Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_evaluation_script_execution(tmp_path):
    """Verify eval_site_scan.py runs and writes structured coverage statistics."""
    from scripts.eval_site_scan import evaluate_site_scans

    out_file = str(tmp_path / "test_eval_results.json")
    dummy_scan = Scan(
        scan_id="scan_eval_test",
        root_url="http://127.0.0.1:8000/sample",
        status="completed",
        created_at="2026-10-17T00:00:00Z",
        coverage=Coverage(
            pages_discovered=5,
            pages_analysed=3,
            pages_blocked=1,
            pages_needs_login=0,
            pages_ai_analysed=0,
            key_page_types_found=["pricing", "cart"],
            key_page_types_reached=["pricing"]
        )
    )

    with patch("scripts.eval_site_scan.ScanManager.create_scan", return_value=dummy_scan):
        with patch("scripts.eval_site_scan.ScanManager._run_scan_job", new_callable=AsyncMock):
            with patch("scripts.eval_site_scan.ScanManager.get_scan", return_value=dummy_scan):
                summary = await evaluate_site_scans(
                    target_sites=["http://127.0.0.1:8000/sample"],
                    output_file=out_file,
                    include_ai=False,
                    max_pages=3
                )

                assert summary["total_sites_evaluated"] == 1
                assert summary["aggregate_metrics"]["total_pages_discovered"] == 5
                assert summary["aggregate_metrics"]["total_pages_analysed"] == 3
                assert os.path.exists(out_file)

                with open(out_file, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    assert saved["total_sites_evaluated"] == 1

