"""
Resilient Multi-Provider LLM Client for ClearClick AI
Supports Claude (Anthropic), Gemini (Google GenAI), and explicit status reporting.
Strictly implements build guide requirement:
If no API key is present or the call fails, reports 'AI analysis not run'.
"""

import os
import json
import base64
import logging
from typing import Optional, List, Dict, Any, Tuple

logger = logging.getLogger("clearclick.ai")


class AIClient:
    def __init__(self):
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        
        self.has_anthropic = bool(self.anthropic_key and self.anthropic_key.strip())
        self.has_gemini = bool(self.gemini_key and self.gemini_key.strip())

    @property
    def has_any_key(self) -> bool:
        return self.has_anthropic or self.has_gemini

    async def analyze_text(
        self,
        system_prompt: str,
        user_prompt: str
    ) -> Tuple[List[Dict[str, Any]], str, str]:
        """
        Analyze page copy with text LLM.
        Returns: (findings_list, status, status_message)
        where status is 'completed', 'not_run', or 'failed'.
        """
        if not self.has_any_key:
            return [], "not_run", "AI analysis not run (no API key configured)"

        # Try Anthropic Claude
        if self.has_anthropic:
            try:
                import anthropic
                client = anthropic.AsyncAnthropic(api_key=self.anthropic_key)
                response = await client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=2000,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}]
                )
                text_out = response.content[0].text
                items = self._parse_json_list(text_out)
                return items, "completed", "AI analysis completed via Claude 3.5 Sonnet"
            except Exception as e:
                logger.warning(f"Claude API call failed: {e}")
                if not self.has_gemini:
                    return [], "failed", f"AI analysis not run (Claude request failed: {type(e).__name__})"

        # Fallback to Gemini
        if self.has_gemini:
            try:
                from google import genai
                client = genai.Client(api_key=self.gemini_key)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=f"{system_prompt}\n\n{user_prompt}"
                )
                text_out = response.text or ""
                items = self._parse_json_list(text_out)
                return items, "completed", "AI analysis completed via Gemini 2.5 Flash"
            except Exception as e:
                logger.warning(f"Gemini API call failed: {e}")
                return [], "failed", f"AI analysis not run (Gemini request failed: {type(e).__name__})"

        return [], "not_run", "AI analysis not run (no API key configured)"

    async def analyze_vision(
        self,
        system_prompt: str,
        user_prompt: str,
        image_base64: str
    ) -> Tuple[List[Dict[str, Any]], str, str]:
        """
        Analyze screenshot with Multimodal Vision LLM.
        Returns: (findings_list, status, status_message)
        """
        if not image_base64 or not image_base64.strip():
            return [], "not_run", "AI vision analysis not run (no screenshot provided)"

        if not self.has_any_key:
            return [], "not_run", "AI vision analysis not run (no API key configured)"

        clean_base64 = image_base64
        if "base64," in clean_base64:
            clean_base64 = clean_base64.split("base64,")[1]

        # 1. Try Claude Multimodal
        if self.has_anthropic:
            try:
                import anthropic
                client = anthropic.AsyncAnthropic(api_key=self.anthropic_key)
                response = await client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=2000,
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
                )
                text_out = response.content[0].text
                items = self._parse_json_list(text_out)
                return items, "completed", "AI vision completed via Claude 3.5 Sonnet"
            except Exception as e:
                logger.warning(f"Claude Vision API call failed: {e}")
                if not self.has_gemini:
                    return [], "failed", f"AI vision analysis not run (Claude request failed: {type(e).__name__})"

        # 2. Try Gemini Multimodal
        if self.has_gemini:
            try:
                from google import genai
                from google.genai import types
                client = genai.Client(api_key=self.gemini_key)
                img_bytes = base64.b64decode(clean_base64)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[
                        types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
                        f"{system_prompt}\n\n{user_prompt}"
                    ]
                )
                text_out = response.text or ""
                items = self._parse_json_list(text_out)
                return items, "completed", "AI vision completed via Gemini 2.5 Flash"
            except Exception as e:
                logger.warning(f"Gemini Vision API call failed: {e}")
                return [], "failed", f"AI vision analysis not run (Gemini request failed: {type(e).__name__})"

        return [], "not_run", "AI vision analysis not run (no API key configured)"

    def _parse_json_list(self, text: str) -> List[Dict[str, Any]]:
        """Extract structured JSON list from LLM response text."""
        if not text:
            return []
        try:
            cleaned = text.strip()
            # If wrapped in markdown code fence
            if "```" in cleaned:
                # Find start of json block
                start = cleaned.find("```")
                end = cleaned.rfind("```")
                if start != -1 and end != -1 and end > start:
                    inner = cleaned[start:end]
                    # Strip ```json or ```
                    if inner.startswith("```json"):
                        inner = inner[7:]
                    elif inner.startswith("```"):
                        inner = inner[3:]
                    cleaned = inner.strip()

            # Sometimes LLM outputs [ ... ] with commentary before or after
            left_bracket = cleaned.find("[")
            right_bracket = cleaned.rfind("]")
            if left_bracket != -1 and right_bracket != -1 and right_bracket > left_bracket:
                cleaned = cleaned[left_bracket:right_bracket + 1]

            data = json.loads(cleaned)
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.debug(f"JSON parsing error: {e}")
            return []
