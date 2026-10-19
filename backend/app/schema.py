"""
Unified Finding & Analysis Schema for ClearClick AI
Strictly conforms to Section 9 of the ClearClick AI Build Guide.
"""

from typing import List, Optional, Tuple, Literal, Any, Union, Dict
from pydantic import BaseModel, Field


CategoryType = Literal["hidden_charges", "cancellation", "consent"]
SeverityType = Literal["low", "medium", "high"]
SourceType = Literal["rule", "ai", "hybrid"]

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


class Finding(BaseModel):
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


class FlowData(BaseModel):
    flow_type: Literal["cancellation", "checkout", "signup", "general"] = "general"
    steps: List[PageData] = Field(default_factory=list)
    signup_steps_count: int = 1


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


