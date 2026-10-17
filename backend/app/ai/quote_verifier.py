"""
Verbatim Quote and Element Verifier for ClearClick AI
Verifies that quotes and evidence provided by AI detectors exist in the extracted DOM elements,
enforces closed category/type lists, assigns severity strictly from code mapping,
and drops unverified or hallucinated findings with explicit rejection logging.
"""

import re
import logging
from typing import List, Tuple, Dict, Any, Optional, Union
from ..schema import Finding, PageData, ExtractedElement, ExtractedCheckbox
from ..config.thresholds import (
    ALLOWED_CATEGORIES,
    ALLOWED_TYPES,
    CATEGORY_ALLOWED_TYPES,
    SEVERITY_MAPPING,
    CONFIDENCE_AI_ONLY,
    MIN_QUOTE_LENGTH,
)

logger = logging.getLogger("clearclick.verifier")

UNICODE_QUOTE_REPLACEMENTS = {
    "\u201c": '"',  # left double quotation mark
    "\u201d": '"',  # right double quotation mark
    "\u201e": '"',  # double low-9 quotation mark
    "\u00ab": '"',  # left-pointing double angle quotation mark
    "\u00bb": '"',  # right-pointing double angle quotation mark
    "\u2018": "'",  # left single quotation mark
    "\u2019": "'",  # right single quotation mark
    "\u201a": "'",  # single low-9 quotation mark
    "\u02bb": "'",  # modifier letter turned comma
    "\u02bc": "'",  # modifier letter apostrophe
    "\u00b4": "'",  # acute accent
    "`": "'",
    "\u2013": "-",  # en dash
    "\u2014": "-",  # em dash
    "\u2015": "-",  # horizontal bar
    "\u2026": "...", # ellipsis
    "\u00a0": " ",  # non-breaking space
}


def normalize_text(text: str) -> str:
    """Normalize unicode quotes, dashes, ellipsis, and collapse whitespace."""
    if not text:
        return ""
    result = text
    for char, rep in UNICODE_QUOTE_REPLACEMENTS.items():
        result = result.replace(char, rep)
    # Collapse all whitespace and lowercase
    return " ".join(result.lower().split())


class QuoteVerifier:
    MIN_LENGTH = MIN_QUOTE_LENGTH
    rejected_count: int = 0
    total_proposals: int = 0
    rejected_log: List[Dict[str, Any]] = []

    @classmethod
    def reset_stats(cls):
        """Reset verifier rejection statistics."""
        cls.rejected_count = 0
        cls.total_proposals = 0
        cls.rejected_log = []

    @classmethod
    def get_stats(cls) -> Dict[str, Any]:
        """Return rejection statistics including count and rate."""
        rate = round(cls.rejected_count / cls.total_proposals, 3) if cls.total_proposals > 0 else 0.0
        return {
            "rejected_count": cls.rejected_count,
            "total_proposals": cls.total_proposals,
            "rejection_rate": rate,
            "rejected_log": list(cls.rejected_log)
        }

    @classmethod
    def record_rejection(cls, finding: Finding, reason: str):
        """Record dropped finding in rejection tracking log."""
        cls.rejected_count += 1
        cls.rejected_log.append({
            "element_id": finding.element_id or "unknown",
            "category": finding.category,
            "type": finding.type,
            "evidence": finding.evidence,
            "reason": reason
        })

    @classmethod
    def verify_finding(
        cls,
        finding: Finding,
        page_data_or_text: Union[PageData, str],
        page_data: Optional[PageData] = None
    ) -> Tuple[bool, str]:
        """
        Verify that an AI finding is grounded in actual extracted DOM data:
        1. Quote is not trivially short (>= MIN_QUOTE_LENGTH chars).
        2. Quote appears verbatim (normalized) in visible DOM text and/or specific element.
        3. Category and type belong to the closed allowed list.
        4. Bounding box and measurements are attached from extracted DOM facts.
        5. Severity is assigned strictly from code mapping.
        """
        pdata: Optional[PageData] = page_data if page_data is not None else (
            page_data_or_text if isinstance(page_data_or_text, PageData) else None
        )
        page_text: str = pdata.visible_text if pdata else (
            page_data_or_text if isinstance(page_data_or_text, str) else ""
        )

        if not finding.evidence or not str(finding.evidence).strip():
            return False, "Evidence is empty"

        # Force code-driven severity from documented mapping (AI cannot set severity)
        finding.severity = SEVERITY_MAPPING.get(finding.type, "medium")

        # Preserve rule measurements for deterministic rules
        if finding.source == "rule" and any(
            token in finding.evidence.lower()
            for token in [":", "px", "contrast", "ratio", "vs", "$", "€", "£", "step", "font"]
        ):
            return True, "Rule-based measurement accepted"

        # Clean evidence to isolate quote if wrapped in quotes or backticks
        clean_ev = str(finding.evidence).strip()
        quote_match = re.search(r"['\"`]{1,3}([^'\"`]{4,})['\"`]{1,3}", clean_ev)
        target_quote = quote_match.group(1).strip() if quote_match else clean_ev

        norm_quote = normalize_text(target_quote)
        norm_page = normalize_text(page_text)

        # 1. Enforce minimum quote length to prevent trivial fragment matching
        if len(norm_quote) < MIN_QUOTE_LENGTH:
            return False, f"Evidence quote too short ({len(norm_quote)} chars < {MIN_QUOTE_LENGTH} minimum required)"

        # 2. Check quote exists in visible page text
        quote_in_page = (norm_quote in norm_page) or (len(norm_quote) > 40 and norm_quote[:35] in norm_page)
        if not quote_in_page:
            return False, f"Quote '{target_quote}' was NOT found in the visible page text (anti-hallucination drop)"

        # 3. Element-tied verification if element_id is specified
        if pdata is not None:
            if finding.element_id:
                matched_el = pdata.get_element(finding.element_id)
                if not matched_el:
                    return False, f"Element ID '{finding.element_id}' was not found in extracted page elements"

                el_text = getattr(matched_el, "text", "") or getattr(matched_el, "label", "")
                norm_el_text = normalize_text(el_text)

                if norm_quote not in norm_el_text and (len(norm_quote) <= 40 or norm_quote[:35] not in norm_el_text):
                    return False, f"Quote '{target_quote}' does not appear in element {finding.element_id} text"

                if hasattr(matched_el, "bbox") and matched_el.bbox:
                    finding.bbox = matched_el.bbox
            elif finding.source == "ai":
                # AI findings strictly require an element_id when element IDs exist on the page
                has_extracted_ids = any(bool(getattr(el, "element_id", None)) for el in pdata.all_elements())
                if has_extracted_ids:
                    return False, "Missing element_id in AI finding (element_id is required)"
                else:
                    # Legacy or fixture PageData without element IDs: attempt bbox matching
                    for el in pdata.all_elements():
                        txt = getattr(el, "text", "") or getattr(el, "label", "")
                        norm_txt = normalize_text(txt)
                        if norm_quote in norm_txt or (len(norm_quote) > 40 and norm_quote[:35] in norm_txt):
                            if hasattr(el, "bbox") and el.bbox:
                                finding.bbox = el.bbox
                            break
            else:
                # Rule findings without element_id: attempt association if matching element exists
                for el in pdata.all_elements():
                    txt = getattr(el, "text", "") or getattr(el, "label", "")
                    norm_txt = normalize_text(txt)
                    if norm_quote in norm_txt or (len(norm_quote) > 40 and norm_quote[:35] in norm_txt):
                        finding.element_id = getattr(el, "element_id", None) or getattr(el, "id", None)
                        if hasattr(el, "bbox") and el.bbox:
                            finding.bbox = el.bbox
                        break

        # 4. Check closed category and type list
        if finding.category not in ALLOWED_CATEGORIES:
            return False, f"Disallowed category '{finding.category}' (not in allowed closed list)"
        
        allowed_types_for_cat = CATEGORY_ALLOWED_TYPES.get(finding.category, set())
        if finding.type not in ALLOWED_TYPES or finding.type not in allowed_types_for_cat:
            return False, f"Disallowed type '{finding.type}' for category '{finding.category}'"

        if finding.source == "ai":
            finding.confidence = CONFIDENCE_AI_ONLY

        return True, f"Quote verified in {'element ' + str(finding.element_id) if finding.element_id else 'visible page text'}"

    @classmethod
    def filter_findings(
        cls,
        findings: List[Finding],
        page_data_or_text: Union[PageData, str],
        page_data: Optional[PageData] = None
    ) -> List[Finding]:
        """Prune any finding that fails element-tied quote verification and log rejections."""
        cls.total_proposals += len(findings)
        valid_findings = []
        for f in findings:
            valid, reason = cls.verify_finding(f, page_data_or_text, page_data=page_data)
            if valid:
                valid_findings.append(f)
            else:
                cls.record_rejection(f, reason)
                logger.info(f"Rejected finding [{f.type}] (element: {f.element_id}): {reason}")
        return valid_findings
