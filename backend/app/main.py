"""
FastAPI Server for ClearClick AI
Provides inspection endpoints, corpus demo fixtures, and evaluation benchmarking.
"""

import os
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .schema import (
    PageData,
    Finding,
    AnalysisReport,
    CategoryType,
    ExtractedCheckbox,
    ExtractedElement
)
from .extract.playwright_extractor import PageExtractor
from .detectors.consent import ConsentDetector
from .detectors.hidden_charges import HiddenChargesDetector
from .detectors.cancellation import CancellationDetector
from .ai.text_analysis import AITextDetector
from .ai.vision_analysis import AIVisionDetector
from .ai.quote_verifier import QuoteVerifier
from .evaluation.benchmark import run_benchmark
from .security import validate_url_safety, validate_html_payload, SlidingWindowRateLimiter


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


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ClearClick AI",
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

    # 3. Execute AI Text & Vision Detectors
    text_findings, text_status, text_msg = await ai_text_detector.detect(page_data)
    vision_findings, vision_status, vision_msg = await ai_vision_detector.detect(page_data)

    ai_findings: List[Finding] = text_findings + vision_findings

    # Resolve overall AI execution status
    if text_status == "completed" or vision_status == "completed":
        ai_status = "completed"
        ai_status_message = text_msg if text_status == "completed" else vision_msg
    elif text_status == "failed" or vision_status == "failed":
        ai_status = "failed"
        ai_status_message = text_msg if text_status == "failed" else vision_msg
    else:
        ai_status = "not_run"
        ai_status_message = "AI analysis not run (no API key configured)"

    # 4. Consolidate and Deduplicate Findings
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


def consolidate_findings(rule_findings: List[Finding], ai_findings: List[Finding]) -> List[Finding]:
    """
    Merge rule and AI findings, preventing duplicate flags on the same issue.
    """
    merged: List[Finding] = list(rule_findings)

    for aif in ai_findings:
        is_duplicate = False
        for rf in rule_findings:
            if rf.category == aif.category and (
                rf.type == aif.type or
                (aif.evidence and aif.evidence.lower() in rf.evidence.lower())
            ):
                is_duplicate = True
                break
        if not is_duplicate:
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
