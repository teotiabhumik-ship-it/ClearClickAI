"""Focused calibration and overlapping-signal regression tests."""

from backend.app.main import consolidate_findings
from backend.app.schema import Finding


def _finding(*, finding_type: str, confidence: float, evidence: str, element_id: str = "fee-1") -> Finding:
    return Finding(
        category="hidden_charges",
        type=finding_type,
        confidence=confidence,
        evidence=evidence,
        element_id=element_id,
        why="Measured fee signal",
        safer_alternative="Show the fee clearly",
    )


def test_signal_strength_is_derived_from_confidence_and_old_payloads_still_parse():
    assert _finding(finding_type="microprint_fee", confidence=0.95, evidence="large confidence").signal_strength == "high"
    assert _finding(finding_type="microprint_fee", confidence=0.80, evidence="medium confidence").signal_strength == "medium"
    assert _finding(finding_type="microprint_fee", confidence=0.60, evidence="needs review").signal_strength == "review"

    legacy = Finding.model_validate({
        "category": "hidden_charges",
        "type": "microprint_fee",
        "confidence": 0.91,
        "evidence": "legacy fee evidence",
        "why": "legacy finding",
        "safer_alternative": "show it clearly",
    })
    assert legacy.signal_strength == "high"
    assert legacy.related_signals == []


def test_overlapping_fee_signals_share_one_finding_and_keep_both_measurements():
    microprint = _finding(
        finding_type="microprint_fee",
        confidence=0.91,
        evidence="Fee rendered at 8px",
    )
    contrast = _finding(
        finding_type="low_contrast_fee",
        confidence=0.94,
        evidence="Fee contrast is 1.3:1",
    )

    consolidated = consolidate_findings([microprint, contrast], [])

    assert len(consolidated) == 1
    assert consolidated[0].type == "microprint_fee"
    assert consolidated[0].evidence == "Fee rendered at 8px"
    assert len(consolidated[0].related_signals) == 1
    related = consolidated[0].related_signals[0]
    assert related.type == "low_contrast_fee"
    assert related.evidence == "Fee contrast is 1.3:1"
    assert related.signal_strength == "high"


def test_fee_signals_on_different_elements_remain_distinct():
    microprint = _finding(
        finding_type="microprint_fee",
        confidence=0.91,
        evidence="Fee A rendered at 8px",
        element_id="fee-a",
    )
    contrast = _finding(
        finding_type="low_contrast_fee",
        confidence=0.94,
        evidence="Fee B contrast is 1.3:1",
        element_id="fee-b",
    )

    consolidated = consolidate_findings([microprint, contrast], [])

    assert len(consolidated) == 2
    assert all(not finding.related_signals for finding in consolidated)


def test_nested_fee_evidence_is_collapsed_without_stable_element_ids():
    outer = _finding(
        finding_type="low_contrast_fee",
        confidence=0.94,
        evidence="Fee: 'Processing surcharge $4.00' contrast is 3.2:1",
        element_id="",
    )
    nested = _finding(
        finding_type="low_contrast_fee",
        confidence=0.94,
        evidence="Fee: 'Processing surcharge' contrast is 3.2:1",
        element_id="",
    )

    consolidated = consolidate_findings([outer, nested], [])

    assert len(consolidated) == 1
    assert consolidated[0].type == "low_contrast_fee"
