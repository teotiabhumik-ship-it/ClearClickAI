"""
Unit tests for ClearClick AI Phase F: Security & Hygiene
Validates SSRF protection, URL scheme filtering, payload size constraints, and rate limiting.
"""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.security import (
    validate_url_safety,
    validate_html_payload,
    SlidingWindowRateLimiter,
    MAX_HTML_SIZE_BYTES
)


def test_ssrf_rejects_disallowed_schemes():
    safe, reason = validate_url_safety("file:///etc/passwd")
    assert safe is False
    assert "Unsupported scheme" in reason

    safe, reason = validate_url_safety("ftp://example.com/test")
    assert safe is False
    assert "Unsupported scheme" in reason

    safe, reason = validate_url_safety("javascript:alert(1)")
    assert safe is False
    assert "Unsupported scheme" in reason


def test_ssrf_rejects_loopback_and_local_hosts():
    safe, reason = validate_url_safety("http://localhost:8000/api")
    assert safe is False
    assert "SSRF Guard" in reason

    safe, reason = validate_url_safety("http://127.0.0.1:5000")
    assert safe is False
    assert "SSRF Guard" in reason

    safe, reason = validate_url_safety("http://service.local/login")
    assert safe is False
    assert "SSRF Guard" in reason

    safe, reason = validate_url_safety("http://service.internal/status")
    assert safe is False
    assert "SSRF Guard" in reason


def test_ssrf_rejects_cloud_metadata_and_private_ips():
    # AWS / GCP / Azure metadata endpoint
    safe, reason = validate_url_safety("http://169.254.169.254/latest/meta-data/")
    assert safe is False
    assert "SSRF Guard" in reason

    # RFC1918 Private networks
    safe, reason = validate_url_safety("http://192.168.1.1/router")
    assert safe is False
    assert "SSRF Guard" in reason

    safe, reason = validate_url_safety("http://10.200.0.1/admin")
    assert safe is False
    assert "SSRF Guard" in reason

    safe, reason = validate_url_safety("http://172.16.50.4:8080/metrics")
    assert safe is False
    assert "SSRF Guard" in reason


def test_html_payload_limit():
    small_html = "<html><body>Small page</body></html>"
    # Should not raise exception
    validate_html_payload(small_html)

    huge_html = "x" * (MAX_HTML_SIZE_BYTES + 1024)
    with pytest.raises(HTTPException) as excinfo:
        validate_html_payload(huge_html)
    assert excinfo.value.status_code == 413


def test_rate_limiter():
    limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=10)
    client_ip = "198.51.100.99"

    assert limiter.is_allowed(client_ip) is True
    assert limiter.is_allowed(client_ip) is True
    assert limiter.is_allowed(client_ip) is True
    # 4th request in the same window should be rejected
    assert limiter.is_allowed(client_ip) is False


def test_api_endpoint_blocks_ssrf_url():
    client = TestClient(app)
    response = client.post("/api/analyze", json={"url": "http://127.0.0.1:8000/internal"})
    assert response.status_code == 400
    assert "SSRF Security Violation" in response.json()["detail"]


def test_api_endpoint_blocks_oversized_payload():
    client = TestClient(app)
    response = client.post("/api/analyze", json={"html_content": "a" * (MAX_HTML_SIZE_BYTES + 500)})
    assert response.status_code == 413
