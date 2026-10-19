"""
ClearClick AI Configuration & Settings
Manages environment variables, model selection, rate limiting, and caching settings.
"""

import os
from typing import Literal

# Environment variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Default model strings (configurable via environment, no hardcoded logic dependency)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

# Provider preference: gemini, claude, or auto. Auto preserves the historical
# Gemini-first selection while still allowing Anthropic-only configurations.
AI_PROVIDER = os.getenv("AI_PROVIDER", "auto")

# Prompt and cache versioning
PROMPT_VERSION = "v2.0"

# Free-tier rate limits and safety limits
AI_CALLS_PER_MINUTE = int(os.getenv("AI_CALLS_PER_MINUTE", "15"))  # Gemini free tier standard
AI_DAILY_CALL_LIMIT = int(os.getenv("AI_DAILY_CALL_LIMIT", "1500")) # Gemini free tier standard
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "30.0"))
AI_MAX_RETRIES = int(os.getenv("AI_MAX_RETRIES", "3"))

# Disk cache directory
CACHE_DIR = os.getenv("CLEARCLICK_CACHE_DIR", os.path.join(os.path.dirname(__file__), "..", "..", ".cache", "ai"))
