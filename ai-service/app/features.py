"""
features.py
===========
Runtime capability detection for optional, heavyweight ML features.

Why this file exists
--------------------
The full dependency set imports at ~496 MB of RSS before a single model
weight is loaded (torch alone accounts for ~166 MB of that), which does not
fit a 512 MB free-tier container. Dropping torch, transformers,
sentence-transformers, spaCy and ChromaDB brings the same service down to
~265 MB, which does fit — at the cost of the two feature groups that
genuinely need local inference:

    * NLP employee-voice analysis (emotion + zero-shot classifiers)
    * RAG knowledge search (sentence-transformer embeddings + vector store)

Everything else is unaffected. Attrition prediction is a joblib bundle,
SHAP runs on that same bundle, and the decision engine's LLM reasoning
happens on Groq's API — no local model, no torch.

Capability is derived from what is actually importable rather than from an
environment flag, so the image and its advertised behaviour cannot drift
apart: a lite image cannot claim NLP support, and a full image cannot
accidentally disable it by forgetting to set a variable.

`find_spec` only resolves the module on the import path — it does not
execute it — so this probe stays cheap even in the full image where
importing torch for real would cost hundreds of milliseconds and megabytes.
"""

import importlib.util
import logging

logger = logging.getLogger(__name__)


def _installed(module_name: str) -> bool:
    try:
        return importlib.util.find_spec(module_name) is not None
    except (ImportError, ValueError):
        # A namespace package with a broken parent raises rather than
        # returning None; treat anything unresolvable as absent.
        return False


NLP_AVAILABLE = _installed("torch") and _installed("transformers")
RAG_AVAILABLE = _installed("sentence_transformers") and _installed("chromadb")

#: True only in the full image, where every feature group is present.
FULL_ML_STACK = NLP_AVAILABLE and RAG_AVAILABLE

#: Sent to callers that hit a route the running image cannot serve.
UNAVAILABLE_DETAIL = (
    "This feature requires the full AI service image. The running instance was "
    "built without the local inference stack (torch/transformers/"
    "sentence-transformers/ChromaDB) to fit a memory-constrained host. "
    "Prediction, SHAP explainability, and decision recommendations are "
    "unaffected."
)


def log_enabled_features() -> None:
    """Emit one line at startup stating exactly what this image can serve."""
    if FULL_ML_STACK:
        logger.info("Feature set: FULL (prediction, SHAP, NLP, RAG, decisions)")
        return
    logger.warning(
        "Feature set: LITE — prediction, SHAP and decisions enabled; "
        "NLP available=%s, RAG available=%s. %s",
        NLP_AVAILABLE,
        RAG_AVAILABLE,
        UNAVAILABLE_DETAIL,
    )
