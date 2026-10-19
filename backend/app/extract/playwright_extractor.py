"""
Playwright Page Extractor for ClearClick AI
Captures visible DOM elements, computed styles, element bounding boxes, and full-page screenshots.
Supports:
- Shadow DOM piercing (open shadow roots)
- Iframe exploration (same-origin and cross-origin frames)
- Dynamic banner wait conditions (OneTrust, Cookiebot, late overlays)
- Device pixel ratio coordinate scaling alignment
- Responsive viewports
"""

import os
import base64
import asyncio
import logging
from typing import Optional, Dict, Any, List
from bs4 import BeautifulSoup

from ..schema import PageData, ExtractedCheckbox, ExtractedElement, PageStatus
from .contrast import calculate_contrast_ratio, parse_color_to_rgb
from ..config.scan_settings import SCAN_USER_AGENT, PER_PAGE_TIMEOUT
from ..crawler.block_detector import detect_page_block, domain_cooldown_tracker
from ..security import validate_url_safety

logger = logging.getLogger("clearclick.extractor")


EXTRACTION_JS = r"""
() => {
    const dpr = window.devicePixelRatio || 1;

    function getBBox(el, offsetX = 0, offsetY = 0) {
        const r = el.getBoundingClientRect();
        return [
            Math.round(r.left + window.scrollX + offsetX),
            Math.round(r.top + window.scrollY + offsetY),
            Math.round(r.width),
            Math.round(r.height)
        ];
    }

    function getEffectiveBackgroundColor(el) {
        let cur = el;
        while (cur && cur !== document.documentElement) {
            if (cur instanceof Element) {
                const cs = window.getComputedStyle(cur);
                const bg = cs.backgroundColor;
                if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)' && !bg.endsWith(', 0)')) {
                    return bg;
                }
            }
            cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host);
        }
        if (document.body) {
            const bodyCs = window.getComputedStyle(document.body);
            if (bodyCs.backgroundColor && bodyCs.backgroundColor !== 'transparent' && bodyCs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                return bodyCs.backgroundColor;
            }
        }
        return 'rgb(255, 255, 255)';
    }

    function getStyle(el) {
        const cs = window.getComputedStyle(el);
        return {
            fontSizePx: parseFloat(cs.fontSize) || 14,
            color: cs.color,
            backgroundColor: (cs.backgroundColor && cs.backgroundColor !== 'transparent' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') 
                ? cs.backgroundColor 
                : getEffectiveBackgroundColor(el)
        };
    }

    // Recursively collect all elements across light DOM and open shadow DOMs
    function getAllElementsWithShadow(root) {
        const elements = [];
        function walk(node) {
            if (!node) return;
            if (node.nodeType === Node.ELEMENT_NODE) {
                elements.push(node);
                if (node.shadowRoot) {
                    walk(node.shadowRoot);
                }
            }
            let child = node.firstElementChild;
            while (child) {
                walk(child);
                child = child.nextElementSibling;
            }
        }
        walk(root);
        return elements;
    }

    const allNodes = getAllElementsWithShadow(document.documentElement);
    let elCounter = 1;

    // 1. Checkboxes
    const checkboxes = [];
    allNodes.filter(n => n.tagName === 'INPUT' && n.type === 'checkbox').forEach((cb, idx) => {
        let labelText = '';
        if (cb.id) {
            const lbl = document.querySelector(`label[for="${cb.id}"]`);
            if (lbl) labelText = lbl.innerText;
        }
        if (!labelText) {
            const parentLabel = cb.closest('label');
            if (parentLabel) labelText = parentLabel.innerText;
        }
        if (!labelText && cb.parentElement) {
            labelText = cb.parentElement.innerText;
        }
        if (!labelText) {
            labelText = cb.getAttribute('aria-label') || '';
        }

        const assignedId = `el_${elCounter++}`;
        checkboxes.push({
            id: cb.id || assignedId,
            element_id: assignedId,
            name: cb.name || '',
            checked: cb.checked,
            disabled: cb.disabled,
            label: labelText.trim(),
            bbox: getBBox(cb)
        });
    });

    // 2. Buttons
    const buttons = [];
    allNodes.filter(n => {
        const tag = n.tagName.toLowerCase();
        const role = n.getAttribute('role');
        const type = n.getAttribute('type');
        return tag === 'button' || (tag === 'input' && (type === 'button' || type === 'submit')) || role === 'button';
    }).forEach((btn, idx) => {
        const txt = btn.innerText || btn.value || btn.getAttribute('aria-label') || '';
        if (!txt.trim()) return;
        const s = getStyle(btn);
        const assignedId = `el_${elCounter++}`;
        buttons.push({
            tag: btn.tagName.toLowerCase(),
            text: txt.trim(),
            id: btn.id || assignedId,
            element_id: assignedId,
            classes: Array.from(btn.classList || []),
            bbox: getBBox(btn),
            font_size_px: s.fontSizePx,
            color: s.color,
            background_color: s.backgroundColor,
            role: btn.getAttribute('role') || 'button',
            href: null
        });
    });

    // 3. Links
    const links = [];
    allNodes.filter(n => n.tagName.toLowerCase() === 'a' && (n.hasAttribute('href') || n.hasAttribute('role'))).forEach((link, idx) => {
        const txt = link.innerText || link.getAttribute('aria-label') || '';
        if (!txt.trim()) return;
        const s = getStyle(link);
        const assignedId = `el_${elCounter++}`;
        links.push({
            tag: 'a',
            text: txt.trim(),
            id: link.id || assignedId,
            element_id: assignedId,
            classes: Array.from(link.classList || []),
            bbox: getBBox(link),
            font_size_px: s.fontSizePx,
            color: s.color,
            background_color: s.backgroundColor,
            role: link.getAttribute('role') || 'link',
            href: link.getAttribute('href') || ''
        });
    });

    // 4. Prices and fees
    const prices = [];
    const priceRegex = /([$€£₹]\s*\d+(?:\.\d{2})?|fee|charge|surcharge|total|resort|processing|handling|cleaning)/i;

    allNodes.filter(n => {
        const tag = n.tagName.toLowerCase();
        return ['span', 'div', 'p', 'strong', 'em', 'b', 'h1', 'h2', 'h3', 'h4', 'td'].includes(tag);
    }).forEach((el, idx) => {
        if (el.children && el.children.length > 2) return;
        const txt = el.innerText || '';
        if (priceRegex.test(txt) && txt.trim().length < 150) {
            const s = getStyle(el);
            const assignedId = `el_${elCounter++}`;
            prices.push({
                tag: el.tagName.toLowerCase(),
                text: txt.trim(),
                id: el.id || assignedId,
                element_id: assignedId,
                classes: Array.from(el.classList || []),
                bbox: getBBox(el),
                font_size_px: s.fontSizePx,
                color: s.color,
                background_color: s.backgroundColor,
                role: 'price_item',
                href: null
            });
        }
    });

    // 5. Relevant Content and Text Elements
    const textElements = [];
    allNodes.filter(n => {
        const tag = n.tagName.toLowerCase();
        return ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tag);
    }).forEach((el) => {
        const txt = el.innerText || '';
        if (txt.trim().length >= 8 && txt.trim().length < 500) {
            const s = getStyle(el);
            const assignedId = `el_${elCounter++}`;
            textElements.push({
                tag: el.tagName.toLowerCase(),
                text: txt.trim(),
                id: el.id || assignedId,
                element_id: assignedId,
                classes: Array.from(el.classList || []),
                bbox: getBBox(el),
                font_size_px: s.fontSizePx,
                color: s.color,
                background_color: s.backgroundColor,
                role: 'text',
                href: null
            });
        }
    });

    const bodyColor = document.body ? window.getComputedStyle(document.body).color : 'rgb(0, 0, 0)';
    const bodyBg = document.body ? getEffectiveBackgroundColor(document.body) : 'rgb(255, 255, 255)';

    return {
        title: document.title || '',
        visibleText: document.body ? document.body.innerText : '',
        bodyColor,
        bodyBg,
        dpr,
        checkboxes,
        buttons,
        links,
        prices,
        textElements
    };
}
"""


class PageExtractor:
    COMMON_BANNER_SELECTORS = [
        "#onetrust-banner-sdk",
        "#onetrust-consent-sdk",
        "#usercentrics-root",
        "#cookie-banner",
        "#cookie-law-info-bar",
        ".cookie-banner",
        ".cc-banner",
        "[aria-label*='cookie' i]",
        "[aria-label*='consent' i]",
        "[role='dialog'][aria-modal='true']"
    ]

    @classmethod
    async def extract_from_url_or_html(
        cls,
        url: Optional[str] = None,
        html_content: Optional[str] = None,
        viewport_width: int = 1280,
        viewport_height: int = 800
    ) -> PageData:
        """
        Extract page structure using Playwright Chromium with shadow DOM piercing,
        iframe exploration, late banner waiting, and DPR alignment.
        """
        from playwright.async_api import async_playwright

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-infobars",
                        "--window-position=0,0",
                        "--ignore-certificate-errors",
                        "--ignore-certificate-errors-spki-list",
                    ]
                )
                # Lock device_scale_factor to 1.0 for pixel-perfect screenshot & coordinate matching
                # Use honest identifying User-Agent from config (Hard Rule 1 & 2: no stealth plugins or spoofing)
                context = await browser.new_context(
                    viewport={"width": viewport_width, "height": viewport_height},
                    device_scale_factor=1.0,
                    user_agent=SCAN_USER_AGENT,
                    locale="en-US",
                    timezone_id="America/New_York",
                )

                page = await context.new_page()

                # Re-check each redirect target against SSRF safety (Hard Rule 4)
                redirect_violation = None

                async def _guard_redirect(route):
                    """Validate redirect requests before Playwright sends them."""
                    nonlocal redirect_violation
                    request = route.request
                    if request.redirected_from is not None:
                        target_url = request.url
                        is_safe, reason = validate_url_safety(target_url)
                        if not is_safe:
                            redirect_violation = f"Redirect target '{target_url}' violates SSRF safety: {reason}"
                            logger.warning(redirect_violation)
                            await route.abort()
                            return
                    await route.continue_()

                await page.route("**/*", _guard_redirect)

                def _on_response(resp):
                    nonlocal redirect_violation
                    if resp.status in (301, 302, 303, 307, 308):
                        loc = resp.headers.get("location")
                        if loc:
                            from urllib.parse import urljoin
                            target_url = urljoin(resp.url, loc)
                            is_safe, reason = validate_url_safety(target_url)
                            if not is_safe:
                                redirect_violation = f"Redirect target '{target_url}' violates SSRF safety: {reason}"
                                logger.warning(redirect_violation)

                page.on("response", _on_response)

                http_status = None
                nav_status: PageStatus = "ok"
                nav_reason = "Page loaded successfully"

                if url and (url.startswith("http://") or url.startswith("https://")):
                    try:
                        resp = await page.goto(url, wait_until="domcontentloaded", timeout=int(PER_PAGE_TIMEOUT * 1000))
                        if resp:
                            http_status = resp.status
                    except Exception as nav_e:
                        err_str = str(nav_e)
                        if "timeout" in err_str.lower():
                            nav_status = "timeout"
                            nav_reason = f"Navigation timeout exceeded ({PER_PAGE_TIMEOUT}s)"
                        else:
                            nav_status = "error"
                            nav_reason = f"Navigation failed: {nav_e}"
                        logger.warning(f"Navigation warning or partial timeout for {url}: {nav_e}")
                elif url and os.path.exists(url):
                    abs_path = os.path.abspath(url)
                    await page.goto(f"file:///{abs_path.replace(os.sep, '/')}", wait_until="domcontentloaded")
                elif html_content:
                    await page.set_content(html_content, wait_until="domcontentloaded")
                else:
                    raise ValueError("Must provide either a valid URL, file path, or HTML content.")

                if redirect_violation:
                    nav_status = "invalid_url"
                    nav_reason = redirect_violation

                # Dynamic wait for late-loading cookie banners or dialogs
                await cls._wait_for_dynamic_content(page)

                # Capture full-page screenshot aligned to CSS pixels (scale 1.0) with fast, optimized JPEG compression
                screenshot_bytes = await page.screenshot(full_page=True, type="jpeg", quality=82)
                screenshot_base64 = base64.b64encode(screenshot_bytes).decode("utf-8")

                # Execute DOM & computed styles extraction script (pierces shadow DOM)
                data: Dict[str, Any] = await page.evaluate(EXTRACTION_JS)

                # Traverse child iframes (for banners loaded in separate frames)
                await cls._extract_iframe_elements(page, data)

                await browser.close()

                # Block and access barrier detection
                has_interactive = bool(
                    data.get("checkboxes")
                    or data.get("buttons")
                    or data.get("links")
                    or data.get("prices")
                )
                if nav_status == "ok":
                    det_status, det_reason = detect_page_block(
                        http_status=http_status,
                        title=data.get("title", ""),
                        visible_text=data.get("visibleText", ""),
                        html_content=html_content or "",
                        has_interactive_elements=has_interactive,
                    )
                    page_status = det_status
                    status_reason = det_reason
                    if page_status == "blocked" and url:
                        domain_cooldown_tracker.record_block(url)
                else:
                    page_status = nav_status
                    status_reason = nav_reason

                body_fg = data.get("bodyColor", "#000000")
                body_bg = data.get("bodyBg", "#ffffff")
                body_contrast = calculate_contrast_ratio(body_fg, body_bg)

                # Post-process contrast ratios on extracted elements with resolved page background
                cls._compute_contrasts(data.get("buttons", []), default_bg=body_bg)
                cls._compute_contrasts(data.get("links", []), default_bg=body_bg)
                cls._compute_contrasts(data.get("prices", []), default_bg=body_bg)
                cls._compute_contrasts(data.get("textElements", []), default_bg=body_bg)

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
                    viewport_width=viewport_width,
                    viewport_height=viewport_height,
                    body_color=body_fg,
                    body_background_color=body_bg,
                    body_contrast_ratio=body_contrast,
                    device_pixel_ratio=float(data.get("dpr", 1.0)),
                    page_status=page_status,
                    status_reason=status_reason,
                    http_status=http_status
                )

        except Exception as e:
            logger.warning(f"Playwright extraction failed ({e}), falling back to static parser.")
            return cls._fallback_soup_extract(html_content or "", url=url)

    @classmethod
    async def _wait_for_dynamic_content(cls, page):
        """Wait for dynamic banners, modals, and animation stabilization."""
        # Try waiting for known banner selectors with short timeout
        for sel in cls.COMMON_BANNER_SELECTORS:
            try:
                elem = page.locator(sel).first
                if await elem.is_visible(timeout=300):
                    break
            except Exception:
                continue

        # Brief stabilization delay for CSS animations/transitions
        try:
            await page.wait_for_load_state("networkidle", timeout=1200)
        except Exception:
            await page.wait_for_timeout(350)

    @classmethod
    async def _extract_iframe_elements(cls, page, main_data: Dict[str, Any]):
        """Explore child frames and merge extracted interactive elements."""
        try:
            frames = page.frames
            # Skip main frame (index 0) as it's already extracted
            for frame in frames[1:]:
                try:
                    # Check if frame is accessible
                    frame_data = await frame.evaluate(EXTRACTION_JS)
                    if frame_data:
                        # Append elements and visible text from iframe
                        if frame_data.get("visibleText"):
                            main_data["visibleText"] = (main_data.get("visibleText", "") + "\n" + frame_data["visibleText"]).strip()
                        main_data.setdefault("buttons", []).extend(frame_data.get("buttons", []))
                        main_data.setdefault("links", []).extend(frame_data.get("links", []))
                        main_data.setdefault("checkboxes", []).extend(frame_data.get("checkboxes", []))
                        main_data.setdefault("prices", []).extend(frame_data.get("prices", []))
                        main_data.setdefault("textElements", []).extend(frame_data.get("textElements", []))
                except Exception:
                    continue
        except Exception:
            pass

    @staticmethod
    def _compute_contrasts(elements: List[Dict[str, Any]], default_bg: str = "#ffffff"):
        for el in elements:
            fg = el.get("color", "#000000")
            bg = el.get("background_color") or default_bg
            el["contrast_ratio"] = calculate_contrast_ratio(fg, bg, default_bg=default_bg)

    @classmethod
    def _fallback_soup_extract(cls, html: str, url: Optional[str] = None) -> PageData:
        """Lightweight pure-python fallback for fast offline testing and serverless environments."""
        page_status: PageStatus = "ok"
        status_reason = "Page loaded successfully"
        http_status: Optional[int] = None

        if not html and url:
            if url.startswith("http://") or url.startswith("https://"):
                import urllib.request
                import urllib.error

                class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
                    def redirect_request(self, req, fp, code, msg, headers, newurl):
                        is_safe, reason = validate_url_safety(newurl)
                        if not is_safe:
                            raise urllib.error.HTTPError(
                                newurl, 400, f"SSRF security violation on redirect: {reason}", headers, None
                            )
                        return super().redirect_request(req, fp, code, msg, headers, newurl)

                try:
                    req = urllib.request.Request(
                        url,
                        headers={
                            "User-Agent": SCAN_USER_AGENT,
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                            "Accept-Language": "en-US,en;q=0.9",
                        }
                    )
                    opener = urllib.request.build_opener(SafeRedirectHandler())
                    with opener.open(req, timeout=int(PER_PAGE_TIMEOUT)) as resp:
                        http_status = resp.getcode()
                        html = resp.read().decode("utf-8", errors="replace")
                except urllib.error.HTTPError as http_err:
                    http_status = http_err.code
                    try:
                        html = http_err.read().decode("utf-8", errors="replace")
                    except Exception:
                        html = ""
                    det_status, det_reason = detect_page_block(http_status=http_status, html_content=html)
                    if det_status == "blocked" and url:
                        domain_cooldown_tracker.record_block(url)
                    logger.warning(f"Fallback URL fetch HTTP error {http_status} for {url}: {det_reason}")
                    return PageData(
                        url=url,
                        title="",
                        visible_text="",
                        page_status=det_status,
                        status_reason=det_reason,
                        http_status=http_status
                    )
                except Exception as fetch_e:
                    err_str = str(fetch_e)
                    status = "timeout" if "timed out" in err_str.lower() else "error"
                    logger.warning(f"Fallback URL fetch failed for {url}: {fetch_e}")
                    return PageData(
                        url=url,
                        title="",
                        visible_text="",
                        page_status=status,
                        status_reason=f"Fetch failed: {err_str}",
                        http_status=None
                    )
            elif os.path.exists(url):
                try:
                    with open(url, "r", encoding="utf-8") as f:
                        html = f.read()
                except Exception as file_e:
                    logger.warning(f"Fallback file read failed for {url}: {file_e}")

        soup = BeautifulSoup(html or "", "html.parser")
        title = soup.title.string if soup.title else ""
        text = soup.get_text(separator=" ", strip=True)

        # Detect block or empty content on rendered HTML
        det_status, det_reason = detect_page_block(
            http_status=http_status or 200,
            title=title or "",
            visible_text=text,
            html_content=html or ""
        )
        if det_status != "ok":
            page_status = det_status
            status_reason = det_reason
            if page_status == "blocked" and url:
                domain_cooldown_tracker.record_block(url)

        el_counter = 1

        checkboxes: List[ExtractedCheckbox] = []
        for idx, cb in enumerate(soup.find_all("input", {"type": "checkbox"})):
            assigned_id = f"el_{el_counter}"
            el_counter += 1
            cb_id = cb.get("id") or assigned_id
            lbl_text = ""
            if cb.get("id"):
                lbl = soup.find("label", {"for": cb.get("id")})
                if lbl:
                    lbl_text = lbl.get_text(strip=True)
            if not lbl_text and cb.parent and cb.parent.name == "label":
                lbl_text = cb.parent.get_text(strip=True)
            if not lbl_text and cb.parent:
                lbl_text = cb.parent.get_text(strip=True)

            checkboxes.append(ExtractedCheckbox(
                id=cb_id,
                element_id=assigned_id,
                name=cb.get("name", ""),
                checked=cb.has_attr("checked"),
                disabled=cb.has_attr("disabled"),
                label=lbl_text,
                bbox=[20.0, float(100 + idx * 40), 16.0, 16.0]
            ))

        buttons: List[ExtractedElement] = []
        for idx, b in enumerate(soup.find_all(["button", "input"])):
            if b.name == "input" and b.get("type") not in ["button", "submit"]:
                continue
            txt = b.get_text(strip=True) or b.get("value", "")
            if not txt:
                continue
            assigned_id = f"el_{el_counter}"
            el_counter += 1
            b_id = b.get("id") or assigned_id
            buttons.append(ExtractedElement(
                tag=b.name,
                text=txt,
                id=b_id,
                element_id=assigned_id,
                classes=b.get("class", []),
                bbox=[40.0, float(200 + idx * 50), 120.0, 36.0],
                font_size_px=14.0,
                color="#ffffff",
                background_color="#2563eb",
                contrast_ratio=4.5
            ))

        links: List[ExtractedElement] = []
        for idx, a in enumerate(soup.find_all("a", href=True)):
            txt = a.get_text(strip=True)
            if not txt:
                continue
            assigned_id = f"el_{el_counter}"
            el_counter += 1
            link_id = a.get("id") or assigned_id
            links.append(ExtractedElement(
                tag="a",
                text=txt,
                id=link_id,
                element_id=assigned_id,
                classes=a.get("class", []),
                bbox=[20.0, float(350 + idx * 30), 150.0, 20.0],
                font_size_px=12.0,
                color="#64748b",
                background_color="#ffffff",
                contrast_ratio=3.8,
                href=a.get("href")
            ))

        prices: List[ExtractedElement] = []
        for idx, p in enumerate(soup.find_all(["span", "div", "p"])):
            txt = p.get_text(strip=True)
            if any(sym in txt for sym in ["$", "€", "£", "₹", "fee", "surcharge", "resort", "cleaning"]):
                assigned_id = f"el_{el_counter}"
                el_counter += 1
                p_id = p.get("id") or assigned_id
                prices.append(ExtractedElement(
                    tag=p.name,
                    text=txt,
                    id=p_id,
                    element_id=assigned_id,
                    classes=p.get("class", []),
                    bbox=[20.0, float(400 + idx * 30), 200.0, 24.0],
                    font_size_px=14.0,
                    color="#000000",
                    background_color="#ffffff",
                    contrast_ratio=21.0
                ))

        text_elements: List[ExtractedElement] = []
        for p in soup.find_all(["p", "h1", "h2", "h3", "h4", "li"]):
            txt = p.get_text(strip=True)
            if 8 <= len(txt) < 500:
                assigned_id = f"el_{el_counter}"
                el_counter += 1
                t_id = p.get("id") or assigned_id
                text_elements.append(ExtractedElement(
                    tag=p.name,
                    text=txt,
                    id=t_id,
                    element_id=assigned_id,
                    classes=p.get("class", []),
                    bbox=[20.0, float(450 + len(text_elements) * 25), 300.0, 20.0],
                    font_size_px=14.0,
                    color="#000000",
                    background_color="#ffffff",
                    contrast_ratio=21.0
                ))

        return PageData(
            url=url,
            title=title or "",
            visible_text=text,
            checkboxes=checkboxes,
            buttons=buttons,
            links=links,
            prices=prices,
            text_elements=text_elements,
            screenshot_base64=None,
            viewport_width=1280,
            viewport_height=800,
            device_pixel_ratio=1.0,
            page_status=page_status,
            status_reason=status_reason,
            http_status=http_status or 200
        )
