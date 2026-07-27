"""
app/agent/tools/shap_tool.py
=============================
Tool wrapper: retrieves SHAP local explanations for an employee.
Calls the existing local_explainer — does NOT rebuild SHAP.
"""

from app.explainability.local_explainer import explain_employee
from typing import Dict, Any


def run_shap_explanation(employee_doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates SHAP local explanation for an employee.
    Returns top positive/negative contributors and narrative.
    """
    try:
        result = explain_employee(employee_doc, top_n=5)
        
        top_risk = [f["displayName"] for f in result.get("topPositiveContributors", [])[:5]]
        top_protective = [f["displayName"] for f in result.get("topNegativeContributors", [])[:5]]
        
        return {
            "success": True,
            "topRiskFeatures": top_risk,
            "topProtectiveFeatures": top_protective,
            "narrative": result.get("narrative", ""),
            "allFeatures": result.get("top10Features", [])
        }
    except RuntimeError as e:
        # SHAP not initialised
        return {
            "success": False,
            "topRiskFeatures": [],
            "topProtectiveFeatures": [],
            "narrative": "SHAP explainer not available.",
            "error": str(e)
        }
    except Exception as e:
        return {
            "success": False,
            "topRiskFeatures": [],
            "topProtectiveFeatures": [],
            "narrative": "Could not generate SHAP explanation.",
            "error": str(e)
        }
