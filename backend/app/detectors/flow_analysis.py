"""
Flow Analysis Engine for Multi-Step Journeys
Analyzes ordered sequences of user interaction screens/steps (e.g. checkout, subscription cancellation).
Extracts screen semantics and compares:
1. Price changes and late-appearing fee disclosures across steps (drip pricing)
2. Number of interaction steps required for cancellation vs onboarding (retention maze)
Deterministic code strictly controls decisions, calculations, and severity mappings.
"""

import re
from typing import List, Dict, Any, Optional
from ..schema import FlowData, PageData, Finding, ExtractedElement
from ..config.thresholds import (
    DRIP_PRICING_FLOW_RATIO,
    CANCEL_RETENTION_MAZE_STEPS,
    SEVERITY_MAPPING,
)
from .hidden_charges import FEE_KEYWORDS
from .cancellation import CANCEL_KEYWORDS


FLOW_STEP_EXTRACTION_PROMPT = """You are ClearClick AI Flow Auditor.
Your job is to extract transactional facts from this screen in a multi-step user flow.
Extract:
1. screen_purpose: A brief label for the screen (e.g. "product_selection", "add_ons", "order_summary", "cancellation_retention", "confirmation").
2. visible_prices: A list of numbers (floats) representing prices, fees, or subtotals visible on this screen.
3. button_labels: A list of button or link labels on this screen.

Return ONLY a valid JSON object matching:
{
  "screen_purpose": "<string>",
  "visible_prices": [<number>, ...],
  "button_labels": ["<string>", ...]
}
"""


class FlowAnalyzer:
    """
    Analyzes multi-step user interaction flows.
    """

    @classmethod
    async def extract_step_semantics(cls, step: PageData, client: Optional[Any] = None) -> Dict[str, Any]:
        """
        Extract screen purpose, visible prices/fees, and button labels from a step.
        Uses AI if available, falling back to DOM measurements.
        """
        fallback_prices = []
        for p in step.prices:
            m = re.search(r"[\$€£₹]\s*(\d+(?:\.\d{2})?)", p.text)
            if m:
                try:
                    fallback_prices.append(float(m.group(1)))
                except ValueError:
                    pass
        fallback_buttons = [b.text.strip() for b in step.buttons + step.links if b.text.strip()][:10]
        fallback_purpose = "interaction_step"
        if any(re.search(kw, step.visible_text, re.IGNORECASE) for kw in CANCEL_KEYWORDS):
            fallback_purpose = "cancellation"
        elif any(re.search(kw, step.visible_text, re.IGNORECASE) for kw in FEE_KEYWORDS):
            fallback_purpose = "fee_disclosure"

        if client and getattr(client, "has_any_key", False):
            try:
                user_prompt = f"""<untrusted_page_content>
Page Title: {step.title or 'Unknown'}
Page Text: {step.visible_text[:2000]}
Detected Prices: {[p.text for p in step.prices[:10]]}
Detected Buttons: {fallback_buttons}
</untrusted_page_content>

Extract screen_purpose, visible_prices, and button_labels strictly as JSON.
"""
                items, status, _ = await client.analyze_text(FLOW_STEP_EXTRACTION_PROMPT, user_prompt)
                if status in ("ran", "completed") and items and isinstance(items[0], dict):
                    ai_dict = items[0]
                    prices = [float(x) for x in ai_dict.get("visible_prices", []) if isinstance(x, (int, float))]
                    return {
                        "screen_purpose": str(ai_dict.get("screen_purpose", fallback_purpose)),
                        "visible_prices": prices or fallback_prices,
                        "button_labels": [str(x) for x in ai_dict.get("button_labels", fallback_buttons)],
                    }
            except Exception:
                pass

        return {
            "screen_purpose": fallback_purpose,
            "visible_prices": fallback_prices,
            "button_labels": fallback_buttons
        }

    @classmethod
    async def analyze_flow_async(
        cls,
        flow: FlowData,
        client: Optional[Any] = None
    ) -> List[Finding]:
        """Execute async flow analysis with AI-assisted step semantic extraction."""
        step_extractions = []
        for step in flow.steps:
            info = await cls.extract_step_semantics(step, client=client)
            step_extractions.append(info)
        return cls.analyze_flow(flow, step_ai_extractions=step_extractions)

    @classmethod
    def analyze_flow(
        cls,
        flow: FlowData,
        step_ai_extractions: Optional[List[Dict[str, Any]]] = None
    ) -> List[Finding]:
        """
        Execute deterministic flow evaluation across ordered steps.
        Optional step_ai_extractions provides per-step screen purpose and extracted prices.
        """
        findings: List[Finding] = []
        steps = flow.steps
        if len(steps) < 2:
            return findings

        # 1. Price Inflation & Late-Appearing Fees Comparison
        first_step = steps[0]
        last_step = steps[-1]

        initial_price = cls._extract_step_headline_price(first_step, step_idx=0, ai_metadata=step_ai_extractions)
        final_price = cls._extract_step_total_price(last_step, step_idx=len(steps)-1, ai_metadata=step_ai_extractions)

        if initial_price and final_price and final_price > initial_price * DRIP_PRICING_FLOW_RATIO:
            pct_increase = ((final_price - initial_price) / initial_price) * 100

            # Identify which intermediate or final steps introduced new fees
            late_fees: List[str] = []
            for idx, step in enumerate(steps[1:], start=2):
                step_fees = []
                for p in step.prices:
                    if any(re.search(kw, p.text, re.IGNORECASE) for kw in FEE_KEYWORDS):
                        step_fees.append(p.text.strip())
                if step_fees:
                    late_fees.append(f"Step {idx}: {', '.join(step_fees[:2])}")

            evidence_str = (
                f"Price increased by {pct_increase:.1f}% across flow: "
                f"${initial_price:.2f} (Step 1) -> ${final_price:.2f} (Step {len(steps)}). "
                f"Late-added charges: {'; '.join(late_fees) if late_fees else 'undisclosed fees at checkout'}"
            )

            findings.append(Finding(
                category="hidden_charges",
                type="drip_pricing",
                severity=SEVERITY_MAPPING.get("drip_pricing", "high"),
                confidence=0.95,
                evidence=evidence_str,
                bbox=[0.0, 0.0, 0.0, 0.0],
                why=f"The price increased by {pct_increase:.1f}% between initial product selection and payment completion due to compulsory charges withheld from the initial screen.",
                safer_alternative="Display an all-inclusive price upfront on Step 1, including all mandatory surcharges and fees.",
                source="rule"
            ))

        # 2. Step Asymmetry Comparison (Cancellation Retention Maze & signup vs cancel comparison)
        is_cancel = (flow.flow_type == "cancellation") or any(
            any(re.search(kw, s.visible_text, re.IGNORECASE) for kw in CANCEL_KEYWORDS)
            for s in steps
        )

        signup_steps_count = getattr(flow, "signup_steps_count", 1)
        if is_cancel and len(steps) > signup_steps_count and len(steps) >= CANCEL_RETENTION_MAZE_STEPS:
            findings.append(Finding(
                category="cancellation",
                type="asymmetric_cancellation_steps",
                severity=SEVERITY_MAPPING.get("asymmetric_cancellation_steps", "high"),
                confidence=0.95,
                evidence=f"Cancellation requires {len(steps)} interaction steps vs. {signup_steps_count} step for signup ({len(steps)}:1 friction ratio)",
                bbox=[0.0, 0.0, 0.0, 0.0],
                why=f"Cancelling requires traversing {len(steps)} screens with retention prompts, surveys, and multi-step confirmations, creating severe asymmetric friction compared to {signup_steps_count}-step onboarding.",
                safer_alternative="Allow cancellation in equal or fewer steps than signup without interstitial survey or offer walls.",
                source="rule"
            ))
        elif is_cancel and len(steps) >= CANCEL_RETENTION_MAZE_STEPS:
            findings.append(Finding(
                category="cancellation",
                type="asymmetric_cancellation_steps",
                severity=SEVERITY_MAPPING.get("asymmetric_cancellation_steps", "high"),
                confidence=0.95,
                evidence=f"Cancellation flow requires {len(steps)} sequential interaction steps (threshold: {CANCEL_RETENTION_MAZE_STEPS} steps)",
                bbox=[0.0, 0.0, 0.0, 0.0],
                why=f"Cancelling requires traversing {len(steps)} screens with retention prompts, surveys, and multi-step confirmations, creating asymmetric friction compared to onboarding.",
                safer_alternative="Allow cancellation in 1 or 2 straightforward steps without interstitial survey or offer walls.",
                source="rule"
            ))

        return findings

    @classmethod
    def _extract_step_headline_price(
        cls,
        step: PageData,
        step_idx: int = 0,
        ai_metadata: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[float]:
        # Check if AI extracted prices
        if ai_metadata and step_idx < len(ai_metadata):
            ai_prices = ai_metadata[step_idx].get("visible_prices", [])
            if ai_prices:
                return float(min(ai_prices))

        values = []
        for p in step.prices:
            m = re.search(r"[\$€£₹]\s*(\d+(?:\.\d{2})?)", p.text)
            if m:
                values.append(float(m.group(1)))
        return min(values) if values else None

    @classmethod
    def _extract_step_total_price(
        cls,
        step: PageData,
        step_idx: int = 0,
        ai_metadata: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[float]:
        if ai_metadata and step_idx < len(ai_metadata):
            ai_prices = ai_metadata[step_idx].get("visible_prices", [])
            if ai_prices:
                return float(max(ai_prices))

        values = []
        for p in step.prices:
            m = re.search(r"[\$€£₹]\s*(\d+(?:\.\d{2})?)", p.text)
            if m:
                values.append(float(m.group(1)))
        return max(values) if values else None
