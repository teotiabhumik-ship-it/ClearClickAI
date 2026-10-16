"""
Hidden Charges Detector for ClearClick AI
Detects:
1. Micro-print fees and low-contrast cost disclosures (microprint_fee, low_contrast_fee)
2. Late-appearing charges and price inflation across flow steps (drip_pricing)
3. Pre-selected bundled fee add-ons (bundled_hidden_fee)
"""

import re
from typing import List, Optional
from ..schema import PageData, Finding, ExtractedElement, FlowData
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

# AidUI-derived Urgency & Scarcity Patterns (Table II & Section III-D1)
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
        baseline_price_size = self._find_headline_price_size(page_data.prices)

        for price_el in page_data.prices:
            is_fee_text = any(re.search(kw, price_el.text, re.IGNORECASE) for kw in FEE_KEYWORDS)
            
            if is_fee_text:
                # Check font size disparity (microprint is <= 10px or <= 35% of main price headline)
                is_microprint = price_el.font_size_px <= 10.0 or (
                    baseline_price_size > 0 and price_el.font_size_px <= baseline_price_size * 0.35
                )
                if is_microprint:
                    findings.append(Finding(
                        category="hidden_charges",
                        type="microprint_fee",
                        severity="high",
                        confidence=0.91,
                        evidence=f"Fee disclosure: '{price_el.text.strip()}' rendered at {price_el.font_size_px}px (baseline headline: {baseline_price_size}px)",
                        bbox=price_el.bbox,
                        why="A mandatory surcharge or renewal cost is rendered in diminutive micro-print font, making it easy for users to miss the true cost before purchasing.",
                        safer_alternative="Display mandatory fees in standard, legible font size directly alongside the advertised headline rate.",
                        source="rule"
                    ))

                # Contextual contrast: check if fee text contrast is significantly impaired (< 4.0:1)
                is_low_contrast = price_el.contrast_ratio < 4.0
                if is_low_contrast:
                    findings.append(Finding(
                        category="hidden_charges",
                        type="low_contrast_fee",
                        severity="high",
                        confidence=0.94,
                        evidence=f"Fee: '{price_el.text.strip()}' contrast is {price_el.contrast_ratio}:1 (below WCAG 4.5:1 minimum on resolved background)",
                        bbox=price_el.bbox,
                        why="Fee details are displayed using faint, low-contrast text against the background, impairing readability and obscuring the final price.",
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
                        severity="high",
                        confidence=0.92,
                        evidence=box.label.strip(),
                        bbox=box.bbox,
                        why="An optional paid add-on is pre-selected by default, adding unexpected cost to the purchase total without requiring explicit opt-in.",
                        safer_alternative="Present paid add-ons as un-checked options requiring affirmative user selection.",
                        source="rule"
                    ))

        # 3. Check for single-page drip pricing (initial advertised vs final total jump)
        drip_finding = self._detect_single_page_drip_pricing(page_data)
        if drip_finding:
            findings.append(drip_finding)

        # 4. AidUI Rules: Countdown Timers, Scarcity, High Demand & Social Proof
        findings.extend(self._detect_countdown_timers(page_data))
        findings.extend(self._detect_low_stock_scarcity(page_data))
        findings.extend(self._detect_high_demand_scarcity(page_data))
        findings.extend(self._detect_activity_messages(page_data))

        return findings

    def _detect_countdown_timers(self, page_data: PageData) -> List[Finding]:
        findings = []
        all_elements = page_data.prices + page_data.buttons + page_data.links
        full_text = page_data.visible_text

        for pat in COUNTDOWN_TIMER_PATTERNS:
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                match_str = m.group(0).strip()
                bbox = [0.0, 0.0, 0.0, 0.0]
                for el in all_elements:
                    if match_str.lower() in el.text.lower() or el.text.lower() in match_str.lower():
                        bbox = el.bbox
                        break

                findings.append(Finding(
                    category="hidden_charges",
                    type="countdown_timer",
                    severity="medium",
                    confidence=0.88,
                    evidence=f"Countdown timer detected: '{match_str}'",
                    bbox=bbox,
                    why="A ticking countdown timer creates high urgency pressure, nudging users to bypass deliberate purchasing decisions.",
                    safer_alternative="State standard promotional deadlines without artificial ticking timers unless part of a genuine live auction or scheduled broadcast.",
                    source="rule"
                ))
                break
        return findings

    def _detect_low_stock_scarcity(self, page_data: PageData) -> List[Finding]:
        findings = []
        all_elements = page_data.prices + page_data.buttons + page_data.links
        full_text = page_data.visible_text

        for pat in LOW_STOCK_PATTERNS:
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                match_str = m.group(0).strip()
                bbox = [0.0, 0.0, 0.0, 0.0]
                for el in all_elements:
                    if match_str.lower() in el.text.lower() or el.text.lower() in match_str.lower():
                        bbox = el.bbox
                        break

                findings.append(Finding(
                    category="hidden_charges",
                    type="low_stock_scarcity",
                    severity="medium",
                    confidence=0.86,
                    evidence=f"Low stock pressure cue: '{match_str}'",
                    bbox=bbox,
                    why="Highlighting extreme low inventory creates artificial scarcity pressure to force impulsive checkout.",
                    safer_alternative="Provide factual inventory status (e.g., 'In Stock') without emotive hurry banners unless inventory is genuinely exhausted.",
                    source="rule"
                ))
                break
        return findings

    def _detect_high_demand_scarcity(self, page_data: PageData) -> List[Finding]:
        findings = []
        all_elements = page_data.prices + page_data.buttons + page_data.links
        full_text = page_data.visible_text

        for pat in HIGH_DEMAND_PATTERNS:
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                match_str = m.group(0).strip()
                bbox = [0.0, 0.0, 0.0, 0.0]
                for el in all_elements:
                    if match_str.lower() in el.text.lower() or el.text.lower() in match_str.lower():
                        bbox = el.bbox
                        break

                findings.append(Finding(
                    category="hidden_charges",
                    type="high_demand_scarcity",
                    severity="medium",
                    confidence=0.85,
                    evidence=f"High-demand alert: '{match_str}'",
                    bbox=bbox,
                    why="Displaying real-time viewer counts or high-demand alerts exploits competition anxiety to rush the user through payment.",
                    safer_alternative="Allow consumers to review listings without intrusive live viewer tallies.",
                    source="rule"
                ))
                break
        return findings

    def _detect_activity_messages(self, page_data: PageData) -> List[Finding]:
        findings = []
        all_elements = page_data.prices + page_data.buttons + page_data.links
        full_text = page_data.visible_text

        for pat in ACTIVITY_MESSAGE_PATTERNS:
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                match_str = m.group(0).strip()
                bbox = [0.0, 0.0, 0.0, 0.0]
                for el in all_elements:
                    if match_str.lower() in el.text.lower() or el.text.lower() in match_str.lower():
                        bbox = el.bbox
                        break

                findings.append(Finding(
                    category="hidden_charges",
                    type="activity_message",
                    severity="low",
                    confidence=0.82,
                    evidence=f"Social proof sales activity: '{match_str}'",
                    bbox=bbox,
                    why="Displaying rapid recent sales numbers leverages bandwagon effects to influence immediate buying behavior.",
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

        if initial_headline and final_total and final_total > initial_headline * 1.20:
            # Detect fees introduced in intermediate/final steps
            new_fees = []
            for step in flow.steps[1:]:
                for p in step.prices:
                    if any(re.search(kw, p.text, re.IGNORECASE) for kw in FEE_KEYWORDS):
                        new_fees.append(p.text.strip())

            findings.append(Finding(
                category="hidden_charges",
                type="drip_pricing",
                severity="high",
                confidence=0.95,
                evidence=f"Price increased across flow from ${initial_headline:.2f} (Step 1) to ${final_total:.2f} (Step {len(flow.steps)}) via late-added fees: {', '.join(new_fees[:3]) or 'undisclosed surcharges'}",
                bbox=[0.0, 0.0, 0.0, 0.0],
                why=f"The price increased by {(final_total - initial_headline)/initial_headline:.1%} between initial product viewing and final checkout due to compulsory fees not disclosed on the first screen.",
                safer_alternative="Quote an all-inclusive price on the first step of the booking or checkout journey.",
                source="rule"
            ))

        return findings

    def _find_headline_price_size(self, prices: List[ExtractedElement]) -> float:
        headline_size = 0.0
        for p in prices:
            if re.search(r"[\$€£₹]\s*\d+", p.text) and p.font_size_px > headline_size:
                headline_size = p.font_size_px
        return headline_size

    def _extract_largest_price(self, page_data: PageData) -> Optional[float]:
        values = []
        for p in page_data.prices:
            m = re.search(r"[\$€£₹]\s*(\d+(?:\.\d{2})?)", p.text)
            if m:
                values.append(float(m.group(1)))
        return max(values) if values else None

    def _detect_single_page_drip_pricing(self, page_data: PageData) -> Optional[Finding]:
        # Normalize whitespace across newlines
        norm_text = " ".join(page_data.visible_text.split())
        
        # Generic match: advertised/initial price vs final total
        init_match = re.search(r"(?:advertised\s+(?:ticket\s+)?price|initial\s+price|starting\s+(?:at|price))\s*[:\-]?\s*[\$€£₹]\s*(\d+(?:\.\d{2})?)", norm_text, re.IGNORECASE)
        total_match = re.search(r"(?:final\s+total|order\s+total|grand\s+total)\s*[:\-]?\s*[\$€£₹]\s*(\d+(?:\.\d{2})?)", norm_text, re.IGNORECASE)
        
        # Generic search for any fee additions (e.g. "Delivery Fee: $9.50")
        detected_fees = re.findall(r"[A-Za-z\s]{3,30}(?:fee|surcharge|charge)\s*[:\-]?\s*[\$€£₹]\s*\d+(?:\.\d{2})?", norm_text, re.IGNORECASE)

        if init_match and total_match and len(detected_fees) >= 1:
            init_val = float(init_match.group(1))
            total_val = float(total_match.group(1))
            
            if total_val > init_val * 1.15:
                clean_fees = [f.strip() for f in detected_fees]
                return Finding(
                    category="hidden_charges",
                    type="drip_pricing",
                    severity="high",
                    confidence=0.93,
                    evidence=f"Advertised price ${init_val:.2f} inflated to final total ${total_val:.2f} via late-added fees: {', '.join(clean_fees[:3])}",
                    bbox=[0.0, 0.0, 0.0, 0.0],
                    why="The initial price displayed to the user is significantly lower than the final total due to compulsory fees added at the payment summary.",
                    safer_alternative="Quote an all-inclusive total upfront from the first step of the booking or checkout flow.",
                    source="rule"
                )
        return None
