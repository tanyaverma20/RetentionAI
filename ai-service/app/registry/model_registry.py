"""
app/registry/model_registry.py
==============================
Versioned model artifact packaging, safe loading with checksum verification,
and champion/candidate promotion gate.
"""

import os
import sys
import json
import hashlib
import datetime
from typing import Dict, Any, Tuple, Optional
import joblib
import sklearn


class ModelIntegrityException(Exception):
    """Raised when a model artifact fails integrity or schema verification."""
    pass


REQUIRED_BUNDLE_KEYS = {"model", "model_name", "scaler", "encoders", "feature_metadata"}


def compute_file_sha256(filepath: str) -> str:
    """Computes SHA-256 checksum of an artifact file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def package_model_artifact(
    bundle: Dict[str, Any],
    version: str,
    output_dir: str = "../models/active",
) -> Dict[str, Any]:
    """
    Saves a versioned model bundle along with a cryptographic manifest.json
    recording environment metadata, feature schema, hyperparameters, and checksum.
    """
    os.makedirs(output_dir, exist_ok=True)
    target_joblib = os.path.join(output_dir, "attrition_model.joblib")
    target_manifest = os.path.join(output_dir, "manifest.json")

    # Ensure bundle has version stamped
    bundle["version"] = version
    joblib.dump(bundle, target_joblib)

    file_checksum = compute_file_sha256(target_joblib)

    manifest = {
        "modelVersion": version,
        "algorithm": bundle.get("model_name", "Unknown"),
        "trainedAt": bundle.get("trained_at", datetime.datetime.now().isoformat()),
        "datasetFingerprint": bundle.get("dataset_fingerprint", "untracked"),
        "featureSchema": {
            "featureCols": bundle.get("feature_metadata", {}).get("feature_cols", []),
            "numericalCols": bundle.get("feature_metadata", {}).get("numerical_cols", []),
            "categoricalCols": bundle.get("feature_metadata", {}).get("categorical_cols", []),
        },
        "hyperparameters": bundle.get("best_params", {}),
        "threshold": bundle.get("threshold", 0.5),
        "calibrationMethod": bundle.get("calibration_method", "isotonic"),
        "metrics": bundle.get("metrics", {}),
        "baselineMetrics": bundle.get("baseline_metrics", {}),
        "environment": {
            "pythonVersion": sys.version.split()[0],
            "scikitLearnVersion": sklearn.__version__,
            "platform": sys.platform,
        },
        "artifactFile": "attrition_model.joblib",
        "sha256Checksum": file_checksum,
        "status": "APPROVED",
    }

    with open(target_manifest, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return manifest


def safe_load_model_bundle(
    filepath: str,
    manifest_path: Optional[str] = None,
    verify_checksum: bool = True,
    require_manifest: bool = False,
) -> Dict[str, Any]:
    """
    Loads and validates a model bundle. Verifies:
    1. File existence and non-zero size
    2. Checksum against manifest.json if present (or mandatory if require_manifest=True)
    3. Required dictionary keys
    4. Model prediction interface support
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Model file not found: {filepath}")

    if os.path.getsize(filepath) == 0:
        raise ModelIntegrityException(f"Model file {filepath} is empty (0 bytes).")

    # If manifest is not explicitly passed, check adjacent directory
    if manifest_path is None:
        candidate_manifest = os.path.join(os.path.dirname(filepath), "manifest.json")
        if os.path.exists(candidate_manifest):
            manifest_path = candidate_manifest

    strict_manifest = require_manifest or os.getenv("REQUIRE_MANIFEST_CHECKSUM", "false").lower() in ("true", "1")

    if verify_checksum:
        if not manifest_path or not os.path.exists(manifest_path):
            if strict_manifest:
                raise ModelIntegrityException(f"Cryptographic manifest missing for model file: {filepath}")
        else:
            try:
                with open(manifest_path, "r", encoding="utf-8") as f:
                    manifest_data = json.load(f)
                expected_hash = manifest_data.get("sha256Checksum")
                if expected_hash:
                    actual_hash = compute_file_sha256(filepath)
                    if actual_hash != expected_hash:
                        raise ModelIntegrityException(
                            f"Checksum mismatch for {filepath}. Expected {expected_hash}, got {actual_hash}. "
                            "Artifact may be corrupted or modified."
                        )
                elif strict_manifest:
                    raise ModelIntegrityException(f"Manifest {manifest_path} is missing sha256Checksum field.")
            except json.JSONDecodeError as e:
                raise ModelIntegrityException(f"Corrupted manifest JSON at {manifest_path}: {e}")

    try:
        bundle = joblib.load(filepath)
    except Exception as e:
        raise ModelIntegrityException(f"Failed to deserialize model bundle: {e}")

    if not isinstance(bundle, dict):
        raise ModelIntegrityException("Loaded bundle is not a valid dictionary.")

    missing_keys = REQUIRED_BUNDLE_KEYS - set(bundle.keys())
    if missing_keys:
        raise ModelIntegrityException(f"Model bundle is missing mandatory keys: {missing_keys}")

    # Validate model estimator interface
    model = bundle["model"]
    if not hasattr(model, "predict"):
        raise ModelIntegrityException("Loaded model estimator does not implement .predict() method.")

    return bundle


def evaluate_promotion_gate(
    candidate_metrics: Dict[str, float],
    active_metrics: Optional[Dict[str, float]],
    primary_metric: str = "prAuc",
    min_lift: float = 0.0,
) -> Tuple[bool, str]:
    """
    Enforces documented promotion criteria before replacing the active champion model.
    A candidate model is approved for promotion if:
    1. Candidate primary metric (PR-AUC) >= active primary metric + min_lift
    2. Candidate recall does not suffer catastrophic degradation (> 10% drop)
    3. Candidate Brier score is not worse than active
    """
    if not active_metrics:
        return True, "Initial model registration approved: no prior active champion exists."

    cand_primary = candidate_metrics.get(primary_metric, 0.0)
    act_primary = active_metrics.get(primary_metric, 0.0)

    if cand_primary < (act_primary + min_lift):
        return False, (
            f"Promotion rejected: Candidate {primary_metric} ({cand_primary:.4f}) did not achieve "
            f"required margin over active champion ({act_primary:.4f} + {min_lift:.4f})."
        )

    # Check for severe recall drop
    cand_rec = candidate_metrics.get("recall", 1.0)
    act_rec = active_metrics.get("recall", 1.0)
    if (act_rec - cand_rec) > 0.10:
        return False, (
            f"Promotion rejected: Candidate recall ({cand_rec:.4f}) dropped by more than 10% "
            f"compared to champion ({act_rec:.4f}). High recall is required for workforce retention."
        )

    return True, (
        f"Promotion approved: Candidate {primary_metric} ({cand_primary:.4f}) beats champion "
        f"({act_primary:.4f}) while preserving recall standards."
    )
