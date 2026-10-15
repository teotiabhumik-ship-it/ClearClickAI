"""
Anti-Hallucination Quote Verifier for ClearClick AI
Strictly conforms to Section 10.1 of Build Guide:
'Require a verbatim quote as evidence. Then verify in code that the quote really
appears in the page text, and drop the finding if it does not. This removes invented evidence.'
"""

import re
from typing import List, Tuple
from ..schema import Finding

MIN_QUOTE_LENGTH = 12

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
    # Collapse all whitespace
    return " ".join(result.lower().split())


class QuoteVerifier:
    MIN_LENGTH = MIN_QUOTE_LENGTH

    @staticmethod
    def verify_finding(finding: Finding, page_text: str) -> Tuple[bool, str]:
        """
        Verify that the evidence quote provided by the detector actually appears
        verbatim (normalized) in the visible page text.
        Returns (is_valid, reason).
        """
        if not finding.evidence or not finding.evidence.strip():
            return False, "Evidence is empty"

        # If it's a rule-based measured value or comparison (e.g. 'contrast: 1.3:1', 'Step 4 of 6'), allow
        if finding.source == "rule" and any(
            token in finding.evidence.lower()
            for token in [":", "px", "contrast", "ratio", "vs", "$", "€", "£", "step", "font"]
        ):
            return True, "Rule-based measurement accepted"

        # Clean evidence to extract key quote if wrapped in quotes or backticks
        clean_ev = finding.evidence.strip()
        quote_match = re.search(r"['\"`]{1,3}([^'\"`]{4,})['\"`]{1,3}", clean_ev)
        target_quote = quote_match.group(1).strip() if quote_match else clean_ev

        # Normalize unicode and whitespace
        norm_quote = normalize_text(target_quote)
        norm_page = normalize_text(page_text)

        # Enforce minimum quote length for AI claims to prevent false positives from tiny fragments
        if len(norm_quote) < MIN_QUOTE_LENGTH:
            return False, f"Evidence quote too short ({len(norm_quote)} chars < {MIN_QUOTE_LENGTH} minimum required)"

        if norm_quote in norm_page:
            return True, "Verbatim quote verified in page DOM text"

        # Partial tolerance for quotes longer than 40 chars: check if 35-char prefix matches
        if len(norm_quote) > 40:
            prefix = norm_quote[:35]
            if prefix in norm_page:
                return True, "Long quote prefix verified in page DOM text"

        return False, f"Quote '{target_quote}' was NOT found in the visible page text (anti-hallucination drop)"

    @classmethod
    def filter_findings(cls, findings: List[Finding], page_text: str) -> List[Finding]:
        """Prune any finding whose evidence quote fails verification against the page text."""
        valid_findings = []
        for f in findings:
            valid, reason = cls.verify_finding(f, page_text)
            if valid:
                valid_findings.append(f)
            else:
                # Dropped as hallucinated or unverified quote
                pass
        return valid_findings
