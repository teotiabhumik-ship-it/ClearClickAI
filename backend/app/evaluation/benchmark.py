"""
Automated Evaluation and Benchmarking Suite for ClearClick AI
Supports independent evaluation on 'dev' set and 'held_out' test set,
with separate reporting for rule-only vs. rule-plus-AI detectors.
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
from ..ai.text_analysis import AITextDetector
from ..ai.vision_analysis import AIVisionDetector
from ..ai.client import AIClient


async def run_benchmark(split: str = "held_out", include_ai: bool = False) -> Dict[str, Any]:
    corpus_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "corpus"))
    
    if split == "dev":
        labels_file = os.path.join(corpus_dir, "dev_labels.json")
    elif split == "held_out":
        labels_file = os.path.join(corpus_dir, "held_out_labels.json")
    else:
        labels_file = os.path.join(corpus_dir, "held_out_labels.json")

    if not os.path.exists(labels_file):
        raise FileNotFoundError(f"Labels file not found at {labels_file}")

    with open(labels_file, "r", encoding="utf-8") as f:
        cases = json.load(f)

    consent_detector = ConsentDetector()
    charges_detector = HiddenChargesDetector()
    cancel_detector = CancellationDetector()

    ai_text_detector = AITextDetector() if include_ai else None
    ai_vision_detector = AIVisionDetector() if include_ai else None
    ai_client = AIClient()

    stats = {
        "split": split,
        "include_ai": include_ai,
        "ai_status": "completed" if (include_ai and ai_client.has_any_key) else ("not_run" if not include_ai else "no_key"),
        "ai_status_message": "AI analysis active" if (include_ai and ai_client.has_any_key) else "AI analysis not run (rules-only mode or no key)",
        "overall": {"tp": 0, "fp": 0, "fn": 0, "total": len(cases)},
        "categories": {
            "consent": {"tp": 0, "fp": 0, "fn": 0},
            "hidden_charges": {"tp": 0, "fp": 0, "fn": 0},
            "cancellation": {"tp": 0, "fp": 0, "fn": 0},
        },
        "details": []
    }

    mode_label = "RULES + AI" if include_ai else "RULES ONLY"
    print("=================================================================")
    print(f"  ClearClick AI — Evaluation Benchmark [SPLIT: {split.upper()} | {mode_label}]  ")
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

        # Run rule detectors
        detected_findings: List[Finding] = []
        detected_findings.extend(consent_detector.detect(page_data))
        detected_findings.extend(charges_detector.detect(page_data))
        detected_findings.extend(cancel_detector.detect(page_data))

        # Run AI detectors if enabled
        if include_ai and ai_text_detector and ai_vision_detector:
            ai_tf, _, _ = await ai_text_detector.detect(page_data)
            ai_vf, _, _ = await ai_vision_detector.detect(page_data)
            detected_findings.extend(ai_tf)
            detected_findings.extend(ai_vf)

        detected_pattern_types = list(set(f.type for f in detected_findings))
        is_clean_control = len(expected_patterns) == 0

        # Evaluate against ground truth
        matched_tp = set(detected_pattern_types).intersection(set(expected_patterns))
        tp = len(matched_tp)
        fn = len(set(expected_patterns) - set(detected_pattern_types))
        
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
        print(f"[{status_flag:4}] {case_id:45} Expected: {expected_patterns} | Detected: {detected_pattern_types}")

        stats["details"].append({
            "id": case_id,
            "status": status_flag,
            "category": expected_category,
            "expected": expected_patterns,
            "detected": detected_pattern_types,
            "tp": tp,
            "fp": fp,
            "fn": fn
        })

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
    print(f"OVERALL [{split.upper()} - {mode_label}]: Precision: {overall_metrics['precision']:.1%} | Recall: {overall_metrics['recall']:.1%} | F1: {overall_metrics['f1']:.3f}")
    print(f"Counts: Total Cases: {len(cases)} | TP: {stats['overall']['tp']} | FP: {stats['overall']['fp']} | FN: {stats['overall']['fn']}")
    print("-----------------------------------------------------------------")
    for cat, m in stats["categories"].items():
        print(f"  - {cat:15}: Precision={m['precision']:.1%}, Recall={m['recall']:.1%}, F1={m['f1']:.3f} (TP={stats['categories'][cat]['tp']}, FP={stats['categories'][cat]['fp']}, FN={stats['categories'][cat]['fn']})")
    print("=================================================================\n")

    return stats


if __name__ == "__main__":
    split_arg = "held_out"
    with_ai_arg = False

    for arg in sys.argv[1:]:
        if arg in ["dev", "held_out"]:
            split_arg = arg
        elif arg in ["--with-ai", "--ai"]:
            with_ai_arg = True

    asyncio.run(run_benchmark(split=split_arg, include_ai=with_ai_arg))
