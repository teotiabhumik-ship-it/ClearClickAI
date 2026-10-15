"""
Misleading Cancellation Detector for ClearClick AI
Detects:
1. Buried or de-emphasized cancellation links (buried_cancel_link)
2. Confirm-shaming and guilt-tripping language (confirm_shaming)
3. Asymmetric step counts and retention mazes (asymmetric_cancellation_steps)
"""

import re
from typing import List, Optional
from ..schema import PageData, Finding, ExtractedElement, FlowData
from .base import BaseDetector


CANCEL_KEYWORDS = [
    r"cancel\s+(?:subscription|account|membership|plan)",
    r"request\s+cancellation",
    r"end\s+membership",
    r"terminate\s+subscription",
]

CONFIRM_SHAMING_PATTERNS = [
    r"\b(?:i\s+(?:hate|prefer\s+to\s+pay\s+full|don'?t\s+care\s+about\s+losing|want\s+worse|like\s+overpaying))\b",
    r"\b(?:no\s+thanks,?\s+i\s+(?:don'?t\s+want|prefer\s+to\s+lose|hate))\b",
    r"\b(?:break\s+(?:our\s+)?hearts?|mascot\s+is\s+crying|make\s+us\s+sad)\b",
]

FORCED_OFFLINE_PATTERNS = [
    r"\b(?:must\s+call|online\s+cancellation\s+is\s+not\s+supported)\b",
    r"\bcall\s+our\s+(?:retention|support|department|hotline|telephone)\b",
    r"\bsubmit\s+a\s+written\s+(?:letter|mail|notice)\b",
]


class CancellationDetector(BaseDetector):
    category = "cancellation"

    def detect(self, page_data: PageData) -> List[Finding]:
        findings: List[Finding] = []

        # 1. Buried cancellation links
        for link in page_data.links:
            is_cancel_text = any(re.search(kw, link.text, re.IGNORECASE) for kw in CANCEL_KEYWORDS)
            if is_cancel_text:
                is_small = link.font_size_px <= 11.0
                is_faint = link.contrast_ratio < 4.0 or link.color.lower() in ["#94a3b8", "#9ca3af", "#cbd5e1", "gray"]
                
                # Check prominence relative to primary buttons
                has_prominent_buttons = any(b.font_size_px >= 12.0 for b in page_data.buttons) or len(page_data.buttons) > 0

                if (is_small or is_faint) and has_prominent_buttons:
                    findings.append(Finding(
                        category="cancellation",
                        type="buried_cancel_link",
                        severity="high",
                        confidence=0.92,
                        evidence=f"Cancellation link: '{link.text.strip()}' rendered in {link.font_size_px}px with color {link.color} (contrast: {link.contrast_ratio}:1)",
                        bbox=link.bbox,
                        why="The cancellation mechanism is hidden in small, low-contrast text embedded within a paragraph or footer, making it substantially harder to locate than account upgrade actions.",
                        safer_alternative="Provide a clear, standard-sized 'Cancel Subscription' button with neutral styling in account management.",
                        source="rule"
                    ))

        # 2. Confirm-shaming wording
        all_interactive = page_data.buttons + page_data.links
        for el in all_interactive:
            for pattern in CONFIRM_SHAMING_PATTERNS:
                match = re.search(pattern, el.text, re.IGNORECASE)
                if match:
                    findings.append(Finding(
                        category="cancellation",
                        type="confirm_shaming",
                        severity="medium",
                        confidence=0.96,
                        evidence=el.text.strip(),
                        bbox=el.bbox,
                        why="The cancellation decline option utilizes emotional manipulation and guilt-inducing phrasing ('confirm-shaming') to dissuade the user from cancelling.",
                        safer_alternative="Use neutral, objective action labels such as 'Proceed with Cancellation' or 'Keep My Plan'.",
                        source="rule"
                    ))
                    break

        # Also check page visible text for confirm-shaming if not already in interactive element
        if not any(f.type == "confirm_shaming" for f in findings):
            for pattern in CONFIRM_SHAMING_PATTERNS:
                match = re.search(pattern, page_data.visible_text, re.IGNORECASE)
                if match:
                    findings.append(Finding(
                        category="cancellation",
                        type="confirm_shaming",
                        severity="medium",
                        confidence=0.90,
                        evidence=match.group(0),
                        bbox=[0.0, 0.0, 0.0, 0.0],
                        why="The cancellation screen uses emotionally manipulative copy to induce guilt in users attempting to cancel.",
                        safer_alternative="Maintain neutral and informative tone throughout cancellation dialogues.",
                        source="rule"
                    ))
                    break

        # 3. Asymmetric cancellation friction (multi-step text or forced offline hurdles)
        step_match = re.search(r"step\s+(\d+)\s+of\s+(\d+)", page_data.visible_text, re.IGNORECASE)
        is_retention_flow = any(kw in page_data.visible_text.lower() for kw in ["retention", "cancel", "stay", "survey", "questionnaire"])
        if step_match and is_retention_flow:
            current_step = int(step_match.group(1))
            total_steps = int(step_match.group(2))
            
            if total_steps >= 3 or current_step >= 3:
                findings.append(Finding(
                    category="cancellation",
                    type="asymmetric_cancellation_steps",
                    severity="high",
                    confidence=0.93,
                    evidence=f"Multi-step cancellation process ({step_match.group(0)}) requiring {total_steps} sequential screens",
                    bbox=[0.0, 0.0, 0.0, 0.0],
                    why=f"Cancelling requires navigating a {total_steps}-step retention maze designed to introduce cognitive fatigue, while signing up typically takes 1 step.",
                    safer_alternative="Enable users to cancel with a straightforward process that matches signup simplicity (ideally 1 to 2 clear steps).",
                    source="rule"
                ))

        # Check for forced offline barriers (e.g. required phone call / postal mail to cancel)
        for pattern in FORCED_OFFLINE_PATTERNS:
            offline_match = re.search(pattern, page_data.visible_text, re.IGNORECASE)
            if offline_match and is_retention_flow:
                findings.append(Finding(
                    category="cancellation",
                    type="asymmetric_cancellation_steps",
                    severity="high",
                    confidence=0.95,
                    evidence=f"Forced offline barrier: '{offline_match.group(0)}'",
                    bbox=[0.0, 0.0, 0.0, 0.0],
                    why="The service allows online signup in seconds, but imposes artificial friction by forcing users to call a phone number or send physical mail to cancel.",
                    safer_alternative="Provide self-serve online cancellation directly within the account dashboard.",
                    source="rule"
                ))
                break

        return findings

    def detect_flow(self, flow: FlowData) -> List[Finding]:
        """
        Multi-step flow analysis: counts the exact number of screens in a recorded cancellation session.
        """
        findings = []
        if flow.flow_type == "cancellation" and len(flow.steps) >= 3:
            findings.append(Finding(
                category="cancellation",
                type="asymmetric_cancellation_steps",
                severity="high",
                confidence=0.95,
                evidence=f"Cancellation flow requires {len(flow.steps)} sequential interaction steps",
                bbox=[0.0, 0.0, 0.0, 0.0],
                why=f"Cancelling requires navigating through {len(flow.steps)} distinct screens with retention offers or surveys, creating asymmetric friction compared to simple onboarding.",
                safer_alternative="Offer immediate 1-click or 2-click cancellation without intervening survey walls.",
                source="rule"
            ))
        return findings
