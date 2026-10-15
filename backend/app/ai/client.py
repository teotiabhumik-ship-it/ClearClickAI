"""
Resilient LLM Client Adapter for ClearClick AI
Supports Claude (Anthropic), Gemini, or Heuristic Fallback when no API key is present.
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger("clearclick.ai")


class AIClient:
    def __init__(self):
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        
        self.has_anthropic = bool(self.anthropic_key)
        self.has_gemini = bool(self.gemini_key)

    async def analyze_text(self, system_prompt: str, user_prompt: str) -> List[Dict[str, Any]]:
        """
        Invoke LLM with strict JSON requirement. If no API key is set, returns empty list.
        """
        if self.has_anthropic:
            try:
                import anthropic
                client = anthropic.AsyncAnthropic(api_key=self.anthropic_key)
                response = await client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=1500,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}]
                )
                text_out = response.content[0].text
                return self._parse_json_list(text_out)
            except Exception as e:
                logger.warning(f"Anthropic API call failed: {e}")

        if self.has_gemini:
            try:
                from google import genai
                client = genai.Client(api_key=self.gemini_key)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=f"{system_prompt}\n\n{user_prompt}"
                )
                return self._parse_json_list(response.text)
            except Exception as e:
                logger.warning(f"Gemini API call failed: {e}")

        # When no API key is configured, return empty list (rule detectors handle core checks)
        return []

    def _parse_json_list(self, text: str) -> List[Dict[str, Any]]:
        try:
            # Strip markdown json code fences if present
            cleaned = text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            data = json.loads(cleaned.strip())
            return data if isinstance(data, list) else []
        except Exception:
            return []
