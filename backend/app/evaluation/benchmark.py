"""
Automated Evaluation and Benchmarking Suite for ClearClick AI
Calculates True Positives, False Positives, False Negatives, Precision, and Recall
across all corpus fixtures in corpus/labels.json.
"""

import os
import sys
import json
import asyncio
from typing import Dict, Any, List

from ..schema import PageData, Finding
from ..extract.playwright_extractor import PageExtractor
from ..detectors.consent import ConsentDetector
from ..detectors.hidden_charges import HiddenChargesDetector
from ..detectors.cancellation import CancellationDetector


async def run_benchmark() -> Dict[str, Any]:
    corpus_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "corpus"))
    labels_file = os.path.join(corpus_dir, "labels.json")

    if not os.path.exists(labels_file):
        raise FileNotFoundError(f"labels.json not found at {labels_file}")

    with open(labels_file, "r", encoding="utf-8") as f:
        cases = json.load(f)

    consent_detector = ConsentDetector()
    charges_detector = HiddenChargesDetector()
    cancel_detector = CancellationDetector()

    stats = {
        "overall": {"tp": 0, "fp": 0, "fn": 0, "total": len(cases)},
        "categories": {
            "consent": {"tp": 0, "fp": 0, "fn": 0},
            "hidden_charges": {"tp": 0, "fp": 0, "fn": 0},
            "cancellation": {"tp": 0, "fp": 0, "fn": 0},
        },
        "details": []
    }

    print("=================================================================")
    print("  ClearClick AI - Running Ground-Truth Evaluation Benchmark       ")
    print("=================================================================\n")

    for case in cases:
        case_id = case["id"]
        rel_path = case["file"]
        expected_patterns = case.get("patterns", [])
        expected_category = case.get("category", "")
        fixture_path = os.path.join(corpus_dir, rel_path)

        if not os.path.exists(fixture_path):
            print(f"[MISSING] Fixture file not found: {fixture_path}")
            continue

        with open(fixture_path, "r", encoding="utf-8") as hf:
            html_content = hf.read()

        # Extract structured data
        page_data = await PageExtractor.extract_from_url_or_html(
            url=fixture_path,
            html_content=html_content
        )

        # Run detectors
        detected_findings: List[Finding] = []
        detected_findings.extend(consent_detector.detect(page_data))
        detected_findings.extend(charges_detector.detect(page_data))
        detected_findings.extend(cancel_detector.detect(page_data))

        detected_pattern_types = [f.type for f in detected_findings]
        is_clean_control = len(expected_patterns) == 0

        # Evaluate against ground truth
        matched_tp = set(detected_pattern_types).intersection(set(expected_patterns))
        tp = len(matched_tp)
        fn = len(set(expected_patterns) - set(detected_pattern_types))
        
        # If clean control, any finding is false positive.
        # If positive case, any unexpected pattern is false positive.
        if is_clean_control:
            fp = len(detected_findings)
        else:
            fp = len(set(detected_pattern_types) - set(expected_patterns))

        stats["overall"]["tp"] += tp
        stats["overall"]["fp"] += fp
        stats["overall"]["fn"] += fn

        if expected_category in stats["categories"]:
            stats["categories"][expected_category]["tp"] += tp
            stats["categories"][expected_category]["fp"] += fp
            stats["categories"][expected_category]["fn"] += fn

        status_flag = "PASS" if (fn == 0 and fp == 0) else "FAIL"
        print(f"[{status_flag}] {case_id:30} Expected: {expected_patterns} | Detected: {detected_pattern_types}")

        stats["details"].append({
            "id": case_id,
            "status": status_flag,
            "expected": expected_patterns,
            "detected": detected_pattern_types,
            "tp": tp,
            "fp": fp,
            "fn": fn
        })

    # Calculate metrics
    def calc_metrics(d):
        tp, fp, fn = d["tp"], d["fp"], d["fn"]
        precision = round(tp / (tp + fp), 3) if (tp + fp) > 0 else (1.0 if fp == 0 else 0.0)
        recall = round(tp / (tp + fn), 3) if (tp + fn) > 0 else (1.0 if fn == 0 else 0.0)
        f1 = round(2 * precision * recall / (precision + recall), 3) if (precision + recall) > 0 else 0.0
        return {"precision": precision, "recall": recall, "f1": f1}

    overall_metrics = calc_metrics(stats["overall"])
    stats["overall"].update(overall_metrics)

    for cat in stats["categories"]:
        stats["categories"][cat].update(calc_metrics(stats["categories"][cat]))

    print("\n-----------------------------------------------------------------")
    print(f"OVERALL RESULTS: Precision: {overall_metrics['precision']:.1%} | Recall: {overall_metrics['recall']:.1%} | F1: {overall_metrics['f1']:.3f}")
    print(f"TP: {stats['overall']['tp']} | FP: {stats['overall']['fp']} | FN: {stats['overall']['fn']}")
    print("-----------------------------------------------------------------")
    for cat, m in stats["categories"].items():
        print(f"  - {cat:15}: Precision={m['precision']:.1%}, Recall={m['recall']:.1%}, F1={m['f1']:.3f}")
    print("=================================================================\n")

    return stats


if __name__ == "__main__":
    asyncio.run(run_benchmark())
