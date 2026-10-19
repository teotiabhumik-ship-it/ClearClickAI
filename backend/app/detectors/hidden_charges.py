"""
Hidden Charges Detector for ClearClick AI
Detects:
1. Micro-print fees and low-contrast cost disclosures (microprint_fee, low_contrast_fee)
2. Late-appearing charges and price inflation across flow steps (drip_pricing)
3. Pre-selected bundled fee add-ons (bundled_hidden_fee)
4. Urgency and scarcity claims (countdown_timer_urgency, fake_scarcity_low_stock, etc.)
Thresholds and severity mappings centralized in backend/app/config/thresholds.py.
"""

import re
from typing import List, Optional, Tuple
from ..schema import PageData, Finding, ExtractedElement, FlowData
from ..config.thresholds import (
    FEE_RELATIVE_FONT_SIZE_RATIO,
    FEE_ABSOLUTE_MICROPRINT_FONT_PX,
    FEE_LOW_CONTRAST_THRESHOLD,
    DRIP_PRICING_FLOW_RATIO,
    DRIP_PRICING_SINGLE_PAGE_RATIO,
    SEVERITY_MAPPING,
)
from .base import BaseDetector


FEE_KEYWORDS = [
    r"resort\s+(?:fee|charge)",
    r"maintenance\s+(?:fee|charge)",
    r"delivery\s+(?:fee|charge)",
    r"facilities\s+(?:fee|charge)",
    r"service\s+(?:fee|charge|surcharge)",
    r"processing\s+(?:fee|surcharge)",
    r"handling\s+(?:fee|charge)",
    r"booking\s+(?:fee|surcharge)",
    r"operational\s+(?:fee|surcharge)",
    r"cleaning\s+(?:fee|charge)",
    r"fuel\s+surcharge",
    r"auto[- ]renews?\s+at",
    r"credit\s+card\s+(?:fee|surcharge|charge)",
]

BUNDLED_ADDON_KEYWORDS = [
    r"warranty",
    r"care\s+plan",
    r"protection",
    r"insurance",
    r"donation",
    r"tip",
]

# AidUI-derived Urgency & Scarcity Patterns
COUNTDOWN_TIMER_PATTERNS = [
    r"(?:sale|deal|offer|discount|flash\s+sale)\s+(?:ends|expires|countdown|ends\s+in)\s*[:\-]?\s*(\d{1,2}:\d{2}(?::\d{2})?|\d+\s*(?:hours?|mins?|minutes?|secs?|seconds?))",
    r"\b(?:ends\s+in|expires\s+in|time\s+left)\s*[:\-]?\s*(\d{1,2}:\d{2}(?::\d{2})?)\b",
    r"\b\d{1,2}:\d{2}:\d{2}\b(?=.*(?:sale|deal|ends|hurry|offer|expires|countdown|now))",
]

LOW_STOCK_PATTERNS = [
    r"\bonly\s+(\d+|one|two|three|four|five)\s+(?:left\s+in\s+stock|remaining|in\s+stock|left|available)\b",
    r"\b(?:almost\s+sold\s+out|hurry,?\s+only\s+\d+\s+left)\b",
    r"\b(?:order|order\s+within)\s+\d+\s+(?:hours?|mins?|minutes?)\s+for\s+(?:delivery|dispatch|same\s*day)\b",
]

HIGH_DEMAND_PATTERNS = [
    r"(\d+)\s+(?:people|travelers|guests|viewers|shoppers)\s+(?:are\s+)?(?:viewing|looking\s+at|checking|browsing)\s+(?:this|now)(?:\s+right\s+now)?",
    r"\b(?:in\s+high\s+demand|selling\s+fast|booked\s+\d+\s+times\s+today)\b",
]

ACTIVITY_MESSAGE_PATTERNS = [
    r"(\d+)\s+(?:items?|units?|rooms?|tickets?)\s+(?:sold|bought|purchased|reserved)\s+in\s+the\s+last\s+(\d+|24|48)?\s*(?:hours?|days?|today)",
    r"\b(\d+)\s+people\s+bought\s+this\s+(?:recently|today|in\s+the\s+last\s+\d+\s+hours?)\b",
]


class HiddenChargesDetector(BaseDetector):
    category = "hidden_charges"

    def detect(self, page_data: PageData) -> List[Finding]:
        findings: List[Finding] = []

        # 1. Inspect price elements and surrounding fee notes
        baseline_price_size, baseline_contrast = self._find_headline_price_metrics(page_data.prices)

        for price_el in page_data.prices:
            is_fee_text = any(re.search(kw, price_el.text, re.IGNORECASE) for kw in FEE_KEYWORDS)
            
            # Flag only elements related to fees
            if is_fee_text:
                # Relative font size comparison against baseline price headline on same page
                if baseline_price_size > 0:
                    is_microprint = price_el.font_size_px <= baseline_price_size * FEE_RELATIVE_FONT_SIZE_RATIO
                else:
                    is_microprint = price_el.font_size_px <= FEE_ABSOLUTE_MICROPRINT_FONT_PX

                if is_microprint:
                    evidence_str = (
                        f"Fee disclosure: '{price_el.text.strip()}' rendered at {price_el.font_size_px}px "
                        f"(relative to headline {baseline_price_size:.0f}px, ratio {price_el.font_size_px / max(baseline_price_size, 1.0):.2f})"
                    ) if baseline_price_size > 0 else f"Fee disclosure: '{price_el.text.strip()}' rendered at {price_el.font_size_px}px"
                    findings.append(Finding(
                        category="hidden_charges",
                        type="microprint_fee",
                        severity=SEVERITY_MAPPING.get("microprint_fee", "high"),
                        confidence=0.91,
                        evidence=evidence_str,
                        element_id=price_el.element_id or price_el.id,
                        bbox=price_el.bbox,
                        why="A mandatory surcharge or renewal cost is rendered in diminutive micro-print font compared to the main price, making it easy for users to miss the true cost before purchasing.",
                        safer_alternative="Display mandatory fees in standard, legible font size directly alongside the advertised headline rate.",
                        source="rule"
                    ))

                # Contrast is an absolute readability measurement. A lower ratio
                # than the headline price alone is not a violation: a 6.5:1 fee
                # remains WCAG-readable even when the headline is black on white.
                is_low_contrast = price_el.contrast_ratio < FEE_LOW_CONTRAST_THRESHOLD

                if is_low_contrast:
                    evidence_str = (
                        f"Fee: '{price_el.text.strip()}' contrast is {price_el.contrast_ratio}:1 "
                        f"(relative to baseline {baseline_contrast:.1f}:1, below WCAG 4.5:1 minimum on resolved background)"
                    ) if baseline_contrast > 0 else f"Fee: '{price_el.text.strip()}' contrast is {price_el.contrast_ratio}:1 (below WCAG 4.5:1 minimum on resolved background)"
                    findings.append(Finding(
                        category="hidden_charges",
                        type="low_contrast_fee",
                        severity=SEVERITY_MAPPING.get("low_contrast_fee", "high"),
                        confidence=0.94,
                        evidence=evidence_str,
                        element_id=price_el.element_id or price_el.id,
                        bbox=price_el.bbox,
                        why="Fee details are displayed using faint, low-contrast text relative to the main price, impairing readability and obscuring the final price.",
                        safer_alternative="Render all pricing notices with at least 4.5:1 contrast against their background (WCAG AA compliant).",
                        source="rule"
                    ))

        # 2. Check for pre-ticked bundled fee add-ons
        for box in page_data.checkboxes:
            if box.checked:
                has_price = bool(re.search(r"[\$€£₹]\s*\d+", box.label))
                has_addon = any(re.search(kw, box.label, re.IGNORECASE) for kw in BUNDLED_ADDON_KEYWORDS)
                if has_price and has_addon:
                    findings.append(Finding(
                        category="hidden_charges",
                        type="bundled_hidden_fee",
                        severity=SEVERITY_MAPPING.get("bundled_hidden_fee", "high"),
                        confidence=0.92,
                        evidence=box.label.strip(),
                        element_id=box.element_id or box.id,
                        bbox=box.bbox,
                        why="A supplementary fee, paid warranty, or paid add-on is bundled and pre-selected by default, adding unexpected cost to the purchase.",
                        safer_alternative="Present all add-on products and warranties with un-ticked checkboxes, requiring affirmative opt-in.",
                        source="rule"
                    ))

        # 3. Check for single-page drip pricing in checkout summaries
        single_page_drip = self._detect_single_page_drip_pricing(page_data)
        if single_page_drip:
            findings.append(single_page_drip)

        # 4. AidUI Rule: Detect countdown timer urgency
        findings.extend(self._detect_countdown_timers(page_data))

        # 5. AidUI Rule: Detect fake scarcity / low stock claims
        findings.extend(self._detect_fake_scarcity(page_data))

        # 6. AidUI Rule: Detect high demand social proof
        findings.extend(self._detect_high_demand(page_data))

        # 7. AidUI Rule: Detect activity messages
        findings.extend(self._detect_activity_messages(page_data))

        return findings

    def _detect_countdown_timers(self, page_data: PageData) -> List[Finding]:
        findings = []
        for pat in COUNTDOWN_TIMER_PATTERNS:
            match = re.search(pat, page_data.visible_text, re.IGNORECASE)
            if match:
                match_text = match.group(0).strip()
                bbox = [0.0, 0.0, 0.0, 0.0]
                for p in page_data.prices + page_data.buttons:
                    if match_text.lower() in p.text.lower():
                        bbox = p.bbox
                        break

                findings.append(Finding(
                    category="hidden_charges",
                    type="countdown_timer",
                    severity=SEVERITY_MAPPING.get("countdown_timer", "medium"),
                    confidence=0.88,
                    evidence=f"Urgency timer claim: '{match_text}'",
                    bbox=bbox,
                    why="Countdown timers create artificial time pressure, prompting hurried purchases before users can scrutinize hidden charges or terms.",
                    safer_alternative="State clear sale deadlines without animated or deceptive countdown tickers.",
                    source="rule"
                ))
                break
        return findings

    def _detect_fake_scarcity(self, page_data: PageData) -> List[Finding]:
        findings = []
        for pat in LOW_STOCK_PATTERNS:
            match = re.search(pat, page_data.visible_text, re.IGNORECASE)
            if match:
                match_text = match.group(0).strip()
                bbox = [0.0, 0.0, 0.0, 0.0]
                for p in page_data.prices + page_data.buttons:
                    if match_text.lower() in p.text.lower():
                        bbox = p.bbox
                        break

                findings.append(Finding(
                    category="hidden_charges",
                    type="low_stock_scarcity",
                    severity=SEVERITY_MAPPING.get("low_stock_scarcity", "medium"),
                    confidence=0.87,
                    evidence=f"Scarcity claim: '{match_text}'",
                    bbox=bbox,
                    why="Aggressive scarcity warnings ('only 1 left in stock') pressure users into expedited purchases without comparing prices or verifying hidden fees.",
                    safer_alternative="Display actual inventory status transparently without alarmist phrasing.",
                    source="rule"
                ))
                break
        return findings

    def _detect_high_demand(self, page_data: PageData) -> List[Finding]:
        findings = []
        for pat in HIGH_DEMAND_PATTERNS:
            match = re.search(pat, page_data.visible_text, re.IGNORECASE)
            if match:
                match_text = match.group(0).strip()
                findings.append(Finding(
                    category="hidden_charges",
                    type="high_demand_scarcity",
                    severity=SEVERITY_MAPPING.get("high_demand_scarcity", "medium"),
                    confidence=0.85,
                    evidence=f"Social proof pressure: '{match_text}'",
                    bbox=[0.0, 0.0, 0.0, 0.0],
                    why="Displaying real-time viewer counts uses artificial social proof to induce fear of missing out (FOMO), leading users to accept unverified costs.",
                    safer_alternative="Allow consumers to review options at their own pace without simulated competition.",
                    source="rule"
                ))
                break
        return findings

    def _detect_activity_messages(self, page_data: PageData) -> List[Finding]:
        findings = []
        for pat in ACTIVITY_MESSAGE_PATTERNS:
            match = re.search(pat, page_data.visible_text, re.IGNORECASE)
            if match:
                match_text = match.group(0).strip()
                findings.append(Finding(
                    category="hidden_charges",
                    type="activity_message",
                    severity=SEVERITY_MAPPING.get("activity_message", "medium"),
                    confidence=0.85,
                    evidence=f"Activity notification: '{match_text}'",
                    bbox=[0.0, 0.0, 0.0, 0.0],
                    why="Highlighting recent purchases creates urgency by implying limited availability or surging demand.",
                    safer_alternative="Allow users to evaluate products on their own merits and verified long-term reviews.",
                    source="rule"
                ))
                break
        return findings

    def detect_flow(self, flow: FlowData) -> List[Finding]:
        """
        Multi-step flow analysis: compares advertised price on initial step vs final total on checkout step.
        """
        findings = []
        if len(flow.steps) < 2:
            return findings

        first_step = flow.steps[0]
        last_step = flow.steps[-1]

        initial_headline = self._extract_largest_price(first_step)
        final_total = self._extract_largest_price(last_step)

        if initial_headline and final_total and final_total > initial_headline * DRIP_PRICING_FLOW_RATIO:
            # Detect fees introduced in intermediate/final steps
            new_fees = []
            for step in flow.steps[1:]:
                for p in step.prices:
                    if any(re.search(kw, p.text, re.IGNORECASE) for kw in FEE_KEYWORDS):
                        new_fees.append(p.text.strip())

            findings.append(Finding(
                category="hidden_charges",
                type="drip_pricing",
                severity=SEVERITY_MAPPING.get("drip_pricing", "high"),
                confidence=0.95,
                evidence=f"Price increased across flow from ${initial_headline:.2f} (Step 1) to ${final_total:.2f} (Step {len(flow.steps)}) via late-added fees: {', '.join(new_fees[:3]) or 'undisclosed surcharges'}",
                bbox=[0.0, 0.0, 0.0, 0.0],
                why=f"The price increased by {(final_total - initial_headline)/initial_headline:.1%} between initial product viewing and final checkout due to compulsory fees not disclosed on the first screen.",
                safer_alternative="Quote an all-inclusive price on the first step of the booking or checkout journey.",
                source="rule"
            ))

        return findings

    def _find_headline_price_metrics(self, prices: List[ExtractedElement]) -> Tuple[float, float]:
        headline_size = 0.0
        headline_contrast = 21.0
        # Exclude fee-labeled elements when searching for primary headline price
        for p in prices:
            is_fee = any(re.search(kw, p.text, re.IGNORECASE) for kw in FEE_KEYWORDS)
            if not is_fee and re.search(r"[\$€£₹]\s*\d+", p.text) and p.font_size_px > headline_size:
                headline_size = p.font_size_px
                headline_contrast = p.contrast_ratio

        # Fallback if all prices contain fee keywords
        if headline_size == 0.0:
            for p in prices:
                if re.search(r"[\$€£₹]\s*\d+", p.text) and p.font_size_px > headline_size:
                    headline_size = p.font_size_px
                    headline_contrast = p.contrast_ratio

        return headline_size, headline_contrast

    def _extract_largest_price(self, page_data: PageData) -> Optional[float]:
        values = []
        for p in page_data.prices:
            m = re.search(r"[\$€£₹]\s*(\d+(?:\.\d{2})?)", p.text)
            if m:
                values.append(float(m.group(1)))
        return max(values) if values else None

    def _detect_single_page_drip_pricing(self, page_data: PageData) -> Optional[Finding]:
        norm_text = " ".join(page_data.visible_text.split())
        
        init_match = re.search(r"(?:advertised\s+(?:ticket\s+)?price|initial\s+price|starting\s+(?:at|price))\s*[:\-]?\s*[\$€£₹]\s*(\d+(?:\.\d{2})?)", norm_text, re.IGNORECASE)
        total_match = re.search(r"(?:final\s+total|order\s+total|grand\s+total)\s*[:\-]?\s*[\$€£₹]\s*(\d+(?:\.\d{2})?)", norm_text, re.IGNORECASE)
        
        detected_fees = re.findall(r"[A-Za-z\s]{3,30}(?:fee|surcharge|charge)\s*[:\-]?\s*[\$€£₹]\s*\d+(?:\.\d{2})?", norm_text, re.IGNORECASE)

        if init_match and total_match and len(detected_fees) >= 1:
            init_val = float(init_match.group(1))
            total_val = float(total_match.group(1))
            
            if total_val > init_val * DRIP_PRICING_SINGLE_PAGE_RATIO:
                clean_fees = [f.strip() for f in detected_fees]
                return Finding(
                    category="hidden_charges",
                    type="drip_pricing",
                    severity=SEVERITY_MAPPING.get("drip_pricing", "high"),
                    confidence=0.93,
                    evidence=f"Advertised price ${init_val:.2f} inflated to final total ${total_val:.2f} via late-added fees: {', '.join(clean_fees[:3])}",
                    bbox=[0.0, 0.0, 0.0, 0.0],
                    why="The initial price displayed to the user is significantly lower than the final total due to compulsory fees added at the payment summary.",
                    safer_alternative="Quote an all-inclusive total upfront from the first step of the booking or checkout flow.",
                    source="rule"
                )
        return None
