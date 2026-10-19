"""
Server-side URL Analyzer for ClearClick AI.
Performs comprehensive syntax, domain structure, security (SSRF),
and DNS reachability checks strictly on the server side.
"""

import ipaddress
import re
import socket
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, urlunparse
from pydantic import BaseModel, Field

from ..security import BLOCKED_IP_NETWORKS, DISALLOWED_HOSTS


class URLAnalysisResult(BaseModel):
    """Structured report returned by the server-side URL Analyzer."""
    is_valid: bool = Field(..., description="True if the URL passes all server-side validation checks.")
    url: str = Field(..., description="The original raw URL analyzed.")
    normalized_url: Optional[str] = Field(None, description="The canonicalized URL if valid.")
    reason: str = Field(..., description="Human-readable explanation of validity or failure reason.")
    error_code: Optional[str] = Field(None, description="Machine-readable error identifier if invalid.")
    checks: Dict[str, bool] = Field(
        default_factory=dict,
        description="Individual test pass/fail breakdown (syntax, scheme, domain, ssrf, dns)."
    )
    details: Dict[str, Any] = Field(
        default_factory=dict,
        description="Diagnostic metadata (parsed scheme, host, resolved IPs, port)."
    )


class URLAnalyzer:
    """
    Robust server-side URL analyzer.
    Validates RFC 3986 compliance, domain labeling, port constraints,
    SSRF boundaries, and active DNS resolution.
    """

    # RFC 1123 / RFC 952 domain label regex
    LABEL_REGEX = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$")

    @classmethod
    def analyze(cls, raw_url: Any) -> URLAnalysisResult:
        """
        Executes complete server-side analysis on the supplied URL.
        Returns a structured URLAnalysisResult.
        """
        checks: Dict[str, bool] = {
            "non_empty": False,
            "syntax": False,
            "scheme": False,
            "hostname": False,
            "port": False,
            "ssrf_safe": False,
            "dns_resolvable": False,
        }
        details: Dict[str, Any] = {}

        # 1. Non-empty string check
        if not raw_url or not isinstance(raw_url, str):
            return URLAnalysisResult(
                is_valid=False,
                url=str(raw_url) if raw_url is not None else "",
                reason="URL is missing, empty, or not a string.",
                error_code="EMPTY_URL",
                checks=checks,
                details=details,
            )

        cleaned_url = raw_url.strip()
        if not cleaned_url:
            return URLAnalysisResult(
                is_valid=False,
                url=raw_url,
                reason="URL cannot be blank or whitespace-only.",
                error_code="BLANK_URL",
                checks=checks,
                details=details,
            )
        checks["non_empty"] = True

        # Check for illegal whitespace or control characters inside the URL
        if any(c in cleaned_url for c in (" ", "\t", "\r", "\n", "\0")):
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason="URL contains forbidden whitespace or control characters.",
                error_code="ILLEGAL_CHARACTERS",
                checks=checks,
                details=details,
            )

        # 2. Parse URL structure
        try:
            parsed = urlparse(cleaned_url)
            checks["syntax"] = True
        except Exception as e:
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason=f"Malformed URL syntax: {e}",
                error_code="SYNTAX_ERROR",
                checks=checks,
                details={"parse_error": str(e)},
            )

        # 3. Scheme validation (strictly http and https)
        scheme = parsed.scheme.lower()
        details["scheme"] = scheme
        if not scheme:
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason="Missing protocol scheme. URLs must explicitly begin with 'http://' or 'https://'.",
                error_code="MISSING_SCHEME",
                checks=checks,
                details=details,
            )

        if scheme not in ("http", "https"):
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason=f"Unsupported protocol scheme '{scheme}'. Only 'http://' and 'https://' are permitted.",
                error_code="UNSUPPORTED_SCHEME",
                checks=checks,
                details=details,
            )
        checks["scheme"] = True

        # 4. Hostname validation
        raw_host = parsed.hostname
        if not raw_host:
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason="Target URL is missing a valid host or domain name.",
                error_code="MISSING_HOSTNAME",
                checks=checks,
                details=details,
            )

        host_lower = raw_host.lower().strip()
        details["host"] = host_lower

        if len(host_lower) > 253:
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason=f"Hostname exceeds maximum allowed length of 253 characters (got {len(host_lower)}).",
                error_code="HOSTNAME_TOO_LONG",
                checks=checks,
                details=details,
            )

        # Disallow internal, reserved, and local TLDs
        if (
            host_lower in DISALLOWED_HOSTS
            or host_lower.endswith(".local")
            or host_lower.endswith(".internal")
            or host_lower.endswith(".localhost")
            or host_lower.endswith(".test")
            or host_lower.endswith(".invalid")
        ):
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason=f"Host '{host_lower}' is an internal or local reserved domain (SSRF Guard).",
                error_code="SSRF_LOCAL_HOST",
                checks=checks,
                details=details,
            )

        # Check domain labels if not a raw IP address
        is_ip_literal = False
        try:
            ipaddress.ip_address(host_lower)
            is_ip_literal = True
        except ValueError:
            pass

        if not is_ip_literal:
            labels = host_lower.split(".")
            # A valid public domain name must have at least two labels (e.g. domain.org)
            if len(labels) < 2:
                return URLAnalysisResult(
                    is_valid=False,
                    url=cleaned_url,
                    reason=f"Hostname '{host_lower}' must contain a valid top-level domain (TLD). Single-label relative names are disallowed.",
                    error_code="MISSING_TLD",
                    checks=checks,
                    details=details,
                )

            for label in labels:
                if not label:
                    return URLAnalysisResult(
                        is_valid=False,
                        url=cleaned_url,
                        reason=f"Hostname '{host_lower}' contains an empty domain label (consecutive dots).",
                        error_code="EMPTY_DOMAIN_LABEL",
                        checks=checks,
                        details=details,
                    )
                if len(label) > 63:
                    return URLAnalysisResult(
                        is_valid=False,
                        url=cleaned_url,
                        reason=f"Domain label '{label}' exceeds maximum permitted length of 63 characters.",
                        error_code="LABEL_TOO_LONG",
                        checks=checks,
                        details=details,
                    )
                if not cls.LABEL_REGEX.match(label):
                    return URLAnalysisResult(
                        is_valid=False,
                        url=cleaned_url,
                        reason=f"Domain label '{label}' contains invalid characters or illegal hyphen placement.",
                        error_code="INVALID_DOMAIN_LABEL",
                        checks=checks,
                        details=details,
                    )

        checks["hostname"] = True

        # 5. Port constraints
        try:
            port = parsed.port
        except ValueError as e:
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason=f"Invalid port specification: {e}",
                error_code="INVALID_PORT",
                checks=checks,
                details=details,
            )

        if port is not None:
            details["port"] = port
            if port < 1 or port > 65535:
                return URLAnalysisResult(
                    is_valid=False,
                    url=cleaned_url,
                    reason=f"Invalid port number {port}. Port must be between 1 and 65535.",
                    error_code="INVALID_PORT",
                    checks=checks,
                    details=details,
                )
        checks["port"] = True

        # 6. DNS Resolution & SSRF address inspection
        resolved_ips: List[str] = []
        try:
            addr_target_port = port or (443 if scheme == "https" else 80)
            addr_info = socket.getaddrinfo(host_lower, addr_target_port)
            resolved_ips = list(dict.fromkeys(item[4][0] for item in addr_info))
            details["resolved_ips"] = resolved_ips
            checks["dns_resolvable"] = True
        except socket.gaierror as e:
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason=f"DNS resolution failed for host '{host_lower}'. The domain could not be found or has no DNS records.",
                error_code="DNS_RESOLUTION_FAILED",
                checks=checks,
                details={"dns_error": str(e)},
            )
        except Exception as e:
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason=f"Failed to resolve host '{host_lower}': {e}",
                error_code="DNS_ERROR",
                checks=checks,
                details={"error": str(e)},
            )

        if not resolved_ips:
            return URLAnalysisResult(
                is_valid=False,
                url=cleaned_url,
                reason=f"No IP addresses resolved for host '{host_lower}'.",
                error_code="NO_IPS_RESOLVED",
                checks=checks,
                details=details,
            )

        # Check every resolved IP against blocked networks
        for ip_str in resolved_ips:
            try:
                ip_obj = ipaddress.ip_address(ip_str)
                for blocked_net in BLOCKED_IP_NETWORKS:
                    if ip_obj in blocked_net:
                        return URLAnalysisResult(
                            is_valid=False,
                            url=cleaned_url,
                            reason=f"Host '{host_lower}' resolves to restricted internal IP {ip_str} ({blocked_net}) (SSRF Guard).",
                            error_code="SSRF_RESTRICTED_IP",
                            checks=checks,
                            details={"violating_ip": ip_str, "blocked_subnet": str(blocked_net)},
                        )
            except ValueError:
                return URLAnalysisResult(
                    is_valid=False,
                    url=cleaned_url,
                    reason=f"Resolved host returned an invalid IP address representation: '{ip_str}'.",
                    error_code="MALFORMED_IP",
                    checks=checks,
                    details={"invalid_ip": ip_str},
                )

        checks["ssrf_safe"] = True

        # 7. Construct canonical normalized URL
        normalized = urlunparse((
            scheme,
            f"{host_lower}:{port}" if port and port not in (80, 443) else host_lower,
            parsed.path or "/",
            parsed.params,
            parsed.query,
            ""  # Strip fragment identifier
        ))

        return URLAnalysisResult(
            is_valid=True,
            url=cleaned_url,
            normalized_url=normalized,
            reason="URL validated successfully. Format, domain structure, security boundaries, and DNS resolution passed.",
            error_code=None,
            checks=checks,
            details=details,
        )


url_analyzer = URLAnalyzer()
