"""
app/agent/tools/ml_tool.py
===========================
Tool wrapper: runs attrition prediction for a given employee document.
Calls the existing prediction_service — does NOT retrain the model.
"""

from app.prediction.prediction_service import prediction_service, ModelNotLoadedException
from typing import Dict, Any
import pandas as pd


async def run_ml_prediction(employee_doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Runs ML attrition prediction for an employee.
    Returns riskScore, riskLevel, confidence.
    """
    try:
        result = await prediction_service.predict_single(employee_doc, run_id="agent_run")
        return {
            "success": True,
            "riskScore": result["riskScore"],
            "riskLevel": result["riskLevel"],
            "confidence": result["confidence"],
        }
    except ModelNotLoadedException:
        return {
            "success": False,
            "riskScore": 0.5,
            "riskLevel": "MEDIUM",
            "confidence": 0.5,
            "error": "ML model not loaded."
        }
    except Exception as e:
        return {
            "success": False,
            "riskScore": 0.5,
            "riskLevel": "MEDIUM",
            "confidence": 0.5,
            "error": str(e)
        }
