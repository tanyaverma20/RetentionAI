"""
app/api/experiment_routes.py
============================
FastAPI routes for A/B testing and intervention evaluation.
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.routes import verify_auth_token
from app.experimentation.schemas import (
    ExperimentAssignRequest,
    ExperimentAssignResponse,
    ExperimentEvaluateRequest,
    ExperimentEvaluationResponse,
)
from app.experimentation.statistical_tests import calculate_sample_size_per_variant
from app.experimentation.experiment_service import (
    assign_employee_to_variant,
    evaluate_experiment_outcomes,
    generate_synthetic_experiment_demo,
)
import datetime

router = APIRouter(prefix="/experiments", tags=["A/B Testing & Interventions"])


@router.get("/plan", dependencies=[Depends(verify_auth_token)])
async def plan_experiment_sample_size(
    baseline_rate: float = Query(0.80, ge=0.01, le=0.99, description="Baseline retention rate"),
    mde: float = Query(0.05, ge=0.01, le=0.50, description="Minimum detectable effect size"),
    power: float = Query(0.80, ge=0.50, le=0.99, description="Statistical power (typically 0.80)"),
    alpha: float = Query(0.05, ge=0.001, le=0.20, description="Type I error rate alpha"),
):
    """
    Computes required sample size per variant for planned retention experiments.
    """
    n_required = calculate_sample_size_per_variant(
        baseline_rate=baseline_rate,
        minimum_detectable_effect=mde,
        alpha=alpha,
        power=power,
    )
    return {
        "status": "success",
        "parameters": {
            "baselineRetentionRate": baseline_rate,
            "minimumDetectableEffect": mde,
            "statisticalPower": power,
            "alpha": alpha,
        },
        "sampleSizeRequiredPerVariant": n_required,
        "totalSampleSizeRequired": n_required * 2,
        "guidance": (
            f"To reliably detect a {mde:.1%} lift in retention with {power:.0%} power at alpha={alpha}, "
            f"you must enroll at least {n_required} employees per variant ({n_required * 2} total)."
        ),
    }


@router.post("/assign", response_model=ExperimentAssignResponse, dependencies=[Depends(verify_auth_token)])
async def assign_experiment_variant(req: ExperimentAssignRequest):
    """
    Deterministically assigns an employee to 'TREATMENT' or 'CONTROL'.
    """
    if not req.employeeId or not req.experimentId:
        raise HTTPException(status_code=400, detail="employeeId and experimentId are required.")

    variant = assign_employee_to_variant(req.employeeId, req.experimentId)
    return ExperimentAssignResponse(
        experimentId=req.experimentId,
        employeeId=req.employeeId,
        variant=variant,
        assignedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        salt="retentionai_salt_v1",
    )


@router.post("/evaluate", response_model=ExperimentEvaluationResponse, dependencies=[Depends(verify_auth_token)])
async def evaluate_experiment(req: ExperimentEvaluateRequest):
    """
    Evaluates real treatment and control outcomes to test the intervention hypothesis.
    """
    try:
        return evaluate_experiment_outcomes(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Experiment evaluation failed: {e}")


@router.get("/demo", dependencies=[Depends(verify_auth_token)])
async def get_synthetic_experiment_demo(
    samples: int = Query(240, ge=40, le=1000, description="Number of synthetic participants"),
    effect: float = Query(0.09, ge=-0.3, le=0.3, description="True underlying retention effect"),
):
    """
    Returns an explicitly labeled, synthetic demonstration of retention A/B testing
    with statistical significance and demographic balance checks.
    """
    return generate_synthetic_experiment_demo(n_samples=samples, true_treatment_effect=effect)
