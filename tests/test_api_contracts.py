"""Contract tests for user-visible analysis states and flow comparisons."""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schema import PageData


client = TestClient(app)


def test_html_analysis_returns_evidence_contract_without_ai():
    response = client.post(
        "/api/analyze",
        json={
            "html_content": """
                <html><body>
                  <label><input type='checkbox' checked> Send me promotional offers</label>
                  <p>This page contains enough visible content for extraction and analysis.</p>
                </body></html>
            """,
            "include_ai": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["page_status"] == "ok"
    assert payload["ai_status"] == "skipped_no_key"
    assert payload["findings"][0]["type"] == "preticked_consent"
    assert payload["findings"][0]["signal_strength"] == "high"


def test_empty_html_is_not_presented_as_clean():
    response = client.post(
        "/api/analyze",
        json={"html_content": "<html><body></body></html>", "include_ai": False},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["page_status"] == "empty"
    assert payload["findings"] == []
    assert "No design patterns were evaluated" in payload["disclaimer"]


def test_flow_endpoint_accepts_comparison_metadata_and_returns_comparative_evidence():
    pages = [PageData(visible_text=f"Cancellation screen {index}") for index in range(4)]
    with patch(
        "backend.app.main.PageExtractor.extract_from_url_or_html",
        new_callable=AsyncMock,
        side_effect=pages,
    ):
        response = client.post(
            "/api/analyze-flow",
            json={
                "steps_html": ["<p>one</p>", "<p>two</p>", "<p>three</p>", "<p>four</p>"],
                "flow_type": "cancellation",
                "signup_steps_count": 1,
                "include_ai": False,
            },
        )

    assert response.status_code == 200
    payload = response.json()
    flow_finding = next(f for f in payload["findings"] if f["type"] == "asymmetric_cancellation_steps")
    assert "Raw cancellation step count: 4" in flow_finding["evidence"]
    assert "Comparative friction evidence" in flow_finding["evidence"]
