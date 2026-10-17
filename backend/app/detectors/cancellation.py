"""
Misleading Cancellation Detector for ClearClick AI
Detects:
1. Buried or de-emphasized cancellation links (buried_cancel_link)
2. Confirm-shaming and guilt-tripping language (confirm_shaming)
3. Asymmetric step counts and retention mazes (asymmetric_cancellation_steps)
4. Forced offline cancellation requirements (forced_offline_cancellation)
5. Nagging review prompts and gamified retention gates
Thresholds and severity mappings centralized in backend/app/config/thresholds.py.
"""

import re
from typing import List, Optional
from ..schema import PageData, Finding, ExtractedElement, FlowData
from ..config.thresholds import (
    CANCEL_LINK_MAX_FONT_PX,
    CANCEL_LINK_MAX_CONTRAST,
    CANCEL_RETENTION_MAZE_STEPS,
    SEVERITY_MAPPING,
)
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

# AidUI-derived Nagging & Gamification Patterns
NAGGING_REVIEW_PATTERNS = [
    r"(?:enjoying|love|like)\s+(?:our\s+)?(?:app|service|website)\??\s+(?:rate|review|give\s+us\s+\d+\s+stars)",
    r"\b(?:rate\s+us\s+now|give\s+us\s+5\s+stars|rate\s+this\s+app)\b.*(?:ask\s+me\s+later|not\s+now|maybe\s+later)",
    r"\b(?:please\s+rate|leave\s+(?:a\s+)?review)\b.*(?:★|stars?|later)",
]

GAMIFICATION_PATTERNS = [
    r"(?:invite|refer|ask)\s+(\d+|\w+)?\s*friends\s+to\s+(?:unlock|earn|get|receive|access)",
    r"(?:sign\s*up|register)\s+for\s+(\d+)?\s*(?:credits|points|tokens|spins|coins)",
    r"watch\s+(?:an?\s+)?(?:ad|video|session)\s+to\s+(?:continue|unlock|proceed|earn)",
]


class CancellationDetector(BaseDetector):
    category = "cancellation"

    def detect(self, page_data: PageData) -> List[Finding]:
        findings: List[Finding] = []

        # 1. Buried cancellation links (flag only elements related to cancel actions)
        for link in page_data.links:
            is_cancel_text = any(re.search(kw, link.text, re.IGNORECASE) for kw in CANCEL_KEYWORDS)
            if is_cancel_text:
                max_button_font = max((b.font_size_px for b in page_data.buttons), default=0.0)
                is_small = link.font_size_px <= CANCEL_LINK_MAX_FONT_PX or (
                    max_button_font > 0 and link.font_size_px <= max_button_font * 0.65
                )
                is_faint = link.contrast_ratio < CANCEL_LINK_MAX_CONTRAST or link.color.lower() in ["#94a3b8", "#9ca3af", "#cbd5e1", "gray"]
                
                # Check prominence relative to primary buttons
                has_prominent_buttons = any(b.font_size_px >= 12.0 for b in page_data.buttons) or len(page_data.buttons) > 0

                if (is_small or is_faint) and has_prominent_buttons:
                    evidence_str = (
                        f"Cancellation link: '{link.text.strip()}' rendered in {link.font_size_px}px with color {link.color} "
                        f"(contrast: {link.contrast_ratio}:1, compared to primary button font: {max_button_font:.0f}px)"
                    ) if max_button_font > 0 else f"Cancellation link: '{link.text.strip()}' rendered in {link.font_size_px}px with color {link.color} (contrast: {link.contrast_ratio}:1)"
                    findings.append(Finding(
                        category="cancellation",
                        type="buried_cancel_link",
                        severity=SEVERITY_MAPPING.get("buried_cancel_link", "high"),
                        confidence=0.92,
                        evidence=evidence_str,
                        element_id=link.element_id or link.id,
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
                        severity=SEVERITY_MAPPING.get("confirm_shaming", "medium"),
                        confidence=0.96,
                        evidence=el.text.strip(),
                        element_id=el.element_id or el.id,
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
                        severity=SEVERITY_MAPPING.get("confirm_shaming", "medium"),
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
            cur_step = int(step_match.group(1))
            total_steps = int(step_match.group(2))

            if total_steps >= CANCEL_RETENTION_MAZE_STEPS or cur_step >= CANCEL_RETENTION_MAZE_STEPS:
                findings.append(Finding(
                    category="cancellation",
                    type="asymmetric_cancellation_steps",
                    severity=SEVERITY_MAPPING.get("asymmetric_cancellation_steps", "high"),
                    confidence=0.94,
                    evidence=f"Cancellation requires {total_steps} sequential confirmation steps ({step_match.group(0)})",
                    bbox=[0.0, 0.0, 0.0, 0.0],
                    why="Cancelling the service requires navigating through multiple sequential screens, creating substantial friction compared to onboarding.",
                    safer_alternative="Allow cancellation through a streamlined, single-step confirmation dialogue.",
                    source="rule"
                ))

        # 4. Forced offline cancellation
        for pattern in FORCED_OFFLINE_PATTERNS:
            match = re.search(pattern, page_data.visible_text, re.IGNORECASE)
            if match and is_retention_flow:
                findings.append(Finding(
                    category="cancellation",
                    type="asymmetric_cancellation_steps",
                    severity=SEVERITY_MAPPING.get("asymmetric_cancellation_steps", "high"),
                    confidence=0.95,
                    evidence=match.group(0),
                    bbox=[0.0, 0.0, 0.0, 0.0],
                    why="Users who signed up online are prevented from cancelling online, forcing them to call phone hotlines or mail physical letters.",
                    safer_alternative="Provide immediate, automated online cancellation on the same platform where signup occurred (FTC Click-to-Cancel rule).",
                    source="rule"
                ))
                break

        # 5. AidUI Rule: Detect nagging app reviews
        findings.extend(self._detect_nagging_reviews(page_data))

        # 6. AidUI Rule: Detect forced referral / gamified gating
        findings.extend(self._detect_gamification_referrals(page_data))

        return findings

    def _detect_nagging_reviews(self, page_data: PageData) -> List[Finding]:
        findings = []
        for pat in NAGGING_REVIEW_PATTERNS:
            m = re.search(pat, page_data.visible_text, re.IGNORECASE)
            if m:
                match_str = m.group(0).strip()
                bbox = [0.0, 0.0, 0.0, 0.0]
                for btn in page_data.buttons + page_data.links:
                    if any(w in btn.text.lower() for w in ["rate", "later", "review", "star"]):
                        bbox = btn.bbox
                        break

                findings.append(Finding(
                    category="cancellation",
                    type="nagging_review",
                    severity=SEVERITY_MAPPING.get("nagging_review", "medium"),
                    confidence=0.88,
                    evidence=f"Persistent rating prompt: '{match_str[:60]}...'",
                    bbox=bbox,
                    why="Repeated intrusive rating dialogues disrupt normal workflows and lack an explicit permanent dismissal option.",
                    safer_alternative="Place feedback and rating requests passively inside account or settings menus.",
                    source="rule"
                ))
                break
        return findings

    def _detect_gamification_referrals(self, page_data: PageData) -> List[Finding]:
        findings = []
        all_elements = page_data.buttons + page_data.links
        full_text = page_data.visible_text

        for pat in GAMIFICATION_PATTERNS:
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                match_str = m.group(0).strip()
                bbox = [0.0, 0.0, 0.0, 0.0]
                el_id = None
                for el in all_elements:
                    if match_str.lower() in el.text.lower() or el.text.lower() in match_str.lower():
                        bbox = el.bbox
                        el_id = el.element_id or el.id
                        break

                findings.append(Finding(
                    category="cancellation",
                    type="gamification_referral",
                    severity=SEVERITY_MAPPING.get("gamification_referral", "medium"),
                    confidence=0.86,
                    evidence=f"Forced referral / gamified gating: '{match_str}'",
                    element_id=el_id,
                    bbox=bbox,
                    why="Gating application functionality or discounts behind mandatory contact recruitment or ad watching turns users into involuntary promoters.",
                    safer_alternative="Offer direct transparent pricing and features without viral referral walls or mandatory ad viewing.",
                    source="rule"
                ))
                break
        return findings

    def detect_flow(self, flow: FlowData) -> List[Finding]:
        """
        Multi-step flow analysis: counts the exact number of screens in a recorded cancellation session.
        """
        findings = []
        if flow.flow_type == "cancellation" and len(flow.steps) >= CANCEL_RETENTION_MAZE_STEPS:
            findings.append(Finding(
                category="cancellation",
                type="asymmetric_cancellation_steps",
                severity=SEVERITY_MAPPING.get("asymmetric_cancellation_steps", "high"),
                confidence=0.95,
                evidence=f"Cancellation flow requires {len(flow.steps)} sequential interaction steps",
                bbox=[0.0, 0.0, 0.0, 0.0],
                why=f"Cancelling requires navigating through {len(flow.steps)} distinct screens with retention offers or surveys, creating asymmetric friction compared to simple onboarding.",
                safer_alternative="Offer immediate 1-click or 2-click cancellation without intervening survey walls.",
                source="rule"
            ))
        return findings
