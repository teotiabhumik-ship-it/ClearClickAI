"""
Centralized Detector Thresholds and Documented Mappings for ClearClick AI.
Every threshold used by deterministic and hybrid detectors is defined here with clear rationales.
No magic numbers or fixture-specific strings are permitted in detector logic.
"""

from typing import Dict, Set, Literal

CategoryType = Literal["hidden_charges", "cancellation", "consent"]
SeverityType = Literal["low", "medium", "high"]
SourceType = Literal["rule", "ai", "hybrid"]

# ---------------------------------------------------------------------------
# Closed Allowed Lists for Category and Finding Types
# ---------------------------------------------------------------------------
ALLOWED_CATEGORIES: Set[str] = {
    "consent",
    "cancellation",
    "hidden_charges",
}

ALLOWED_TYPES: Set[str] = {
    # Consent dark patterns
    "preticked_consent",
    "unequal_button_emphasis",
    "missing_reject_option",
    "double_negative_language",
    "disguised_ads",
    # Cancellation dark patterns
    "buried_cancel_link",
    "confirm_shaming",
    "asymmetric_cancellation_steps",
    "forced_offline_cancellation",
    "nagging_review",
    "nagging_review_request",
    "gamified_retention",
    "gamification_referral",
    "visual_cancellation_obstacle",
    "cancel_barrier",
    # Hidden charges dark patterns
    "microprint_fee",
    "low_contrast_fee",
    "bundled_hidden_fee",
    "drip_pricing",
    "countdown_timer",
    "countdown_timer_urgency",
    "low_stock_scarcity",
    "fake_scarcity_low_stock",
    "high_demand_scarcity",
    "high_demand_social_proof",
    "activity_message",
    "activity_message_urgency",
    "obscured_charge_visual",
    "hidden_cost_language",
    "hallucinated_finding",
}

CATEGORY_ALLOWED_TYPES: Dict[str, Set[str]] = {
    "consent": {
        "preticked_consent",
        "unequal_button_emphasis",
        "missing_reject_option",
        "double_negative_language",
        "disguised_ads",
        "hallucinated_finding",
    },
    "cancellation": {
        "buried_cancel_link",
        "confirm_shaming",
        "asymmetric_cancellation_steps",
        "forced_offline_cancellation",
        "nagging_review",
        "nagging_review_request",
        "gamified_retention",
        "gamification_referral",
        "visual_cancellation_obstacle",
        "cancel_barrier",
    },
    "hidden_charges": {
        "microprint_fee",
        "low_contrast_fee",
        "bundled_hidden_fee",
        "drip_pricing",
        "countdown_timer",
        "countdown_timer_urgency",
        "low_stock_scarcity",
        "fake_scarcity_low_stock",
        "high_demand_scarcity",
        "high_demand_social_proof",
        "activity_message",
        "activity_message_urgency",
        "obscured_charge_visual",
        "hidden_cost_language",
    },
}

# ---------------------------------------------------------------------------
# Code-Enforced Severity Mapping (Documented)
# Severity is NEVER assigned by the AI. It is strictly looked up from this map.
# ---------------------------------------------------------------------------
SEVERITY_MAPPING: Dict[str, SeverityType] = {
    # High: Direct financial impact, severe obstruction, or unconsented enrollment
    "drip_pricing": "high",
    "microprint_fee": "high",
    "low_contrast_fee": "high",
    "bundled_hidden_fee": "high",
    "buried_cancel_link": "high",
    "forced_offline_cancellation": "high",
    "missing_reject_option": "high",
    "asymmetric_cancellation_steps": "high",
    "double_negative_language": "high",

    # Medium: Deceptive visual hierarchy, guilt copy, or behavioral manipulation
    "preticked_consent": "medium",
    "unequal_button_emphasis": "medium",
    "confirm_shaming": "medium",
    "countdown_timer": "medium",
    "countdown_timer_urgency": "medium",
    "low_stock_scarcity": "medium",
    "fake_scarcity_low_stock": "medium",
    "high_demand_scarcity": "medium",
    "high_demand_social_proof": "medium",
    "activity_message": "medium",
    "activity_message_urgency": "medium",
    "disguised_ads": "medium",
    "visual_cancellation_obstacle": "medium",
    "obscured_charge_visual": "medium",
    "hidden_cost_language": "medium",
    "nagging_review": "medium",
    "nagging_review_request": "medium",
    "gamified_retention": "medium",
    "gamification_referral": "medium",
    "cancel_barrier": "low",
    "hallucinated_finding": "high",
}

# ---------------------------------------------------------------------------
# Calibrated Confidence Baselines
# ---------------------------------------------------------------------------
CONFIDENCE_HYBRID: float = 0.95        # Both deterministic rule and AI detector agree
CONFIDENCE_RULE_BASE: float = 0.90      # Deterministic DOM/CSS measurement verified
CONFIDENCE_AI_ONLY: float = 0.75       # AI detector claim without deterministic corroboration
CONFIDENCE_UNVERIFIED_VISION: float = 0.60 # Vision claim that cannot be measured against DOM

# ---------------------------------------------------------------------------
# Verifier Minimum Quote Length
# Quotes shorter than 12 characters are trivially matched in unrelated text
# ---------------------------------------------------------------------------
MIN_QUOTE_LENGTH: int = 12

# ---------------------------------------------------------------------------
# Consent Detector Thresholds
# ---------------------------------------------------------------------------
CONSENT_EQUAL_FONT_DIFF_PX: float = 1.0
CONSENT_ACCEPT_MIN_CONTRAST: float = 4.0
CONSENT_REJECT_MIN_CONTRAST: float = 3.5
CONSENT_AREA_PARITY_THRESHOLD: float = 0.35
CONSENT_ASYMMETRIC_AREA_RATIO: float = 1.8
CONSENT_ASYMMETRIC_FONT_RATIO: float = 1.25
CONSENT_REJECT_LOW_CONTRAST_THRESHOLD: float = 3.0
DISGUISED_AD_MAX_FONT_PX: float = 10.0
DISGUISED_AD_MIN_CONTRAST: float = 3.0

# ---------------------------------------------------------------------------
# Hidden Charges Detector Thresholds
# ---------------------------------------------------------------------------
FEE_RELATIVE_FONT_SIZE_RATIO: float = 0.35
FEE_ABSOLUTE_MICROPRINT_FONT_PX: float = 10.0
FEE_LOW_CONTRAST_THRESHOLD: float = 4.0
FEE_RELATIVE_CONTRAST_RATIO: float = 0.60
DRIP_PRICING_SINGLE_PAGE_RATIO: float = 1.15
DRIP_PRICING_FLOW_RATIO: float = 1.20

# ---------------------------------------------------------------------------
# Cancellation Detector Thresholds
# ---------------------------------------------------------------------------
CANCEL_LINK_MAX_FONT_PX: float = 11.0
CANCEL_LINK_MAX_CONTRAST: float = 4.0
CANCEL_RETENTION_MAZE_STEPS: int = 3
