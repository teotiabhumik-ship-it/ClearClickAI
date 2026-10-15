import pytest
import os
from backend.app.extract.playwright_extractor import PageExtractor
from backend.app.detectors.cancellation import CancellationDetector


@pytest.mark.asyncio
async def test_buried_cancel_link_detector():
    fixture = os.path.abspath("corpus/positive/cancel_buried_link.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = CancellationDetector()
    findings = detector.detect(page_data)

    types = [f.type for f in findings]
    assert "buried_cancel_link" in types


@pytest.mark.asyncio
async def test_confirm_shaming_detector():
    fixture = os.path.abspath("corpus/positive/cancel_confirm_shaming.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = CancellationDetector()
    findings = detector.detect(page_data)

    types = [f.type for f in findings]
    assert "confirm_shaming" in types
    finding = next(f for f in findings if f.type == "confirm_shaming")
    assert "hate saving money" in finding.evidence.lower()


@pytest.mark.asyncio
async def test_asymmetric_flow_detector():
    fixture = os.path.abspath("corpus/positive/cancel_asymmetric_flow.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = CancellationDetector()
    findings = detector.detect(page_data)

    types = [f.type for f in findings]
    assert "asymmetric_cancellation_steps" in types


@pytest.mark.asyncio
async def test_clean_cancellation_negative_control():
    fixture = os.path.abspath("corpus/negative/cancel_one_click.html")
    with open(fixture, "r", encoding="utf-8") as f:
        html = f.read()

    page_data = await PageExtractor.extract_from_url_or_html(url=fixture, html_content=html)
    detector = CancellationDetector()
    findings = detector.detect(page_data)

    assert len(findings) == 0, f"Clean fixture incorrectly flagged: {[f.type for f in findings]}"
