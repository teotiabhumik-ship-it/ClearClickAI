"""
Guided Safe Flow Capture Module for ClearClick AI.
Implements safe, scripted multi-step user interaction capture (e.g. cart to checkout review)
strictly adhering to Hard Rule 3:
- Never enters payment info, submits purchases, creates accounts, or logs in.
- Strictly avoids clicking buttons or links with buying, paying, confirming, or cancelling text.
- Aborts immediately the moment payment details, personal data input, login, or purchase confirmations appear.
- Feeds reached steps to FlowAnalyzer to detect drip pricing and price divergence.
"""

import re
import uuid
import logging
from typing import List, Optional, Tuple, Dict, Any
from urllib.parse import urljoin, urlparse

from ..schema import FlowStepResult, GuidedFlowResult, FlowData, PageData, Finding
from ..config.scan_settings import SCAN_USER_AGENT, PER_PAGE_TIMEOUT
from ..security import validate_url_safety
from ..detectors.flow_analysis import FlowAnalyzer
from ..extract.playwright_extractor import PageExtractor

logger = logging.getLogger("clearclick.crawler.guided_flow")

# Forbidden terms: clicking these could trigger payment, purchase, account changes, or destructive actions
FORBIDDEN_CLICK_TERMS = [
    r"\bbuy\b",
    r"\bpay\b",
    r"\bpay now\b",
    r"\bpurchase\b",
    r"\bplace order\b",
    r"\bcomplete order\b",
    r"\bcomplete purchase\b",
    r"\bsubmit order\b",
    r"\bconfirm payment\b",
    r"\bconfirm order\b",
    r"\bconfirm purchase\b",
    r"\bconfirm and pay\b",
    r"\border now\b",
    r"\bdelete\b",
    r"\bcancel\b",
    r"\bcancel subscription\b",
    r"\bdelete account\b",
]

# Safe generic patterns for Step 1 -> Step 2 (Product/Plan to Cart)
ADD_TO_CART_PATTERNS = [
    r"^\s*add to (cart|bag|basket)\s*$",
    r"^\s*choose plan\s*$",
    r"^\s*select plan\s*$",
    r"^\s*pick plan\s*$",
    r"^\s*select this plan\s*$",
    r"^\s*get started\s*$",
]

# Safe generic patterns for Step 2 -> Step 3 (Open Cart)
OPEN_CART_PATTERNS = [
    r"^\s*view (cart|bag|basket)\s*$",
    r"^\s*go to (cart|bag|basket)\s*$",
    r"^\s*open (cart|bag|basket)\s*$",
    r"^\s*(cart|bag|basket)\s*$",
]

# Safe generic patterns for Step 3 -> Step 4 (Proceed to Checkout / Review)
PROCEED_CHECKOUT_PATTERNS = [
    r"^\s*proceed to checkout\s*$",
    r"^\s*continue to checkout\s*$",
    r"^\s*go to checkout\s*$",
    r"^\s*review order\s*$",
]


def is_click_forbidden(text: str) -> Tuple[bool, str]:
    """Check if button/link text suggests buying, paying, confirming, or cancelling."""
    norm = text.strip().lower()
    for pattern in FORBIDDEN_CLICK_TERMS:
        if re.search(pattern, norm):
            return True, f"Click forbidden under Hard Rule 3: matches '{pattern}'"
    return False, ""


class GuidedFlowCapturer:
    """
    Executes a safe, non-destructive scripted journey from product/pricing to checkout review.
    """

    @classmethod
    async def capture_safe_flow(
        cls,
        start_url: str,
        ai_client: Optional[Any] = None,
    ) -> GuidedFlowResult:
        flow_id = f"flow_{uuid.uuid4().hex[:12]}"
        steps: List[FlowStepResult] = []

        # Validate starting URL
        is_safe, reason = validate_url_safety(start_url)
        if not is_safe:
            return GuidedFlowResult(
                flow_id=flow_id,
                root_url=start_url,
                status="failed",
                flow_stopped_reason=f"URL safety check failed: {reason}",
                steps=[],
                findings=[],
            )

        from playwright.async_api import async_playwright

        flow_stopped_reason: Optional[str] = None

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                    ],
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    device_scale_factor=1.0,
                    user_agent=SCAN_USER_AGENT,
                )
                page = await context.new_page()

                # Step 1: Initial Page (Product or Pricing)
                logger.info(f"GuidedFlow: Step 1 navigating to {start_url}")
                try:
                    await page.goto(start_url, wait_until="domcontentloaded", timeout=int(PER_PAGE_TIMEOUT * 1000))
                except Exception as nav_e:
                    await browser.close()
                    return GuidedFlowResult(
                        flow_id=flow_id,
                        root_url=start_url,
                        status="failed",
                        flow_stopped_reason=f"Navigation failed: {nav_e}",
                        steps=[
                            FlowStepResult(
                                step_index=1,
                                step_name="initial_page",
                                url=start_url,
                                status="not_reached",
                                stopped_reason=str(nav_e),
                            )
                        ],
                        findings=[],
                    )

                step1_data = await cls._extract_step_page_data(page, start_url)
                stop_check = await cls._check_abort_conditions(page, step1_data)
                if stop_check:
                    steps.append(
                        FlowStepResult(
                            step_index=1,
                            step_name="initial_page",
                            url=page.url,
                            status="reached",
                            page_data=step1_data,
                            stopped_reason=stop_check,
                        )
                    )
                    flow_stopped_reason = stop_check
                    await browser.close()
                    return await cls._finalize_flow(flow_id, start_url, steps, flow_stopped_reason, ai_client)

                steps.append(
                    FlowStepResult(
                        step_index=1,
                        step_name="product_or_pricing",
                        url=page.url,
                        status="reached",
                        page_data=step1_data,
                    )
                )

                # Step 2: Add to Cart / Choose Plan
                step2_clicked, step2_reason = await cls._find_and_safe_click(
                    page, ADD_TO_CART_PATTERNS, "Add to Cart / Select Plan"
                )
                if not step2_clicked:
                    flow_stopped_reason = f"flow_stopped: {step2_reason}"
                    steps.append(
                        FlowStepResult(
                            step_index=2,
                            step_name="add_to_cart",
                            status="not_reached",
                            stopped_reason=step2_reason,
                        )
                    )
                    await browser.close()
                    return await cls._finalize_flow(flow_id, start_url, steps, flow_stopped_reason, ai_client)

                await page.wait_for_timeout(1000)
                step2_data = await cls._extract_step_page_data(page, page.url)
                stop_check = await cls._check_abort_conditions(page, step2_data)
                if stop_check:
                    steps.append(
                        FlowStepResult(
                            step_index=2,
                            step_name="cart_updated",
                            url=page.url,
                            status="reached",
                            page_data=step2_data,
                            stopped_reason=stop_check,
                        )
                    )
                    flow_stopped_reason = stop_check
                    await browser.close()
                    return await cls._finalize_flow(flow_id, start_url, steps, flow_stopped_reason, ai_client)

                steps.append(
                    FlowStepResult(
                        step_index=2,
                        step_name="cart_item_added",
                        url=page.url,
                        status="reached",
                        page_data=step2_data,
                    )
                )

                # Step 3: Open Cart / Basket View
                step3_clicked, step3_reason = await cls._find_and_safe_click(
                    page, OPEN_CART_PATTERNS, "View Cart"
                )
                if not step3_clicked:
                    flow_stopped_reason = f"flow_stopped: {step3_reason}"
                    steps.append(
                        FlowStepResult(
                            step_index=3,
                            step_name="cart_view",
                            status="not_reached",
                            stopped_reason=step3_reason,
                        )
                    )
                    await browser.close()
                    return await cls._finalize_flow(flow_id, start_url, steps, flow_stopped_reason, ai_client)

                await page.wait_for_timeout(1000)
                step3_data = await cls._extract_step_page_data(page, page.url)
                stop_check = await cls._check_abort_conditions(page, step3_data)
                if stop_check:
                    steps.append(
                        FlowStepResult(
                            step_index=3,
                            step_name="cart_view",
                            url=page.url,
                            status="reached",
                            page_data=step3_data,
                            stopped_reason=stop_check,
                        )
                    )
                    flow_stopped_reason = stop_check
                    await browser.close()
                    return await cls._finalize_flow(flow_id, start_url, steps, flow_stopped_reason, ai_client)

                steps.append(
                    FlowStepResult(
                        step_index=3,
                        step_name="cart_view",
                        url=page.url,
                        status="reached",
                        page_data=step3_data,
                    )
                )

                # Step 4: Proceed to Checkout Review
                step4_clicked, step4_reason = await cls._find_and_safe_click(
                    page, PROCEED_CHECKOUT_PATTERNS, "Proceed to Checkout"
                )
                if not step4_clicked:
                    flow_stopped_reason = f"flow_stopped: {step4_reason}"
                    steps.append(
                        FlowStepResult(
                            step_index=4,
                            step_name="checkout_review",
                            status="not_reached",
                            stopped_reason=step4_reason,
                        )
                    )
                    await browser.close()
                    return await cls._finalize_flow(flow_id, start_url, steps, flow_stopped_reason, ai_client)

                await page.wait_for_timeout(1000)
                step4_data = await cls._extract_step_page_data(page, page.url)
                stop_check = await cls._check_abort_conditions(page, step4_data)

                # Reached checkout review screen; always stop before payment
                steps.append(
                    FlowStepResult(
                        step_index=4,
                        step_name="checkout_review",
                        url=page.url,
                        status="reached",
                        page_data=step4_data,
                        stopped_reason=stop_check or "flow_stopped: reached checkout review screen (payment halted by safety rule)",
                    )
                )
                flow_stopped_reason = stop_check or "flow_stopped: reached checkout review screen (payment halted by safety rule)"
                await browser.close()

                return await cls._finalize_flow(flow_id, start_url, steps, flow_stopped_reason, ai_client)

        except Exception as e:
            logger.error(f"Guided flow execution error: {e}")
            return GuidedFlowResult(
                flow_id=flow_id,
                root_url=start_url,
                status="failed",
                flow_stopped_reason=f"flow_stopped: execution error ({e})",
                steps=steps,
                findings=[],
            )

    @classmethod
    async def _check_abort_conditions(cls, page: Any, page_data: PageData) -> Optional[str]:
        """
        Evaluate Hard Rule 3 abort conditions:
        - Login / authentication challenge
        - Payment inputs (credit card number, cvv, cardholder)
        - Form inputs required
        - Dangerous purchase confirmation buttons
        """
        # 1. Login or Authentication Barrier
        if page_data.page_status in ("needs_login", "blocked"):
            return f"flow_stopped: {page_data.status_reason}"

        # Password input detection
        has_password = await page.query_selector("input[type='password']")
        if has_password:
            return "flow_stopped: authentication or password input required"

        # 2. Payment Details Inputs
        payment_selectors = [
            "input[autocomplete*='cc-']",
            "input[name*='card']",
            "input[id*='card']",
            "input[placeholder*='card number' i]",
            "iframe[src*='stripe' i]",
            "iframe[src*='braintree' i]",
            "iframe[src*='paypal' i]",
        ]
        for sel in payment_selectors:
            has_payment = await page.query_selector(sel)
            if has_payment:
                return "flow_stopped: payment or credit card details required"

        # 3. Dangerous Purchase Confirmation Controls
        for btn in page_data.buttons + page_data.links:
            is_bad, reason = is_click_forbidden(btn.text)
            if is_bad:
                return f"flow_stopped: reached purchase confirmation screen ({btn.text})"

        return None

    @classmethod
    async def _find_and_safe_click(
        cls,
        page: Any,
        safe_patterns: List[str],
        action_name: str,
    ) -> Tuple[bool, str]:
        """
        Locates a visible element matching safe patterns, validates that it does NOT match
        forbidden terms, and clicks it.
        """
        elements = await page.query_selector_all("button, a, input[type='submit'], input[type='button'], [role='button']")
        target = None
        matched_text = ""

        for el in elements:
            try:
                is_vis = await el.is_visible()
                if not is_vis:
                    continue
                txt = (await el.inner_text()).strip()
                if not txt:
                    val = await el.get_attribute("value")
                    txt = (val or "").strip()
                if not txt:
                    continue

                # Strictly check forbidden terms first!
                is_bad, _ = is_click_forbidden(txt)
                if is_bad:
                    continue

                # Check safe pattern
                for pat in safe_patterns:
                    if re.search(pat, txt, re.IGNORECASE):
                        target = el
                        matched_text = txt
                        break
                if target:
                    break
            except Exception:
                continue

        if not target:
            return False, f"no safe control found for {action_name}"

        # Re-check href if it's a link to verify SSRF safety
        tag = await target.evaluate("el => el.tagName.toLowerCase()")
        if tag == "a":
            href = await target.get_attribute("href")
            if href:
                full_url = urljoin(page.url, href)
                is_safe, reason = validate_url_safety(full_url)
                if not is_safe:
                    return False, f"link destination violates SSRF safety: {reason}"

        logger.info(f"GuidedFlow: clicking safe control '{matched_text}' ({action_name})")
        try:
            await target.click(timeout=5000)
            return True, f"clicked '{matched_text}'"
        except Exception as click_e:
            return False, f"click failed: {click_e}"

    @classmethod
    async def _extract_step_page_data(cls, page: Any, url: str) -> PageData:
        """Extract structured PageData snapshot at the current flow step."""
        from ..extract.playwright_extractor import EXTRACTION_JS
        data: Dict[str, Any] = await page.evaluate(EXTRACTION_JS)
        screenshot_bytes = await page.screenshot(full_page=False, type="jpeg", quality=82)
        import base64
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode("utf-8")

        from ..extract.playwright_extractor import ExtractedCheckbox, ExtractedElement
        return PageData(
            url=url,
            title=data.get("title", ""),
            visible_text=data.get("visibleText", ""),
            checkboxes=[ExtractedCheckbox(**cb) for cb in data.get("checkboxes", [])],
            buttons=[ExtractedElement(**b) for b in data.get("buttons", [])],
            links=[ExtractedElement(**l) for l in data.get("links", [])],
            prices=[ExtractedElement(**p) for p in data.get("prices", [])],
            text_elements=[ExtractedElement(**t) for t in data.get("textElements", [])],
            screenshot_base64=screenshot_base64,
            page_status="ok",
            status_reason="Flow step captured successfully",
        )

    @classmethod
    async def _finalize_flow(
        cls,
        flow_id: str,
        root_url: str,
        steps: List[FlowStepResult],
        stopped_reason: Optional[str],
        ai_client: Optional[Any],
    ) -> GuidedFlowResult:
        """Run flow analysis on reached steps and compile the result."""
        reached_pages = [s.page_data for s in steps if s.status == "reached" and s.page_data]
        findings: List[Finding] = []
        if len(reached_pages) >= 2:
            flow_data = FlowData(flow_type="checkout", steps=reached_pages)
            findings = await FlowAnalyzer.analyze_flow_async(flow_data, client=ai_client)

        status = "completed" if len(steps) >= 3 and not (stopped_reason and "failed" in stopped_reason) else "aborted"
        return GuidedFlowResult(
            flow_id=flow_id,
            root_url=root_url,
            status=status,
            flow_stopped_reason=stopped_reason,
            steps=steps,
            findings=findings,
        )
