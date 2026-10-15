"""
Security and Hygiene Module for ClearClick AI
Provides:
- SSRF (Server-Side Request Forgery) protection against private and loopback networks
- URL scheme enforcement (http/https only)
- In-memory rate limiting per client IP
- Payload size constraints
"""

import time
import socket
import ipaddress
from urllib.parse import urlparse
from typing import Tuple, Dict, List
from collections import defaultdict
from fastapi import HTTPException

# Maximum allowed HTML content length in bytes (2 MB)
MAX_HTML_SIZE_BYTES = 2 * 1024 * 1024

# Disallowed hostname keywords
DISALLOWED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "instance-data",
    "metadata.google.internal",
    "metadata",
}

# Private & restricted IP networks to block
BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # IPv4 loopback
    ipaddress.ip_network("10.0.0.0/8"),       # RFC1918 private
    ipaddress.ip_network("172.16.0.0/12"),    # RFC1918 private
    ipaddress.ip_network("192.168.0.0/16"),   # RFC1918 private
    ipaddress.ip_network("169.254.0.0/16"),   # Link-local / Cloud Metadata (AWS, Azure, GCP)
    ipaddress.ip_network("100.64.0.0/10"),    # Carrier-grade NAT
    ipaddress.ip_network("192.0.2.0/24"),     # TEST-NET-1
    ipaddress.ip_network("198.51.100.0/24"),  # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),   # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),      # Multicast
    ipaddress.ip_network("240.0.0.0/4"),      # Reserved
    ipaddress.ip_network("255.255.255.255/32"), # Broadcast
    ipaddress.ip_network("::1/128"),          # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),        # IPv6 link-local
]


def validate_url_safety(url: str) -> Tuple[bool, str]:
    """
    Validates that a URL uses http/https and does not resolve to local or private IP ranges.
    Returns (is_safe, reason).
    """
    if not url or not isinstance(url, str):
        return False, "URL is missing or invalid."

    url_clean = url.strip()
    try:
        parsed = urlparse(url_clean)
    except Exception as e:
        return False, f"Malformed URL syntax: {e}"

    # 1. Scheme enforcement: http and https only
    if parsed.scheme.lower() not in ["http", "https"]:
        return False, f"Unsupported scheme '{parsed.scheme}'. Only 'http' and 'https' are allowed."

    # 2. Hostname validation
    hostname = parsed.hostname
    if not hostname:
        return False, "Target URL must contain a valid domain or host name."

    hostname_lower = hostname.lower()

    if hostname_lower in DISALLOWED_HOSTS or hostname_lower.endswith(".local") or hostname_lower.endswith(".internal"):
        return False, f"Target host '{hostname}' is an internal or local reserved domain (SSRF Guard)."

    # 3. DNS Resolution and IP checks
    try:
        # Resolve all addresses (IPv4 & IPv6) for the hostname
        addr_info = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
        resolved_ips = set(item[4][0] for item in addr_info)
    except socket.gaierror as e:
        return False, f"DNS resolution failed for host '{hostname}': {e}"
    except Exception as e:
        return False, f"Failed to resolve host '{hostname}': {e}"

    if not resolved_ips:
        return False, f"No IP addresses resolved for '{hostname}'."

    for ip_str in resolved_ips:
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            for blocked_net in BLOCKED_IP_NETWORKS:
                if ip_obj in blocked_net:
                    return False, f"Host '{hostname}' resolves to restricted internal IP {ip_str} ({blocked_net}) (SSRF Guard)."
        except ValueError:
            return False, f"Invalid IP address format: {ip_str}"

    return True, "URL validated successfully"


def validate_html_payload(html_content: str) -> None:
    """Validate HTML content size against denial-of-service page limits."""
    if html_content and len(html_content.encode("utf-8")) > MAX_HTML_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"HTML payload exceeds maximum allowed size of {MAX_HTML_SIZE_BYTES // (1024 * 1024)} MB."
        )


class SlidingWindowRateLimiter:
    """In-memory sliding window rate limiter per client IP."""
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.clients: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds

        # Filter out timestamps older than the sliding window
        self.clients[client_ip] = [ts for ts in self.clients[client_ip] if ts > window_start]

        if len(self.clients[client_ip]) >= self.max_requests:
            return False

        self.clients[client_ip].append(now)
        return True
