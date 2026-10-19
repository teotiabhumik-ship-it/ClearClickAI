from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.app.extract.playwright_extractor import PageExtractor


class _FakeAsyncPlaywright:
    def __init__(self, page):
        self.chromium = MagicMock()
        self.chromium.launch = AsyncMock(return_value=_FakeBrowser(page))

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None


class _FakeBrowser:
    def __init__(self, page):
        self._page = page

    async def new_context(self, **kwargs):
        return _FakeContext(self._page)

    async def close(self):
        return None


class _FakeContext:
    def __init__(self, page):
        self._page = page

    async def new_page(self):
        return self._page


def _fake_page_with_redirects(redirect_url, navigation_events):
    page = MagicMock()
    page.route = AsyncMock()
    page.on = MagicMock()
    page.screenshot = AsyncMock(return_value=b"png")
    page.evaluate = AsyncMock(return_value={
        "title": "Test page",
        "visibleText": "This is enough rendered content for the test page.",
        "bodyColor": "#000000",
        "bodyBg": "#ffffff",
        "dpr": 1,
        "checkboxes": [],
        "buttons": [],
        "links": [],
        "prices": [],
        "textElements": [],
    })
    page.frames = [MagicMock()]

    async def goto(url, **kwargs):
        navigation_events.append(("goto", url))
        route_handler = page.route.await_args.args[1]
        redirect_request = SimpleNamespace(
            url=redirect_url,
            redirected_from=SimpleNamespace(url=url),
        )
        route = MagicMock(request=redirect_request)
        route.abort = AsyncMock(side_effect=lambda: navigation_events.append(("abort", redirect_url)))
        route.continue_ = AsyncMock(side_effect=lambda: navigation_events.append(("continue", redirect_url)))
        await route_handler(route)
        if navigation_events[-1][0] == "abort":
            raise RuntimeError("redirect aborted")
        return SimpleNamespace(status=200)

    page.goto = goto
    page.wait_for_load_state = AsyncMock()
    page.wait_for_timeout = AsyncMock()
    return page


@pytest.mark.asyncio
async def test_unsafe_playwright_redirect_is_aborted_before_navigation():
    navigation_events = []
    page = _fake_page_with_redirects("http://127.0.0.1:8000/private", navigation_events)

    with patch(
        "playwright.async_api.async_playwright",
        return_value=_FakeAsyncPlaywright(page),
    ), patch(
        "backend.app.extract.playwright_extractor.validate_url_safety",
        return_value=(False, "blocked private address"),
    ) as validate:
        page_data = await PageExtractor.extract_from_url_or_html(url="https://public.example")

    assert navigation_events == [
        ("goto", "https://public.example"),
        ("abort", "http://127.0.0.1:8000/private"),
    ]
    validate.assert_called_once_with("http://127.0.0.1:8000/private")
    assert page_data.page_status == "invalid_url"
    assert "violates SSRF safety" in page_data.status_reason


@pytest.mark.asyncio
async def test_safe_playwright_redirect_is_continued():
    navigation_events = []
    page = _fake_page_with_redirects("https://safe.example/next", navigation_events)

    with patch(
        "playwright.async_api.async_playwright",
        return_value=_FakeAsyncPlaywright(page),
    ), patch(
        "backend.app.extract.playwright_extractor.validate_url_safety",
        return_value=(True, "URL validated successfully"),
    ) as validate:
        page_data = await PageExtractor.extract_from_url_or_html(url="https://public.example")

    assert navigation_events == [
        ("goto", "https://public.example"),
        ("continue", "https://safe.example/next"),
    ]
    validate.assert_called_once_with("https://safe.example/next")
    assert page_data.page_status == "ok"
