"""
Verifies the lite build: the service must import, start, and serve
prediction/SHAP/decision routes when torch, transformers,
sentence-transformers and ChromaDB are absent, and must answer 503 (not 404,
not a crash) on the routes it cannot serve.

The lite image is the only artifact that exercises this path, and building it
takes several GB, so instead of requiring that image these tests simulate the
missing libraries with a meta-path finder that raises ImportError for them.
That is exactly what a real lite container does at import time, so the code
under test cannot tell the difference.
"""

import importlib
import sys

import pytest

LITE_ABSENT = ("torch", "transformers", "sentence_transformers", "chromadb")


class _BlockedFinder:
    """Raises ImportError for the blocked top-level packages and submodules."""

    def __init__(self, blocked):
        self._blocked = blocked

    def find_spec(self, fullname, path=None, target=None):
        root = fullname.split(".")[0]
        if root in self._blocked:
            raise ImportError(f"simulated lite build: {root} is not installed")
        return None


@pytest.fixture
def lite_env(monkeypatch):
    """Import the app with the heavy ML libraries made unavailable."""
    # Drop anything already imported, plus every app.* module, so the guarded
    # imports in app.main are re-evaluated rather than served from cache.
    for name in list(sys.modules):
        root = name.split(".")[0]
        if root in LITE_ABSENT or root == "app":
            monkeypatch.delitem(sys.modules, name, raising=False)

    monkeypatch.setattr(sys, "meta_path", [_BlockedFinder(LITE_ABSENT), *sys.meta_path])
    monkeypatch.setenv("AI_SERVICE_TOKEN", "test-token-not-a-placeholder")
    monkeypatch.setenv("AI_SERVICE_ENV", "development")
    yield


def test_features_report_lite(lite_env):
    features = importlib.import_module("app.features")
    assert features.NLP_AVAILABLE is False
    assert features.RAG_AVAILABLE is False
    assert features.FULL_ML_STACK is False


def test_app_imports_without_heavy_libraries(lite_env):
    """The whole point: a missing torch must not take the process down."""
    main = importlib.import_module("app.main")
    assert main.app is not None


def test_prediction_and_decision_routes_are_registered(lite_env):
    main = importlib.import_module("app.main")
    paths = {route.path for route in main.app.routes}
    # These do not need torch and must survive in the lite build.
    assert "/health" in paths
    assert any(p.startswith("/predict") for p in paths), paths
    assert any("recommend" in p or "decision" in p for p in paths), paths


def test_nlp_and_rag_routes_return_503_not_404(lite_env):
    from fastapi.testclient import TestClient

    main = importlib.import_module("app.main")
    # Bypass lifespan: it opens a Mongo connection, which is not what these
    # assertions are about.
    client = TestClient(main.app)

    for path in ("/nlp/analyze", "/knowledge/statistics"):
        response = client.get(path)
        assert response.status_code == 503, (
            f"{path} returned {response.status_code}; a lite build must report "
            "the feature as unavailable rather than missing"
        )
        assert response.json()["code"] == "FEATURE_NOT_AVAILABLE_IN_BUILD"


def test_orchestrator_degrades_instead_of_failing(lite_env):
    """Recommendations must still run with the NLP/RAG signals absent."""
    orch = importlib.import_module("app.agent.orchestrator.agent_orchestrator")
    # The stubs stand in for the real tools and must match their call shape,
    # because the orchestrator awaits one and calls the other in an executor.
    assert orch.run_rag_retrieval("any query", 4) == {}


@pytest.mark.asyncio
async def test_nlp_stub_is_awaitable(lite_env):
    orch = importlib.import_module("app.agent.orchestrator.agent_orchestrator")
    assert await orch.run_nlp_insights("employee-id") == {}
