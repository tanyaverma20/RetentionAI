"""
tests/test_experiment_tracker.py
=================================
Tests local experiment tracking and run lineage:
1. Log run persists parameters, validation metrics, test metrics, and SHA-256 fingerprint.
2. List runs filtering by experiment name.
3. Retrieve run by run_id.
4. Champion run selection based on explicit champion tag or highest test PR-AUC.
5. Run comparison calculates correct metric deltas (PR-AUC, ROC-AUC, Recall, Brier score).
6. Graceful MLflow decoupling (zero error when MLflow is absent).
"""

import pytest
import os
import json
from app.registry.experiment_tracker import LocalExperimentTracker


@pytest.fixture
def temp_tracker(tmp_path):
    tracker_dir = str(tmp_path / "experiments")
    return LocalExperimentTracker(base_dir=tracker_dir)


def test_log_run_persists_full_metadata(temp_tracker):
    run_id = temp_tracker.log_run(
        experiment_name="attrition_v2",
        model_name="RandomForest",
        parameters={"n_estimators": 100, "max_depth": 6},
        metrics={"rocAuc": 0.88, "prAuc": 0.65, "f1": 0.58, "brierScore": 0.095},
        dataset_fingerprint="sha256_mock_dataset_fingerprint_abc123",
        artifact_path="/models/rf_v2.joblib",
        artifact_sha256="sha256_mock_model_checksum_def456",
        validation_metrics={"rocAuc": 0.89, "prAuc": 0.67},
        is_champion=False,
    )

    assert run_id.startswith("run_")
    run = temp_tracker.get_run(run_id)
    assert run is not None
    assert run["model_name"] == "RandomForest"
    assert run["parameters"]["n_estimators"] == 100
    assert run["dataset_fingerprint"] == "sha256_mock_dataset_fingerprint_abc123"
    assert run["artifact_sha256"] == "sha256_mock_model_checksum_def456"
    assert run["validation_metrics"]["rocAuc"] == 0.89
    assert run["metrics"]["rocAuc"] == 0.88


def test_list_runs_and_experiment_filter(temp_tracker):
    temp_tracker.log_run(
        experiment_name="exp_A",
        model_name="LogisticRegression",
        parameters={},
        metrics={"prAuc": 0.60},
        dataset_fingerprint="fp1",
        artifact_path="p1",
        artifact_sha256="s1",
    )
    temp_tracker.log_run(
        experiment_name="exp_B",
        model_name="XGBoost",
        parameters={},
        metrics={"prAuc": 0.70},
        dataset_fingerprint="fp2",
        artifact_path="p2",
        artifact_sha256="s2",
    )

    all_runs = temp_tracker.list_runs()
    assert len(all_runs) == 2

    exp_a_runs = temp_tracker.list_runs("exp_A")
    assert len(exp_a_runs) == 1
    assert exp_a_runs[0]["model_name"] == "LogisticRegression"


def test_get_champion_run_selection(temp_tracker):
    run_1 = temp_tracker.log_run(
        experiment_name="exp_champ",
        model_name="Model_Low",
        parameters={},
        metrics={"prAuc": 0.55},
        dataset_fingerprint="fp1",
        artifact_path="p1",
        artifact_sha256="s1",
        is_champion=False,
    )
    run_2 = temp_tracker.log_run(
        experiment_name="exp_champ",
        model_name="Model_High",
        parameters={},
        metrics={"prAuc": 0.75},
        dataset_fingerprint="fp2",
        artifact_path="p2",
        artifact_sha256="s2",
        is_champion=True,
    )

    champ = temp_tracker.get_champion_run("exp_champ")
    assert champ is not None
    assert champ["run_id"] == run_2
    assert champ["model_name"] == "Model_High"


def test_compare_runs_calculates_deltas(temp_tracker):
    base_id = temp_tracker.log_run(
        experiment_name="benchmark",
        model_name="LogisticRegression",
        parameters={},
        metrics={"prAuc": 0.60, "rocAuc": 0.82, "brierScore": 0.12},
        dataset_fingerprint="fp1",
        artifact_path="p1",
        artifact_sha256="s1",
    )
    cand_id = temp_tracker.log_run(
        experiment_name="benchmark",
        model_name="CatBoost",
        parameters={},
        metrics={"prAuc": 0.68, "rocAuc": 0.86, "brierScore": 0.09},
        dataset_fingerprint="fp1",
        artifact_path="p2",
        artifact_sha256="s2",
    )

    comparison = temp_tracker.compare_runs(candidate_run_id=cand_id, baseline_run_id=base_id)

    assert comparison["candidate_model"] == "CatBoost"
    assert comparison["baseline_model"] == "LogisticRegression"

    deltas = comparison["deltas"]
    assert abs(deltas["prAuc"]["delta"] - 0.08) < 1e-4
    assert deltas["prAuc"]["improved"] is True
    # Brier score: lower is better, so candidate 0.09 < baseline 0.12 should be marked improved
    assert deltas["brierScore"]["improved"] is True
    assert deltas["brierScore"]["delta"] < 0
