"""
Unified Finding & Analysis Schema for ClearClick AI
Strictly conforms to Section 9 of the ClearClick AI Build Guide.
"""

from typing import List, Optional, Tuple, Literal
from pydantic import BaseModel, Field


CategoryType = Literal["hidden_charges", "cancellation", "consent"]
SeverityType = Literal["low", "medium", "high"]
SourceType = Literal["rule", "ai", "hybrid"]


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
    source: SourceType = Field(
        default="rule",
        description="Source of finding: rule, ai, or hybrid"
    )


class ExtractedCheckbox(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    checked: bool
    disabled: bool = False
    label: str
    bbox: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0])


class ExtractedElement(BaseModel):
    tag: str
    text: str
    id: Optional[str] = None
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
    screenshot_base64: Optional[str] = None
    viewport_width: int = 1280
    viewport_height: int = 800
    step_info: Optional[str] = None
    body_color: str = "#000000"
    body_background_color: str = "#ffffff"
    body_contrast_ratio: float = 21.0


class FlowData(BaseModel):
    flow_type: Literal["cancellation", "checkout", "signup", "general"] = "general"
    steps: List[PageData] = Field(default_factory=list)


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
    screenshot_base64: Optional[str] = None
    page_title: str = ""
    is_flow: bool = False
    step_count: int = 1
