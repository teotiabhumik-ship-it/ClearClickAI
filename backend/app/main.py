"""
FastAPI Server for ClearClick AI
Provides inspection endpoints, corpus demo fixtures, and evaluation benchmarking.
"""

import os
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Literal
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import logging

from .schema import (
    PageData,
    Finding,
    AnalysisReport,
    CategoryType,
    ExtractedCheckbox,
    ExtractedElement,
    FlowData
)
from .extract.playwright_extractor import PageExtractor
from .detectors.consent import ConsentDetector
from .detectors.hidden_charges import HiddenChargesDetector
from .detectors.cancellation import CancellationDetector
from .detectors.flow_analysis import FlowAnalyzer
from .ai.text_analysis import AITextDetector
from .ai.vision_analysis import AIVisionDetector
from .ai.quote_verifier import QuoteVerifier
from .ai.client import AIStatus
from .config.thresholds import SEVERITY_MAPPING, CONFIDENCE_HYBRID, CONFIDENCE_AI_ONLY
from .evaluation.benchmark import run_benchmark
from .security import validate_url_safety, validate_html_payload, SlidingWindowRateLimiter

logger = logging.getLogger("clearclick.server")

app = FastAPI(
    title="ClearClick AI Backend",
    description="Evidence-based dark pattern detection and fair design advisory engine.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

consent_detector = ConsentDetector()
charges_detector = HiddenChargesDetector()
cancel_detector = CancellationDetector()
ai_text_detector = AITextDetector()
ai_vision_detector = AIVisionDetector()
rate_limiter = SlidingWindowRateLimiter(max_requests=30, window_seconds=60)


class AnalyzeRequest(BaseModel):
    url: Optional[str] = None
    html_content: Optional[str] = None
    corpus_id: Optional[str] = None
    include_ai: bool = True


@app.on_event("startup")
async def startup_check():
    """Startup check: inspect configured model availability and report clearly if unavailable."""
    is_available, status_msg = await ai_text_detector.client.check_model_availability()
    app.state.ai_model_available = is_available
    app.state.ai_model_status = status_msg
    if not is_available:
        logger.warning(
            f"[ClearClick Startup] Configured AI model '{ai_text_detector.client.gemini_model}' is UNAVAILABLE: {status_msg}. "
            "AI detection will fall back to 'unavailable' status."
        )
    else:
        logger.info(
            f"[ClearClick Startup] Configured AI model '{ai_text_detector.client.gemini_model}' is functional: {status_msg}."
        )


@app.api_route("/api/health", methods=["GET", "HEAD"])
def health_check():
    model_status = getattr(app.state, "ai_model_status", None)
    if model_status is None:
        model_status = "skipped_no_key" if not ai_text_detector.client.has_any_key else "configured"
    return {
        "status": "healthy",
        "service": "ClearClick AI",
        "ai_model": ai_text_detector.client.gemini_model,
        "ai_status": model_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/corpus")
def get_corpus():
    """Returns available ground-truth corpus fixtures for quick one-click demo testing."""
    corpus_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "corpus", "labels.json"))
    if not os.path.exists(corpus_path):
        return []
    with open(corpus_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/benchmark")
async def get_benchmark_results(split: str = "held_out", include_ai: bool = False):
    """Executes evaluation pipeline across ground-truth corpus and returns precision/recall metrics."""
    return await run_benchmark(split=split, include_ai=include_ai)


@app.post("/api/analyze", response_model=AnalysisReport)
async def analyze_page(req: AnalyzeRequest, request: Request):
    """
    Analyzes a page from URL, provided HTML, or pre-configured corpus ID.
    Enforces SSRF prevention, HTML payload limits, and rate limits.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please wait before submitting additional inspection requests."
        )

    # Validate HTML payload size if provided
    if req.html_content:
        validate_html_payload(req.html_content)

    html_to_process = req.html_content
    url_to_process = req.url

    # Check if request specifies a corpus fixture
    if req.corpus_id:
        corpus_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "corpus"))
        labels_path = os.path.join(corpus_base, "labels.json")
        if os.path.exists(labels_path):
            with open(labels_path, "r", encoding="utf-8") as f:
                items = json.load(f)
                matched = next((item for item in items if item["id"] == req.corpus_id), None)
                if matched:
                    target_file = os.path.join(corpus_base, matched["file"])
                    if os.path.exists(target_file):
                        with open(target_file, "r", encoding="utf-8") as hf:
                            html_to_process = hf.read()
                            url_to_process = target_file

    # SSRF Guard for external URL inputs
    if req.url and not req.corpus_id:
        if req.url.startswith("http://") or req.url.startswith("https://"):
            is_safe, reason = validate_url_safety(req.url)
            if not is_safe:
                raise HTTPException(status_code=400, detail=f"SSRF Security Violation: {reason}")
        else:
            raise HTTPException(status_code=400, detail="Only 'http' and 'https' URLs are supported.")

    if not url_to_process and not html_to_process:
        raise HTTPException(status_code=400, detail="Must provide url, html_content, or valid corpus_id.")

    # 1. Extraction with Playwright (20s timeout enforced)
    page_data: PageData = await PageExtractor.extract_from_url_or_html(
        url=url_to_process,
        html_content=html_to_process
    )

    # 2. Execute Rule Detectors
    rule_findings: List[Finding] = []
    rule_findings.extend(consent_detector.detect(page_data))
    rule_findings.extend(charges_detector.detect(page_data))
    rule_findings.extend(cancel_detector.detect(page_data))

    # 3. Execute AI Text & Vision Detectors if enabled
    if req.include_ai:
        model_avail = getattr(app.state, "ai_model_available", None)
        model_stat = getattr(app.state, "ai_model_status", None)

        if model_avail is False and model_stat != "skipped_no_key":
            ai_findings = []
            ai_status = AIStatus("unavailable")
            ai_status_message = f"AI analysis not run (Configured model unavailable: {model_stat})"
        else:
            text_findings, text_status, text_msg = await ai_text_detector.detect(page_data)

            # Free-tier safety: only call vision when needed (screenshot exists, interactive visual cues exist, and text call succeeded)
            has_interactive = bool(page_data.buttons or page_data.links or page_data.prices)
            vision_needed = bool(page_data.screenshot_base64 and has_interactive)

            if text_status in ("ran", "completed") and vision_needed:
                vision_findings, vision_status, vision_msg = await ai_vision_detector.detect(page_data)
            elif text_status in ("skipped_no_key", "limit_reached", "unavailable"):
                vision_findings, vision_status, vision_msg = [], text_status, text_msg
            else:
                vision_findings, vision_status, vision_msg = [], "not_run", "AI vision analysis not run (no visual cues or screenshot)"

            ai_findings = text_findings + vision_findings

            # Resolve overall AI execution status
            if text_status in ("ran", "completed") or vision_status in ("ran", "completed"):
                ai_status = AIStatus("ran")
                ai_status_message = text_msg if text_status in ("ran", "completed") else vision_msg
            elif text_status in ("skipped_no_key", "not_run") and vision_status in ("skipped_no_key", "not_run"):
                ai_status = AIStatus("skipped_no_key")
                ai_status_message = "AI analysis not run (no API key configured)"
            elif text_status == "limit_reached" or vision_status == "limit_reached":
                ai_status = AIStatus("limit_reached")
                ai_status_message = text_msg if text_status == "limit_reached" else vision_msg
            elif text_status == "invalid_response" or vision_status == "invalid_response":
                ai_status = AIStatus("invalid_response")
                ai_status_message = text_msg if text_status == "invalid_response" else vision_msg
            else:
                ai_status = AIStatus("unavailable")
                ai_status_message = text_msg if text_status not in ("ran", "completed") else vision_msg
    else:
        ai_findings = []
        ai_status = AIStatus("skipped_no_key")
        ai_status_message = "AI analysis disabled by user toggle"

    # 4. Consolidate and Deduplicate Findings with provenance & hybrid source tracking
    consolidated_findings = consolidate_findings(rule_findings, ai_findings)

    # 5. Build Category Summaries (No single verdict score!)
    summary: Dict[CategoryType, int] = {
        "consent": sum(1 for f in consolidated_findings if f.category == "consent"),
        "hidden_charges": sum(1 for f in consolidated_findings if f.category == "hidden_charges"),
        "cancellation": sum(1 for f in consolidated_findings if f.category == "cancellation"),
    }

    return AnalysisReport(
        url=url_to_process or "Uploaded HTML",
        timestamp=datetime.now(timezone.utc).isoformat(),
        disclaimer="ClearClick AI findings are automated warnings for human review, not legal conclusions.",
        summary_by_category=summary,
        findings=consolidated_findings,
        rule_findings=rule_findings,
        ai_findings=ai_findings,
        rule_findings_count=len(rule_findings),
        ai_findings_count=len(ai_findings),
        ai_status=ai_status,
        ai_status_message=ai_status_message,
        screenshot_base64=page_data.screenshot_base64,
        page_title=page_data.title or "Page Analysis"
    )


class AnalyzeFlowRequest(BaseModel):
    steps_html: Optional[List[str]] = None
    steps_urls: Optional[List[str]] = None
    flow_type: Literal["cancellation", "checkout", "signup", "general"] = "general"
    signup_steps_count: int = 1
    include_ai: bool = True


@app.post("/api/analyze-flow", response_model=AnalysisReport)
async def analyze_flow_endpoint(req: AnalyzeFlowRequest, request: Request):
    """
    Analyzes an ordered sequence of flow screens/steps for drip pricing, late-added charges,
    and asymmetric retention friction.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded.")

    steps_data: List[PageData] = []
    if req.steps_html:
        for idx, html in enumerate(req.steps_html):
            validate_html_payload(html)
            pdata = await PageExtractor.extract_from_url_or_html(html_content=html)
            steps_data.append(pdata)
    elif req.steps_urls:
        for u in req.steps_urls:
            is_safe, reason = validate_url_safety(u)
            if not is_safe:
                raise HTTPException(status_code=400, detail=f"SSRF Security Violation: {reason}")
            pdata = await PageExtractor.extract_from_url_or_html(url=u)
            steps_data.append(pdata)
    else:
        raise HTTPException(status_code=400, detail="Must provide steps_html or steps_urls.")

    if len(steps_data) < 2:
        raise HTTPException(status_code=400, detail="Flow analysis requires at least 2 sequential steps.")

    flow = FlowData(
        flow_type=req.flow_type,
        steps=steps_data,
        signup_steps_count=req.signup_steps_count
    )

    # 1. Flow Analyzer
    flow_findings = await FlowAnalyzer.analyze_flow_async(
        flow,
        client=ai_text_detector.client if req.include_ai else None
    )

    # 2. Per-step rule detectors
    all_rule_findings: List[Finding] = list(flow_findings)
    for pdata in steps_data:
        all_rule_findings.extend(consent_detector.detect(pdata))
        all_rule_findings.extend(charges_detector.detect(pdata))
        all_rule_findings.extend(cancel_detector.detect(pdata))

    # 3. Consolidate and summarize
    consolidated = consolidate_findings(all_rule_findings, [])
    summary = {
        "consent": sum(1 for f in consolidated if f.category == "consent"),
        "hidden_charges": sum(1 for f in consolidated if f.category == "hidden_charges"),
        "cancellation": sum(1 for f in consolidated if f.category == "cancellation"),
    }

    return AnalysisReport(
        url=f"Flow ({len(steps_data)} steps)",
        timestamp=datetime.now(timezone.utc).isoformat(),
        disclaimer="ClearClick AI findings are automated warnings for human review, not legal conclusions.",
        summary_by_category=summary,
        findings=consolidated,
        rule_findings=all_rule_findings,
        ai_findings=[],
        rule_findings_count=len(all_rule_findings),
        ai_findings_count=0,
        ai_status=AIStatus("ran") if req.include_ai else AIStatus("skipped_no_key"),
        ai_status_message="Flow analysis completed successfully",
        page_title=f"{req.flow_type.capitalize()} Flow Analysis",
        is_flow=True,
        step_count=len(steps_data)
    )


def consolidate_findings(rule_findings: List[Finding], ai_findings: List[Finding]) -> List[Finding]:
    """
    Merge rule and AI findings into a calibrated list.
    When both rule and AI detect the same element and issue:
    - Merged into a single finding with source="hybrid"
    - Calibrated confidence boosted to CONFIDENCE_HYBRID (0.95)
    - Severity enforced strictly by code from SEVERITY_MAPPING
    """
    merged: List[Finding] = []
    matched_ai_indices = set()
    seen_keys = set()

    for rf in rule_findings:
        # Enforce code-assigned severity
        rf.severity = SEVERITY_MAPPING.get(rf.type, rf.severity)

        # Check for corroborating AI finding on same element & type
        matching_ai = None
        for idx, aif in enumerate(ai_findings):
            if idx in matched_ai_indices:
                continue

            same_type = (rf.type == aif.type) or (rf.category == aif.category and rf.type in aif.type)
            same_element = (
                (rf.element_id and aif.element_id and rf.element_id == aif.element_id) or
                (aif.evidence and rf.evidence and aif.evidence.lower() in rf.evidence.lower()) or
                (rf.evidence and aif.evidence and rf.evidence.lower() in aif.evidence.lower())
            )

            if same_type and same_element:
                matching_ai = aif
                matched_ai_indices.add(idx)
                break

        if matching_ai:
            hybrid = Finding(
                category=rf.category,
                type=rf.type,
                severity=SEVERITY_MAPPING.get(rf.type, rf.severity),
                confidence=CONFIDENCE_HYBRID,
                evidence=rf.evidence,
                element_id=rf.element_id or matching_ai.element_id,
                bbox=rf.bbox if rf.bbox != [0, 0, 0, 0] else matching_ai.bbox,
                why=matching_ai.why if len(matching_ai.why) > len(rf.why) else rf.why,
                safer_alternative=matching_ai.safer_alternative or rf.safer_alternative,
                source="hybrid"
            )
            dedup_key = (hybrid.element_id or hybrid.evidence[:30], hybrid.type)
            if dedup_key not in seen_keys:
                seen_keys.add(dedup_key)
                merged.append(hybrid)
        else:
            rf.source = "rule"
            dedup_key = (rf.element_id or rf.evidence[:30], rf.type)
            if dedup_key not in seen_keys:
                seen_keys.add(dedup_key)
                merged.append(rf)

    for idx, aif in enumerate(ai_findings):
        if idx not in matched_ai_indices:
            aif.severity = SEVERITY_MAPPING.get(aif.type, aif.severity)
            aif.source = "ai"
            if aif.confidence > CONFIDENCE_AI_ONLY:
                aif.confidence = CONFIDENCE_AI_ONLY
            dedup_key = (aif.element_id or aif.evidence[:30], aif.type)
            if dedup_key not in seen_keys:
                seen_keys.add(dedup_key)
                merged.append(aif)

    return merged


# Mount compiled React frontend if built
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
