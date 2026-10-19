"""
Unit tests for ClearClick AI Server-Side URL Analyzer
Validates syntax, scheme, domain structure, SSRF guards, DNS resolution, and the /api/validate-url endpoint.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.detectors.url_analyzer import URLAnalyzer, url_analyzer


def test_valid_public_urls():
    # Standard public domain with valid DNS
    res = url_analyzer.analyze("https://example.com")
    assert res.is_valid is True
    assert res.error_code is None
    assert res.checks["scheme"] is True
    assert res.checks["hostname"] is True
    assert res.checks["ssrf_safe"] is True
    assert res.normalized_url == "https://example.com/"

    # Valid subdomain, query, and port
    res2 = url_analyzer.analyze("https://www.wikipedia.org/wiki/Main_Page?utm_source=test#frag")
    assert res2.is_valid is True
    assert res2.checks["scheme"] is True
    # Fragment stripped in normalized canonical URL
    assert "#frag" not in (res2.normalized_url or "")


def test_rejects_empty_and_whitespace():
    res = url_analyzer.analyze("")
    assert res.is_valid is False
    assert res.error_code in ("EMPTY_URL", "BLANK_URL")

    res = url_analyzer.analyze("   ")
    assert res.is_valid is False
    assert res.error_code in ("EMPTY_URL", "BLANK_URL")

    res = url_analyzer.analyze("https://exa mple.com")
    assert res.is_valid is False
    assert res.error_code == "ILLEGAL_CHARACTERS"


def test_rejects_disallowed_schemes():
    for bad_url in [
        "file:///etc/passwd",
        "ftp://example.com/file",
        "javascript:alert(1)",
        "data:text/html,<html>",
        "blob:https://example.com/uuid",
        "ws://example.com/socket",
    ]:
        res = url_analyzer.analyze(bad_url)
        assert res.is_valid is False
        assert res.error_code in ("UNSUPPORTED_SCHEME", "MISSING_SCHEME")


def test_rejects_missing_scheme():
    res = url_analyzer.analyze("example.com/test")
    assert res.is_valid is False
    assert res.error_code == "MISSING_SCHEME"


def test_rejects_single_label_hosts():
    res = url_analyzer.analyze("http://intranet/login")
    assert res.is_valid is False
    assert res.error_code == "MISSING_TLD"


def test_rejects_local_and_internal_domains():
    for local_url in [
        "http://localhost:8000",
        "http://service.local/status",
        "http://node.internal/metrics",
        "http://test.localhost",
        "http://myhost.invalid",
    ]:
        res = url_analyzer.analyze(local_url)
        assert res.is_valid is False
        assert "SSRF" in (res.error_code or "")


def test_rejects_ssrf_private_ips():
    for private_url in [
        "http://127.0.0.1:8000/api",
        "http://169.254.169.254/latest/meta-data",
        "http://192.168.1.1/admin",
        "http://10.0.0.1/",
        "http://172.16.0.5:3000",
        "http://[::1]:8080",
    ]:
        res = url_analyzer.analyze(private_url)
        assert res.is_valid is False
        assert "SSRF" in (res.error_code or "")


def test_rejects_invalid_ports():
    res = url_analyzer.analyze("https://example.com:999999/test")
    assert res.is_valid is False
    assert res.error_code in ("INVALID_PORT", "SYNTAX_ERROR")


def test_rejects_nonexistent_dns():
    res = url_analyzer.analyze("https://this-domain-definitely-does-not-exist-clearclick-test987654.org")
    assert res.is_valid is False
    assert res.error_code in ("DNS_RESOLUTION_FAILED", "DNS_ERROR", "NO_IPS_RESOLVED")


def test_validate_url_api_endpoint():
    client = TestClient(app)

    # Valid URL via POST
    resp = client.post("/api/validate-url", json={"url": "https://example.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is True
    assert data["normalized_url"] == "https://example.com/"

    # Invalid URL via POST
    resp = client.post("/api/validate-url", json={"url": "http://127.0.0.1:8000"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is False
    assert "SSRF" in (data.get("error_code") or "")

    # Valid URL via GET query param
    resp = client.get("/api/validate-url?url=https://example.com")
    assert resp.status_code == 200
    assert resp.json()["is_valid"] is True

    # Missing URL parameter
    resp = client.post("/api/validate-url", json={})
    assert resp.status_code == 422 or resp.status_code == 400
