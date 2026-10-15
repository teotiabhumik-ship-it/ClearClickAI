"""
Unit tests for ClearClick AI's real AI & vision layer
Validates explicit status tracking, markdown JSON parsing, quote verification,
and resilient error handling.
"""

import pytest
import json
from unittest.mock import AsyncMock, patch
from backend.app.schema import PageData, Finding, ExtractedElement
from backend.app.ai.client import AIClient
from backend.app.ai.text_analysis import AITextDetector
from backend.app.ai.vision_analysis import AIVisionDetector


@pytest.mark.asyncio
async def test_ai_layer_reports_not_run_when_no_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    client = AIClient()
    assert client.has_any_key is False

    items, status, msg = await client.analyze_text("system", "user")
    assert items == []
    assert status == "not_run"
    assert "no API key configured" in msg

    items_v, status_v, msg_v = await client.analyze_vision("system", "user", "fakebase64")
    assert items_v == []
    assert status_v == "not_run"
    assert "no API key configured" in msg_v


@pytest.mark.asyncio
async def test_ai_text_detector_with_valid_and_invalid_quotes(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    page_text = "Click to proceed. Are you sure you do not want to not keep your exclusive benefits?"
    page_data = PageData(
        url="http://test.local",
        title="Test Page",
        visible_text=page_text,
        buttons=[
            ExtractedElement(
                tag="button",
                text="do not want to not keep",
                bbox=[100, 200, 150, 40]
            )
        ]
    )

    detector = AITextDetector()

    # Mock AI client returning two findings: one real quote, one hallucinated quote
    mock_findings = [
        {
            "category": "consent",
            "type": "double_negative_language",
            "severity": "high",
            "confidence": 0.9,
            "evidence": "do not want to not keep",
            "why": "Confusing double negation",
            "safer_alternative": "Use clear language"
        },
        {
            "category": "hidden_charges",
            "type": "fake_charge",
            "severity": "medium",
            "confidence": 0.8,
            "evidence": "You will be charged an extra 99 dollars unexpectedly",
            "why": "Hallucinated fee",
            "safer_alternative": "None"
        }
    ]

    with patch.object(detector.client, "analyze_text", new_callable=AsyncMock) as mock_analyze:
        mock_analyze.return_value = (mock_findings, "completed", "AI analysis completed via Claude")
        findings, status, msg = await detector.detect(page_data)

        assert status == "completed"
        # The hallucinated quote must be dropped by QuoteVerifier!
        assert len(findings) == 1
        assert findings[0].evidence == "do not want to not keep"
        assert findings[0].bbox == [100, 200, 150, 40]


@pytest.mark.asyncio
async def test_ai_vision_detector_matches_element_bbox(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    page_data = PageData(
        url="http://test.local",
        title="Test Page",
        screenshot_base64="fake_base64_data",
        buttons=[
            ExtractedElement(
                tag="button",
                text="Accept All Cookies",
                bbox=[20, 50, 200, 45],
                background_color="#2563eb",
                color="#ffffff"
            ),
            ExtractedElement(
                tag="a",
                text="Reject all optional tracking",
                bbox=[250, 60, 120, 20],
                background_color="rgba(0,0,0,0)",
                color="#9ca3af"
            )
        ]
    )

    detector = AIVisionDetector()

    mock_vision_items = [
        {
            "category": "consent",
            "type": "unequal_button_emphasis",
            "severity": "medium",
            "confidence": 0.88,
            "evidence": "Accept button has bright blue solid background, Reject is faint gray link",
            "target_element_text": "Reject all optional tracking",
            "why": "Visual imbalance guides user to accept",
            "safer_alternative": "Give equal visual prominence to Accept and Reject"
        }
    ]

    with patch.object(detector.client, "analyze_vision", new_callable=AsyncMock) as mock_vision:
        mock_vision.return_value = (mock_vision_items, "completed", "AI vision completed via Claude")
        findings, status, msg = await detector.detect(page_data)

        assert status == "completed"
        assert len(findings) == 1
        # Bounding box should match the 'Reject' link
        assert findings[0].bbox == [250, 60, 120, 20]
        assert findings[0].source == "ai"


@pytest.mark.asyncio
async def test_ai_layer_handles_api_exception(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy_key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    client = AIClient()

    with patch("anthropic.AsyncAnthropic") as mock_anthropic:
        mock_client = AsyncMock()
        mock_client.messages.create.side_effect = RuntimeError("Rate limit reached (429)")
        mock_anthropic.return_value = mock_client

        items, status, msg = await client.analyze_text("sys", "user")
        assert items == []
        assert status == "failed"
        assert "request failed" in msg.lower()


@pytest.mark.asyncio
async def test_ai_layer_handles_gemini_exception(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "dummy_gemini_key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    client = AIClient()

    with patch("google.genai.Client") as mock_genai_cls:
        mock_genai_client = AsyncMock()
        mock_genai_client.models.generate_content.side_effect = RuntimeError("Gemini Quota Exceeded")
        mock_genai_cls.return_value = mock_genai_client

        items, status, msg = await client.analyze_text("sys", "user")
        assert items == []
        assert status == "failed"
        assert "request failed" in msg.lower()
