import pytest
import os
from backend.app.extract.playwright_extractor import PageExtractor
from backend.app.detectors.consent import ConsentDetector


@pytest.mark.asyncio
async def test_preticked_consent_detector():
    fixture = os.path.abspath("corpus/positive/consent_preticked.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = ConsentDetector()
    findings = detector.detect(page_data)

    types = [f.type for f in findings]
    assert "preticked_consent" in types
    finding = next(f for f in findings if f.type == "preticked_consent")
    assert finding.category == "consent"
    assert "promotional newsletters" in finding.evidence.lower()
    assert finding.source == "rule"


@pytest.mark.asyncio
async def test_asymmetric_cookie_buttons():
    fixture = os.path.abspath("corpus/positive/consent_asymmetric_buttons.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = ConsentDetector()
    findings = detector.detect(page_data)

    types = [f.type for f in findings]
    assert "unequal_button_emphasis" in types


@pytest.mark.asyncio
async def test_missing_reject_option():
    fixture = os.path.abspath("corpus/positive/consent_missing_reject.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = ConsentDetector()
    findings = detector.detect(page_data)

    types = [f.type for f in findings]
    assert "missing_reject_option" in types


@pytest.mark.asyncio
async def test_double_negative():
    fixture = os.path.abspath("corpus/positive/consent_double_negative.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = ConsentDetector()
    findings = detector.detect(page_data)

    types = [f.type for f in findings]
    assert "double_negative_language" in types


@pytest.mark.asyncio
async def test_clean_consent_negative_controls():
    clean_fixtures = [
        "corpus/negative/consent_equal_choice.html",
        "corpus/negative/consent_unchecked_optin.html",
    ]
    detector = ConsentDetector()
    for rel_path in clean_fixtures:
        fixture = os.path.abspath(rel_path)
        with open(fixture, "r", encoding="utf-8") as f:
            html = f.read()
        page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
        findings = detector.detect(page_data)
        assert len(findings) == 0, f"Clean fixture {rel_path} incorrectly flagged: {[f.type for f in findings]}"
