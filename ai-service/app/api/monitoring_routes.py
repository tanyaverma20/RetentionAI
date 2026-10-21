"""
app/api/monitoring_routes.py
============================
FastAPI routes for model and data drift monitoring.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.routes import verify_auth_token
from app.monitoring.drift_detector import (
    compute_psi,
    compute_feature_drift,
    compute_data_quality_report,
    compute_prediction_drift,
    compute_delayed_performance,
)
from app.preprocessing.pipeline import generate_synthetic_data, NUMERICAL_COLS, CATEGORICAL_COLS
import pandas as pd
import numpy as np

router = APIRouter(prefix="/monitoring", tags=["Model & Data Monitoring"])


class PredictionDriftRequest(BaseModel):
    baselineScores: List[float] = Field(..., min_length=5, description="Historical reference risk score predictions")
    currentScores: List[float] = Field(..., min_length=5, description="Current production window risk score predictions")
    highRiskThreshold: Optional[float] = Field(default=0.5, description="Decision threshold for high-risk classification")


class DelayedPerformanceRequest(BaseModel):
    groundTruthLabels: List[int] = Field(..., min_length=10, description="1 if employee left, 0 if retained")
    predictedProbabilities: List[float] = Field(..., min_length=10, description="Model-predicted attrition probabilities")
    baselineMetrics: Optional[Dict[str, float]] = None
    threshold: Optional[float] = 0.5


@router.post("/prediction-drift", dependencies=[Depends(verify_auth_token)])
async def analyze_prediction_drift(req: PredictionDriftRequest):
    """
    Computes Population Stability Index (PSI) and high-risk shift between baseline and current risk distributions.
    """
    return compute_prediction_drift(
        baseline_scores=req.baselineScores,
        current_scores=req.currentScores,
        high_risk_threshold=req.highRiskThreshold,
    )


@router.post("/delayed-performance", dependencies=[Depends(verify_auth_token)])
async def evaluate_delayed_performance(req: DelayedPerformanceRequest):
    """
    Evaluates real model performance when ground-truth outcomes become available.
    """
    return compute_delayed_performance(
        ground_truth=req.groundTruthLabels,
        predicted_probs=req.predictedProbabilities,
        baseline_metrics=req.baselineMetrics,
        threshold=req.threshold,
    )


@router.get("/demo", dependencies=[Depends(verify_auth_token)])
async def get_monitoring_demo(
    drift_level: str = Query("moderate", pattern="^(none|moderate|severe)$", description="Level of simulated drift to demonstrate"),
):
    """
    Returns an explicitly labeled, synthetic demonstration of feature, prediction,
    and data quality drift monitoring.
    """
    rng = np.random.default_rng(42)
    baseline_df = generate_synthetic_data(300)

    # Shift current data if moderate or severe drift requested
    current_df = generate_synthetic_data(300)
    if drift_level == "moderate":
        current_df["overtime_hours"] = current_df["overtime_hours"] * 1.5
        current_df["salary"] = current_df["salary"] * 0.90
    elif drift_level == "severe":
        current_df["overtime_hours"] = current_df["overtime_hours"] * 2.2
        current_df["burnout_score"] = np.clip(current_df["burnout_score"] + 0.35, 0, 1)
        current_df["salary"] = current_df["salary"] * 0.75

    feature_drift = compute_feature_drift(
        baseline_df=baseline_df,
        current_df=current_df,
        numerical_cols=NUMERICAL_COLS[:8],
        categorical_cols=CATEGORICAL_COLS[:3],
    )

    data_quality = compute_data_quality_report(current_df)

    # Prediction drift simulation
    b_scores = rng.beta(2, 5, size=200).tolist()
    if drift_level == "moderate":
        c_scores = rng.beta(3, 4, size=200).tolist()
    elif drift_level == "severe":
        c_scores = rng.beta(4, 3, size=200).tolist()
    else:
        c_scores = rng.beta(2, 5, size=200).tolist()

    pred_drift = compute_prediction_drift(b_scores, c_scores, high_risk_threshold=0.5)

    return {
        "isDemonstration": True,
        "demonstrationScenario": f"{drift_level.upper()} drift scenario",
        "dataQuality": data_quality,
        "featureDrift": feature_drift,
        "predictionDrift": pred_drift,
        "recommendedInvestigation": (
            "Review feature shift in overtime_hours and salary. Evaluate if market competition or "
            "organizational restructuring caused input feature distribution divergence."
            if drift_level != "none" else "Distributions are stable within historical bounds."
        ),
    }
