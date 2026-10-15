"""
AI Text Analysis Detector for ClearClick AI
Inspects page copy for guilt-tripping (confirm-shaming), deceptive double negatives,
and masked fee wording with strict anti-hallucination quote verification and status tracking.
"""

from typing import List, Tuple
from ..schema import PageData, Finding, ExtractedElement
from .client import AIClient
from .quote_verifier import QuoteVerifier


SYSTEM_PROMPT = """You are ClearClick AI, a specialised design fairness auditor.
Your job is to identify potentially misleading linguistic patterns in visible web text.
Focus ONLY on three categories:
1. hidden_charges (wording that hides or softens costs)
2. cancellation (guilt-tripping, confirm-shaming, emotional manipulation to prevent cancellation)
3. consent (confusing double negatives, deceptive wording in consent choices)

RULES:
- Return ONLY a valid JSON array of objects. No intro, no markdown explanation outside the JSON.
- If nothing is wrong, return an empty array: []
- Every finding MUST contain an exact verbatim quote (at least 12 characters) from the text as 'evidence'. Do not paraphrase.
- Use objective, cautious language ('may mislead', 'potentially obscures'), NEVER legal accusations or words like 'fraud' or 'scam'.
- JSON schema for each item:
[
  {
    "category": "hidden_charges" | "cancellation" | "consent",
    "type": "confirm_shaming" | "double_negative_language" | "hidden_cost_language",
    "severity": "low" | "medium" | "high",
    "confidence": 0.85,
    "evidence": "<exact verbatim quote>",
    "why": "<one or two plain sentences explaining how this may mislead>",
    "safer_alternative": "<concrete fairer design alternative>"
  }
]
"""


class AITextDetector:
    def __init__(self):
        self.client = AIClient()

    async def detect(self, page_data: PageData) -> Tuple[List[Finding], str, str]:
        text = page_data.visible_text.strip()
        if not text or len(text) < 15:
            return [], "not_run", "AI text analysis not run (insufficient page text)"

        user_prompt = f"Analyze the following visible text from a webpage for dark patterns:\n\n---\n{text[:4000]}\n---"
        
        raw_items, status, status_msg = await self.client.analyze_text(SYSTEM_PROMPT, user_prompt)
        findings: List[Finding] = []

        for item in raw_items:
            try:
                ev = str(item.get("evidence", "")).strip()
                matched_bbox = self._find_matching_bbox(ev, page_data)

                finding = Finding(
                    category=item.get("category", "consent"),
                    type=item.get("type", "ai_text_finding"),
                    severity=item.get("severity", "medium"),
                    confidence=float(item.get("confidence", 0.80)),
                    evidence=ev,
                    bbox=matched_bbox,
                    why=str(item.get("why", "Text phrasing may confuse or mislead users.")),
                    safer_alternative=str(item.get("safer_alternative", "Use clear, direct phrasing.")),
                    source="ai"
                )
                findings.append(finding)
            except Exception:
                continue

        # Strictly enforce Anti-Hallucination verification: prune any finding without exact page quote
        verified = QuoteVerifier.filter_findings(findings, page_data.visible_text)
        return verified, status, status_msg

    def _find_matching_bbox(self, quote: str, page_data: PageData) -> List[float]:
        """Attempt to match quote to bounding box of an element containing the quote."""
        if not quote:
            return [0.0, 0.0, 0.0, 0.0]

        clean_quote = quote.lower().strip()
        all_elements: List[ExtractedElement] = page_data.buttons + page_data.links + page_data.prices
        for el in all_elements:
            el_text = el.text.strip().lower()
            if clean_quote in el_text or el_text in clean_quote:
                if el.bbox and len(el.bbox) == 4 and any(v > 0 for v in el.bbox):
                    return el.bbox

        return [0.0, 0.0, 0.0, 0.0]
