"""
Hidden Charges Detector for ClearClick AI
Detects:
1. Micro-print fees and low-contrast cost disclosures (microprint_fee, low_contrast_fee)
2. Late-appearing charges and price inflation in multi-step checkouts (drip_pricing)
"""

import re
from typing import List
from ..schema import PageData, Finding, ExtractedElement
from .base import BaseDetector


FEE_KEYWORDS = [
    r"resort\s+fee",
    r"maintenance\s+fee",
    r"delivery\s+fee",
    r"facilities\s+fee",
    r"service\s+(?:fee|charge)",
    r"processing\s+(?:fee|surcharge)",
    r"handling\s+fee",
    r"booking\s+(?:fee|surcharge)",
    r"fuel\s+surcharge",
]


class HiddenChargesDetector(BaseDetector):
    category = "hidden_charges"

    def detect(self, page_data: PageData) -> List[Finding]:
        findings: List[Finding] = []

        # 1. Inspect price elements and surrounding fee notes
        baseline_price_size = self._find_headline_price_size(page_data.prices)

        for price_el in page_data.prices:
            # Check for micro-print fee
            is_fee_text = any(re.search(kw, price_el.text, re.IGNORECASE) for kw in FEE_KEYWORDS)
            
            if is_fee_text:
                # Check font size disparity (microprint is <= 10px or <= 35% of main price headline)
                if price_el.font_size_px <= 10.0 or (baseline_price_size > 0 and price_el.font_size_px <= baseline_price_size * 0.35):
                    findings.append(Finding(
                        category="hidden_charges",
                        type="microprint_fee",
                        severity="high",
                        confidence=0.91,
                        evidence=f"Fee: '{price_el.text.strip()}' rendered at {price_el.font_size_px}px (headline price: {baseline_price_size}px)",
                        bbox=price_el.bbox,
                        why="A mandatory surcharge is rendered in diminutive micro-print font, making it easy for users to miss the true cost before purchasing.",
                        safer_alternative="Display mandatory fees in standard, legible font size directly alongside the advertised headline rate.",
                        source="rule"
                    ))

                # Check for low contrast
                if price_el.contrast_ratio < 4.0:
                    findings.append(Finding(
                        category="hidden_charges",
                        type="low_contrast_fee",
                        severity="high",
                        confidence=0.94,
                        evidence=f"Fee: '{price_el.text.strip()}' has contrast ratio {price_el.contrast_ratio}:1 (below WCAG 4.5:1 minimum)",
                        bbox=price_el.bbox,
                        why="Fee details are displayed using faint, low-contrast text against the background, impairing readability and obscuring the final price.",
                        safer_alternative="Render all pricing notices with at least 4.5:1 contrast against their background (WCAG AA compliant).",
                        source="rule"
                    ))

        # 2. Check for drip pricing / late unexpected fee addition
        drip_finding = self._detect_drip_pricing(page_data)
        if drip_finding:
            findings.append(drip_finding)

        return findings

    def _find_headline_price_size(self, prices: List[ExtractedElement]) -> float:
        headline_size = 0.0
        for p in prices:
            # If element has large font and currency symbol
            if re.search(r"[\$€£₹]\s*\d+", p.text) and p.font_size_px > headline_size:
                headline_size = p.font_size_px
        return headline_size

    def _detect_drip_pricing(self, page_data: PageData) -> Finding | None:
        text = page_data.visible_text
        
        # Check for initial advertised vs final total discrepancy
        init_match = re.search(r"(?:advertised\s+(?:ticket\s+)?price|initial\s+price|starting\s+at)\s*[:\-]?\s*[\$€£₹]\s*(\d+(?:\.\d{2})?)", text, re.IGNORECASE)
        total_match = re.search(r"(?:final\s+total|order\s+total|total\s+amount)\s*[:\-]?\s*[\$€£₹]\s*(\d+(?:\.\d{2})?)", text, re.IGNORECASE)
        
        fee_count = len(re.findall(r"(?:delivery\s+fee|facilities\s+fee|processing\s+surcharge|convenience\s+fee|service\s+fee)", text, re.IGNORECASE))

        if init_match and total_match and fee_count >= 2:
            init_val = float(init_match.group(1))
            total_val = float(total_match.group(1))
            
            if total_val > init_val * 1.25:  # Over 25% price inflation due to incremental fees
                evidence_fees = [m.group(0) for m in re.finditer(r"(?:Electronic Delivery Fee|Venue Facilities Fee|Payment Processing Surcharge|Convenience Fee)[^\n]*", text, re.IGNORECASE)]
                return Finding(
                    category="hidden_charges",
                    type="drip_pricing",
                    severity="high",
                    confidence=0.93,
                    evidence=f"Advertised price ${init_val:.2f} inflated to final total ${total_val:.2f} via late-added fees: {', '.join(evidence_fees[:3])}",
                    bbox=[0.0, 0.0, 0.0, 0.0],
                    why="The initial price displayed to the user is significantly lower than the final total due to compulsory service fees added only in later checkout steps.",
                    safer_alternative="Quote an all-inclusive total upfront from the first step of the booking or checkout flow.",
                    source="rule"
                )
        return None
