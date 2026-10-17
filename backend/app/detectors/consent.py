"""
Manipulative Consent Detector for ClearClick AI
Detects:
1. Pre-ticked marketing / tracking checkboxes (preticked_consent)
2. Unequal button emphasis in cookie/privacy notices (unequal_button_emphasis)
3. Missing first-layer reject options (missing_reject_option)
4. Deceptive double negatives (double_negative_language)
5. Disguised ads (disguised_ads)
Thresholds and severity are centralized in backend/app/config/thresholds.py.
"""

import re
from typing import List
from ..schema import PageData, Finding, ExtractedCheckbox, ExtractedElement
from ..config.thresholds import (
    CONSENT_EQUAL_FONT_DIFF_PX,
    CONSENT_ACCEPT_MIN_CONTRAST,
    CONSENT_REJECT_MIN_CONTRAST,
    CONSENT_AREA_PARITY_THRESHOLD,
    CONSENT_ASYMMETRIC_AREA_RATIO,
    CONSENT_ASYMMETRIC_FONT_RATIO,
    CONSENT_REJECT_LOW_CONTRAST_THRESHOLD,
    DISGUISED_AD_MAX_FONT_PX,
    DISGUISED_AD_MIN_CONTRAST,
    SEVERITY_MAPPING,
)
from .base import BaseDetector


MARKETING_CONSENT_KEYWORDS = [
    r"promotional",
    r"marketing",
    r"partner",
    r"newsletter",
    r"third[- ]party",
    r"advertising",
    r"commercial\s+updates?",
    r"share\s+my\s+profile",
    r"tracking\s+cookies?",
    r"send\s+me\s+offers",
    r"ad\s*partner",
    r"vendor",
    r"telemetry",
    r"analytics",
    r"consent\s+to\s+profiling",
    r"data\s+sharing",
    r"share\s+(?:my\s+)?data",
]

DOUBLE_NEGATIVE_PATTERNS = [
    r"do\s+not\s+wish\s+to\s+not\s+receive",
    r"uncheck.*(?:do\s+not|never)\s+want\s+to\s+not",
    r"prevent\s+us\s+from\s+not\s+sharing",
    r"opt[- ]out\s+of\s+not\s+receiving",
]


class ConsentDetector(BaseDetector):
    category = "consent"

    def detect(self, page_data: PageData) -> List[Finding]:
        findings: List[Finding] = []
        
        # 1. Detect pre-ticked consent checkboxes
        findings.extend(self._detect_preticked(page_data.checkboxes))
        
        # 2. Detect unequal button emphasis & missing reject
        findings.extend(self._detect_cookie_banner_buttons(page_data.buttons, page_data.links, page_data.visible_text))
        
        # 3. Detect double-negative language in page text and checkbox labels
        findings.extend(self._detect_double_negatives(page_data))

        # 4. AidUI Rule: Detect disguised ads
        findings.extend(self._detect_disguised_ads(page_data))

        return findings

    def _detect_preticked(self, checkboxes: List[ExtractedCheckbox]) -> List[Finding]:
        findings = []
        for box in checkboxes:
            if not box.checked:
                continue
            
            label_lower = box.label.lower()

            # If the box uses deceptive double negatives, let the double negative detector handle it
            if any(re.search(pat, label_lower) for pat in DOUBLE_NEGATIVE_PATTERNS):
                continue

            # Exclude required terms of service / privacy policy acknowledgment
            if ("agree to the terms" in label_lower or "terms of service" in label_lower) and not any(
                kw in label_lower for kw in ["marketing", "promotional", "partner", "advertising", "telemetry", "share"]
            ):
                continue

            # Flag ONLY boxes whose label relates to consent, marketing, or data sharing
            matches = [kw for kw in MARKETING_CONSENT_KEYWORDS if re.search(kw, label_lower)]
            if matches:
                findings.append(Finding(
                    category="consent",
                    type="preticked_consent",
                    severity=SEVERITY_MAPPING.get("preticked_consent", "medium"),
                    confidence=0.92,
                    evidence=box.label.strip(),
                    element_id=box.element_id or box.id,
                    bbox=box.bbox,
                    why="This marketing or data-sharing option is pre-selected by default, enrolling the user unless they take affirmative action to uncheck it.",
                    safer_alternative="Provide an un-ticked checkbox requiring explicit, affirmative opt-in by the user.",
                    source="rule"
                ))
        return findings

    def _detect_cookie_banner_buttons(
        self,
        buttons: List[ExtractedElement],
        links: List[ExtractedElement],
        visible_text: str
    ) -> List[Finding]:
        findings = []
        
        # Identify cookie / consent context
        is_consent_context = any(
            term in visible_text.lower()
            for term in ["cookie", "privacy notice", "we value your privacy", "tracking", "preferences", "data privacy"]
        )
        if not is_consent_context:
            return findings

        accept_elements = [
            b for b in buttons + links
            if re.search(r"\b(accept(\s+all)?|agree|allow(\s+all)?|got\s+it)\b", b.text, re.IGNORECASE)
        ]
        
        reject_elements = [
            b for b in buttons + links
            if re.search(r"\b(reject(\s+all)?|decline|refuse|reject\s+optional|continue\s+without\s+accepting)\b", b.text, re.IGNORECASE)
        ]

        if accept_elements and not reject_elements:
            # Check if there is only "Manage Preferences" / "Customize"
            has_manage = any(
                re.search(r"\b(manage|settings|preferences|customize|more\s+options)\b", b.text, re.IGNORECASE)
                for b in buttons + links
            )
            if has_manage:
                acc = accept_elements[0]
                findings.append(Finding(
                    category="consent",
                    type="missing_reject_option",
                    severity=SEVERITY_MAPPING.get("missing_reject_option", "high"),
                    confidence=0.90,
                    evidence=f"Accept option available ('{acc.text}') but no direct Reject button on first layer",
                    element_id=acc.element_id or acc.id,
                    bbox=acc.bbox,
                    why="The first layer of the consent dialogue allows immediate agreement in one click, but forces users to navigate secondary menus to decline non-essential cookies.",
                    safer_alternative="Display a direct, equally accessible 'Reject Optional Cookies' button alongside 'Accept All'.",
                    source="rule"
                ))
        
        elif accept_elements and reject_elements:
            acc = accept_elements[0]
            rej = reject_elements[0]
            
            # Button asymmetry: compare Accept and Reject on size, contrast, and style
            acc_area = acc.bbox[2] * acc.bbox[3] if len(acc.bbox) == 4 and acc.bbox[2] > 0 and acc.bbox[3] > 0 else 0
            rej_area = rej.bbox[2] * rej.bbox[3] if len(rej.bbox) == 4 and rej.bbox[2] > 0 and rej.bbox[3] > 0 else 0

            # Equal check: similar font size, acceptable contrast, and comparable area
            font_diff = abs(acc.font_size_px - rej.font_size_px)
            has_equal_font = font_diff <= CONSENT_EQUAL_FONT_DIFF_PX
            both_have_contrast = acc.contrast_ratio >= CONSENT_ACCEPT_MIN_CONTRAST and rej.contrast_ratio >= CONSENT_REJECT_MIN_CONTRAST
            both_have_button_tag = acc.tag in ["button", "input"] and rej.tag in ["button", "input"]
            area_similar = (acc_area > 0 and rej_area > 0) and (abs(acc_area - rej_area) / max(acc_area, rej_area) < CONSENT_AREA_PARITY_THRESHOLD)

            if has_equal_font and both_have_contrast and both_have_button_tag and (area_similar or acc_area == 0):
                # Clean equal buttons: do not flag
                return findings

            # Otherwise check visual asymmetry indicators:
            area_asymmetric = acc_area > 0 and rej_area > 0 and (acc_area >= CONSENT_ASYMMETRIC_AREA_RATIO * rej_area)
            font_asymmetric = acc.font_size_px >= rej.font_size_px * CONSENT_ASYMMETRIC_FONT_RATIO
            reject_low_contrast = rej.contrast_ratio < CONSENT_REJECT_LOW_CONTRAST_THRESHOLD
            reject_link_style = rej.tag == "a" or (acc.tag in ["button", "input"] and rej.tag not in ["button", "input"])

            if area_asymmetric or font_asymmetric or reject_low_contrast or reject_link_style:
                evidence_str = (
                    f"Accept: '{acc.text}' (area: {acc_area:.0f}px², font: {acc.font_size_px}px, contrast: {acc.contrast_ratio}:1) vs "
                    f"Reject: '{rej.text}' (area: {rej_area:.0f}px², font: {rej.font_size_px}px, contrast: {rej.contrast_ratio}:1)"
                )
                findings.append(Finding(
                    category="consent",
                    type="unequal_button_emphasis",
                    severity=SEVERITY_MAPPING.get("unequal_button_emphasis", "medium"),
                    confidence=0.88,
                    evidence=evidence_str,
                    element_id=rej.element_id or rej.id or acc.element_id or acc.id,
                    bbox=rej.bbox if rej.bbox != [0, 0, 0, 0] else acc.bbox,
                    why="The Accept button uses high-contrast styling and visual prominence, whereas the Reject option is visually subdued, formatted as a faint link, or has inferior visual weight.",
                    safer_alternative="Present both 'Accept' and 'Reject' choices with equal visual weight, matching button shapes, and equivalent font styling.",
                    source="rule"
                ))

        return findings

    def _detect_double_negatives(self, page_data: PageData) -> List[Finding]:
        findings = []
        texts_to_check = [page_data.visible_text] + [b.label for b in page_data.checkboxes]
        for text in texts_to_check:
            for pattern in DOUBLE_NEGATIVE_PATTERNS:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    findings.append(Finding(
                        category="consent",
                        type="double_negative_language",
                        severity=SEVERITY_MAPPING.get("double_negative_language", "high"),
                        confidence=0.95,
                        evidence=match.group(0),
                        bbox=[0.0, 0.0, 0.0, 0.0],
                        why="The phrasing contains confusing double negatives ('do not wish to not receive') that may cause users to unintentionally agree to unwanted communications.",
                        safer_alternative="Use clear, direct affirmative wording such as 'Send me partner promotions' with an unchecked box.",
                        source="rule"
                    ))
                    break
        return findings

    def _detect_disguised_ads(self, page_data: PageData) -> List[Finding]:
        findings = []
        for el in page_data.links + page_data.buttons:
            text_clean = el.text.strip().lower()
            if text_clean in ["ad", "sponsored", "promoted", "advertisement"]:
                is_subdued = el.font_size_px <= DISGUISED_AD_MAX_FONT_PX or el.contrast_ratio < DISGUISED_AD_MIN_CONTRAST
                if is_subdued:
                    findings.append(Finding(
                        category="consent",
                        type="disguised_ads",
                        severity=SEVERITY_MAPPING.get("disguised_ads", "medium"),
                        confidence=0.85,
                        evidence=f"Disguised ad disclosure: '{el.text}' rendered in {el.font_size_px}px with low contrast ({el.contrast_ratio}:1)",
                        element_id=el.element_id or el.id,
                        bbox=el.bbox,
                        why="Advertising markers are visually degraded in tiny font and low contrast, disguising sponsored commercial links as regular editorial content.",
                        safer_alternative="Clearly label sponsored links with high-contrast, prominent 'Sponsored' badges.",
                        source="rule"
                    ))
                    break
        return findings
