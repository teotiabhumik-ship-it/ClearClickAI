from backend.app.schema import FlowData, PageData, FlowInteractionMetadata
from backend.app.detectors.flow_analysis import FlowAnalyzer


def _cancellation_steps(count: int):
    return [
        PageData(
            title=f"Cancel step {index}",
            visible_text=f"Cancellation step {index}: continue cancellation",
        )
        for index in range(1, count + 1)
    ]


def test_one_step_signup_vs_four_step_cancellation_distinguishes_raw_and_comparative_friction():
    finding = FlowAnalyzer.analyze_flow(
        FlowData(
            flow_type="cancellation",
            steps=_cancellation_steps(4),
            signup_steps_count=1,
        )
    )[0]

    assert finding.type == "asymmetric_cancellation_steps"
    assert "Raw cancellation step count: 4" in finding.evidence
    assert "Comparative friction evidence" in finding.evidence
    assert "vs. 1 step for signup" in finding.evidence


def test_equal_step_flows_do_not_claim_asymmetric_friction():
    findings = FlowAnalyzer.analyze_flow(
        FlowData(
            flow_type="cancellation",
            steps=_cancellation_steps(4),
            signup_steps_count=4,
        )
    )

    assert findings == []


def test_retention_metadata_can_establish_friction_when_step_counts_are_equal():
    findings = FlowAnalyzer.analyze_flow(
        FlowData(
            flow_type="cancellation",
            steps=_cancellation_steps(4),
            signup_steps_count=4,
            signup_interaction_metadata=FlowInteractionMetadata(
                retention_prompts=0,
                required_actions=["submit signup"],
            ),
            cancellation_interaction_metadata=FlowInteractionMetadata(
                retention_prompts=["discount offer", "survey"],
                required_actions=["submit survey"],
            ),
        )
    )

    assert len(findings) == 1
    assert findings[0].type == "asymmetric_cancellation_steps"
    assert "Raw cancellation step count: 4" in findings[0].evidence
    assert "retention prompts: cancellation 2 vs signup 0" in findings[0].evidence


def test_ambiguous_interaction_metadata_returns_review_needed():
    findings = FlowAnalyzer.analyze_flow(
        FlowData(
            flow_type="cancellation",
            steps=_cancellation_steps(4),
            signup_steps_count=4,
            cancellation_interaction_metadata=FlowInteractionMetadata(retention_prompts=2),
        )
    )

    assert len(findings) == 1
    assert findings[0].type == "review_needed"
    assert findings[0].severity == "low"
    assert "Review needed" in findings[0].evidence
    assert "comparable" in findings[0].evidence
