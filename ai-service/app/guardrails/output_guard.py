"""
Output Guardrail & PII Redaction Engine (Prompt 10)
Provides deterministic redaction for PII, API keys, passwords, JWT tokens,
and toxic output filtering.
"""

import re
from typing import Dict, Any

PII_PATTERNS = [
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "[REDACTED_EMAIL]"),
    (r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", "[REDACTED_PHONE]"),
    (r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]"),
]

SECRET_PATTERNS = [
    (r"eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*", "[REDACTED_JWT]"),
    (r"(?:sk|pk|api|key)_[a-zA-Z0-9]{24,}", "[REDACTED_API_KEY]"),
    (r"(?:password|passwd|secret)\s*[:=]\s*['\"]?[^\s'\"]+['\"]?", "[REDACTED_SECRET]"),
    (r"Bearer\s+[A-Za-z0-9-_=.]+", "Bearer [REDACTED_TOKEN]"),
]

TOXICITY_KEYWORDS = ["hate", "discrimination", "illegal_firing", "retaliation_threat"]


def sanitize_text(text: str) -> str:
    """
    Deterministically redacts PII and sensitive credentials from input/output text.
    """
    if not text:
        return ""

    sanitized = text
    for pattern, replacement in SECRET_PATTERNS:
        sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)

    for pattern, replacement in PII_PATTERNS:
        sanitized = re.sub(pattern, replacement, sanitized)

    return sanitized


def inspect_output_safety(text: str) -> Dict[str, Any]:
    """
    Inspects generated LLM output for PII leakage, secret exposure, or unsafe recommendations.
    """
    if not text:
        return {"passed": True, "action": "PASSED", "sanitizedText": ""}

    sanitized = sanitize_text(text)
    was_redacted = sanitized != text

    for word in TOXICITY_KEYWORDS:
        if word in text.lower():
            return {
                "passed": False,
                "action": "SANITIZED",
                "category": "TOXICITY",
                "severity": "HIGH",
                "sanitizedText": "Output sanitized to comply with corporate safety guidelines.",
            }

    return {
        "passed": True,
        "action": "SANITIZED" if was_redacted else "PASSED",
        "category": "PII_LEAK" if was_redacted else None,
        "sanitizedText": sanitized,
    }
