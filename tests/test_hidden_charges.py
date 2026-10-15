import pytest
import os
from backend.app.extract.playwright_extractor import PageExtractor
from backend.app.detectors.hidden_charges import HiddenChargesDetector


@pytest.mark.asyncio
async def test_microprint_fee_detector():
    fixture = os.path.abspath("corpus/positive/charges_microprint_fee.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = HiddenChargesDetector()
    findings = detector.detect(page_data)

    types = [f.type for f in findings]
    assert "microprint_fee" in types
    finding = next(f for f in findings if f.type == "microprint_fee")
    assert finding.category == "hidden_charges"
    assert "resort and maintenance fee" in finding.evidence.lower()


@pytest.mark.asyncio
async def test_low_contrast_fee_detector():
    fixture = os.path.abspath("corpus/positive/charges_low_contrast_fee.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = HiddenChargesDetector()
    findings = detector.detect(page_data)

    types = [f.type for f in findings]
    assert "low_contrast_fee" in types


@pytest.mark.asyncio
async def test_drip_pricing_detector():
    fixture = os.path.abspath("corpus/positive/charges_drip_pricing.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = HiddenChargesDetector()
    findings = detector.detect(page_data)

    types = [f.type for f in findings]
    assert "drip_pricing" in types


@pytest.mark.asyncio
async def test_clean_charges_negative_control():
    fixture = os.path.abspath("corpus/negative/charges_transparent_pricing.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = HiddenChargesDetector()
    findings = detector.detect(page_data)

    assert len(findings) == 0, f"Clean fixture incorrectly flagged: {[f.type for f in findings]}"
