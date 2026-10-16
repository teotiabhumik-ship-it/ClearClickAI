"""
Unit Tests for AidUI Research Paper Dark Pattern Rules
Covers:
- Countdown Timer (Urgency)
- Low Stock Scarcity (Scarcity)
- High Demand Message (Scarcity)
- Activity Message (Social Proof)
- Nagging Review Prompt (Nagging)
- Gamification / Forced Referral (Gamification)
- Disguised Ads (Misdirection)
- Clean eCommerce negative control
"""

import pytest
from backend.app.schema import PageData, ExtractedElement, ExtractedCheckbox
from backend.app.detectors.hidden_charges import HiddenChargesDetector
from backend.app.detectors.cancellation import CancellationDetector
from backend.app.detectors.consent import ConsentDetector


def test_countdown_timer_detection():
    detector = HiddenChargesDetector()
    page = PageData(
        title="Flash Sale Checkout",
        visible_text="Limited Deal! Flash sale ends in 02:45:10. Total: $49.00",
        prices=[
            ExtractedElement(tag="div", text="$49.00", font_size_px=20.0, bbox=[10.0, 10.0, 100.0, 30.0]),
            ExtractedElement(tag="span", text="Flash sale ends in 02:45:10", font_size_px=14.0, bbox=[10.0, 50.0, 200.0, 20.0]),
        ]
    )
    findings = detector.detect(page)
    types = [f.type for f in findings]
    assert "countdown_timer" in types
    finding = next(f for f in findings if f.type == "countdown_timer")
    assert finding.category == "hidden_charges"
    assert "02:45:10" in finding.evidence


def test_low_stock_scarcity_detection():
    detector = HiddenChargesDetector()
    page = PageData(
        title="Product Page",
        visible_text="Deluxe Ergonomic Chair. Only 2 left in stock. Order within 15 mins for same day dispatch.",
        prices=[
            ExtractedElement(tag="span", text="$199.00", font_size_px=22.0, bbox=[10.0, 10.0, 100.0, 30.0]),
            ExtractedElement(tag="p", text="Only 2 left in stock", font_size_px=13.0, bbox=[10.0, 45.0, 150.0, 20.0]),
        ]
    )
    findings = detector.detect(page)
    types = [f.type for f in findings]
    assert "low_stock_scarcity" in types
    finding = next(f for f in findings if f.type == "low_stock_scarcity")
    assert "only 2 left in stock" in finding.evidence.lower()


def test_high_demand_scarcity_detection():
    detector = HiddenChargesDetector()
    page = PageData(
        title="Hotel Booking",
        visible_text="Grand Seaside Resort. 18 people are looking at this right now! In high demand.",
        prices=[
            ExtractedElement(tag="div", text="$140.00", font_size_px=24.0, bbox=[10.0, 10.0, 100.0, 30.0]),
        ]
    )
    findings = detector.detect(page)
    types = [f.type for f in findings]
    assert "high_demand_scarcity" in types
    finding = next(f for f in findings if f.type == "high_demand_scarcity")
    assert "18 people are looking at this right now" in finding.evidence.lower()


def test_activity_message_social_proof_detection():
    detector = HiddenChargesDetector()
    page = PageData(
        title="Trending Item",
        visible_text="Wireless Headphones. 150 items sold in the last 24 hours. Price: $79.00",
        prices=[
            ExtractedElement(tag="div", text="$79.00", font_size_px=20.0, bbox=[10.0, 10.0, 100.0, 30.0]),
        ]
    )
    findings = detector.detect(page)
    types = [f.type for f in findings]
    assert "activity_message" in types
    finding = next(f for f in findings if f.type == "activity_message")
    assert "150 items sold in the last 24 hours" in finding.evidence.lower()


def test_nagging_review_prompt_detection():
    detector = CancellationDetector()
    page = PageData(
        title="Reading App",
        visible_text="Enjoying our app? Rate us 5 stars on the store! Ask me later.",
        buttons=[
            ExtractedElement(tag="button", text="Rate Us Now ★★★★★", font_size_px=14.0, bbox=[50.0, 100.0, 140.0, 36.0]),
            ExtractedElement(tag="button", text="Ask me later", font_size_px=12.0, bbox=[50.0, 150.0, 100.0, 30.0]),
        ]
    )
    findings = detector.detect(page)
    types = [f.type for f in findings]
    assert "nagging_review" in types
    finding = next(f for f in findings if f.type == "nagging_review")
    assert finding.category == "cancellation"


def test_gamification_forced_referral_detection():
    detector = CancellationDetector()
    page = PageData(
        title="Prize Unlock",
        visible_text="Invite 3 friends to unlock 500 bonus tokens and continue reading.",
        buttons=[
            ExtractedElement(tag="button", text="Invite friends to unlock", font_size_px=14.0, bbox=[20.0, 80.0, 180.0, 40.0]),
        ]
    )
    findings = detector.detect(page)
    types = [f.type for f in findings]
    assert "gamification_referral" in types
    finding = next(f for f in findings if f.type == "gamification_referral")
    assert "invite 3 friends to unlock" in finding.evidence.lower()


def test_disguised_ads_detection():
    detector = ConsentDetector()
    page = PageData(
        title="News Feed",
        visible_text="Breaking News Headlines. Discover trending products today.",
        links=[
            ExtractedElement(
                tag="a",
                text="Sponsored",
                font_size_px=8.5,
                color="#cbd5e1",
                contrast_ratio=1.6,
                bbox=[200.0, 50.0, 50.0, 12.0],
                href="https://sponsor.example.com"
            )
        ]
    )
    findings = detector.detect(page)
    types = [f.type for f in findings]
    assert "disguised_ads" in types
    finding = next(f for f in findings if f.type == "disguised_ads")
    assert finding.category == "consent"


def test_clean_ecommerce_control_no_aidui_false_positives():
    detector_charges = HiddenChargesDetector()
    detector_cancel = CancellationDetector()
    detector_consent = ConsentDetector()

    clean_page = PageData(
        title="Fair Electronics Store",
        visible_text="Standard USB Cable. In Stock. Price: $12.00 inclusive of VAT. Standard 2-year warranty included. Account cancellation available in user settings.",
        prices=[
            ExtractedElement(tag="div", text="$12.00", font_size_px=18.0, bbox=[10.0, 10.0, 80.0, 24.0])
        ],
        buttons=[
            ExtractedElement(tag="button", text="Add to Cart", font_size_px=14.0, bbox=[10.0, 50.0, 120.0, 36.0])
        ]
    )

    f_charges = detector_charges.detect(clean_page)
    f_cancel = detector_cancel.detect(clean_page)
    f_consent = detector_consent.detect(clean_page)

    assert len(f_charges) == 0, f"False positive in charges: {[f.type for f in f_charges]}"
    assert len(f_cancel) == 0, f"False positive in cancellation: {[f.type for f in f_cancel]}"
    assert len(f_consent) == 0, f"False positive in consent: {[f.type for f in f_consent]}"
