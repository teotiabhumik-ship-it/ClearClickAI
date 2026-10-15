"""
Tests for Phase E: Real-world extraction robustness
Validates shadow DOM piercing, iframe traversal, and DPR scaling.
"""

import pytest
from backend.app.extract.playwright_extractor import PageExtractor


@pytest.mark.asyncio
async def test_extractor_pierces_open_shadow_dom():
    html_with_shadow_dom = """
    <!DOCTYPE html>
    <html>
    <head><title>Shadow DOM Test</title></head>
    <body>
        <h1>Main Page Title</h1>
        <div id="host-element"></div>
        <script>
            const host = document.getElementById('host-element');
            const shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = `
                <div class="shadow-cookie-banner">
                    <p>We use tracking cookies inside Shadow DOM.</p>
                    <button id="shadow-accept-btn" style="background:#2563eb;color:#fff;padding:10px 20px;">Accept All</button>
                    <a id="shadow-reject-link" href="#reject" style="color:#94a3b8;font-size:11px;">Reject optional</a>
                    <label>
                        <input type="checkbox" id="shadow-analytics-cb" checked>
                        Enable Partner Analytics
                    </label>
                </div>
            `;
        </script>
    </body>
    </html>
    """

    page_data = await PageExtractor.extract_from_url_or_html(html_content=html_with_shadow_dom)

    # Verify buttons inside shadow DOM were discovered
    button_texts = [b.text for b in page_data.buttons]
    assert "Accept All" in button_texts, f"Shadow DOM button not extracted! Extracted: {button_texts}"

    # Verify links inside shadow DOM were discovered
    link_texts = [l.text for l in page_data.links]
    assert "Reject optional" in link_texts, f"Shadow DOM link not extracted! Extracted: {link_texts}"

    # Verify checkboxes inside shadow DOM were discovered
    cb_ids = [cb.id for cb in page_data.checkboxes]
    assert "shadow-analytics-cb" in cb_ids, f"Shadow DOM checkbox not extracted! Extracted: {cb_ids}"


@pytest.mark.asyncio
async def test_extractor_traverses_iframes():
    iframe_html = """
    <!DOCTYPE html>
    <html>
    <head><title>Parent Page</title></head>
    <body>
        <h2>Main Container</h2>
        <iframe id="consent-frame" srcdoc="
            <html><body>
                <p>Third-party consent manager frame</p>
                <button id='iframe-consent-btn'>Agree to All Tracking</button>
            </body></html>
        "></iframe>
    </body>
    </html>
    """

    page_data = await PageExtractor.extract_from_url_or_html(html_content=iframe_html)
    button_texts = [b.text for b in page_data.buttons]
    assert "Agree to All Tracking" in button_texts, f"Iframe button was not extracted! Extracted: {button_texts}"


@pytest.mark.asyncio
async def test_extractor_respects_custom_viewports():
    mobile_html = """
    <!DOCTYPE html>
    <html>
    <head><title>Mobile Viewport Test</title></head>
    <body style="margin:0;padding:20px;">
        <button style="width:100%;height:50px;">Mobile Action</button>
    </body>
    </html>
    """

    # Test mobile dimensions
    page_data = await PageExtractor.extract_from_url_or_html(
        html_content=mobile_html,
        viewport_width=375,
        viewport_height=667
    )

    assert page_data.viewport_width == 375
    assert page_data.viewport_height == 667
    assert len(page_data.buttons) == 1
    assert page_data.device_pixel_ratio == 1.0


@pytest.mark.asyncio
async def test_extractor_across_10_diverse_pages():
    import os
    import base64

    corpus_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "corpus"))
    test_files = [
        "dev/positive/consent_asymmetric_buttons.html",
        "dev/positive/consent_preticked.html",
        "dev/positive/charges_microprint_fee.html",
        "dev/positive/cancel_buried_link.html",
        "dev/negative/consent_equal_choice.html",
        "dev/negative/charges_transparent_pricing.html",
        "held_out/positive/consent_dark_theme_hidden_reject.html",
        "held_out/positive/charges_rental_cleaning_fee.html",
        "held_out/positive/cancel_guilt_trip_avatar.html",
        "held_out/negative/charges_breakdown_calculator.html"
    ]

    assert len(test_files) == 10, "Must test exactly 10 distinct pages"

    for rel_file in test_files:
        full_path = os.path.join(corpus_dir, rel_file)
        assert os.path.exists(full_path), f"File {full_path} not found"

        with open(full_path, "r", encoding="utf-8") as f:
            html = f.read()

        page_data = await PageExtractor.extract_from_url_or_html(url=full_path, html_content=html)

        # 1. Non-empty text extraction
        assert len(page_data.visible_text.strip()) > 10, f"Empty text extracted from {rel_file}"

        # 2. Screenshot generation
        assert page_data.screenshot_base64 is not None, f"Screenshot missing for {rel_file}"
        decoded_bytes = base64.b64decode(page_data.screenshot_base64)
        assert len(decoded_bytes) > 500, f"Screenshot corrupted for {rel_file}"

        # 3. Viewport and DPR stability
        assert page_data.viewport_width == 1280
        assert page_data.viewport_height == 800
        assert page_data.device_pixel_ratio == 1.0

        # 4. Interactive element extraction
        total_interactive = len(page_data.buttons) + len(page_data.links) + len(page_data.checkboxes) + len(page_data.prices)
        assert total_interactive > 0, f"No interactive elements found in {rel_file}"

