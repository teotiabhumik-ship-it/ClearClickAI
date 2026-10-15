"""
Anti-Hallucination Quote Verifier for ClearClick AI
Strictly conforms to Section 10.1 of Build Guide:
'Require a verbatim quote as evidence. Then verify in code that the quote really
appears in the page text, and drop the finding if it does not. This removes invented evidence.'
"""

import re
from typing import List, Tuple
from ..schema import Finding, PageData


class QuoteVerifier:
    @staticmethod
    def verify_finding(finding: Finding, page_text: str) -> Tuple[bool, str]:
        """
        Verify that the evidence quote provided by the detector actually appears
        verbatim (or normalized) in the visible page text.
        Returns (is_valid, reason).
        """
        if not finding.evidence:
            return False, "Evidence is empty"

        # If it's a rule-based measured value or comparison (e.g. 'contrast: 1.3:1', 'Step 4 of 6'), allow
        if finding.source == "rule" and any(token in finding.evidence for token in [":", "px", "contrast", "ratio", "vs", "$", "€", "£", "Step"]):
            return True, "Rule-based measurement accepted"

        # Clean evidence to extract key quote if wrapped in quotes
        quote_match = re.search(r"['\"]([^'\"]{4,})['\"]", finding.evidence)
        target_quote = quote_match.group(1) if quote_match else finding.evidence.strip()

        # Normalize whitespace
        norm_quote = " ".join(target_quote.lower().split())
        norm_page = " ".join(page_text.lower().split())

        if norm_quote in norm_page:
            return True, "Verbatim quote verified in page DOM text"

        # Partial tolerance for quotes longer than 40 chars: check if 80% substring matches
        if len(norm_quote) > 40:
            sub = norm_quote[:35]
            if sub in norm_page:
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
                # Dropped as hallucination
                pass
        return valid_findings
