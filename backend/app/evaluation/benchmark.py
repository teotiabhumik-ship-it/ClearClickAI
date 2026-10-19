"""
Automated Evaluation and Benchmarking Suite for ClearClick AI.
Supports independent evaluation on 'dev' set and 'held_out' test set,
with separate side-by-side reporting for rules-only vs. rules+AI detectors,
disk-cached AI inference to prevent quota burn, and verifier rejection statistics.
"""

import os
import json
import asyncio
import argparse
from typing import Dict, Any, List, Optional

from ..schema import PageData, Finding
from ..extract.playwright_extractor import PageExtractor
from ..detectors.consent import ConsentDetector
from ..detectors.hidden_charges import HiddenChargesDetector
from ..detectors.cancellation import CancellationDetector
from ..ai.text_analysis import AITextDetector
from ..ai.vision_analysis import AIVisionDetector
from ..ai.quote_verifier import QuoteVerifier
from ..ai.client import AIClient
from ..config.settings import GEMINI_MODEL, AI_PROVIDER, CACHE_DIR


def _init_stats_structure(total_cases: int) -> Dict[str, Any]:
    return {
        "overall": {"tp": 0, "fp": 0, "fn": 0, "total": total_cases},
        "categories": {
            "consent": {"tp": 0, "fp": 0, "fn": 0},
            "hidden_charges": {"tp": 0, "fp": 0, "fn": 0},
            "cancellation": {"tp": 0, "fp": 0, "fn": 0},
        },
    }


def _calc_metrics(d: Dict[str, Any]) -> Dict[str, float]:
    tp, fp, fn = d["tp"], d["fp"], d["fn"]
    precision = round(tp / (tp + fp), 3) if (tp + fp) > 0 else (1.0 if fp == 0 else 0.0)
    recall = round(tp / (tp + fn), 3) if (tp + fn) > 0 else (1.0 if fn == 0 else 0.0)
    f1 = round(2 * precision * recall / (precision + recall), 3) if (precision + recall) > 0 else 0.0
    return {"precision": precision, "recall": recall, "f1": f1}


async def run_benchmark(
    split: str = "held_out",
    include_ai: bool = False,
    export_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes benchmark evaluation across ground-truth corpus.
    Evaluates rules-only and (optionally) rules+AI side-by-side,
    tracking QuoteVerifier rejection statistics and leveraging disk caching.
    """
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

    from ..main import consolidate_findings

    # Initialize detectors
    consent_detector = ConsentDetector()
    charges_detector = HiddenChargesDetector()
    cancel_detector = CancellationDetector()

    ai_text_detector = AITextDetector() if include_ai else None
    ai_vision_detector = AIVisionDetector() if include_ai else None
    ai_client = AIClient()

    # Reset QuoteVerifier rejection statistics for this benchmark run
    QuoteVerifier.reset_stats()

    rules_stats = _init_stats_structure(len(cases))
    ai_stats = _init_stats_structure(len(cases)) if include_ai else None

    details: List[Dict[str, Any]] = []

    mode_label = "RULES + AI (SIDE-BY-SIDE)" if include_ai else "RULES ONLY"
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

        # 1. Extract structured data from fixture
        page_data = await PageExtractor.extract_from_url_or_html(
            url=fixture_path,
            html_content=html_content
        )

        # 2. Run deterministic rule detectors
        rule_findings: List[Finding] = []
        rule_findings.extend(consent_detector.detect(page_data))
        rule_findings.extend(charges_detector.detect(page_data))
        rule_findings.extend(cancel_detector.detect(page_data))

        rule_pattern_types = list(set(f.type for f in rule_findings))
        is_clean_control = len(expected_patterns) == 0

        # Score Rules-Only against ground truth
        tp_r = len(set(rule_pattern_types).intersection(set(expected_patterns)))
        fn_r = len(set(expected_patterns) - set(rule_pattern_types))
        fp_r = len(rule_findings) if is_clean_control else len(set(rule_pattern_types) - set(expected_patterns))

        rules_stats["overall"]["tp"] += tp_r
        rules_stats["overall"]["fp"] += fp_r
        rules_stats["overall"]["fn"] += fn_r

        if expected_category in rules_stats["categories"]:
            rules_stats["categories"][expected_category]["tp"] += tp_r
            rules_stats["categories"][expected_category]["fp"] += fp_r
            rules_stats["categories"][expected_category]["fn"] += fn_r

        # 3. Run AI detectors (cached on disk) if enabled
        combined_pattern_types = list(rule_pattern_types)
        tp_c, fp_c, fn_c = tp_r, fp_r, fn_r

        if include_ai and ai_text_detector and ai_vision_detector:
            ai_tf, _, _ = await ai_text_detector.detect(page_data)
            ai_vf, _, _ = await ai_vision_detector.detect(page_data)
            combined_findings = consolidate_findings(rule_findings, ai_tf + ai_vf)
            combined_pattern_types = list(set(f.type for f in combined_findings))

            tp_c = len(set(combined_pattern_types).intersection(set(expected_patterns)))
            fn_c = len(set(expected_patterns) - set(combined_pattern_types))
            fp_c = len(combined_findings) if is_clean_control else len(set(combined_pattern_types) - set(expected_patterns))

            ai_stats["overall"]["tp"] += tp_c
            ai_stats["overall"]["fp"] += fp_c
            ai_stats["overall"]["fn"] += fn_c

            if expected_category in ai_stats["categories"]:
                ai_stats["categories"][expected_category]["tp"] += tp_c
                ai_stats["categories"][expected_category]["fp"] += fp_c
                ai_stats["categories"][expected_category]["fn"] += fn_c

        # Record case outcome
        eval_tp, eval_fp, eval_fn = (tp_c, fp_c, fn_c) if include_ai else (tp_r, fp_r, fn_r)
        status_flag = "PASS" if (eval_fn == 0 and eval_fp == 0) else "FAIL"
        display_types = combined_pattern_types if include_ai else rule_pattern_types
        print(f"[{status_flag:4}] {case_id:45} Expected: {expected_patterns} | Detected: {display_types}")

        details.append({
            "id": case_id,
            "status": status_flag,
            "category": expected_category,
            "expected": expected_patterns,
            "detected": display_types,
            "rules_detected": rule_pattern_types,
            "tp": eval_tp,
            "fp": eval_fp,
            "fn": eval_fn,
        })

    # Calculate final metrics without changing scoring mathematics
    rules_metrics = _calc_metrics(rules_stats["overall"])
    rules_stats["overall"].update(rules_metrics)
    for cat in rules_stats["categories"]:
        rules_stats["categories"][cat].update(_calc_metrics(rules_stats["categories"][cat]))

    if include_ai and ai_stats:
        ai_metrics = _calc_metrics(ai_stats["overall"])
        ai_stats["overall"].update(ai_metrics)
        for cat in ai_stats["categories"]:
            ai_stats["categories"][cat].update(_calc_metrics(ai_stats["categories"][cat]))

    verifier_stats = QuoteVerifier.get_stats()

    # Console Summary Display
    print("\n-----------------------------------------------------------------")
    print(f"RULES-ONLY [{split.upper()}]: Precision: {rules_metrics['precision']:.1%} | Recall: {rules_metrics['recall']:.1%} | F1: {rules_metrics['f1']:.3f} (TP={rules_stats['overall']['tp']}, FP={rules_stats['overall']['fp']}, FN={rules_stats['overall']['fn']})")
    if include_ai and ai_stats:
        print(f"RULES + AI [{split.upper()}]: Precision: {ai_metrics['precision']:.1%} | Recall: {ai_metrics['recall']:.1%} | F1: {ai_metrics['f1']:.3f} (TP={ai_stats['overall']['tp']}, FP={ai_stats['overall']['fp']}, FN={ai_stats['overall']['fn']})")
        print("-----------------------------------------------------------------")
        print(f"Verifier Rejection Stats: Total Proposals={verifier_stats['total_proposals']} | Rejected={verifier_stats['rejected_count']} | Rejection Rate={verifier_stats['rejection_rate']:.1%}")
    print("-----------------------------------------------------------------")
    for cat in rules_stats["categories"]:
        r_m = rules_stats["categories"][cat]
        ai_str = ""
        if include_ai and ai_stats:
            c_m = ai_stats["categories"][cat]
            ai_str = f" -> Rules+AI: P={c_m['precision']:.1%}, R={c_m['recall']:.1%}, F1={c_m['f1']:.3f}"
        print(f"  - {cat:15}: Rules: P={r_m['precision']:.1%}, R={r_m['recall']:.1%}, F1={r_m['f1']:.3f}{ai_str}")
    print("=================================================================\n")

    # Export only when explicitly requested. A benchmark/API read should not
    # mutate tracked frontend data as a side effect.
    if export_path:
        try:
            from datetime import datetime, timezone
            eval_file = os.path.abspath(os.path.expanduser(export_path))
            os.makedirs(os.path.dirname(eval_file), exist_ok=True)

            dev_labels_file = os.path.join(corpus_dir, "dev_labels.json")
            dev_count = 0
            dev_clean = 0
            if os.path.exists(dev_labels_file):
                with open(dev_labels_file, "r", encoding="utf-8") as df:
                    dev_data = json.load(df)
                    dev_count = len(dev_data)
                    dev_clean = sum(1 for c in dev_data if len(c.get("patterns", [])) == 0)

            held_clean = sum(1 for c in cases if len(c.get("patterns", [])) == 0)

            failures_list = []
            for d in details:
                if d["status"] == "FAIL":
                    failures_list.append({
                        "title": d["id"],
                        "description": f"Expected: {d['expected'] or 'Clean control'}, Detected: {d['detected'] or 'None'} (FP: {d['fp']}, FN: {d['fn']})"
                    })

            export_data = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "provider": AI_PROVIDER if include_ai else None,
                "model": GEMINI_MODEL if include_ai else None,
                "datasets": {
                    "dev": dev_count,
                    "heldout": len(cases),
                    "heldout_source": "mixed",
                    "clean": dev_clean + held_clean
                },
                "categories": {
                    cat: {
                        "rules": {
                            "precision": rules_stats["categories"][cat]["precision"],
                            "recall": rules_stats["categories"][cat]["recall"],
                            "tp": rules_stats["categories"][cat]["tp"],
                            "fp": rules_stats["categories"][cat]["fp"],
                            "fn": rules_stats["categories"][cat]["fn"]
                        },
                        "rules_ai": {
                            "precision": ai_stats["categories"][cat]["precision"],
                            "recall": ai_stats["categories"][cat]["recall"],
                            "tp": ai_stats["categories"][cat]["tp"],
                            "fp": ai_stats["categories"][cat]["fp"],
                            "fn": ai_stats["categories"][cat]["fn"]
                        } if (include_ai and ai_stats) else None
                    }
                    for cat in ["hidden_charges", "cancellation", "consent"]
                },
                "verifier_stats": verifier_stats if include_ai else None,
                "failures": failures_list
            }
            with open(eval_file, "w", encoding="utf-8") as ef:
                json.dump(export_data, ef, indent=2)
        except Exception as e:
            print(f"[WARN] Failed to export benchmark results to {export_path}: {e}")

    return {
        "split": split,
        "include_ai": include_ai,
        "ai_status": "completed" if (include_ai and ai_client.has_any_key) else ("not_run" if not include_ai else "no_key"),
        "ai_status_message": "AI analysis active" if (include_ai and ai_client.has_any_key) else "AI analysis not run (rules-only mode or no key)",
        "rules": rules_stats,
        "rules_ai": ai_stats if include_ai else None,
        "verifier_stats": verifier_stats,
        "overall": ai_stats["overall"] if (include_ai and ai_stats) else rules_stats["overall"],
        "categories": ai_stats["categories"] if (include_ai and ai_stats) else rules_stats["categories"],
        "details": details
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the ClearClick AI benchmark.")
    parser.add_argument("split", nargs="?", choices=["dev", "held_out"], default="held_out")
    parser.add_argument("--with-ai", "--ai", dest="with_ai", action="store_true")
    parser.add_argument("--rules-only", "--no-ai", dest="with_ai", action="store_false")
    parser.add_argument(
        "--export",
        metavar="PATH",
        help="Explicitly write the JSON report to PATH; omitted by default.",
    )
    parser.set_defaults(with_ai=False)
    args = parser.parse_args()

    asyncio.run(run_benchmark(split=args.split, include_ai=args.with_ai, export_path=args.export))
