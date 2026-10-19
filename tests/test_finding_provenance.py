"""Regression tests for source-specific provenance on hybrid findings."""

from backend.app.main import consolidate_findings
from backend.app.schema import Finding


def _finding(*, source: str, confidence: float, evidence: str, why: str) -> Finding:
    return Finding(
        category="consent",
        type="preticked_consent",
        confidence=confidence,
        evidence=evidence,
        element_id="checkbox-1",
        why=why,
        safer_alternative="Require explicit opt-in",
        source=source,
    )


def test_finding_provenance_fields_are_optional_for_legacy_payloads():
    finding = _finding(
        source="rule",
        confidence=0.85,
        evidence="Pre-selected marketing checkbox",
        why="Checkbox is selected by default",
    )

    assert finding.rule_confidence is None
    assert finding.ai_confidence is None
    assert finding.rule_evidence is None
    assert finding.ai_evidence is None


def test_hybrid_finding_preserves_original_rule_and_ai_provenance():
    rule_finding = _finding(
        source="rule",
        confidence=0.82,
        evidence="Checkbox is pre-selected for marketing emails",
        why="The rule detector found a pre-selected checkbox",
    )
    ai_finding = _finding(
        source="ai",
        confidence=0.71,
        evidence="Marketing checkbox starts checked",
        why="The checked marketing option may steer consent",
    )

    [hybrid] = consolidate_findings([rule_finding], [ai_finding])

    assert hybrid.source == "hybrid"
    assert hybrid.confidence == 0.95
    assert hybrid.evidence == rule_finding.evidence
    assert hybrid.rule_confidence == 0.82
    assert hybrid.ai_confidence == 0.71
    assert hybrid.rule_evidence == rule_finding.evidence
    assert hybrid.ai_evidence == ai_finding.evidence


def test_standalone_findings_do_not_invent_cross_source_provenance():
    rule_finding = _finding(
        source="rule",
        confidence=0.84,
        evidence="Rule-only evidence",
        why="Rule-only explanation",
    )
    ai_finding = _finding(
        source="ai",
        confidence=0.64,
        evidence="AI-only evidence",
        why="AI-only explanation",
    )

    [rule_result] = consolidate_findings([rule_finding], [])
    [ai_result] = consolidate_findings([], [ai_finding])

    assert rule_result.rule_confidence is None
    assert rule_result.ai_confidence is None
    assert rule_result.rule_evidence is None
    assert rule_result.ai_evidence is None
    assert ai_result.rule_confidence is None
    assert ai_result.ai_confidence is None
    assert ai_result.rule_evidence is None
    assert ai_result.ai_evidence is None
