import pytest
from backend.app.schema import Finding
from backend.app.ai.quote_verifier import QuoteVerifier, normalize_text


def test_quote_verifier_accepts_valid_quote():
    page_text = "Welcome to our portal. Uncheck this box if you do not wish to not receive partner promotions."
    finding = Finding(
        category="consent",
        type="double_negative_language",
        severity="high",
        confidence=0.9,
        evidence="do not wish to not receive",
        bbox=[0, 0, 0, 0],
        why="Deceptive phrasing",
        safer_alternative="Use clear phrasing",
        source="ai"
    )

    valid, reason = QuoteVerifier.verify_finding(finding, page_text)
    assert valid is True
    assert "verified" in reason.lower()


def test_quote_verifier_normalizes_curly_quotes_and_whitespace():
    # DOM contains curly quotes and irregular spaces
    page_text = "Click here if you “do not agree to decline” promotional emails."
    # Finding contains straight ASCII quotes and extra spacing
    finding = Finding(
        category="consent",
        type="double_negative_language",
        severity="medium",
        confidence=0.85,
        evidence='"do not agree to decline"',
        bbox=[0, 0, 0, 0],
        why="Misleading negative toggle",
        safer_alternative="Provide clean opt-out",
        source="ai"
    )

    valid, reason = QuoteVerifier.verify_finding(finding, page_text)
    assert valid is True, f"Failed curly quote normalization: {reason}"


def test_quote_verifier_rejects_too_short_quote():
    page_text = "Cancel subscription anytime without fee."
    finding = Finding(
        category="cancellation",
        type="cancel_barrier",
        severity="low",
        confidence=0.5,
        evidence="Cancel",  # Only 6 characters (< 12)
        bbox=[0, 0, 0, 0],
        why="Vague wording",
        safer_alternative="Clear cancellation",
        source="ai"
    )

    valid, reason = QuoteVerifier.verify_finding(finding, page_text)
    assert valid is False
    assert "too short" in reason.lower()


def test_quote_verifier_rejects_hallucinated_quote():
    page_text = "Welcome to our portal. We respect your choices and preferences."
    finding = Finding(
        category="consent",
        type="hallucinated_finding",
        severity="high",
        confidence=0.9,
        evidence="You have been automatically enrolled in our secret recurring bill of $99/mo",
        bbox=[0, 0, 0, 0],
        why="Fake hallucinated dark pattern",
        safer_alternative="None",
        source="ai"
    )

    valid, reason = QuoteVerifier.verify_finding(finding, page_text)
    assert valid is False
    assert "NOT found" in reason

    filtered = QuoteVerifier.filter_findings([finding], page_text)
    assert len(filtered) == 0, "Hallucinated finding was not pruned by filter_findings!"


def test_quote_verifier_preserves_rule_measurements():
    finding = Finding(
        category="hidden_charges",
        type="low_contrast_fee",
        severity="medium",
        confidence=0.85,
        evidence="contrast ratio: 1.8:1 below 4.5:1 threshold (fee: $15.00)",
        bbox=[10, 20, 100, 30],
        why="Contrast too low",
        safer_alternative="Increase contrast",
        source="rule"
    )

    valid, reason = QuoteVerifier.verify_finding(finding, "Some page content")
    assert valid is True
    assert "measurement accepted" in reason.lower()
