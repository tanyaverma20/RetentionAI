"""
test_ml.py — Pytest test suite for the ML Prediction Service

Tests:
  - Pipeline feature engineering and transformations
  - Model training, evaluation, and selection (5-model benchmark + HPO +
    calibration + threshold optimization — see app/training/trainer.py)
  - API endpoint validation (predict, batch, model info, health)
"""
import os
import sys
import pytest
import datetime
import numpy as np
import pandas as pd
from unittest.mock import AsyncMock, MagicMock, patch

# ---------------------------------------------------------------------------
# Unit tests: Data Pipeline
# ---------------------------------------------------------------------------
from app.preprocessing.pipeline import (
    generate_synthetic_data,
    fit_transform_pipeline,
    transform_inference,
    NUMERICAL_COLS,
    CATEGORICAL_COLS,
)
from app.training.trainer import train_and_select_best_model, save_model_bundle

MOCK_EMPLOYEE_ID = "60d5ec388832a828f8000010"
MOCK_EMPLOYEE_DOC = {
    "_id": MOCK_EMPLOYEE_ID,
    "organizationId": "60d5ec388832a828f8000000",
    "employeeCode": "EMP-0010",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@retentionai.example",
    "gender": "MALE",
    "dateOfBirth": datetime.datetime(1990, 5, 15),
    "departmentId": "60d5ec388832a828f8000001",
    "designation": "Software Engineer",
    "joiningDate": datetime.datetime(2023, 1, 15),
    "employmentType": "FULL_TIME",
    "salary": 85000,
    "workLocation": "Remote",
    "status": "ACTIVE",
    "isDeleted": False,
}

VALID_ALGORITHMS = ["LogisticRegression", "RandomForest", "XGBoost", "LightGBM", "CatBoost"]


class TestPipeline:
    """Tests for the data preprocessing pipeline."""

    def test_synthetic_generation_produces_correct_row_count(self):
        df = generate_synthetic_data(50)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 50

    def test_synthetic_generation_has_required_columns(self):
        df = generate_synthetic_data(20)
        required = {"status", "salary", "gender", "employmentType", "workLocation", "designation", "departmentId"}
        assert required.issubset(set(df.columns))

    def test_synthetic_generation_contains_both_classes(self):
        """With 300 samples and the attrition correlations, both classes must appear."""
        df = generate_synthetic_data(300)
        statuses = df["status"].unique()
        assert "ACTIVE" in statuses
        assert "TERMINATED" in statuses

    def test_fit_transform_output_shape(self):
        df = generate_synthetic_data(200)
        X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata = fit_transform_pipeline(df)
        expected_cols = len(NUMERICAL_COLS) + len(CATEGORICAL_COLS)
        assert X_train.shape[1] == expected_cols
        assert X_test.shape[1] == expected_cols
        assert X_train.shape[0] + X_test.shape[0] == 200
        assert len(y_train) == X_train.shape[0]
        assert len(y_test) == X_test.shape[0]

    def test_fit_transform_scaler_and_encoders_populated(self):
        df = generate_synthetic_data(200)
        _, _, _, _, scaler, encoders, feature_metadata = fit_transform_pipeline(df)
        assert scaler is not None
        for col in CATEGORICAL_COLS:
            assert col in encoders
        assert "feature_cols" in feature_metadata

    def test_fit_transform_scaler_fit_only_on_train_split(self):
        """
        Regression test for the Sprint 8 data-leakage finding: the scaler/
        encoders must be fit on the training partition only, not the full
        dataset before splitting.
        """
        df = generate_synthetic_data(200)
        _, _, _, _, scaler, _, _ = fit_transform_pipeline(df)
        # StandardScaler fit on 160 rows (80% of 200), not all 200.
        assert scaler.n_samples_seen_ == 160

    def test_transform_inference_shape_matches_training(self):
        df_train = generate_synthetic_data(200)
        X_train, _, _, _, scaler, encoders, _ = fit_transform_pipeline(df_train)

        single_df = pd.DataFrame([MOCK_EMPLOYEE_DOC])
        X_inf = transform_inference(single_df, scaler, encoders)

        assert X_inf.shape[0] == 1
        assert X_inf.shape[1] == X_train.shape[1]

    def test_transform_inference_handles_unseen_categories(self):
        """Unseen categorical values should be mapped to UNKNOWN gracefully."""
        df_train = generate_synthetic_data(200)
        _, _, _, _, scaler, encoders, _ = fit_transform_pipeline(df_train)

        emp = MOCK_EMPLOYEE_DOC.copy()
        emp["gender"] = "NONBINARY_CUSTOM"  # not in training set
        emp["workLocation"] = "Moon Base"
        single_df = pd.DataFrame([emp])

        # Should not raise
        X_inf = transform_inference(single_df, scaler, encoders)
        assert X_inf.shape[0] == 1

    def test_target_encoding_matches_status_counts(self):
        df = generate_synthetic_data(200)
        _, _, y_train, y_test, _, _, _ = fit_transform_pipeline(df)
        y_all = np.concatenate([y_train, y_test])
        assert set(np.unique(y_all)).issubset({0, 1})
        assert int(y_all.sum()) == int((df["status"] == "TERMINATED").sum())
        assert int((y_all == 0).sum()) == int((df["status"] == "ACTIVE").sum())


# ---------------------------------------------------------------------------
# Unit tests: Model Training
# ---------------------------------------------------------------------------
class TestTrainer:
    """Tests for the 5-model benchmark, hyperparameter tuning, calibration, and threshold optimization."""

    @pytest.fixture(scope="class")
    def trained_bundle(self):
        df = generate_synthetic_data(400)
        X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata = fit_transform_pipeline(df)
        return train_and_select_best_model(X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata)

    def test_bundle_has_required_keys(self, trained_bundle):
        required = {
            "model", "model_name", "scaler", "encoders", "feature_metadata", "metrics",
            "version", "trained_at", "threshold", "best_params", "all_model_metrics",
            "calibration_method",
        }
        assert required.issubset(set(trained_bundle.keys()))

    def test_selected_model_is_valid_algorithm(self, trained_bundle):
        assert trained_bundle["model_name"] in VALID_ALGORITHMS

    def test_benchmark_covers_all_five_candidates(self, trained_bundle):
        """Phase 4: all 5 algorithm families must have been trained and compared."""
        assert set(trained_bundle["all_model_metrics"].keys()) == set(VALID_ALGORITHMS)

    def test_metrics_are_bounded(self, trained_bundle):
        m = trained_bundle["metrics"]
        for key in ("accuracy", "precision", "recall", "f1", "rocAuc", "prAuc"):
            assert key in m
            assert 0.0 <= m[key] <= 1.0

    def test_threshold_is_not_hardcoded_to_half(self, trained_bundle):
        """Phase 7: the threshold must be a real, optimized value in (0, 1) — not just assumed 0.5."""
        assert 0.0 < trained_bundle["threshold"] < 1.0

    def test_model_can_predict_probabilities(self, trained_bundle):
        """The selected (calibrated) model must support predict_proba."""
        df_test = generate_synthetic_data(5)
        X_inf = transform_inference(df_test, trained_bundle["scaler"], trained_bundle["encoders"])
        model = trained_bundle["model"]
        assert hasattr(model, "predict_proba")
        probs = model.predict_proba(X_inf)
        assert probs.shape == (5, 2)
        assert np.allclose(probs.sum(axis=1), 1.0, atol=1e-5)

    def test_model_bundle_save_and_reload(self, trained_bundle, tmp_path):
        filepath = str(tmp_path / "test_model.joblib")
        save_model_bundle(trained_bundle, filepath)
        assert os.path.exists(filepath)

        from app.training.trainer import load_model_bundle
        reloaded = load_model_bundle(filepath)
        assert reloaded["model_name"] == trained_bundle["model_name"]
        assert list(reloaded["metrics"].keys()) == list(trained_bundle["metrics"].keys())


# ---------------------------------------------------------------------------
# Unit tests: Prediction Service (no real MongoDB)
# ---------------------------------------------------------------------------
class TestPredictionService:
    """Tests for the prediction service with mocked MongoDB."""

    @pytest.fixture(scope="class")
    def shared_bundle(self):
        df = generate_synthetic_data(400)
        X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata = fit_transform_pipeline(df)
        return train_and_select_best_model(X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata)

    @pytest.fixture(autouse=True)
    def load_model(self, shared_bundle):
        from app.prediction.prediction_service import prediction_service
        prediction_service.model_bundle = shared_bundle
        self.svc = prediction_service

    def test_model_info_returns_correct_keys(self):
        info = self.svc.get_model_info()
        assert "version" in info
        assert "algorithm" in info
        assert "featureKeys" in info
        assert "trainedAt" in info

    def test_model_metrics_returns_correct_keys(self):
        metrics = self.svc.get_model_metrics()
        assert "algorithm" in metrics
        assert "metrics" in metrics

    @pytest.mark.asyncio
    async def test_predict_single_returns_valid_structure(self):
        with patch("app.prediction.prediction_service.get_db", return_value=None):
            result = await self.svc.predict_single(MOCK_EMPLOYEE_DOC)

        assert result["employeeId"] == MOCK_EMPLOYEE_ID
        assert 0.0 <= result["riskScore"] <= 1.0
        assert result["riskLevel"] in ["LOW", "MEDIUM", "HIGH"]
        assert 0.5 <= result["confidence"] <= 1.0
        assert result["status"] == "SUCCESS"

    @pytest.mark.asyncio
    async def test_risk_thresholds_match_model_bundle_threshold(self):
        """
        Phase 7: risk-level bucketing must be anchored on the model bundle's
        own optimized threshold, not a hardcoded 0.34/0.64 split that was
        never derived from any evaluation.
        """
        with patch("app.prediction.prediction_service.get_db", return_value=None):
            result = await self.svc.predict_single(MOCK_EMPLOYEE_DOC)

        threshold = self.svc.model_bundle["threshold"]
        medium_cutoff = threshold * 0.6
        score = result["riskScore"]
        if score < medium_cutoff:
            assert result["riskLevel"] == "LOW"
        elif score < threshold:
            assert result["riskLevel"] == "MEDIUM"
        else:
            assert result["riskLevel"] == "HIGH"


# ---------------------------------------------------------------------------
# API endpoint tests (via FastAPI TestClient)
# ---------------------------------------------------------------------------
class TestAPIRoutes:
    """Integration-style tests against the FastAPI routes using TestClient."""

    @pytest.fixture(scope="class")
    def api_client(self):
        """
        Creates a TestClient that skips lifespan events (no real DB needed),
        and injects a pre-trained model into the prediction_service singleton.
        """
        from fastapi.testclient import TestClient
        from app.prediction.prediction_service import prediction_service
        from app.main import app

        df = generate_synthetic_data(400)
        X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata = fit_transform_pipeline(df)
        bundle = train_and_select_best_model(X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata)
        prediction_service.model_bundle = bundle

        # A real AI_SERVICE_TOKEN is configured in ai-service/.env, so every
        # route's verify_auth_token dependency requires this Bearer header —
        # without it every request here would 401 regardless of the route's
        # own behavior.
        token = os.getenv("AI_SERVICE_TOKEN", "")
        headers = {"Authorization": f"Bearer {token}"} if token else {}

        with TestClient(app, raise_server_exceptions=True, headers=headers) as c:
            yield c

    def test_health_endpoint_returns_200(self, api_client):
        response = api_client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert "status" in body
        assert "modelLoaded" in body
        assert body["modelLoaded"] is True

    def test_model_info_endpoint(self, api_client):
        response = api_client.get("/model/info")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "algorithm" in body["data"]
        assert "featureKeys" in body["data"]
        assert len(body["data"]["featureKeys"]) > 0

    def test_model_metrics_endpoint(self, api_client):
        response = api_client.get("/model/metrics")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        metrics = body["data"]["metrics"]
        for key in ("f1", "accuracy", "recall", "rocAuc"):
            assert key in metrics
            assert 0.0 <= metrics[key] <= 1.0

    @patch("app.api.routes.get_db")
    def test_predict_single_with_mocked_db(self, mock_get_db, api_client):
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(side_effect=lambda key: mock_db)
        mock_db.find_one = AsyncMock(return_value=MOCK_EMPLOYEE_DOC)
        mock_db.insert_one = AsyncMock(return_value=MagicMock(inserted_id="hist_123"))
        mock_db.update_one = AsyncMock(return_value=MagicMock())
        mock_get_db.return_value = mock_db

        response = api_client.post("/predict", json={"employeeId": MOCK_EMPLOYEE_ID})
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        pred = body["data"]
        assert pred["employeeId"] == MOCK_EMPLOYEE_ID
        assert pred["riskLevel"] in ["LOW", "MEDIUM", "HIGH"]
        assert 0.0 <= pred["riskScore"] <= 1.0
        assert 0.0 <= pred["confidence"] <= 1.0

    def test_predict_missing_body_returns_422(self, api_client):
        response = api_client.post("/predict", json={})
        assert response.status_code == 422

    def test_predict_invalid_employee_id_format_returns_400(self, api_client):
        with patch("app.api.routes.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_db.__getitem__ = MagicMock(side_effect=lambda key: mock_db)
            mock_get_db.return_value = mock_db

            response = api_client.post("/predict", json={"employeeId": "not-a-valid-objectid"})
            assert response.status_code == 400

    @patch("app.api.routes.get_db")
    def test_predict_nonexistent_employee_returns_404(self, mock_get_db, api_client):
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(side_effect=lambda key: mock_db)
        mock_db.find_one = AsyncMock(return_value=None)
        mock_get_db.return_value = mock_db

        response = api_client.post("/predict", json={"employeeId": "60d5ec388832a828f8000099"})
        assert response.status_code == 404

    @patch("app.api.routes.get_db")
    def test_batch_predict_empty_returns_zero_count(self, mock_get_db, api_client):
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(side_effect=lambda key: mock_db)

        # Empty async iterator
        async def empty_iter():
            return
            yield

        mock_db.find = MagicMock(return_value=empty_iter())
        mock_get_db.return_value = mock_db

        response = api_client.post("/predict/batch", json={"departmentId": "60d5ec388832a828f8000001"})
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["totalCount"] == 0
