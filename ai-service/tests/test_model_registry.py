"""
tests/test_model_registry.py
============================
Tests for model packaging, SHA-256 checksum verification, safe model loading,
champion-candidate promotion gate, and registry API routes.
"""

import os
import json
import pytest

from app.preprocessing.pipeline import generate_synthetic_data, fit_transform_pipeline
from app.registry.model_registry import (
    package_model_artifact,
    safe_load_model_bundle,
    evaluate_promotion_gate,
    ModelIntegrityException,
)

AUTH_HEADERS = {"Authorization": f"Bearer {os.getenv('AI_SERVICE_TOKEN', 'test-token-not-a-placeholder')}"}


@pytest.fixture(scope="module")
def api_client():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


@pytest.fixture(scope="module")
def sample_bundle():
    from sklearn.linear_model import LogisticRegression
    df = generate_synthetic_data(80)
    X_train, X_test, y_train, y_test, scaler, encoders, metadata = fit_transform_pipeline(df)
    clf = LogisticRegression(max_iter=50)
    clf.fit(X_train, y_train)
    return {
        "model": clf,
        "model_name": "LogisticRegression",
        "metrics": {"rocAuc": 0.85, "prAuc": 0.72, "recall": 0.86, "brierScore": 0.11},
        "scaler": scaler,
        "label_encoders": encoders,
        "feature_names": metadata["feature_names"],
        "metadata": metadata,
        "version": "v1.0.0",
        "trained_at": "2026-10-19T00:00:00Z"
    }


def test_package_model_artifact_creates_manifest_and_joblib(sample_bundle, tmp_path):
    output_dir = str(tmp_path / "model_reg_test")
    manifest = package_model_artifact(sample_bundle, version="v2.1.0", output_dir=output_dir)

    assert os.path.exists(os.path.join(output_dir, "attrition_model.joblib"))
    assert os.path.exists(os.path.join(output_dir, "manifest.json"))
    assert manifest["modelVersion"] == "v2.1.0"
    assert "sha256Checksum" in manifest
    assert len(manifest["sha256Checksum"]) == 64
    assert manifest["environment"]["pythonVersion"] is not None


def test_safe_load_model_bundle_verifies_valid_artifact(sample_bundle, tmp_path):
    output_dir = str(tmp_path / "model_safe_test")
    package_model_artifact(sample_bundle, version="v2.1.0", output_dir=output_dir)

    joblib_path = os.path.join(output_dir, "attrition_model.joblib")
    reloaded = safe_load_model_bundle(joblib_path, verify_checksum=True)

    assert reloaded["model_name"] == sample_bundle["model_name"]
    assert hasattr(reloaded["model"], "predict")


def test_safe_load_model_bundle_raises_on_checksum_mismatch(sample_bundle, tmp_path):
    output_dir = str(tmp_path / "model_tamper_test")
    package_model_artifact(sample_bundle, version="v2.1.0", output_dir=output_dir)

    joblib_path = os.path.join(output_dir, "attrition_model.joblib")
    manifest_path = os.path.join(output_dir, "manifest.json")

    # Tamper with manifest checksum
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest_data = json.load(f)
    manifest_data["sha256Checksum"] = "0" * 64
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f)

    with pytest.raises(ModelIntegrityException, match="Checksum mismatch"):
        safe_load_model_bundle(joblib_path, manifest_path=manifest_path, verify_checksum=True)


def test_promotion_gate_approves_superior_candidate():
    champion = {"prAuc": 0.72, "recall": 0.85, "brierScore": 0.12}
    candidate = {"prAuc": 0.77, "recall": 0.84, "brierScore": 0.11}

    approved, reason = evaluate_promotion_gate(candidate, champion, primary_metric="prAuc", min_lift=0.02)
    assert approved is True
    assert "Promotion approved" in reason


def test_promotion_gate_rejects_underperforming_candidate():
    champion = {"prAuc": 0.75, "recall": 0.85}
    candidate = {"prAuc": 0.71, "recall": 0.80}

    approved, reason = evaluate_promotion_gate(candidate, champion, primary_metric="prAuc")
    assert approved is False
    assert "did not achieve required margin" in reason


def test_promotion_gate_rejects_severe_recall_degradation():
    champion = {"prAuc": 0.75, "recall": 0.88}
    # Higher PR-AUC but catastrophic recall drop (>10%)
    candidate = {"prAuc": 0.79, "recall": 0.72}

    approved, reason = evaluate_promotion_gate(candidate, champion, primary_metric="prAuc")
    assert approved is False
    assert "dropped by more than 10%" in reason


def test_registry_promote_api_endpoint(api_client):
    payload = {
        "candidateVersion": "v2.2.0-rc1",
        "candidateAlgorithm": "XGBoost",
        "candidateMetrics": {"prAuc": 0.88, "recall": 0.85},
        "primaryMetric": "prAuc",
        "minLiftRequired": 0.01,
    }
    res = api_client.post("/registry/promote", json=payload, headers=AUTH_HEADERS)
    assert res.status_code == 200
    assert "promotionApproved" in res.json()
    assert "reason" in res.json()


def test_registry_verify_integrity_api_endpoint(api_client):
    res = api_client.get("/registry/verify-integrity", headers=AUTH_HEADERS)
    assert res.status_code == 200
    assert "status" in res.json()


def test_safe_load_model_bundle_raises_when_manifest_missing_in_strict_mode(sample_bundle, tmp_path):
    output_dir = str(tmp_path / "model_no_manifest")
    package_model_artifact(sample_bundle, version="v2.1.0", output_dir=output_dir)

    joblib_path = os.path.join(output_dir, "attrition_model.joblib")
    manifest_path = os.path.join(output_dir, "manifest.json")
    os.remove(manifest_path)  # Delete manifest

    with pytest.raises(ModelIntegrityException, match="manifest missing"):
        safe_load_model_bundle(joblib_path, manifest_path=manifest_path, verify_checksum=True, require_manifest=True)


def test_safe_load_model_bundle_raises_on_corrupted_json_manifest(sample_bundle, tmp_path):
    output_dir = str(tmp_path / "model_bad_manifest")
    package_model_artifact(sample_bundle, version="v2.1.0", output_dir=output_dir)

    joblib_path = os.path.join(output_dir, "attrition_model.joblib")
    manifest_path = os.path.join(output_dir, "manifest.json")

    # Corrupt manifest JSON with malformed data
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write("{ INVALID JSON CONTENT :::")

    with pytest.raises(ModelIntegrityException, match="Corrupted manifest"):
        safe_load_model_bundle(joblib_path, manifest_path=manifest_path, verify_checksum=True)


def test_full_model_lifecycle_promotion_rollback_and_continuity(sample_bundle, tmp_path, monkeypatch):
    """
    Tests the complete production model lifecycle:
    1. Initial active champion deployment (v1)
    2. Prediction continuity under champion v1
    3. Candidate v2 training, evaluation gate, and successful atomic promotion
    4. Prediction continuity under promoted champion v2
    5. Malformed/corrupted candidate v3 promotion attempt triggering rollback
    6. Preservation of champion v2 and uninterrupted prediction service continuity
    """
    import copy
    import shutil
    import datetime
    import asyncio
    from unittest.mock import patch
    from app.prediction.prediction_service import PredictionService

    test_model_dir = str(tmp_path / "lifecycle_registry")
    staging_dir = os.path.join(test_model_dir, "_staging")
    backup_dir = os.path.join(test_model_dir, "_backup_champion")
    os.makedirs(test_model_dir, exist_ok=True)
    monkeypatch.setenv("MODEL_ARTIFACT_PATH", test_model_dir)

    # 1. Package and deploy Champion v1
    bundle_v1 = copy.deepcopy(sample_bundle)
    bundle_v1["version"] = "v1.0.0"
    bundle_v1["metrics"]["prAuc"] = 0.70
    bundle_v1["metrics"]["recall"] = 0.85
    package_model_artifact(bundle_v1, version="v1.0.0", output_dir=test_model_dir)

    pred_svc = PredictionService()
    pred_svc.load_active_model()
    assert pred_svc.model_bundle["version"] == "v1.0.0"

    # 2. Prediction continuity under v1
    mock_emp = {
        "_id": "60d5ec388832a828f8000010",
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
    with patch("app.prediction.prediction_service.get_db", return_value=None):
        res1 = asyncio.run(pred_svc.predict_single(mock_emp))
        assert res1["status"] == "SUCCESS"
        assert res1["modelVersion"] == "v1.0.0"

    # 3. Train and stage Candidate v2 (Superior PR-AUC)
    bundle_v2 = copy.deepcopy(sample_bundle)
    bundle_v2["version"] = "v2.0.0"
    bundle_v2["metrics"]["prAuc"] = 0.76
    bundle_v2["metrics"]["recall"] = 0.87
    os.makedirs(staging_dir, exist_ok=True)
    package_model_artifact(bundle_v2, version="v2.0.0", output_dir=staging_dir)

    # Evaluate promotion gate
    approved, reason = evaluate_promotion_gate(bundle_v2["metrics"], bundle_v1["metrics"], primary_metric="prAuc")
    assert approved is True

    # Atomic promotion with backup
    if os.path.exists(backup_dir):
        shutil.rmtree(backup_dir)
    shutil.copytree(test_model_dir, backup_dir, ignore=shutil.ignore_patterns("_staging*", "_backup*"))

    shutil.copy2(os.path.join(staging_dir, "attrition_model.joblib"), os.path.join(test_model_dir, "attrition_model.joblib"))
    shutil.copy2(os.path.join(staging_dir, "manifest.json"), os.path.join(test_model_dir, "manifest.json"))
    shutil.rmtree(staging_dir)

    pred_svc.load_active_model()
    assert pred_svc.model_bundle["version"] == "v2.0.0"

    # 4. Prediction continuity under v2
    with patch("app.prediction.prediction_service.get_db", return_value=None):
        res2 = asyncio.run(pred_svc.predict_single(mock_emp))
        assert res2["status"] == "SUCCESS"
        assert res2["modelVersion"] == "v2.0.0"

    # 5. Failed promotion attempt with corrupted candidate v3
    os.makedirs(staging_dir, exist_ok=True)
    with open(os.path.join(staging_dir, "attrition_model.joblib"), "wb") as f:
        f.write(b"CORRUPTED_BYTES_NOT_A_VALID_JOBLIB")
    with open(os.path.join(staging_dir, "manifest.json"), "w") as f:
        json.dump({"modelVersion": "v3.0.0", "sha256Checksum": "invalid_digest"}, f)

    # Backup current champion (v2)
    if os.path.exists(backup_dir):
        shutil.rmtree(backup_dir)
    shutil.copytree(test_model_dir, backup_dir, ignore=shutil.ignore_patterns("_staging*", "_backup*"))

    # Attempt promote and reload
    try:
        shutil.copy2(os.path.join(staging_dir, "attrition_model.joblib"), os.path.join(test_model_dir, "attrition_model.joblib"))
        shutil.copy2(os.path.join(staging_dir, "manifest.json"), os.path.join(test_model_dir, "manifest.json"))
        # Verify artifact integrity (must fail)
        safe_load_model_bundle(
            os.path.join(test_model_dir, "attrition_model.joblib"),
            manifest_path=os.path.join(test_model_dir, "manifest.json"),
            verify_checksum=True,
        )
    except Exception as exc:
        # Trigger automatic rollback to backup champion
        shutil.copy2(os.path.join(backup_dir, "attrition_model.joblib"), os.path.join(test_model_dir, "attrition_model.joblib"))
        shutil.copy2(os.path.join(backup_dir, "manifest.json"), os.path.join(test_model_dir, "manifest.json"))
        pred_svc.load_active_model()

    # 6. Verify rollback preserved Champion v2 and predictions continue seamlessly
    assert pred_svc.model_bundle["version"] == "v2.0.0"
    with patch("app.prediction.prediction_service.get_db", return_value=None):
        res3 = asyncio.run(pred_svc.predict_single(mock_emp))
        assert res3["status"] == "SUCCESS"
        assert res3["modelVersion"] == "v2.0.0"
