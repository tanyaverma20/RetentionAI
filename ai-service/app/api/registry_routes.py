"""
app/api/registry_routes.py
==========================
FastAPI routes for model registry, artifact manifest inspection, and promotion gate.
"""

import os
import json
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.routes import verify_auth_token
from app.registry.model_registry import (
    safe_load_model_bundle,
    evaluate_promotion_gate,
    ModelIntegrityException,
)
from app.prediction.prediction_service import prediction_service

router = APIRouter(prefix="/registry", tags=["Model Registry"])


class PromotionEvaluationRequest(BaseModel):
    candidateVersion: str
    candidateAlgorithm: str
    candidateMetrics: Dict[str, float] = Field(..., description="Metrics from candidate model evaluation")
    primaryMetric: Optional[str] = "prAuc"
    minLiftRequired: Optional[float] = 0.0


@router.get("/active", dependencies=[Depends(verify_auth_token)])
async def get_active_model_manifest():
    """
    Returns active model manifest and cryptographic provenance.
    """
    artifact_dir = os.getenv("MODEL_ARTIFACT_PATH", "../models/active")
    manifest_path = os.path.join(artifact_dir, "manifest.json")

    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read manifest: {e}")

    # Fallback to model info from running service
    if prediction_service.model_bundle:
        return {
            "modelVersion": prediction_service.model_bundle.get("version", "v2.0"),
            "algorithm": prediction_service.model_bundle.get("model_name", "Unknown"),
            "trainedAt": prediction_service.model_bundle.get("trained_at"),
            "metrics": prediction_service.model_bundle.get("metrics", {}),
            "baselineMetrics": prediction_service.model_bundle.get("baseline_metrics", {}),
            "status": "APPROVED",
            "note": "Manifest generated dynamically from active in-memory bundle.",
        }

    raise HTTPException(status_code=404, detail="No active model manifest found.")


@router.post("/promote", dependencies=[Depends(verify_auth_token)])
async def evaluate_candidate_promotion(req: PromotionEvaluationRequest):
    """
    Evaluates whether candidate model passes promotion criteria to replace champion.
    """
    active_metrics = None
    if prediction_service.model_bundle:
        active_metrics = prediction_service.model_bundle.get("metrics")

    approved, reason = evaluate_promotion_gate(
        candidate_metrics=req.candidateMetrics,
        active_metrics=active_metrics,
        primary_metric=req.primaryMetric or "prAuc",
        min_lift=req.minLiftRequired or 0.0,
    )

    return {
        "candidateVersion": req.candidateVersion,
        "candidateAlgorithm": req.candidateAlgorithm,
        "promotionApproved": approved,
        "reason": reason,
        "championMetrics": active_metrics,
        "candidateMetrics": req.candidateMetrics,
    }


@router.get("/verify-integrity", dependencies=[Depends(verify_auth_token)])
async def verify_active_artifact_integrity():
    """
    Validates on-disk model artifact signature, checksum, and structure.
    """
    artifact_dir = os.getenv("MODEL_ARTIFACT_PATH", "../models/active")
    target_path = os.path.join(artifact_dir, "attrition_model.joblib")

    if not os.path.exists(target_path):
        return {"status": "NO_ARTIFACT", "message": "No model file found on disk."}

    try:
        safe_load_model_bundle(target_path, verify_checksum=True)
        return {
            "status": "VERIFIED",
            "artifactPath": target_path,
            "message": "Model bundle passed cryptographic checksum and schema verification.",
        }
    except ModelIntegrityException as e:
        return {
            "status": "INTEGRITY_FAILURE",
            "artifactPath": target_path,
            "error": str(e),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Integrity check failed: {e}")
