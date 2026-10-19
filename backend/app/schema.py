"""
Unified Finding & Analysis Schema for ClearClick AI
Strictly conforms to Section 9 of the ClearClick AI Build Guide.
"""

from typing import List, Optional, Tuple, Literal, Any, Union, Dict
from pydantic import BaseModel, ConfigDict, Field, model_validator
from .config.thresholds import SIGNAL_STRENGTH_HIGH_MIN, SIGNAL_STRENGTH_MEDIUM_MIN


CategoryType = Literal["hidden_charges", "cancellation", "consent"]
SeverityType = Literal["low", "medium", "high"]
SourceType = Literal["rule", "ai", "hybrid"]
SignalStrengthType = Literal["high", "medium", "review"]


def signal_strength_for_confidence(confidence: float) -> SignalStrengthType:
    """Map the calibrated confidence score to a user-facing signal band."""
    if confidence >= SIGNAL_STRENGTH_HIGH_MIN:
        return "high"
    if confidence >= SIGNAL_STRENGTH_MEDIUM_MIN:
        return "medium"
    return "review"

PageStatus = Literal[
    "ok",
    "blocked",
    "needs_login",
    "empty",
    "timeout",
    "robots_disallowed",
    "invalid_url",
    "error",
]

PageType = Literal[
    "pricing",
    "cart",
    "checkout",
    "signup",
    "account",
    "cancel",
    "consent",
    "other",
]

SkippedReason = Literal[
    "skipped_low_priority",
    "skipped_duplicate",
    "skipped_robots",
    "skipped_cap",
    "skipped_blocked_domain",
]

ScanDecision = Literal[
    "will_analyse",
    "skipped_low_priority",
    "skipped_duplicate",
    "skipped_robots",
    "skipped_cap",
]

ScanAIStatus = Literal[
    "ran",
    "not_run",
    "skipped_no_key",
    "ai_skipped_budget",
    "limit_reached",
    "unavailable",
    "invalid_response",
]


class RelatedSignal(BaseModel):
    """Measured signal retained when two detectors point at the same element."""

    model_config = ConfigDict(validate_assignment=True)

    type: str
    severity: SeverityType = "medium"
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: str
    element_id: Optional[str] = None
    source: SourceType = "rule"
    signal_strength: SignalStrengthType = "review"

    @model_validator(mode="after")
    def calibrate_signal_strength(self) -> "RelatedSignal":
        object.__setattr__(self, "signal_strength", signal_strength_for_confidence(self.confidence))
        return self


class Finding(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    category: CategoryType = Field(
        ...,
        description="The dark pattern category: hidden_charges, cancellation, or consent"
    )
    type: str = Field(
        ...,
        description="Machine identifier (e.g. preticked_consent, microprint_fee, buried_cancel_link)"
    )
    severity: SeverityType = Field(
        default="medium",
        description="Severity assessment: low, medium, or high"
    )
    confidence: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0,
        description="Calibrated confidence score between 0.0 and 1.0"
    )
    evidence: str = Field(
        ...,
        description="Verbatim text quote or measured numerical metric"
    )
    bbox: List[float] = Field(
        default_factory=lambda: [0.0, 0.0, 0.0, 0.0],
        description="[x, y, width, height] bounding box coordinates in screenshot pixels"
    )
    why: str = Field(
        ...,
        description="Neutral, plain-language explanation of how this design choice may mislead"
    )
    safer_alternative: str = Field(
        ...,
        description="Actionable suggestion for a transparent, fair alternative design"
    )
    element_id: Optional[str] = Field(
        default=None,
        description="Stable extracted element ID"
    )
    source: SourceType = Field(
        default="rule",
        description="Source of finding: rule, ai, or hybrid"
    )
    related_signals: List[RelatedSignal] = Field(
        default_factory=list,
        description="Additional measured signals that overlap this finding on the same element"
    )
    signal_strength: SignalStrengthType = Field(
        default="review",
        description="Calibrated presentation band derived from confidence: high, medium, or review"
    )
    rule_confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Original confidence from the rule detector when source is hybrid"
    )
    ai_confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Original confidence from the AI detector when source is hybrid"
    )
    rule_evidence: Optional[str] = Field(
        default=None,
        description="Original evidence from the rule detector when source is hybrid"
    )
    ai_evidence: Optional[str] = Field(
        default=None,
        description="Original evidence from the AI detector when source is hybrid"
    )

    @model_validator(mode="after")
    def calibrate_signal_strength(self) -> "Finding":
        """Keep the presentation band derived from confidence after mutations."""
        object.__setattr__(self, "signal_strength", signal_strength_for_confidence(self.confidence))
        return self


class ExtractedCheckbox(BaseModel):
    id: Optional[str] = None
    element_id: str = ""
    name: Optional[str] = None
    checked: bool
    disabled: bool = False
    label: str
    bbox: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0])
    font_size_px: float = 14.0
    color: str = "#000000"
    background_color: str = "#ffffff"
    contrast_ratio: float = 21.0


class ExtractedElement(BaseModel):
    tag: str
    text: str
    id: Optional[str] = None
    element_id: str = ""
    classes: List[str] = Field(default_factory=list)
    bbox: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0])
    font_size_px: float = 14.0
    color: str = "#000000"
    background_color: str = "#ffffff"
    contrast_ratio: float = 21.0
    role: Optional[str] = None
    href: Optional[str] = None


class PageData(BaseModel):
    url: Optional[str] = None
    title: str = ""
    visible_text: str = ""
    checkboxes: List[ExtractedCheckbox] = Field(default_factory=list)
    buttons: List[ExtractedElement] = Field(default_factory=list)
    links: List[ExtractedElement] = Field(default_factory=list)
    prices: List[ExtractedElement] = Field(default_factory=list)
    text_elements: List[ExtractedElement] = Field(default_factory=list)
    screenshot_base64: Optional[str] = None
    viewport_width: int = 1280
    viewport_height: int = 800
    step_info: Optional[str] = None
    body_color: str = "#000000"
    body_background_color: str = "#ffffff"
    body_contrast_ratio: float = 21.0
    device_pixel_ratio: float = 1.0
    page_status: PageStatus = "ok"
    status_reason: str = "ok"
    http_status: Optional[int] = None

    def get_element(self, element_id: str) -> Optional[Any]:
        """Look up element by element_id or DOM id."""
        if not element_id:
            return None
        for el in self.buttons + self.links + self.prices + self.text_elements:
            if el.element_id == element_id or el.id == element_id:
                return el
        for cb in self.checkboxes:
            if cb.element_id == element_id or cb.id == element_id:
                return cb
        return None

    def all_elements(self) -> List[Any]:
        """Return all extracted interactive and content elements."""
        return self.buttons + self.links + self.prices + self.text_elements + self.checkboxes


class FlowInteractionMetadata(BaseModel):
    """Optional interaction counts used to compare signup and cancellation friction.

    Metrics may be supplied as measured counts or as labels captured during a
    flow.  Accepting both keeps the API useful for crawlers that have not
    reduced their observations to counts yet.
    """

    retention_prompts: Optional[Union[int, List[str]]] = None
    required_actions: Optional[Union[int, List[str]]] = None


class FlowData(BaseModel):
    flow_type: Literal["cancellation", "checkout", "signup", "general"] = "general"
    steps: List[PageData] = Field(default_factory=list)
    signup_steps_count: int = 1
    signup_interaction_metadata: Optional[FlowInteractionMetadata] = None
    cancellation_interaction_metadata: Optional[FlowInteractionMetadata] = None


class CategorySummary(BaseModel):
    category: CategoryType
    count: int
    findings: List[Finding]


class AnalysisReport(BaseModel):
    url: Optional[str] = None
    timestamp: str
    disclaimer: str = "ClearClick AI findings are automated warnings for human review, not legal conclusions."
    summary_by_category: dict[CategoryType, int]
    findings: List[Finding]
    rule_findings: List[Finding] = Field(default_factory=list)
    ai_findings: List[Finding] = Field(default_factory=list)
    rule_findings_count: int = 0
    ai_findings_count: int = 0
    ai_status: Literal[
        "ran",
        "skipped_no_key",
        "ai_skipped_budget",
        "unavailable",
        "limit_reached",
        "invalid_response",
        "completed",
        "not_run",
        "failed"
    ] = "skipped_no_key"
    ai_status_message: str = "AI analysis not run (no API key configured)"
    screenshot_base64: Optional[str] = None
    page_title: str = ""
    page_status: PageStatus = "ok"
    status_reason: str = ""
    is_flow: bool = False
    step_count: int = 1


class ScanPage(BaseModel):
    url: str
    page_type: PageType = "other"
    page_type_evidence: str = ""
    score: float = 0.0
    decision: ScanDecision = "will_analyse"
    page_status: PageStatus = "ok"
    status_reason: str = ""
    ai_status: ScanAIStatus = "not_run"
    ai_status_message: str = ""
    findings: List[Finding] = Field(default_factory=list)
    skipped_reason: Optional[SkippedReason] = None
    screenshot_base64: Optional[str] = None
    page_title: str = ""
    discovered_from: Optional[str] = None
    depth: int = 0


class GroupedFinding(BaseModel):
    category: CategoryType
    type: str
    severity: SeverityType
    confidence: float
    evidence: str
    why: str
    safer_alternative: str
    source: SourceType = "rule"
    element_fingerprint: str
    pages: List[str] = Field(default_factory=list)
    page_types: List[str] = Field(default_factory=list)
    sample_bbox: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0])


class Coverage(BaseModel):
    pages_discovered: int = 0
    pages_analysed: int = 0
    pages_skipped_by_reason: Dict[str, int] = Field(default_factory=dict)
    pages_blocked: int = 0
    pages_needs_login: int = 0
    pages_ai_analysed: int = 0
    ai_calls_used: int = 0
    key_page_types_found: List[str] = Field(default_factory=list)
    key_page_types_reached: List[str] = Field(default_factory=list)


class Scan(BaseModel):
    scan_id: str
    root_url: str
    status: Literal["queued", "running", "completed", "cancelled", "failed"] = "queued"
    created_at: str
    completed_at: Optional[str] = None
    config_snapshot: Dict[str, Any] = Field(default_factory=dict)
    pages: List[ScanPage] = Field(default_factory=list)
    grouped_findings: List[GroupedFinding] = Field(default_factory=list)
    coverage: Coverage = Field(default_factory=Coverage)
    error_message: Optional[str] = None


class FlowStepResult(BaseModel):
    step_index: int
    step_name: str
    url: Optional[str] = None
    status: Literal["reached", "not_reached"]
    stopped_reason: Optional[str] = None
    page_data: Optional[PageData] = None


class GuidedFlowResult(BaseModel):
    flow_id: str
    root_url: str
    status: Literal["completed", "aborted", "failed"]
    flow_stopped_reason: Optional[str] = None
    steps: List[FlowStepResult] = Field(default_factory=list)
    findings: List[Finding] = Field(default_factory=list)


