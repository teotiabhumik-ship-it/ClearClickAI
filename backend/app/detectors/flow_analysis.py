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
from ..schema import FlowData, PageData, Finding, ExtractedElement, FlowInteractionMetadata
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

        if not is_cancel:
            return findings

        signup_steps_count = getattr(flow, "signup_steps_count", 1)
        # ``model_fields_set`` lets us distinguish the legacy default of one
        # signup step from an explicit comparison supplied by a caller.
        signup_count_provided = "signup_steps_count" in getattr(flow, "model_fields_set", set())
        signup_metadata = getattr(flow, "signup_interaction_metadata", None)
        cancellation_metadata = getattr(flow, "cancellation_interaction_metadata", None)
        metadata_supplied = signup_metadata is not None or cancellation_metadata is not None

        signup_metrics = cls._interaction_metrics(signup_metadata)
        cancellation_metrics = cls._interaction_metrics(cancellation_metadata)
        comparable_metrics = [
            (label, signup_metrics[label], cancellation_metrics[label])
            for label in ("retention prompts", "required actions")
            if signup_metrics.get(label) is not None and cancellation_metrics.get(label) is not None
        ]
        metadata_is_ambiguous = metadata_supplied and not comparable_metrics
        metric_differences = [
            f"{label}: cancellation {cancel_count} vs signup {signup_count}"
            for label, signup_count, cancel_count in comparable_metrics
            if cancel_count != signup_count
        ]
        metric_friction = any(
            cancel_count > signup_count
            for _, signup_count, cancel_count in comparable_metrics
        )
        step_friction = signup_count_provided and len(steps) > signup_steps_count
        comparative_friction = step_friction or metric_friction

        if metadata_is_ambiguous and not comparative_friction:
            return findings + [cls._review_needed_finding(
                len(steps),
                "Signup and cancellation interaction metadata does not contain a comparable retention-prompt or required-action pair.",
            )]

        if comparative_friction and len(steps) >= CANCEL_RETENTION_MAZE_STEPS:
            comparative_parts = []
            if step_friction:
                comparative_parts.append(
                    f"cancellation {len(steps)} vs signup {signup_steps_count} steps ({len(steps)}:{signup_steps_count} friction ratio)"
                )
            comparative_parts.extend(metric_differences)
            evidence = (
                f"Raw cancellation step count: {len(steps)}. "
                f"Cancellation requires {len(steps)} interaction steps vs. {signup_steps_count} step for signup "
                f"({len(steps)}:{signup_steps_count} friction ratio). "
                f"Comparative friction evidence: {'; '.join(comparative_parts)}."
            )
            if metadata_is_ambiguous:
                evidence += " Retention metadata is incomplete; review needed for that aspect."
            findings.append(Finding(
                category="cancellation",
                type="asymmetric_cancellation_steps",
                severity=SEVERITY_MAPPING.get("asymmetric_cancellation_steps", "high"),
                confidence=0.95,
                evidence=evidence,
                bbox=[0.0, 0.0, 0.0, 0.0],
                why=f"Cancelling requires traversing {len(steps)} screens, creating asymmetric step friction compared to {signup_steps_count}-step onboarding. The evidence compares measured steps and does not assume unobserved retention actions.",
                safer_alternative="Allow cancellation in equal or fewer steps than signup without interstitial survey or offer walls.",
                source="rule"
            ))
        elif not metadata_supplied and not signup_count_provided and len(steps) >= CANCEL_RETENTION_MAZE_STEPS:
            findings.append(Finding(
                category="cancellation",
                type="asymmetric_cancellation_steps",
                severity=SEVERITY_MAPPING.get("asymmetric_cancellation_steps", "high"),
                confidence=0.95,
                evidence=(
                    f"Cancellation flow requires {len(steps)} sequential interaction steps "
                    f"(threshold: {CANCEL_RETENTION_MAZE_STEPS} steps). Raw step-count evidence is present; "
                    "comparative signup friction was not supplied."
                ),
                bbox=[0.0, 0.0, 0.0, 0.0],
                why=f"The cancellation flow contains {len(steps)} sequential screens, which exceeds the raw-flow threshold. Signup and retention-action comparisons were not supplied, so this finding does not claim comparative friction.",
                safer_alternative="Allow cancellation in 1 or 2 straightforward steps without interstitial survey or offer walls.",
                source="rule"
            ))

        return findings

    @staticmethod
    def _interaction_metrics(metadata: Optional[FlowInteractionMetadata]) -> Dict[str, Optional[int]]:
        """Normalize count-or-label metadata into comparable counts."""
        if metadata is None:
            return {"retention prompts": None, "required actions": None}

        def count(value: Any) -> Optional[int]:
            if value is None:
                return None
            if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                return value
            if isinstance(value, list):
                return len(value)
            return None

        return {
            "retention prompts": count(metadata.retention_prompts),
            "required actions": count(metadata.required_actions),
        }

    @staticmethod
    def _review_needed_finding(step_count: int, reason: str) -> Finding:
        return Finding(
            category="cancellation",
            type="review_needed",
            severity=SEVERITY_MAPPING.get("review_needed", "low"),
            confidence=0.60,
            evidence=f"Review needed: raw cancellation step count is {step_count}; {reason}",
            bbox=[0.0, 0.0, 0.0, 0.0],
            why="The supplied flow metadata is too incomplete to support a reliable comparative-friction conclusion.",
            safer_alternative="Capture signup and cancellation step counts plus the retention prompts and required actions on both flows before drawing a comparison.",
            source="rule",
        )

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
