"""
Site Scanning Evaluation Script for ClearClick AI.
Runs an automated scan across a configured list of test sites and records
coverage statistics (key page types found & reached, block rates, AI calls used, time per site)
into a structured JSON evaluation report.

IMPORTANT:
Only run this script on local fixture sites or websites that you own or have explicit
authorization to scan. ClearClick strictly respects robots.txt, concurrency limits, and
delays, and never attempts to bypass bot protections.
"""

import sys
import os
import time
import json
import asyncio
import argparse
from typing import List, Dict, Any

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.crawler.scan_manager import ScanManager
from backend.app.schema import Scan


DEFAULT_TEST_SITES = [
    "http://127.0.0.1:8000/sample/ecommerce",
    "http://127.0.0.1:8000/sample/subscription",
]


async def evaluate_site_scans(
    target_sites: List[str],
    output_file: str,
    include_ai: bool = False,
    max_pages: int = 8,
) -> Dict[str, Any]:
    """
    Executes scans on target sites and compiles coverage telemetry.
    """
    manager = ScanManager()
    site_evaluations: List[Dict[str, Any]] = []
    total_start_time = time.time()

    print(f"\n=======================================================")
    print(f"ClearClick AI - Multi-Page Scan Coverage Evaluator")
    print(f"Target Sites: {len(target_sites)}")
    print(f"AI Inspection: {'Enabled' if include_ai else 'Disabled (Rules only)'}")
    print(f"Max Pages per Site: {max_pages}")
    print(f"=======================================================\n")

    for idx, site_url in enumerate(target_sites, start=1):
        print(f"[{idx}/{len(target_sites)}] Evaluating: {site_url} ...")
        site_start = time.time()

        scan = manager.create_scan(
            root_url=site_url,
            include_ai=include_ai,
            max_pages=max_pages
        )

        try:
            # Execute scan job
            await manager._run_scan_job(scan.scan_id)
            completed_scan: Scan = manager.get_scan(scan.scan_id) or scan
            elapsed = time.time() - site_start

            record = {
                "site_url": site_url,
                "scan_id": scan.scan_id,
                "status": completed_scan.status,
                "elapsed_seconds": round(elapsed, 2),
                "pages_discovered": completed_scan.coverage.pages_discovered,
                "pages_analysed": completed_scan.coverage.pages_analysed,
                "pages_blocked": completed_scan.coverage.pages_blocked,
                "pages_needs_login": completed_scan.coverage.pages_needs_login,
                "pages_ai_analysed": completed_scan.coverage.pages_ai_analysed,
                "ai_calls_used": completed_scan.coverage.ai_calls_used,
                "key_page_types_found": completed_scan.coverage.key_page_types_found,
                "key_page_types_reached": completed_scan.coverage.key_page_types_reached,
                "skipped_breakdown": completed_scan.coverage.pages_skipped_by_reason,
                "findings_count": len(completed_scan.grouped_findings),
                "findings_summary": {
                    "hidden_charges": sum(1 for f in completed_scan.grouped_findings if f.category == "hidden_charges"),
                    "cancellation": sum(1 for f in completed_scan.grouped_findings if f.category == "cancellation"),
                    "consent": sum(1 for f in completed_scan.grouped_findings if f.category == "consent"),
                }
            }
            site_evaluations.append(record)
            print(f"    Status: {completed_scan.status} | Discovered: {completed_scan.coverage.pages_discovered} | Reached: {completed_scan.coverage.pages_analysed} | Time: {elapsed:.2f}s")

        except Exception as e:
            elapsed = time.time() - site_start
            print(f"    Failed with error: {e}")
            site_evaluations.append({
                "site_url": site_url,
                "scan_id": scan.scan_id,
                "status": "failed",
                "error": str(e),
                "elapsed_seconds": round(elapsed, 2),
            })

    total_time = time.time() - total_start_time

    # Aggregate evaluation summary
    total_discovered = sum(s.get("pages_discovered", 0) for s in site_evaluations)
    total_analysed = sum(s.get("pages_analysed", 0) for s in site_evaluations)
    total_blocked = sum(s.get("pages_blocked", 0) for s in site_evaluations)
    total_login = sum(s.get("pages_needs_login", 0) for s in site_evaluations)
    total_ai_calls = sum(s.get("ai_calls_used", 0) for s in site_evaluations)

    summary = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_sites_evaluated": len(target_sites),
        "total_elapsed_seconds": round(total_time, 2),
        "aggregate_metrics": {
            "total_pages_discovered": total_discovered,
            "total_pages_analysed": total_analysed,
            "total_pages_blocked": total_blocked,
            "total_pages_needs_login": total_login,
            "total_ai_calls_used": total_ai_calls,
            "block_rate_percentage": round((total_blocked / total_discovered * 100), 2) if total_discovered else 0.0,
        },
        "sites": site_evaluations,
    }

    # Save to JSON
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"\n=======================================================")
    print(f"Evaluation Complete!")
    print(f"Total Discovered: {total_discovered} pages | Total Analysed: {total_analysed}")
    print(f"Report written to: {output_file}")
    print(f"=======================================================\n")

    return summary


def main():
    parser = argparse.ArgumentParser(
        description="Run ClearClick AI multi-page scan evaluation on authorized test sites."
    )
    parser.add_argument(
        "--sites",
        nargs="+",
        default=DEFAULT_TEST_SITES,
        help="List of target site root URLs to evaluate (only use sites you are permitted to scan)."
    )
    parser.add_argument(
        "--output",
        default="scan_evaluation_results.json",
        help="Output path for JSON coverage statistics."
    )
    parser.add_argument(
        "--include-ai",
        action="store_true",
        help="Enable optional AI analysis layer on top pages (respects free-tier budget)."
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=8,
        help="Maximum pages to analyse per domain (default: 8)."
    )

    args = parser.parse_args()
    asyncio.run(
        evaluate_site_scans(
            target_sites=args.sites,
            output_file=args.output,
            include_ai=args.include_ai,
            max_pages=args.max_pages,
        )
    )


if __name__ == "__main__":
    main()
