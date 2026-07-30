"""
text_cleaner.py
================
Lightweight text normalization applied to a document AFTER parsing but
BEFORE chunking/embedding.

Deliberately NOT the same kind of cleaning NLP's app/nlp/preprocessing.py
does (lowercasing, stopword removal, lemmatization) — that would corrupt the
exact wording of policy text we need to cite verbatim. This only strips
things that are never meaningful content: control characters, null bytes,
repeated whitespace, and page-break artifacts PDF extraction commonly leaves
behind.
"""

from __future__ import annotations

import re
import unicodedata

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MULTI_BLANK_LINES_RE = re.compile(r"\n{3,}")
_MULTI_SPACES_RE = re.compile(r"[ \t]{2,}")


def clean_document_text(text: str) -> str:
    """Normalizes raw extracted text without altering meaningful wording."""
    if not text:
        return ""

    text = unicodedata.normalize("NFKC", text)
    text = _CONTROL_CHARS_RE.sub("", text)
    text = _MULTI_SPACES_RE.sub(" ", text)
    text = _MULTI_BLANK_LINES_RE.sub("\n\n", text)
    return text.strip()
