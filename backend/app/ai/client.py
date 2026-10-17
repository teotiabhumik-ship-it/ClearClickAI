"""
Resilient Multi-Provider LLM Client for ClearClick AI
Supports Gemini (Google GenAI) and Claude (Anthropic) with configurable models,
disk caching, rate limiting, daily budget tracking, exponential backoff retries,
and unified status reporting.
"""

import os
import json
import base64
import time
import hashlib
import asyncio
import logging
from typing import Optional, List, Dict, Any, Tuple, Union, Callable
from dotenv import load_dotenv

from ..config.settings import (
    GEMINI_API_KEY,
    ANTHROPIC_API_KEY,
    GEMINI_MODEL,
    ANTHROPIC_MODEL,
    AI_PROVIDER,
    PROMPT_VERSION,
    AI_CALLS_PER_MINUTE,
    AI_DAILY_CALL_LIMIT,
    AI_TIMEOUT_SECONDS,
    AI_MAX_RETRIES,
    CACHE_DIR,
)

load_dotenv()

logger = logging.getLogger("clearclick.ai")


class AIStatus(str):
    """
    Unified AI status supporting both new fine-grained values and backward-compatible strings.
    Valid new states: 'ran', 'skipped_no_key', 'unavailable', 'limit_reached', 'invalid_response'.
    Legacy equivalents: 'completed', 'not_run', 'failed'.
    """
    def __eq__(self, other):
        val = str(self)
        if val == "skipped_no_key" and other in ("not_run", "skipped_no_key"):
            return True
        if val == "ran" and other in ("completed", "ran"):
            return True
        if val in ("unavailable", "limit_reached", "invalid_response", "failed") and other in ("failed", val):
            return True
        return super().__eq__(other)

    def __hash__(self):
        return super().__hash__()


class DiskCache:
    """Persistent on-disk cache for LLM inference results."""
    def __init__(self, cache_dir: str = CACHE_DIR):
        self.cache_dir = cache_dir
        try:
            os.makedirs(self.cache_dir, exist_ok=True)
        except Exception:
            pass

    def _make_key(self, prompt_version: str, model_name: str, content: str) -> str:
        raw = f"{prompt_version}::{model_name}::{content}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, prompt_version: str, model_name: str, content: str) -> Optional[List[Dict[str, Any]]]:
        try:
            key = self._make_key(prompt_version, model_name, content)
            file_path = os.path.join(self.cache_dir, f"{key}.json")
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return data
        except Exception as e:
            logger.debug(f"Cache read error: {e}")
        return None

    def set(self, prompt_version: str, model_name: str, content: str, data: List[Dict[str, Any]]):
        try:
            key = self._make_key(prompt_version, model_name, content)
            file_path = os.path.join(self.cache_dir, f"{key}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except Exception as e:
            logger.debug(f"Cache write error: {e}")


class RateLimiter:
    """Sliding-window rate limiter for outbound AI calls with pluggable clock."""
    def __init__(self, max_per_minute: int = AI_CALLS_PER_MINUTE, clock_fn: Optional[Callable[[], float]] = None):
        self.max_per_minute = max_per_minute
        self.clock_fn = clock_fn or time.monotonic
        self.timestamps: List[float] = []

    def can_call(self) -> bool:
        now = self.clock_fn()
        self.timestamps = [t for t in self.timestamps if now - t < 60.0]
        return len(self.timestamps) < self.max_per_minute

    def record_call(self):
        self.timestamps.append(self.clock_fn())


class DailyCallCounter:
    """Daily budget counter preventing free-tier quota exhaustion with pluggable clock."""
    def __init__(self, limit: int = AI_DAILY_CALL_LIMIT, clock_fn: Optional[Callable[[], float]] = None):
        self.limit = limit
        self.clock_fn = clock_fn or time.time
        self.current_day: str = self._current_day_str()
        self.count: int = 0

    def _current_day_str(self) -> str:
        return time.strftime("%Y-%m-%d", time.gmtime(self.clock_fn()))

    def can_call(self) -> bool:
        day = self._current_day_str()
        if day != self.current_day:
            self.current_day = day
            self.count = 0
        return self.count < self.limit

    def record_call(self):
        day = self._current_day_str()
        if day != self.current_day:
            self.current_day = day
            self.count = 0
        self.count += 1


class AIClient:
    def __init__(
        self,
        gemini_model: Optional[str] = None,
        gemini_key: Optional[str] = None,
        anthropic_key: Optional[str] = None,
        cache_dir: Optional[str] = None,
        calls_per_minute: int = AI_CALLS_PER_MINUTE,
        daily_limit: int = AI_DAILY_CALL_LIMIT,
        clock_fn: Optional[Callable[[], float]] = None
    ):
        self.gemini_model = gemini_model or os.getenv("GEMINI_MODEL", GEMINI_MODEL)
        self.anthropic_model = os.getenv("ANTHROPIC_MODEL", ANTHROPIC_MODEL)
        self.gemini_key = gemini_key or os.getenv("GEMINI_API_KEY", GEMINI_API_KEY)
        self.anthropic_key = anthropic_key or os.getenv("ANTHROPIC_API_KEY", ANTHROPIC_API_KEY)
        self.provider = os.getenv("AI_PROVIDER", AI_PROVIDER)

        self.has_anthropic = bool(self.anthropic_key and self.anthropic_key.strip())
        self.has_gemini = bool(self.gemini_key and self.gemini_key.strip())

        self.cache = DiskCache(cache_dir or CACHE_DIR)
        self.rate_limiter = RateLimiter(max_per_minute=calls_per_minute, clock_fn=clock_fn)
        self.daily_counter = DailyCallCounter(limit=daily_limit, clock_fn=clock_fn)

    @property
    def active_model(self) -> str:
        """Returns the active model name based on configured keys and provider."""
        self._resolve_keys()
        if self.has_gemini:
            return self.gemini_model
        if self.has_anthropic:
            return self.anthropic_model
        return self.gemini_model

    @property
    def has_any_key(self) -> bool:
        # Re-check environment dynamically if keys were not present at construction
        g_key = self.gemini_key or os.getenv("GEMINI_API_KEY")
        a_key = self.anthropic_key or os.getenv("ANTHROPIC_API_KEY")
        return bool((g_key and g_key.strip()) or (a_key and a_key.strip()))

    def _resolve_keys(self):
        if not self.gemini_key:
            self.gemini_key = os.getenv("GEMINI_API_KEY")
        if not self.anthropic_key:
            self.anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        self.has_gemini = bool(self.gemini_key and self.gemini_key.strip())
        self.has_anthropic = bool(self.anthropic_key and self.anthropic_key.strip())

    async def check_model_availability(self) -> Tuple[bool, str]:
        """
        Check if the configured model is available and credentials are functional.
        Returns: (is_available, status_or_reason)
        """
        self._resolve_keys()
        if not self.has_any_key:
            return False, "skipped_no_key"

        if self.has_gemini:
            try:
                from google import genai
                client = genai.Client(api_key=self.gemini_key)
                # Probe model availability if models.get is supported
                if hasattr(client, "models") and hasattr(client.models, "get"):
                    try:
                        probe_res = client.models.get(model=self.gemini_model)
                        if asyncio.iscoroutine(probe_res):
                            await probe_res
                    except Exception as probe_e:
                        err_str = str(probe_e).lower()
                        if "not found" in err_str or "404" in err_str:
                            return False, f"unavailable: configured model '{self.gemini_model}' not found"
                        if "401" in err_str or "403" in err_str or "permission" in err_str or "unauthenticated" in err_str:
                            return False, f"unavailable: credentials invalid for model '{self.gemini_model}' ({probe_e})"
                        return False, f"unavailable: {probe_e}"
                return True, f"gemini ({self.gemini_model}) available"
            except Exception as e:
                return False, f"unavailable: {e}"

        if self.has_anthropic:
            try:
                import anthropic
                return True, f"anthropic ({self.anthropic_model}) available"
            except Exception as e:
                return False, f"unavailable: {e}"

        return False, "unavailable"

    async def analyze_text(
        self,
        system_prompt: str,
        user_prompt: str
    ) -> Tuple[List[Dict[str, Any]], AIStatus, str]:
        """
        Analyze page text with configured LLM.
        Applies disk caching, rate limiting, retry backoff, and safe JSON validation.
        """
        self._resolve_keys()
        if not self.has_any_key:
            return [], AIStatus("skipped_no_key"), "AI analysis not run (no API key configured)"

        # Check daily quota budget before making network call
        if not self.daily_counter.can_call():
            return [], AIStatus("limit_reached"), "AI analysis stopped: daily API call limit reached"

        # Check rate limiter
        if not self.rate_limiter.can_call():
            return [], AIStatus("limit_reached"), "AI analysis rate limit exceeded (requests per minute limit)"

        # Check disk cache keyed by prompt version, active model name, and prompt content
        cache_payload = f"{system_prompt}\n\n{user_prompt}"
        cached = self.cache.get(PROMPT_VERSION, self.active_model, cache_payload)
        if cached is not None:
            return cached, AIStatus("ran"), f"AI analysis completed via cache ({self.active_model})"

        # Execute outbound call with retry logic
        # 1. Gemini
        if self.has_gemini:
            items, status, msg = await self._call_gemini_text(system_prompt, user_prompt)
            if status in ("ran", "completed"):
                self.cache.set(PROMPT_VERSION, self.gemini_model, cache_payload, items)
            return items, status, msg

        # 2. Anthropic Claude fallback
        if self.has_anthropic:
            items, status, msg = await self._call_claude_text(system_prompt, user_prompt)
            if status in ("ran", "completed"):
                self.cache.set(PROMPT_VERSION, self.anthropic_model, cache_payload, items)
            return items, status, msg

        return [], AIStatus("skipped_no_key"), "AI analysis not run (no API key configured)"

    async def analyze_vision(
        self,
        system_prompt: str,
        user_prompt: str,
        image_base64: str
    ) -> Tuple[List[Dict[str, Any]], AIStatus, str]:
        """
        Analyze page screenshot with Multimodal Vision LLM.
        """
        if not image_base64 or not image_base64.strip():
            return [], AIStatus("skipped_no_key"), "AI vision analysis not run (no screenshot provided)"

        self._resolve_keys()
        if not self.has_any_key:
            return [], AIStatus("skipped_no_key"), "AI vision analysis not run (no API key configured)"

        if not self.daily_counter.can_call():
            return [], AIStatus("limit_reached"), "AI vision stopped: daily API call limit reached"

        if not self.rate_limiter.can_call():
            return [], AIStatus("limit_reached"), "AI vision rate limit exceeded (requests per minute limit)"

        clean_base64 = image_base64.split("base64,")[1] if "base64," in image_base64 else image_base64

        # Disk cache for vision keyed by prompt version, active model, and hash of prompt + image
        cache_payload = f"{system_prompt}\n\n{user_prompt}\n\n{hashlib.sha256(clean_base64.encode('utf-8')).hexdigest()}"
        cached = self.cache.get(PROMPT_VERSION, self.active_model, cache_payload)
        if cached is not None:
            return cached, AIStatus("ran"), f"AI vision completed via cache ({self.active_model})"

        # 1. Gemini Multimodal
        if self.has_gemini:
            items, status, msg = await self._call_gemini_vision(system_prompt, user_prompt, clean_base64)
            if status in ("ran", "completed"):
                self.cache.set(PROMPT_VERSION, self.gemini_model, cache_payload, items)
            return items, status, msg

        # 2. Anthropic Claude Multimodal
        if self.has_anthropic:
            items, status, msg = await self._call_claude_vision(system_prompt, user_prompt, clean_base64)
            if status in ("ran", "completed"):
                self.cache.set(PROMPT_VERSION, self.anthropic_model, cache_payload, items)
            return items, status, msg

        return [], AIStatus("skipped_no_key"), "AI vision analysis not run (no API key configured)"

    async def _safe_execute_gemini(self, client: Any, **kwargs) -> Any:
        """Execute client.models.generate_content handling both sync and async mocks with timeout."""
        call_res = client.models.generate_content(**kwargs)
        if asyncio.iscoroutine(call_res):
            return await asyncio.wait_for(call_res, timeout=AI_TIMEOUT_SECONDS)
        return call_res

    def _extract_response_text(self, response: Any) -> str:
        """Safely extract text from response, handling safety blocks and candidate parts."""
        try:
            if hasattr(response, "text") and response.text:
                return response.text
        except Exception:
            pass

        try:
            if hasattr(response, "candidates") and response.candidates:
                c = response.candidates[0]
                if hasattr(c, "content") and c.content and hasattr(c.content, "parts"):
                    return "".join(getattr(p, "text", "") for p in c.content.parts if hasattr(p, "text"))
        except Exception:
            pass

        return ""

    async def _call_gemini_text(
        self,
        system_prompt: str,
        user_prompt: str
    ) -> Tuple[List[Dict[str, Any]], AIStatus, str]:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=self.gemini_key)

            attempt = 0
            while attempt <= AI_MAX_RETRIES:
                try:
                    self.rate_limiter.record_call()
                    self.daily_counter.record_call()

                    config = types.GenerateContentConfig(
                        temperature=0.0,
                        system_instruction=system_prompt,
                    )

                    response = await self._safe_execute_gemini(
                        client,
                        model=self.gemini_model,
                        contents=user_prompt,
                        config=config
                    )
                    text_out = self._extract_response_text(response)
                    if not text_out:
                        return [], AIStatus("invalid_response"), "AI returned empty or blocked response"
                    items, parse_ok = self._parse_json_list(text_out)
                    if not parse_ok:
                        return [], AIStatus("invalid_response"), "AI returned invalid or malformed JSON"
                    return items, AIStatus("ran"), f"AI analysis completed via Gemini ({self.gemini_model})"

                except (asyncio.TimeoutError, TimeoutError) as te:
                    logger.warning(f"Gemini API timed out after {AI_TIMEOUT_SECONDS}s: {te}")
                    return [], AIStatus("unavailable"), f"AI analysis not run (Gemini request timed out after {AI_TIMEOUT_SECONDS}s)"

                except Exception as e:
                    err_str = str(e).lower()
                    if "401" in err_str or "403" in err_str or "unauthenticated" in err_str or "permission_denied" in err_str:
                        return [], AIStatus("unavailable"), f"AI analysis not run (Gemini authentication failed: 401/403)"

                    is_rate_limit = "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str
                    is_server_error = "500" in err_str or "503" in err_str or "internal" in err_str

                    if (is_rate_limit or is_server_error) and attempt < AI_MAX_RETRIES:
                        delay = 0.5 * (2 ** attempt)
                        attempt += 1
                        logger.warning(f"Gemini API transient failure ({e}), retrying in {delay}s (attempt {attempt}/{AI_MAX_RETRIES})")
                        await asyncio.sleep(delay)
                        continue

                    if is_rate_limit:
                        return [], AIStatus("limit_reached"), f"AI analysis not run (Gemini request failed: Rate limit 429)"

                    return [], AIStatus("unavailable"), f"AI analysis not run (Gemini request failed: {type(e).__name__})"

        except Exception as e:
            logger.warning(f"Gemini initialization error: {e}")
            return [], AIStatus("unavailable"), f"AI analysis not run (Gemini request failed: {type(e).__name__})"

    async def _call_gemini_vision(
        self,
        system_prompt: str,
        user_prompt: str,
        clean_base64: str
    ) -> Tuple[List[Dict[str, Any]], AIStatus, str]:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=self.gemini_key)
            img_bytes = base64.b64decode(clean_base64)

            attempt = 0
            while attempt <= AI_MAX_RETRIES:
                try:
                    self.rate_limiter.record_call()
                    self.daily_counter.record_call()

                    config = types.GenerateContentConfig(
                        temperature=0.0,
                        system_instruction=system_prompt,
                    )

                    response = await self._safe_execute_gemini(
                        client,
                        model=self.gemini_model,
                        contents=[
                            types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
                            user_prompt
                        ],
                        config=config
                    )
                    text_out = self._extract_response_text(response)
                    if not text_out:
                        return [], AIStatus("invalid_response"), "AI vision returned empty or blocked response"
                    items, parse_ok = self._parse_json_list(text_out)
                    if not parse_ok:
                        return [], AIStatus("invalid_response"), "AI vision returned invalid or malformed JSON"
                    return items, AIStatus("ran"), f"AI vision completed via Gemini ({self.gemini_model})"

                except (asyncio.TimeoutError, TimeoutError) as te:
                    logger.warning(f"Gemini Vision timed out after {AI_TIMEOUT_SECONDS}s: {te}")
                    return [], AIStatus("unavailable"), f"AI vision analysis not run (Gemini request timed out after {AI_TIMEOUT_SECONDS}s)"

                except Exception as e:
                    err_str = str(e).lower()
                    if "401" in err_str or "403" in err_str or "unauthenticated" in err_str or "permission_denied" in err_str:
                        return [], AIStatus("unavailable"), f"AI vision analysis not run (Gemini authentication failed: 401/403)"

                    is_rate_limit = "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str
                    is_server_error = "500" in err_str or "503" in err_str or "internal" in err_str

                    if (is_rate_limit or is_server_error) and attempt < AI_MAX_RETRIES:
                        delay = 0.5 * (2 ** attempt)
                        attempt += 1
                        logger.warning(f"Gemini Vision transient failure ({e}), retrying in {delay}s (attempt {attempt}/{AI_MAX_RETRIES})")
                        await asyncio.sleep(delay)
                        continue

                    if is_rate_limit:
                        return [], AIStatus("limit_reached"), f"AI vision analysis not run (Gemini request failed: Rate limit 429)"

                    return [], AIStatus("unavailable"), f"AI vision analysis not run (Gemini request failed: {type(e).__name__})"

        except Exception as e:
            logger.warning(f"Gemini vision error: {e}")
            return [], AIStatus("unavailable"), f"AI vision analysis not run (Gemini request failed: {type(e).__name__})"

    async def _call_claude_text(
        self,
        system_prompt: str,
        user_prompt: str
    ) -> Tuple[List[Dict[str, Any]], AIStatus, str]:
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=self.anthropic_key)
            self.rate_limiter.record_call()
            self.daily_counter.record_call()

            response = await asyncio.wait_for(
                client.messages.create(
                    model=self.anthropic_model,
                    max_tokens=2000,
                    temperature=0.0,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}]
                ),
                timeout=AI_TIMEOUT_SECONDS
            )
            text_out = response.content[0].text if response.content else ""
            if not text_out:
                return [], AIStatus("invalid_response"), "AI returned empty response"
            items, parse_ok = self._parse_json_list(text_out)
            if not parse_ok:
                return [], AIStatus("invalid_response"), "AI returned invalid or malformed JSON"
            return items, AIStatus("ran"), f"AI analysis completed via Claude ({self.anthropic_model})"
        except (asyncio.TimeoutError, TimeoutError) as te:
            logger.warning(f"Claude API timed out after {AI_TIMEOUT_SECONDS}s: {te}")
            return [], AIStatus("unavailable"), f"AI analysis not run (Claude request timed out after {AI_TIMEOUT_SECONDS}s)"
        except Exception as e:
            logger.warning(f"Claude API call failed: {e}")
            err_str = str(e).lower()
            if "401" in err_str or "403" in err_str or "authentication" in err_str:
                return [], AIStatus("unavailable"), f"AI analysis not run (Claude request failed: Authentication failed 401/403)"
            if "429" in err_str or "rate" in err_str:
                return [], AIStatus("limit_reached"), f"AI analysis not run (Claude request failed: Rate limit 429)"
            return [], AIStatus("unavailable"), f"AI analysis not run (Claude request failed: {type(e).__name__})"

    async def _call_claude_vision(
        self,
        system_prompt: str,
        user_prompt: str,
        clean_base64: str
    ) -> Tuple[List[Dict[str, Any]], AIStatus, str]:
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=self.anthropic_key)
            self.rate_limiter.record_call()
            self.daily_counter.record_call()

            response = await asyncio.wait_for(
                client.messages.create(
                    model=self.anthropic_model,
                    max_tokens=2000,
                    temperature=0.0,
                    system=system_prompt,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/png",
                                        "data": clean_base64.strip()
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": user_prompt
                                }
                            ]
                        }
                    ]
                ),
                timeout=AI_TIMEOUT_SECONDS
            )
            text_out = response.content[0].text if response.content else ""
            if not text_out:
                return [], AIStatus("invalid_response"), "AI vision returned empty response"
            items, parse_ok = self._parse_json_list(text_out)
            if not parse_ok:
                return [], AIStatus("invalid_response"), "AI vision returned invalid or malformed JSON"
            return items, AIStatus("ran"), f"AI vision completed via Claude ({self.anthropic_model})"
        except (asyncio.TimeoutError, TimeoutError) as te:
            logger.warning(f"Claude Vision timed out after {AI_TIMEOUT_SECONDS}s: {te}")
            return [], AIStatus("unavailable"), f"AI vision analysis not run (Claude request timed out after {AI_TIMEOUT_SECONDS}s)"
        except Exception as e:
            logger.warning(f"Claude Vision API call failed: {e}")
            err_str = str(e).lower()
            if "401" in err_str or "403" in err_str or "authentication" in err_str:
                return [], AIStatus("unavailable"), f"AI vision analysis not run (Claude request failed: Authentication failed 401/403)"
            if "429" in err_str or "rate" in err_str:
                return [], AIStatus("limit_reached"), f"AI vision analysis not run (Claude request failed: Rate limit 429)"
            return [], AIStatus("unavailable"), f"AI vision analysis not run (Claude request failed: {type(e).__name__})"

    def _parse_json_list(self, text: str) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Extract structured JSON list from LLM response text.
        Returns: (items, parse_ok)
        """
        if not text or not text.strip():
            return [], False

        cleaned = text.strip()
        # Handle code-fenced markdown
        if "```" in cleaned:
            start = cleaned.find("```")
            end = cleaned.rfind("```")
            if start != -1 and end != -1 and end > start:
                inner = cleaned[start:end]
                if inner.startswith("```json"):
                    inner = inner[7:]
                elif inner.startswith("```"):
                    inner = inner[3:]
                cleaned = inner.strip()

        left_bracket = cleaned.find("[")
        right_bracket = cleaned.rfind("]")
        if left_bracket != -1 and right_bracket != -1 and right_bracket >= left_bracket:
            cleaned = cleaned[left_bracket:right_bracket + 1]
        else:
            left_brace = cleaned.find("{")
            right_brace = cleaned.rfind("}")
            if left_brace != -1 and right_brace != -1 and right_brace >= left_brace:
                cleaned = cleaned[left_brace:right_brace + 1]

        try:
            data = json.loads(cleaned)
            if isinstance(data, list):
                if len(data) == 0:
                    return [], True
                # Ensure all elements in list are dicts
                valid_items = [item for item in data if isinstance(item, dict)]
                if len(valid_items) == 0 and len(data) > 0:
                    return [], False
                return valid_items[:50], True
            elif isinstance(data, dict):
                return [data], True
            return [], False
        except Exception as e:
            logger.debug(f"JSON parsing error: {e}")
            return [], False
