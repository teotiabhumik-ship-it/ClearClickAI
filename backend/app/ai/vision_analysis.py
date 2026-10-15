"""
AI Vision Analysis Detector for ClearClick AI
Analyzes page screenshots for visual asymmetry, visual prominence manipulation,
and obscured disclosures, mapping findings to DOM bounding boxes.
"""

from typing import List, Tuple, Dict, Any, Optional
from ..schema import PageData, Finding, ExtractedElement
from .client import AIClient


VISION_SYSTEM_PROMPT = """You are ClearClick AI Vision Auditor, an expert in UI visual hierarchy and deception analysis.
Analyze the provided web page screenshot to evaluate visual prominence and fairness.

FOCUS STRICTLY ON THREE VISUAL DECEPTION TYPES:
1. "unequal_button_emphasis" (Consent/Choice): An 'Accept All' or 'Confirm' action has high visual weight (solid bright primary color, large padding), while 'Reject All', 'Decline', or 'Settings' is severely visually degraded (faint gray text link, invisible border, hidden in background).
2. "obscured_charge_visual" (Hidden Charges): Vital fee, auto-renewal, or price information is placed in visually subdued locations (washed out against gradient/image, tiny font, outside normal visual path).
3. "visual_cancellation_obstacle" (Cancellation): The cancellation action is visually minimized or visually masked, while retention or downgrade buttons dominate the modal.

RULES:
- Return ONLY a valid JSON array of objects. No markdown explanations outside JSON.
- If the design is fair and balanced, return an empty array: []
- Be neutral and objective in explanations ('may bias attention toward...', 'visually downplays alternative option').
- Do not accuse of illegality or fraud.
- Schema:
[
  {
    "category": "consent" | "hidden_charges" | "cancellation",
    "type": "unequal_button_emphasis" | "obscured_charge_visual" | "visual_cancellation_obstacle",
    "severity": "low" | "medium" | "high",
    "confidence": 0.85,
    "evidence": "<describe visual cue, e.g. High-contrast #2563eb 'Accept All' vs faint #9ca3af text link 'Reject'>",
    "target_element_text": "<text of the specific button, link, or text element involved>",
    "why": "<plain explanation of visual imbalance>",
    "safer_alternative": "<fair visual alternative, e.g. give equal visual weight to Accept and Reject>"
  }
]
"""


class AIVisionDetector:
    def __init__(self):
        self.client = AIClient()

    async def detect(self, page_data: PageData) -> Tuple[List[Finding], str, str]:
        """
        Executes vision analysis on page screenshot.
        Returns: (findings_list, status, status_message)
        """
        if not page_data.screenshot_base64:
            return [], "not_run", "AI vision analysis not run (no screenshot available)"

        # Prepare element context for LLM
        element_summaries = []
        for btn in page_data.buttons[:10]:
            element_summaries.append(f"Button: '{btn.text}' (color: {btn.color}, bg: {btn.background_color}, size: {btn.font_size_px}px)")
        for lnk in page_data.links[:10]:
            element_summaries.append(f"Link: '{lnk.text}' (color: {lnk.color}, bg: {lnk.background_color}, size: {lnk.font_size_px}px)")

        user_prompt = (
            "Examine this webpage screenshot for visual dark patterns.\n"
            f"Page Title: {page_data.title or 'Unknown'}\n"
            "Key Detected Interactive Elements:\n" + "\n".join(element_summaries[:15]) +
            "\n\nIdentify any visual asymmetries, obscured fees, or visual obstacles."
        )

        raw_items, status, status_msg = await self.client.analyze_vision(
            system_prompt=VISION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            image_base64=page_data.screenshot_base64
        )

        findings: List[Finding] = []
        for item in raw_items:
            try:
                target_text = item.get("target_element_text", "").strip().lower()
                matched_bbox = self._find_matching_bbox(target_text, page_data)

                finding = Finding(
                    category=item.get("category", "consent"),
                    type=item.get("type", "visual_asymmetry"),
                    severity=item.get("severity", "medium"),
                    confidence=float(item.get("confidence", 0.85)),
                    evidence=str(item.get("evidence", "Visual emphasis asymmetry")),
                    bbox=matched_bbox,
                    why=str(item.get("why", "Visual layout creates unbalanced user choice.")),
                    safer_alternative=str(item.get("safer_alternative", "Present options with balanced visual prominence.")),
                    source="ai"
                )
                findings.append(finding)
            except Exception:
                continue

        return findings, status, status_msg

    def _find_matching_bbox(self, target_text: str, page_data: PageData) -> List[float]:
        """Attempt to match the target element from the vision finding to an extracted element's bbox."""
        if not target_text:
            return [0.0, 0.0, 0.0, 0.0]

        all_elements: List[ExtractedElement] = page_data.buttons + page_data.links + page_data.prices
        for el in all_elements:
            el_text = el.text.strip().lower()
            if target_text in el_text or el_text in target_text:
                if el.bbox and len(el.bbox) == 4 and any(v > 0 for v in el.bbox):
                    return el.bbox

        return [0.0, 0.0, 0.0, 0.0]
