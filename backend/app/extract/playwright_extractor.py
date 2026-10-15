"""
Playwright Page Extractor for ClearClick AI
Captures visible DOM elements, computed styles, element bounding boxes, and full-page screenshots.
"""

import os
import base64
import asyncio
from typing import Optional, Dict, Any, List
from bs4 import BeautifulSoup

from ..schema import PageData, ExtractedCheckbox, ExtractedElement
from .contrast import calculate_contrast_ratio, parse_color_to_rgb


EXTRACTION_JS = """
() => {
    function getBBox(el) {
        const r = el.getBoundingClientRect();
        return [
            Math.round(r.left + window.scrollX),
            Math.round(r.top + window.scrollY),
            Math.round(r.width),
            Math.round(r.height)
        ];
    }

    function getStyle(el) {
        const cs = window.getComputedStyle(el);
        return {
            fontSizePx: parseFloat(cs.fontSize) || 14,
            color: cs.color,
            backgroundColor: cs.backgroundColor
        };
    }

    // 1. Checkboxes
    const checkboxes = [];
    document.querySelectorAll('input[type="checkbox"]').forEach((cb, idx) => {
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

        checkboxes.push({
            id: cb.id || `cb_${idx}`,
            name: cb.name || '',
            checked: cb.checked,
            disabled: cb.disabled,
            label: labelText.trim(),
            bbox: getBBox(cb)
        });
    });

    // 2. Buttons
    const buttons = [];
    const btnSelector = 'button, input[type="button"], input[type="submit"], [role="button"], .btn, .button';
    document.querySelectorAll(btnSelector).forEach((btn, idx) => {
        const txt = btn.innerText || btn.value || '';
        if (!txt.trim()) return;
        const s = getStyle(btn);
        buttons.push({
            tag: btn.tagName.toLowerCase(),
            text: txt.trim(),
            id: btn.id || `btn_${idx}`,
            classes: Array.from(btn.classList),
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
    document.querySelectorAll('a[href]').forEach((link, idx) => {
        const txt = link.innerText || '';
        if (!txt.trim()) return;
        const s = getStyle(link);
        links.push({
            tag: 'a',
            text: txt.trim(),
            id: link.id || `link_${idx}`,
            classes: Array.from(link.classList),
            bbox: getBBox(link),
            font_size_px: s.fontSizePx,
            color: s.color,
            background_color: s.backgroundColor,
            role: 'link',
            href: link.getAttribute('href')
        });
    });

    // 4. Prices and fees
    const prices = [];
    const priceCandidates = Array.from(document.querySelectorAll('span, div, p, strong, em, b, h1, h2, h3, h4, td'));
    const priceRegex = /([$€£₹]\\s*\\d+(?:\\.\\d{2})?|fee|charge|surcharge|total|resort|processing|handling)/i;

    priceCandidates.forEach((el, idx) => {
        // Only inspect leaf or direct-text nodes to avoid capturing entire parent containers
        if (el.children.length > 2) return;
        const txt = el.innerText || '';
        if (priceRegex.test(txt) && txt.trim().length < 150) {
            const s = getStyle(el);
            prices.push({
                tag: el.tagName.toLowerCase(),
                text: txt.trim(),
                id: el.id || `price_${idx}`,
                classes: Array.from(el.classList),
                bbox: getBBox(el),
                font_size_px: s.fontSizePx,
                color: s.color,
                background_color: s.backgroundColor,
                role: 'price_item',
                href: null
            });
        }
    });

    return {
        title: document.title || '',
        visibleText: document.body ? document.body.innerText : '',
        checkboxes,
        buttons,
        links,
        prices
    };
}
"""


class PageExtractor:
    @classmethod
    async def extract_from_url_or_html(
        cls,
        url: Optional[str] = None,
        html_content: Optional[str] = None,
        viewport_width: int = 1280,
        viewport_height: int = 800
    ) -> PageData:
        """
        Extract page structure using Playwright Chromium with fallback to static parser.
        """
        from playwright.async_api import async_playwright

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(viewport={"width": viewport_width, "height": viewport_height})
                
                if url and (url.startswith("http://") or url.startswith("https://")):
                    await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                elif url and os.path.exists(url):
                    abs_path = os.path.abspath(url)
                    await page.goto(f"file:///{abs_path.replace(os.sep, '/')}", wait_until="domcontentloaded")
                elif html_content:
                    await page.set_content(html_content, wait_until="domcontentloaded")
                else:
                    raise ValueError("Must provide either a valid URL, file path, or HTML content.")

                # Wait slightly for dynamic styling to settle
                await page.wait_for_timeout(400)

                # Capture full-page screenshot
                screenshot_bytes = await page.screenshot(full_page=True, type="png")
                screenshot_base64 = base64.b64encode(screenshot_bytes).decode("utf-8")

                # Execute DOM & computed styles extraction script
                data: Dict[str, Any] = await page.evaluate(EXTRACTION_JS)
                await browser.close()

                # Post-process contrast ratios on extracted elements
                cls._compute_contrasts(data.get("buttons", []))
                cls._compute_contrasts(data.get("links", []))
                cls._compute_contrasts(data.get("prices", []))

                return PageData(
                    url=url,
                    title=data.get("title", ""),
                    visible_text=data.get("visibleText", ""),
                    checkboxes=[ExtractedCheckbox(**cb) for cb in data.get("checkboxes", [])],
                    buttons=[ExtractedElement(**b) for b in data.get("buttons", [])],
                    links=[ExtractedElement(**l) for l in data.get("links", [])],
                    prices=[ExtractedElement(**p) for p in data.get("prices", [])],
                    screenshot_base64=screenshot_base64,
                    viewport_width=viewport_width,
                    viewport_height=viewport_height
                )

        except Exception as e:
            # Fallback to pure BeautifulSoup parser if browser launch fails
            return cls._fallback_soup_extract(html_content or "", url=url)

    @staticmethod
    def _compute_contrasts(elements: List[Dict[str, Any]]):
        for el in elements:
            fg = el.get("color", "#000000")
            bg = el.get("background_color", "#ffffff")
            el["contrast_ratio"] = calculate_contrast_ratio(fg, bg)

    @classmethod
    def _fallback_soup_extract(cls, html: str, url: Optional[str] = None) -> PageData:
        """Lightweight pure-python fallback for fast offline testing."""
        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.string if soup.title else ""
        text = soup.get_text(separator=" ", strip=True)

        checkboxes: List[ExtractedCheckbox] = []
        for idx, cb in enumerate(soup.find_all("input", {"type": "checkbox"})):
            cb_id = cb.get("id", f"cb_{idx}")
            lbl_text = ""
            if cb_id:
                lbl = soup.find("label", {"for": cb_id})
                if lbl:
                    lbl_text = lbl.get_text(strip=True)
            if not lbl_text and cb.parent and cb.parent.name == "label":
                lbl_text = cb.parent.get_text(strip=True)
            if not lbl_text and cb.parent:
                lbl_text = cb.parent.get_text(strip=True)

            checkboxes.append(ExtractedCheckbox(
                id=cb_id,
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
            buttons.append(ExtractedElement(
                tag=b.name,
                text=txt,
                id=b.get("id", f"btn_{idx}"),
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
            links.append(ExtractedElement(
                tag="a",
                text=txt,
                id=a.get("id", f"link_{idx}"),
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
            if any(sym in txt for sym in ["$", "€", "£", "₹", "fee", "surcharge", "resort"]):
                prices.append(ExtractedElement(
                    tag=p.name,
                    text=txt,
                    id=p.get("id", f"price_{idx}"),
                    classes=p.get("class", []),
                    bbox=[20.0, float(400 + idx * 30), 200.0, 24.0],
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
            screenshot_base64=None,
            viewport_width=1280,
            viewport_height=800
        )
