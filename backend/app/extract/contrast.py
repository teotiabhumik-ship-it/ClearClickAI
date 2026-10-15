"""
WCAG 2.1 Contrast Ratio and Color Utilities for ClearClick AI
Calculates luminance and contrast ratios to detect deceptive low-contrast fees or hidden cancellation links.
"""

import re
from typing import Tuple, Optional


NAMED_COLORS = {
    "white": (255, 255, 255),
    "black": (0, 0, 0),
    "transparent": (255, 255, 255),
    "gray": (128, 128, 128),
    "grey": (128, 128, 128),
    "lightgray": (211, 211, 211),
    "lightgrey": (211, 211, 211),
    "darkgray": (169, 169, 169),
    "darkgrey": (169, 169, 169),
    "red": (255, 0, 0),
    "blue": (0, 0, 255),
    "green": (0, 128, 0),
}


def parse_color_to_rgb(color_str: Optional[str]) -> Tuple[int, int, int]:
    """Parse hex, rgb, rgba, or named color to RGB tuple (0-255). Defaults to (0,0,0) or (255,255,255)."""
    if not color_str:
        return (0, 0, 0)
    
    val = color_str.strip().lower()
    
    if val in NAMED_COLORS:
        return NAMED_COLORS[val]
    
    # Check #rgb or #rrggbb
    hex_match = re.match(r"^#([0-9a-f]{3}|[0-9a-f]{6})$", val)
    if hex_match:
        h = hex_match.group(1)
        if len(h) == 3:
            return (int(h[0]*2, 16), int(h[1]*2, 16), int(h[2]*2, 16))
        else:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
            
    # Check rgb(r, g, b) or rgba(r, g, b, a)
    rgb_match = re.match(r"rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d\.]+))?", val)
    if rgb_match:
        r, g, b = int(rgb_match.group(1)), int(rgb_match.group(2)), int(rgb_match.group(3))
        alpha = float(rgb_match.group(4)) if rgb_match.group(4) else 1.0
        if alpha <= 0.05:  # Transparent or near-transparent
            return (255, 255, 255)
        return (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))
        
    return (0, 0, 0)


def srgb_channel_to_linear(channel: int) -> float:
    """Convert 8-bit sRGB channel to linear value for luminance."""
    c = channel / 255.0
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(rgb: Tuple[int, int, int]) -> float:
    """Calculate WCAG 2.1 relative luminance."""
    r = srgb_channel_to_linear(rgb[0])
    g = srgb_channel_to_linear(rgb[1])
    b = srgb_channel_to_linear(rgb[2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def calculate_contrast_ratio(fg: str, bg: str) -> float:
    """
    Calculate contrast ratio between foreground and background.
    Returns float from 1.0 (identical) to 21.0 (black on white).
    """
    fg_rgb = parse_color_to_rgb(fg)
    bg_clean = (bg or "").strip().lower()
    
    if not bg_clean or bg_clean in ["transparent", "rgba(0, 0, 0, 0)", "rgba(0,0,0,0)"]:
        bg_rgb = (255, 255, 255)
    else:
        bg_rgb = parse_color_to_rgb(bg)
    
    l1 = relative_luminance(fg_rgb)
    l2 = relative_luminance(bg_rgb)
    
    lighter = max(l1, l2)
    darker = min(l1, l2)
    
    ratio = (lighter + 0.05) / (darker + 0.05)
    return round(ratio, 2)
