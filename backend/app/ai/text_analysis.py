"""
AI Text Analysis Detector for ClearClick AI
Inspects page copy for guilt-tripping (confirm-shaming), deceptive double negatives,
and masked fee wording with strict anti-hallucination quote verification.
"""

from typing import List
from ..schema import PageData, Finding
from .client import AIClient
from .quote_verifier import QuoteVerifier


SYSTEM_PROMPT = """You are ClearClick AI, a specialised design fairness auditor.
Your job is to identify potentially misleading linguistic patterns in visible web text.
Focus ONLY on three categories:
1. hidden_charges (wording that hides or softens costs)
2. cancellation (guilt-tripping, confirm-shaming, emotional manipulation to prevent cancellation)
3. consent (confusing double negatives, deceptive wording in consent choices)

RULES:
- Return ONLY a valid JSON array of objects. No intro, no markdown explanation.
- If nothing is wrong, return an empty array: []
- Every finding MUST contain an exact verbatim quote from the text as 'evidence'. Do not paraphrase.
- Use objective, cautious language ('may mislead', 'potentially obscures'), NEVER legal accusations or words like 'fraud' or 'scam'.
- JSON schema for each item:
  {
    "category": "hidden_charges" | "cancellation" | "consent",
    "type": "confirm_shaming" | "double_negative_language" | "hidden_cost_language",
    "severity": "low" | "medium" | "high",
    "confidence": 0.85,
    "evidence": "<exact verbatim quote>",
    "why": "<one or two plain sentences explaining how this may mislead>",
    "safer_alternative": "<concrete fairer design alternative>"
  }
"""


class AITextDetector:
    def __init__(self):
        self.client = AIClient()

    async def detect(self, page_data: PageData) -> List[Finding]:
        text = page_data.visible_text.strip()
        if not text or len(text) < 15:
            return []

        user_prompt = f"Analyze the following visible text from a webpage for dark patterns:\n\n---\n{text[:3000]}\n---"
        
        raw_items = await self.client.analyze_text(SYSTEM_PROMPT, user_prompt)
        findings: List[Finding] = []

        for item in raw_items:
            try:
                finding = Finding(
                    category=item.get("category", "consent"),
                    type=item.get("type", "ai_text_finding"),
                    severity=item.get("severity", "medium"),
                    confidence=float(item.get("confidence", 0.80)),
                    evidence=str(item.get("evidence", "")),
                    bbox=[0.0, 0.0, 0.0, 0.0],
                    why=str(item.get("why", "")),
                    safer_alternative=str(item.get("safer_alternative", "")),
                    source="ai"
                )
                findings.append(finding)
            except Exception:
                continue

        # Strictly enforce Anti-Hallucination verification: prune any finding without exact page quote
        verified = QuoteVerifier.filter_findings(findings, page_data.visible_text)
        return verified
