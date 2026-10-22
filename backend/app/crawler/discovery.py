"""
Page Discovery, Normalization, Keyword Scoring, and Ranking Engine for ClearClick AI.
Discovers pages via robots.txt, sitemaps, and navigation links.
Normalizes URLs, scores them by relevance, collapses near-duplicates, and outputs ranked candidate pages.
"""

import re
import logging
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, urljoin, parse_qsl, urlencode, urlunparse
from urllib.robotparser import RobotFileParser
from typing import List, Dict, Tuple, Set, Optional, Any

from ..config.scan_settings import (
    SCAN_USER_AGENT,
    MAX_PAGES_DISCOVERED,
    MAX_DEPTH,
    MAX_PAGES_ANALYSED,
    MAX_PAGE_BYTES,
    KEYWORD_SCORES,
    ALLOWED_SUBDOMAINS,
)
from ..schema import ScanPage, PageType, ScanDecision, SkippedReason
from ..security import validate_url_safety

logger = logging.getLogger("clearclick.crawler.discovery")

TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "gclsrc", "dclid", "msclkid", "mc_eid", "zanpid",
    "ref", "source", "_ga", "_gl", "session_id", "sid"
}


def normalize_url(raw_url: str, base_url: str = "") -> str:
    """
    Normalizes a URL:
    - Resolves relative URLs against base_url
    - Strips fragments (#...)
    - Strips analytics/tracking parameters (utm_*, fbclid, etc.)
    - Lowercases scheme and hostname
    - Normalizes path removing redundant slashes and trailing slashes
    """
    if not raw_url or not isinstance(raw_url, str):
        return ""

    raw_clean = raw_url.strip()
    if base_url:
        base_clean = base_url.strip()
        parsed_base = urlparse(base_clean)
        last_seg = parsed_base.path.split('/')[-1] if parsed_base.path else ""
        if parsed_base.path and not parsed_base.path.endswith('/') and '.' not in last_seg:
            base_clean = f"{base_clean}/"
        full_url = urljoin(base_clean, raw_clean)
    else:
        full_url = raw_clean

    try:
        parsed = urlparse(full_url)
    except Exception:
        return ""

    if parsed.scheme.lower() not in ("http", "https"):
        return ""

    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()

    # Normalize path (lowercase, strip redundant slashes, strip trailing slash)
    path = parsed.path.lower() if parsed.path else ""
    path = re.sub(r"/+", "/", path)
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    elif path == "/":
        path = ""

    # Filter tracking query parameters
    filtered_query = []
    if parsed.query:
        try:
            for k, v in parse_qsl(parsed.query, keep_blank_values=False):
                if k.lower() not in TRACKING_PARAMS and not k.lower().startswith("utm_"):
                    filtered_query.append((k, v))
        except Exception:
            pass

    query_str = urlencode(filtered_query) if filtered_query else ""

    return urlunparse((scheme, netloc, path, "", query_str, ""))


def get_registered_domain(hostname: str) -> str:
    """Extracts base registered domain name (e.g. 'example.com' from 'shop.sub.example.com')."""
    parts = hostname.lower().split(".")
    if len(parts) <= 2:
        return hostname.lower()
    # Handle known 2-part ccTLDs like .co.uk, .com.au, .org.uk
    if len(parts) >= 3 and parts[-2] in ("co", "com", "org", "net", "edu", "gov") and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def is_same_registered_domain(root_url: str, target_url: str) -> bool:
    """Validates that target_url shares the registered domain or an allowed subdomain."""
    root_parsed = urlparse(root_url)
    target_parsed = urlparse(target_url)

    if not root_parsed.hostname or not target_parsed.hostname:
        return False

    root_host = root_parsed.hostname.lower()
    target_host = target_parsed.hostname.lower()

    if root_host == target_host:
        return True

    root_reg = get_registered_domain(root_host)
    target_reg = get_registered_domain(target_host)

    if root_reg != target_reg:
        return False

    # Check allowed subdomains
    subdomain = target_host.replace(f".{target_reg}", "").strip()
    return subdomain in ALLOWED_SUBDOMAINS


def score_and_classify_url(url: str, link_text: str = "") -> Tuple[float, PageType, str]:
    """
    Evaluates path and link text against KEYWORD_SCORES.
    Returns: (score, page_type_guess, matched_evidence)
    """
    parsed = urlparse(url)
    path_lower = parsed.path.lower()
    text_lower = link_text.lower().strip()
    combined = f"{path_lower} {text_lower}"

    best_score = 0.0
    best_type: PageType = "other"
    best_evidence = "default fallback ranking"

    for kw, (weight, p_type) in KEYWORD_SCORES.items():
        kw_lower = kw.lower()
        in_path = kw_lower in path_lower
        in_text = kw_lower in text_lower

        if in_path or in_text:
            score = weight
            if in_path and in_text:
                score += 5.0  # Corroborating path + anchor text bonus

            if abs(score) > abs(best_score) or (score > 0 and best_score <= 0):
                best_score = score
                best_type = p_type  # type: ignore
                loc = "path & link text" if (in_path and in_text) else ("path" if in_path else "link text")
                best_evidence = f"keyword '{kw}' in {loc}"

    return best_score, best_type, best_evidence


def get_path_template(path: str) -> str:
    """Collapses dynamic parameters/IDs in paths (e.g. /products/123 -> /products/<id>)."""
    # Replace UUIDs
    p = re.sub(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}", "<uuid>", path)
    # Replace numeric segments
    p = re.sub(r"/\d+(?=/|$)", "/<id>", p)
    # Replace hex hashes
    p = re.sub(r"/[a-f0-9]{16,64}(?=/|$)", "/<hash>", p)
    return p


class DiscoveryEngine:
    """
    Orchestrates URL discovery from robots.txt, sitemaps, and navigation links.
    """

    @classmethod
    def fetch_robots_txt(cls, root_url: str) -> Tuple[RobotFileParser, List[str]]:
        """Fetches and parses robots.txt, returning RobotFileParser and declared sitemap URLs."""
        parsed = urlparse(root_url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

        rp = RobotFileParser()
        sitemaps: List[str] = []

        is_safe, reason = validate_url_safety(robots_url)
        if not is_safe:
            logger.warning(f"robots.txt URL safety check failed: {reason}")
            rp.parse(["User-agent: *", "Disallow:"])
            return rp, []

        import urllib.request
        try:
            req = urllib.request.Request(
                robots_url,
                headers={"User-Agent": SCAN_USER_AGENT, "Accept": "text/plain"}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                content = resp.read().decode("utf-8", errors="replace")
                lines = content.splitlines()
                rp.parse(lines)
                for line in lines:
                    if line.strip().lower().startswith("sitemap:"):
                        sm_url = line.split(":", 1)[1].strip()
                        if sm_url.startswith("http://") or sm_url.startswith("https://"):
                            sitemaps.append(sm_url)
        except Exception as e:
            logger.debug(f"robots.txt not found or error ({e}); assuming allow all")
            rp.parse(["User-agent: *", "Disallow:"])

        return rp, sitemaps

    @classmethod
    def parse_sitemap(cls, sitemap_url: str, max_depth: int = 1) -> List[str]:
        """Fetches and parses an XML sitemap (supports 1 level of sitemap index)."""
        urls: List[str] = []
        is_safe, reason = validate_url_safety(sitemap_url)
        if not is_safe:
            return []

        import urllib.request
        try:
            req = urllib.request.Request(
                sitemap_url,
                headers={"User-Agent": SCAN_USER_AGENT, "Accept": "application/xml,text/xml"}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                xml_data = resp.read(MAX_PAGE_BYTES)
                root = ET.fromstring(xml_data)

                # Strip XML namespaces
                tag_name = root.tag.split("}")[-1] if "}" in root.tag else root.tag

                if tag_name == "sitemapindex" and max_depth > 0:
                    # Sitemap index: fetch first child sitemaps (up to 3)
                    child_sitemaps = []
                    for child in root:
                        for elem in child:
                            if elem.tag.endswith("loc") and elem.text:
                                child_sitemaps.append(elem.text.strip())
                    for cs in child_sitemaps[:3]:
                        urls.extend(cls.parse_sitemap(cs, max_depth=max_depth - 1))
                elif tag_name == "urlset":
                    for child in root:
                        for elem in child:
                            if elem.tag.endswith("loc") and elem.text:
                                urls.append(elem.text.strip())
                                if len(urls) >= MAX_PAGES_DISCOVERED:
                                    break
        except Exception as e:
            logger.debug(f"Sitemap parse failed for {sitemap_url}: {e}")

        return urls

    @classmethod
    def discover_and_rank(
        cls,
        root_url: str,
        landing_links: Optional[List[Dict[str, Any]]] = None,
        max_pages_analysed: int = MAX_PAGES_ANALYSED
    ) -> List[ScanPage]:
        """
        Discovers candidate URLs from:
        1. robots.txt declared sitemaps
        2. /sitemap.xml
        3. Landing page links (header, nav, footer, body)

        Normalizes, collapses duplicates, scores by keywords, checks robots.txt,
        and outputs a prioritized list of ScanPage items with assigned decisions.
        """
        norm_root = normalize_url(root_url)
        parsed_root = urlparse(norm_root)

        # 1. Fetch robots.txt and sitemap locations
        rp, declared_sitemaps = cls.fetch_robots_txt(norm_root)

        # 2. Collect URLs from Sitemaps
        discovered_raw: List[Tuple[str, str, str]] = []  # (url, source, link_text)
        sitemap_candidates = declared_sitemaps or [f"{parsed_root.scheme}://{parsed_root.netloc}/sitemap.xml"]
        for sm_url in sitemap_candidates[:2]:
            sm_urls = cls.parse_sitemap(sm_url)
            for u in sm_urls:
                discovered_raw.append((u, "sitemap", ""))
                if len(discovered_raw) >= MAX_PAGES_DISCOVERED:
                    break

        # 3. Collect URLs from Landing Page Navigation Links
        if landing_links:
            for lk in landing_links:
                href = lk.get("href") or ""
                txt = lk.get("text") or ""
                if href and not href.startswith("javascript:") and not href.startswith("mailto:") and not href.startswith("tel:"):
                    discovered_raw.append((href, "landing_page_link", txt))
                    if len(discovered_raw) >= MAX_PAGES_DISCOVERED * 2:
                        break

        # 4. Normalize, validate same-registered-domain, and deduplicate
        seen_urls: Set[str] = set()
        normalized_candidates: List[Dict[str, Any]] = []

        # Root landing page always included as first candidate at depth 0
        score_root, type_root, ev_root = score_and_classify_url(norm_root, "Home")
        seen_urls.add(norm_root)
        normalized_candidates.append({
            "url": norm_root,
            "source": "root_url",
            "link_text": "Home",
            "score": score_root + 10.0,  # Root landing page baseline priority
            "page_type": type_root if type_root != "other" else "consent",
            "evidence": "root landing page",
            "depth": 0
        })

        for raw_u, src, txt in discovered_raw:
            nu = normalize_url(raw_u, base_url=norm_root)
            if not nu or nu in seen_urls:
                continue

            # Check SSRF and domain safety
            if not is_same_registered_domain(norm_root, nu):
                continue

            is_safe, _ = validate_url_safety(nu)
            if not is_safe:
                continue

            seen_urls.add(nu)
            score, p_type, ev = score_and_classify_url(nu, txt)
            normalized_candidates.append({
                "url": nu,
                "source": src,
                "link_text": txt,
                "score": score,
                "page_type": p_type,
                "evidence": ev,
                "depth": 1
            })

            if len(normalized_candidates) >= MAX_PAGES_DISCOVERED:
                break

        # 5. Template Deduplication (Collapsing near-duplicate patterns)
        template_seen: Dict[Tuple[str, str], str] = {}  # (page_type, template_path) -> representative_url
        for c in normalized_candidates:
            p_parsed = urlparse(c["url"])
            template_pattern = get_path_template(p_parsed.path)
            key = (c["page_type"], template_pattern)

            if key in template_seen:
                c["is_duplicate"] = True
                c["duplicate_of"] = template_seen[key]
            else:
                c["is_duplicate"] = False
                template_seen[key] = c["url"]

        # 6. Sort Candidates by Score Descending
        # Root page always first, followed by highest scores
        def sort_key(item):
            if item["url"] == norm_root:
                return (1000.0, 0)
            return (item["score"], -item["depth"])

        sorted_candidates = sorted(normalized_candidates, key=sort_key, reverse=True)

        # 7. Check Robots.txt Disallow and Assign Decisions
        pages: List[ScanPage] = []
        analysed_count = 0

        for c in sorted_candidates:
            url = c["url"]
            score = c["score"]
            page_type = c["page_type"]
            evidence = c["evidence"]
            depth = c["depth"]
            is_dup = c.get("is_duplicate", False)

            # Check robots.txt permission
            allowed_by_robots = rp.can_fetch(SCAN_USER_AGENT, url)

            decision: ScanDecision = "will_analyse"
            skipped_reason: Optional[SkippedReason] = None
            page_status = "ok"
            status_reason = "Queued for analysis"

            if not allowed_by_robots:
                decision = "skipped_robots"
                skipped_reason = "skipped_robots"
                page_status = "robots_disallowed"
                status_reason = "Path disallowed by robots.txt"
            elif is_dup:
                decision = "skipped_duplicate"
                skipped_reason = "skipped_duplicate"
                status_reason = f"Near-duplicate template collapsed into {c.get('duplicate_of')}"
            elif score <= -15.0:
                decision = "skipped_low_priority"
                skipped_reason = "skipped_low_priority"
                status_reason = f"Skipped low priority page ({score} pts)"
            elif analysed_count >= max_pages_analysed:
                decision = "skipped_cap"
                skipped_reason = "skipped_cap"
                status_reason = f"Skipped: maximum analysed pages cap reached ({max_pages_analysed})"
            else:
                decision = "will_analyse"
                analysed_count += 1

            pages.append(ScanPage(
                url=url,
                page_type=page_type,
                page_type_evidence=evidence,
                score=score,
                decision=decision,
                page_status=page_status,
                status_reason=status_reason,
                ai_status="not_run",
                ai_status_message="Pending scan execution",
                findings=[],
                skipped_reason=skipped_reason,
                screenshot_base64=None,
                page_title="",
                discovered_from=norm_root if depth > 0 else None,
                depth=depth
            ))

        return pages
