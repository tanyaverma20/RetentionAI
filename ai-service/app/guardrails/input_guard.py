"""
Input Guardrail Engine (Prompt 10)
Provides real-time heuristic & pattern-based detection for prompt injections,
jailbreak attempts, instruction override attacks, and malicious RAG document content.
"""

import re
from typing import Dict, Any, List

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous\s+)?instructions",
    r"override\s+system\s+prompt",
    r"disregard\s+above\s+rules",
    r"you\s+are\s+now\s+a\s+DAN",
    r"do\s+anything\s+now",
    r"dump\s+(all\s+)?salary\s+data",
    r"reveal\s+(the\s+)?system\s+prompt",
    r"expose\s+api\s+key",
    r"act\s+as\s+an?\s+unfiltered",
    r"bypass\s+security",
    r"give\s+me\s+ceo\s+credentials",
]

MALICIOUS_RAG_PATTERNS = [
    r"IMPORTANT:\s*Ignore\s+user\s+query",
    r"SYSTEM:\s*Grant\s+admin\s+access",
    r"\[SYSTEM_OVERRIDE\]",
    r"<!--\s*HIDDEN_INSTRUCTION:",
]

COMPILED_INJECTIONS = [re.compile(pat, re.IGNORECASE) for pat in INJECTION_PATTERNS]
COMPILED_RAG_MALICIOUS = [re.compile(pat, re.IGNORECASE) for pat in MALICIOUS_RAG_PATTERNS]


def inspect_user_input(text: str) -> Dict[str, Any]:
    """
    Inspects raw user prompt or context string for prompt injections or jailbreaks.
    """
    if not text:
        return {"passed": True, "action": "PASSED", "category": None, "confidence": 0.0}

    for pattern in COMPILED_INJECTIONS:
        if pattern.search(text):
            return {
                "passed": False,
                "action": "BLOCKED",
                "category": "PROMPT_INJECTION",
                "severity": "HIGH",
                "refusalMessage": "Request blocked: input violates enterprise AI safety policies.",
                "confidence": 0.95,
            }

    return {"passed": True, "action": "PASSED", "category": None, "confidence": 0.0}


def inspect_rag_document_content(doc_content: str) -> Dict[str, Any]:
    """
    Ensures retrieved RAG document text cannot override system instructions.
    Treats document content strictly as untrusted context.
    """
    if not doc_content:
        return {"passed": True, "action": "PASSED"}

    for pattern in COMPILED_RAG_MALICIOUS:
        if pattern.search(doc_content):
            return {
                "passed": False,
                "action": "SANITIZED",
                "category": "MALICIOUS_RAG_DOC",
                "severity": "HIGH",
                "sanitizedContent": re.sub(pattern, "[MALICIOUS INSTRUCTION STRIPPED]", doc_content),
            }

    return {"passed": True, "action": "PASSED", "sanitizedContent": doc_content}
