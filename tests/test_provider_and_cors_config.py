"""Focused tests for provider routing and CORS configuration."""

from unittest.mock import AsyncMock

import pytest

from backend.app.ai.client import AIClient
from backend.app.main import DEFAULT_CORS_ORIGINS, cors_settings, parse_cors_origins


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("provider", "expected", "gemini_key", "anthropic_key"),
    [
        ("gemini", "gemini", "gemini-key", "anthropic-key"),
        ("anthropic", "anthropic", "gemini-key", "anthropic-key"),
        ("claude", "anthropic", "gemini-key", "anthropic-key"),
        ("auto", "gemini", "gemini-key", "anthropic-key"),
        ("auto", "anthropic", None, "anthropic-key"),
    ],
)
async def test_ai_provider_selects_only_expected_provider(
    monkeypatch, tmp_path, provider, expected, gemini_key, anthropic_key
):
    monkeypatch.setenv("AI_PROVIDER", provider)
    monkeypatch.setenv("GEMINI_API_KEY", gemini_key or "")
    monkeypatch.setenv("ANTHROPIC_API_KEY", anthropic_key or "")
    client = AIClient(cache_dir=str(tmp_path))
    gemini_call = AsyncMock(return_value=([], "ran", "gemini"))
    claude_call = AsyncMock(return_value=([], "ran", "claude"))
    client._call_gemini_text = gemini_call
    client._call_claude_text = claude_call

    await client.analyze_text("system", "user")

    assert client._selected_provider() == expected
    assert gemini_call.await_count == (1 if expected == "gemini" else 0)
    assert claude_call.await_count == (1 if expected == "anthropic" else 0)


@pytest.mark.asyncio
async def test_explicit_provider_does_not_fallback_to_other_provider(monkeypatch, tmp_path):
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-only")
    client = AIClient(cache_dir=str(tmp_path))

    items, status, message = await client.analyze_text("system", "user")

    assert items == []
    assert status == "skipped_no_key"
    assert "no API key" in message


def test_cors_defaults_to_local_frontend_without_wildcard_credentials(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    settings = cors_settings()

    assert settings["allow_origins"] == DEFAULT_CORS_ORIGINS
    assert settings["allow_credentials"] is True
    assert "*" not in settings["allow_origins"]


def test_cors_origins_are_configurable_and_wildcard_disables_credentials(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example, https://admin.example/")
    settings = cors_settings()
    assert settings["allow_origins"] == ["https://app.example", "https://admin.example"]
    assert settings["allow_credentials"] is True

    wildcard_settings = cors_settings("*")
    assert wildcard_settings["allow_origins"] == ["*"]
    assert wildcard_settings["allow_credentials"] is False


def test_empty_cors_value_uses_safe_default():
    assert parse_cors_origins("   ") == DEFAULT_CORS_ORIGINS
