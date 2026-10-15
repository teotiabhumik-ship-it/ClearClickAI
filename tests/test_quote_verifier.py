import pytest
from backend.app.schema import Finding
from backend.app.ai.quote_verifier import QuoteVerifier


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
