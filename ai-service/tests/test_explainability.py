"""
test_explainability.py
======================
Pytest test suite for the SHAP XAI module.

Test classes
------------
TestShapExplainer      — explainer type, background shape, shap_values shape
TestLocalExplainer     — contributor lists, narrative, risk thresholds
TestGlobalExplainer    — importance list length, non-negative values
TestPlotGenerator      — PNG files created for all plot types
TestExplainAPIRoutes   — FastAPI endpoint status codes and response keys
"""

from __future__ import annotations

import datetime
import os
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.preprocessing.pipeline import (
    generate_synthetic_data,
    fit_transform_pipeline,
    NUMERICAL_COLS,
    CATEGORICAL_COLS,
)
from app.training.trainer import train_and_select_best_model

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

# The real, authoritative feature count/order — NUMERICAL_COLS + CATEGORICAL_COLS,
# exactly what fit_transform_pipeline/transform_inference actually build and what
# shap_explainer.py now derives feature_names from. Asserting against this (not a
# hardcoded number) is the whole point of the schema-mismatch fix: these tests
# stay correct automatically if the pipeline's column set ever changes.
EXPECTED_FEATURE_COUNT = len(NUMERICAL_COLS) + len(CATEGORICAL_COLS)
EXPECTED_FEATURE_ORDER = NUMERICAL_COLS + CATEGORICAL_COLS

MOCK_EMP_ID = "60d5ec388832a828f8000020"
MOCK_EMP = {
    "_id": MOCK_EMP_ID,
    "organizationId": "60d5ec388832a828f8000000",
    "employeeCode": "EMP-0020",
    "firstName": "Priya",
    "lastName": "Nair",
    "email": "priya.nair@retentionai.example",
    "gender": "FEMALE",
    "dateOfBirth": datetime.datetime(1988, 3, 12),
    "departmentId": "60d5ec388832a828f8000001",
    "designation": "Senior Engineer",
    "joiningDate": datetime.datetime(2019, 6, 1),
    "employmentType": "FULL_TIME",
    "salary": 95000,
    "workLocation": "Hybrid",
    "status": "ACTIVE",
    "isDeleted": False,
}


def _make_mock_db(employees_find_one_return):
    """
    Builds a mock Motor database where db["employees"] behaves as the
    caller specifies, and every OTHER collection (attendances, performances,
    promotionhistories, traininghistories, surveys, employeefeedbacks,
    nlp_insights) gracefully reports "no record for this employee" —
    exercising enrich_employee_doc()'s documented neutral-default fallback
    path rather than crashing on an employee-shaped document with the wrong
    fields (which a single shared mock across all collections would cause).
    """
    employees_mock = MagicMock()
    employees_mock.find_one = AsyncMock(return_value=employees_find_one_return)

    empty_cursor = MagicMock()
    empty_cursor.to_list = AsyncMock(return_value=[])

    other_collection_mock = MagicMock()
    other_collection_mock.find_one = AsyncMock(return_value=None)
    other_collection_mock.find = MagicMock(return_value=empty_cursor)
    other_collection_mock.count_documents = AsyncMock(return_value=0)

    mock_db = MagicMock()
    mock_db.__getitem__ = MagicMock(
        side_effect=lambda key: employees_mock if key == "employees" else other_collection_mock
    )
    return mock_db


@pytest.fixture(scope="session")
def trained_bundle():
    """Train a quick bundle on 400 synthetic records."""
    df = generate_synthetic_data(400)
    X_train, X_test, y_train, y_test, scaler, encoders, fm = fit_transform_pipeline(df)
    return train_and_select_best_model(X_train, X_test, y_train, y_test, scaler, encoders, fm)


@pytest.fixture(scope="session")
def ready_shap_cache(trained_bundle):
    """Initialise the global shap_cache singleton once per session."""
    from app.explainability.shap_explainer import shap_cache
    from app.prediction.prediction_service import prediction_service

    prediction_service.model_bundle = trained_bundle
    shap_cache.initialise(trained_bundle)
    return shap_cache


# ---------------------------------------------------------------------------
# TestShapExplainer
# ---------------------------------------------------------------------------

class TestShapExplainer:
    """Unit tests for ShapExplainerCache."""

    def test_is_ready_after_initialise(self, ready_shap_cache):
        assert ready_shap_cache.is_ready is True

    def test_explainer_type_matches_model(self, ready_shap_cache, trained_bundle):
        """
        trained_bundle["model"] is always a CalibratedClassifierCV (Phase 6)
        — SHAP explains the uncalibrated importance_estimator instead (see
        shap_explainer.py), so the authoritative algorithm identifier is
        model_name, not an isinstance check on the calibrated wrapper.
        """
        import shap

        if trained_bundle["model_name"] == "LogisticRegression":
            assert isinstance(ready_shap_cache.explainer, shap.LinearExplainer)
        else:
            assert isinstance(ready_shap_cache.explainer, shap.TreeExplainer)

    def test_background_data_shape(self, ready_shap_cache):
        bg = ready_shap_cache.background_data
        assert bg.ndim == 2
        assert bg.shape[1] == EXPECTED_FEATURE_COUNT
        assert bg.shape[0] <= 100  # capped at 100

    def test_feature_names_length(self, ready_shap_cache):
        assert len(ready_shap_cache.feature_names) == EXPECTED_FEATURE_COUNT
        assert len(ready_shap_cache.display_names) == EXPECTED_FEATURE_COUNT

    def test_feature_names_derived_from_pipeline_not_hardcoded(self, ready_shap_cache):
        """Regression test for the SHAP feature-schema mismatch fix: feature
        names/order must come from the trained bundle's feature_metadata
        (numerical_cols + categorical_cols), not a hardcoded list."""
        assert ready_shap_cache.feature_names == EXPECTED_FEATURE_ORDER
        assert ready_shap_cache.categorical_keys == set(CATEGORICAL_COLS)
        # The two features that used to be hardcoded but never existed in the
        # real pipeline must be gone.
        assert "salary_per_tenure" not in ready_shap_cache.feature_names
        assert "age_at_joining" not in ready_shap_cache.feature_names

    def test_compute_shap_values_shape(self, ready_shap_cache):
        X = ready_shap_cache.background_data[:5]
        sv = ready_shap_cache.compute_shap_values(X)
        assert sv.shape == (5, EXPECTED_FEATURE_COUNT)

    def test_expected_value_is_float(self, ready_shap_cache):
        ev = ready_shap_cache.get_expected_value()
        assert isinstance(ev, float)
        # Note: XGBoost (tree_path_dependent) returns log-odds as base value,
        # which is NOT bounded to [0, 1]. Only assert it is a finite number.
        assert np.isfinite(ev)

    def test_shap_values_are_finite(self, ready_shap_cache):
        X = ready_shap_cache.background_data[:10]
        sv = ready_shap_cache.compute_shap_values(X)
        assert np.all(np.isfinite(sv))


# ---------------------------------------------------------------------------
# TestLocalExplainer
# ---------------------------------------------------------------------------

class TestLocalExplainer:
    """Tests for explain_employee()."""

    @pytest.fixture(autouse=True)
    def _ensure_ready(self, ready_shap_cache):
        pass  # fixture ensures shap_cache is initialised

    def _run(self):
        from app.explainability.local_explainer import explain_employee
        return explain_employee(MOCK_EMP)

    def test_explanation_has_required_keys(self):
        result = self._run()
        required = {
            "employeeId", "riskScore", "riskLevel", "confidence",
            "baseValue", "shapValues", "topPositiveContributors",
            "topNegativeContributors", "top10Features", "allFeatures",
            "narrative", "generatedAt",
        }
        assert required.issubset(set(result.keys()))

    def test_risk_score_is_bounded(self):
        result = self._run()
        assert 0.0 <= result["riskScore"] <= 1.0

    def test_risk_level_is_valid(self):
        result = self._run()
        assert result["riskLevel"] in {"LOW", "MEDIUM", "HIGH"}

    def test_risk_thresholds_correct(self, trained_bundle):
        """Phase 7: bucketing is anchored on the bundle's own optimized
        threshold, not a hardcoded 0.34/0.64 split."""
        result = self._run()
        score = result["riskScore"]
        level = result["riskLevel"]
        threshold = trained_bundle["threshold"]
        medium_cutoff = threshold * 0.6
        if score < medium_cutoff:
            assert level == "LOW"
        elif score < threshold:
            assert level == "MEDIUM"
        else:
            assert level == "HIGH"

    def test_confidence_gte_half(self):
        result = self._run()
        assert result["confidence"] >= 0.5

    def test_shap_values_length(self):
        result = self._run()
        assert len(result["shapValues"]) == EXPECTED_FEATURE_COUNT

    def test_all_features_length(self):
        result = self._run()
        assert len(result["allFeatures"]) == EXPECTED_FEATURE_COUNT

    def test_top_10_features_length(self):
        # Deliberately still 10 — top10Features is always capped at 10 by
        # explain_employee(), regardless of the total feature count.
        result = self._run()
        assert len(result["top10Features"]) == 10

    def test_all_features_have_no_placeholder_raw_values(self):
        """Regression test: every real feature (not just the original 7)
        must resolve to an actual raw value/format, not a leftover 'N/A'
        placeholder from the old hardcoded raw_values dict."""
        result = self._run()
        for f in result["allFeatures"]:
            assert f["rawValue"] != "N/A"

    def test_top_positive_direction(self):
        result = self._run()
        for f in result["topPositiveContributors"]:
            assert f["shapValue"] > 0
            assert f["direction"] == "INCREASES_RISK"

    def test_top_negative_direction(self):
        result = self._run()
        for f in result["topNegativeContributors"]:
            assert f["shapValue"] < 0
            assert f["direction"] == "REDUCES_RISK"

    def test_narrative_is_non_empty_string(self):
        result = self._run()
        assert isinstance(result["narrative"], str)
        assert len(result["narrative"]) > 30

    def test_narrative_contains_risk_level(self):
        result = self._run()
        level = result["riskLevel"]
        assert any(
            word in result["narrative"].lower()
            for word in [level.lower(), "risk", "attrition"]
        )

    def test_feature_contributors_have_formatted_value(self):
        result = self._run()
        for f in result["allFeatures"]:
            assert isinstance(f["formattedValue"], str)


# ---------------------------------------------------------------------------
# TestGlobalExplainer
# ---------------------------------------------------------------------------

class TestGlobalExplainer:
    """Tests for compute_global_importance()."""

    @pytest.fixture(autouse=True)
    def _ensure_ready(self, ready_shap_cache):
        pass

    def test_features_list_has_all_items(self):
        from app.explainability.global_explainer import compute_global_importance
        result = compute_global_importance(n_samples=50)
        assert len(result["features"]) == EXPECTED_FEATURE_COUNT

    def test_importance_values_non_negative(self):
        from app.explainability.global_explainer import compute_global_importance
        result = compute_global_importance(n_samples=50)
        for feat in result["features"]:
            assert feat["meanAbsShap"] >= 0.0

    def test_ranks_are_unique_and_sequential(self):
        from app.explainability.global_explainer import compute_global_importance
        result = compute_global_importance(n_samples=50)
        ranks = [f["rank"] for f in result["features"]]
        assert sorted(ranks) == list(range(1, EXPECTED_FEATURE_COUNT + 1))

    def test_shap_matrix_shape(self):
        from app.explainability.global_explainer import compute_global_importance
        result = compute_global_importance(n_samples=40)
        matrix = result["shapMatrix"]
        assert len(matrix) == 40
        assert all(len(row) == EXPECTED_FEATURE_COUNT for row in matrix)

    def test_has_model_name(self):
        from app.explainability.global_explainer import compute_global_importance
        result = compute_global_importance(n_samples=20)
        assert isinstance(result["modelName"], str)
        assert len(result["modelName"]) > 0


# ---------------------------------------------------------------------------
# TestPlotGenerator
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# TestPlotGenerator
# ---------------------------------------------------------------------------

class TestPlotGenerator:
    """Tests for plot file generation."""

    @pytest.fixture(autouse=True)
    def _ensure_ready(self, ready_shap_cache):
        pass  # Ensures shap_cache singleton is initialised

    @staticmethod
    def _get_local_shap_values():
        """Compute SHAP values for the mock employee using the global singleton."""
        import pandas as pd
        from app.explainability.shap_explainer import shap_cache as _cache
        from app.prediction.prediction_service import prediction_service
        from app.preprocessing.pipeline import transform_inference

        bundle = prediction_service.model_bundle
        df = pd.DataFrame([MOCK_EMP])
        X = transform_inference(df, bundle["scaler"], bundle["encoders"])
        return _cache.compute_shap_values(X)[0]

    @staticmethod
    def _get_shap_matrix(n: int = 30):
        from app.explainability.shap_explainer import shap_cache as _cache
        return _cache.compute_shap_values(_cache.background_data[:n])

    def test_waterfall_plot_creates_png(self, tmp_path, monkeypatch):
        from app.explainability import plot_generator
        monkeypatch.setattr(plot_generator, "_BASE_DIR", str(tmp_path))
        sv = self._get_local_shap_values()
        path = plot_generator.generate_waterfall_plot(sv, MOCK_EMP_ID)
        assert os.path.exists(path)
        assert path.endswith(".png")

    def test_force_plot_creates_png(self, tmp_path, monkeypatch):
        from app.explainability import plot_generator
        monkeypatch.setattr(plot_generator, "_BASE_DIR", str(tmp_path))
        sv = self._get_local_shap_values()
        path = plot_generator.generate_force_plot(sv, MOCK_EMP_ID)
        assert os.path.exists(path)
        assert path.endswith(".png")

    def test_decision_plot_creates_png(self, tmp_path, monkeypatch):
        from app.explainability import plot_generator
        monkeypatch.setattr(plot_generator, "_BASE_DIR", str(tmp_path))
        sv = self._get_local_shap_values()
        path = plot_generator.generate_decision_plot(sv, MOCK_EMP_ID)
        assert os.path.exists(path)
        assert path.endswith(".png")

    def test_summary_beeswarm_creates_png(self, tmp_path, monkeypatch):
        from app.explainability import plot_generator
        monkeypatch.setattr(plot_generator, "_BASE_DIR", str(tmp_path))
        shap_matrix = self._get_shap_matrix(30)
        path = plot_generator.generate_summary_plot(shap_matrix)
        assert os.path.exists(path)
        assert path.endswith(".png")

    def test_bar_plot_creates_png(self, tmp_path, monkeypatch):
        from app.explainability import plot_generator
        monkeypatch.setattr(plot_generator, "_BASE_DIR", str(tmp_path))
        shap_matrix = self._get_shap_matrix(30)
        path = plot_generator.generate_bar_plot(shap_matrix)
        assert os.path.exists(path)
        assert path.endswith(".png")

    def test_dependence_plot_creates_png(self, tmp_path, monkeypatch):
        from app.explainability import plot_generator
        monkeypatch.setattr(plot_generator, "_BASE_DIR", str(tmp_path))
        shap_matrix = self._get_shap_matrix(30)
        path = plot_generator.generate_dependence_plot(shap_matrix, "salary")
        assert os.path.exists(path)
        assert path.endswith(".png")



# ---------------------------------------------------------------------------
# TestExplainAPIRoutes
# ---------------------------------------------------------------------------

class TestExplainAPIRoutes:
    """API endpoint integration tests using FastAPI TestClient."""

    @pytest.fixture(scope="class")
    def api_client(self, ready_shap_cache):
        from fastapi.testclient import TestClient
        from app.main import app
        # Send whatever AI_SERVICE_TOKEN is actually configured (main.py's
        # load_dotenv() picks up ai-service/.env when the app module is
        # imported) — verify_auth_token only bypasses auth when the token is
        # unset/the placeholder, so a real configured token must be sent.
        token = os.getenv("AI_SERVICE_TOKEN", "replace-with-a-service-token")
        with TestClient(app, raise_server_exceptions=True, headers={"Authorization": f"Bearer {token}"}) as c:
            yield c

    def test_feature_importance_returns_200(self, api_client):
        response = api_client.get("/feature-importance")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert len(body["data"]["features"]) == EXPECTED_FEATURE_COUNT

    def test_feature_importance_ranks_are_ordered(self, api_client):
        response = api_client.get("/feature-importance")
        features = response.json()["data"]["features"]
        importances = [f["meanAbsShap"] for f in features]
        assert importances == sorted(importances, reverse=True)

    @patch("app.api.explain_routes.get_db")
    def test_explain_employee_returns_200(self, mock_get_db, api_client):
        mock_get_db.return_value = _make_mock_db(employees_find_one_return=MOCK_EMP)

        response = api_client.get(f"/explain/{MOCK_EMP_ID}")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        data = body["data"]
        assert "riskScore" in data
        assert "riskLevel" in data
        assert "narrative" in data
        assert "top10Features" in data

    @patch("app.api.explain_routes.get_db")
    def test_explain_not_found_returns_404(self, mock_get_db, api_client):
        mock_get_db.return_value = _make_mock_db(employees_find_one_return=None)

        response = api_client.get(f"/explain/60d5ec388832a828f8000099")
        assert response.status_code == 404

    def test_explain_invalid_id_returns_400(self, api_client):
        response = api_client.get("/explain/not-a-valid-id")
        assert response.status_code == 400

    def test_explain_post_adhoc_returns_200(self, api_client):
        payload = {
            "salary": 75000,
            "dateOfBirth": "1990-05-15",
            "joiningDate": "2021-03-01",
            "gender": "MALE",
            "employmentType": "FULL_TIME",
            "workLocation": "Remote",
            "designation": "Engineer",
            "departmentId": "60d5ec388832a828f8000001",
        }
        response = api_client.post("/explain", json=payload)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "riskScore" in body["data"]
        assert "narrative" in body["data"]

    def test_global_plots_returns_200(self, api_client):
        response = api_client.get("/plots/global?feature=salary&n_samples=20")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        paths = body["data"]
        assert "summaryBeeswarm" in paths
        assert "summaryBar" in paths
        assert "dependence" in paths

    def test_global_plots_files_exist(self, api_client):
        response = api_client.get("/plots/global?feature=salary&n_samples=20")
        paths = response.json()["data"]
        for key, path in paths.items():
            assert os.path.exists(path), f"Plot file missing: {key} → {path}"
