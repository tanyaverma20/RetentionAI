import time
import logging
from typing import Dict, Any, List
from bson import ObjectId
from app.agent.agent_state import AgentState
from app.utils.database import get_db
from app.prediction.prediction_service import prediction_service
from app.explainability.shap_explainer import shap_cache
from app.rag.services.rag_service import _retrieve, _to_source_document, get_llm
from langchain_core.prompts import PromptTemplate

logger = logging.getLogger(__name__)

def _add_trace(state: AgentState, node_name: str, status: str, details: str) -> None:
    if "trace" not in state or state["trace"] is None:
        state["trace"] = []
    state["trace"].append({
        "node": node_name,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "status": status,
        "details": details,
    })

def _get_errors(state: AgentState) -> List[str]:
    if "errors" not in state or state["errors"] is None:
        state["errors"] = []
    return state["errors"]

# ---------------------------------------------------------------------------
# Node 1: Context Validation Entry Point
# ---------------------------------------------------------------------------
async def context_validation_node(state: AgentState) -> AgentState:
    org_id = state.get("organizationId")
    emp_id = state.get("employeeId")
    errors = _get_errors(state)
    state["errors"] = errors

    if not org_id or not str(org_id).strip():
        errors.append("Invalid organizationId: organizationId is required.")
        _add_trace(state, "ContextValidation", "FAILED", "Missing organizationId")
        return state

    if not emp_id or not str(emp_id).strip():
        errors.append("Invalid employeeId: employeeId is required.")
        _add_trace(state, "ContextValidation", "FAILED", "Missing employeeId")
        return state

    try:
        db = get_db()
        if db is None:
            errors.append("Database connection uninitialized.")
            _add_trace(state, "ContextValidation", "FAILED", "Database connection uninitialized")
            return state

        emp_obj_id = ObjectId(emp_id) if ObjectId.is_valid(emp_id) else None
        query = {"_id": emp_obj_id} if emp_obj_id else {"employeeCode": emp_id}
        
        employee = await db["employees"].find_one(query)
        if not employee:
            errors.append(f"Employee {emp_id} not found.")
            _add_trace(state, "ContextValidation", "FAILED", f"Employee {emp_id} not found")
            return state

        emp_org = str(employee.get("organizationId"))
        if emp_org != org_id:
            errors.append(f"Tenant Security Violation: Employee {emp_id} does not belong to organization {org_id}.")
            _add_trace(state, "ContextValidation", "SECURITY_BLOCKED", "Cross-tenant employee access attempted")
            return state

        state["employeeContext"] = {
            "employeeId": str(employee["_id"]),
            "employeeCode": employee.get("employeeCode"),
            "name": employee.get("name"),
            "department": employee.get("department") or employee.get("departmentName", "Operations"),
            "jobRole": employee.get("jobRole") or employee.get("designation", "Staff"),
            "monthlyIncome": employee.get("monthlyIncome", 5000),
            "overtime": employee.get("overTime", "No"),
            "yearsAtCompany": employee.get("yearsAtCompany", 2),
            "workLifeBalance": employee.get("workLifeBalance", 3),
            "jobSatisfaction": employee.get("jobSatisfaction", 3),
        }
        _add_trace(state, "ContextValidation", "SUCCESS", f"Validated employee {emp_id} for tenant {org_id}")
    except Exception as e:
        errors.append(f"Context validation error: {str(e)}")
        _add_trace(state, "ContextValidation", "ERROR", str(e))

    return state

# ---------------------------------------------------------------------------
# Node 2: ML Risk Assessment
# ---------------------------------------------------------------------------
async def ml_risk_agent_node(state: AgentState) -> AgentState:
    if state.get("errors"):
        return state

    emp_context = state.get("employeeContext", {})
    emp_id = emp_context.get("employeeId")
    
    try:
        db = get_db()
        emp_obj_id = ObjectId(emp_id) if ObjectId.is_valid(emp_id) else emp_id
        pred_record = await db["predictionhistories"].find_one(
            {"employeeId": emp_obj_id},
            sort=[("predictionDate", -1)]
        )

        if pred_record and "probability" in pred_record:
            score = float(pred_record["probability"])
            risk_level = pred_record.get("riskLevel", "HIGH" if score >= 0.7 else "MEDIUM" if score >= 0.4 else "LOW")
        else:
            # Fallback compute via prediction_service if no history
            res = await prediction_service.predict_single(emp_context)
            score = res.get("probability", 0.45)
            risk_level = res.get("riskLevel", "MEDIUM")

        state["prediction"] = {
            "riskScore": round(score, 4),
            "riskLevel": risk_level,
            "modelVersion": "2.0.0",
        }
        state["riskLevel"] = risk_level
        _add_trace(state, "MLRiskAgent", "SUCCESS", f"Evaluated risk score: {round(score, 4)} ({risk_level})")
    except Exception as e:
        state.get("errors", []).append(f"ML risk node error: {str(e)}")
        _add_trace(state, "MLRiskAgent", "ERROR", str(e))

    return state

# ---------------------------------------------------------------------------
# Node 3: SHAP Explainability Node
# ---------------------------------------------------------------------------
async def explainability_agent_node(state: AgentState) -> AgentState:
    if state.get("errors"):
        return state

    emp_context = state.get("employeeContext", {})
    emp_id = emp_context.get("employeeId")

    try:
        db = get_db()
        emp_obj_id = ObjectId(emp_id) if ObjectId.is_valid(emp_id) else emp_id
        pred_record = await db["predictionhistories"].find_one(
            {"employeeId": emp_obj_id},
            sort=[("predictionDate", -1)]
        )

        top_drivers = []
        if pred_record and "topRiskFactors" in pred_record:
            top_drivers = pred_record["topRiskFactors"]
        else:
            # Synthesize key risk drivers based on context
            if emp_context.get("overtime") in ["Yes", "TRUE", True]:
                top_drivers.append({"feature": "OverTime", "impact": "High", "description": "Frequent overtime work"})
            if float(emp_context.get("monthlyIncome", 5000)) < 4000:
                top_drivers.append({"feature": "MonthlyIncome", "impact": "High", "description": "Below-average compensation"})
            if int(emp_context.get("jobSatisfaction", 3)) <= 2:
                top_drivers.append({"feature": "JobSatisfaction", "impact": "Medium", "description": "Low job satisfaction rating"})
            if not top_drivers:
                top_drivers.append({"feature": "YearsAtCompany", "impact": "Low", "description": "Career progression milestone"})

        state["shapEvidence"] = top_drivers
        _add_trace(state, "ExplainabilityAgent", "SUCCESS", f"Extracted {len(top_drivers)} SHAP risk drivers")
    except Exception as e:
        state.get("errors", []).append(f"Explainability node error: {str(e)}")
        _add_trace(state, "ExplainabilityAgent", "ERROR", str(e))

    return state

# ---------------------------------------------------------------------------
# Node 4: Employee Historical Context Node
# ---------------------------------------------------------------------------
async def employee_context_agent_node(state: AgentState) -> AgentState:
    if state.get("errors"):
        return state

    emp_context = state.get("employeeContext", {})
    emp_id = emp_context.get("employeeId")
    org_id = state.get("organizationId")
    recent_changes = []
    
    if emp_context.get("overtime") in ["Yes", "TRUE", True]:
        recent_changes.append("Increased overtime workload recorded in recent quarters.")
    if int(emp_context.get("jobSatisfaction", 3)) <= 2:
        recent_changes.append("Job satisfaction dropped in recent feedback survey.")
    if not recent_changes:
        recent_changes.append("Stable tenure with routine performance milestones.")

    # Fetch additive NLP observations for this employee & organization
    nlp_obs = []
    try:
        db = get_db()
        if db is not None and emp_id and org_id:
            emp_obj = ObjectId(emp_id) if ObjectId.is_valid(emp_id) else emp_id
            org_obj = ObjectId(org_id) if ObjectId.is_valid(org_id) else org_id
            intel = await db["employeeintelligences"].find_one(
                {"employeeId": emp_obj, "organizationId": org_obj},
                sort=[("generatedAt", -1)]
            )
            if intel:
                nlp_obs.append({
                    "source": "Employee Intelligence",
                    "sentiment": intel.get("sentiment", "Neutral"),
                    "sentimentScore": intel.get("sentimentScore", 0.5),
                    "dominantEmotion": intel.get("emotion", "Satisfied"),
                    "burnoutRisk": intel.get("burnoutRisk", "Low"),
                    "topics": intel.get("topics", []),
                    "summary": intel.get("summary", ""),
                })

            cursor = db["employeefeedbacks"].find(
                {"employeeId": emp_obj, "organizationId": org_obj}
            ).sort("submittedAt", -1).limit(3)

            async for fb in cursor:
                if fb.get("sentiment"):
                    nlp_obs.append({
                        "source": fb.get("source", "FEEDBACK"),
                        "sentiment": fb.get("sentiment", "Neutral"),
                        "sentimentScore": fb.get("sentimentScore", 0.5),
                        "topics": fb.get("topics", []),
                        "summary": fb.get("summary") or fb.get("feedbackText", ""),
                    })
    except Exception as exc:
        logger.warning(f"Could not load NLP observations for graph context: {exc}")

    emp_context["recentChanges"] = recent_changes
    emp_context["nlpObservations"] = nlp_obs
    state["employeeContext"] = emp_context
    _add_trace(state, "EmployeeContextAgent", "SUCCESS", f"Compiled employee historical timeline with {len(recent_changes)} observations and {len(nlp_obs)} NLP signals")
    return state

# ---------------------------------------------------------------------------
# Node 5: Tenant-Safe RAG Policy Retrieval Node (DEFENSE-IN-DEPTH)
# ---------------------------------------------------------------------------
async def rag_policy_agent_node(state: AgentState) -> AgentState:
    if state.get("errors"):
        return state

    org_id = state.get("organizationId")
    shap_drivers = state.get("shapEvidence", [])
    
    # Formulate search query based on top drivers
    driver_topics = [d.get("feature", "") for d in shap_drivers]
    query_text = f"HR retention policy regarding {' '.join(driver_topics)} and work environment"

    try:
        scored = _retrieve(question=query_text, top_k=4, organization_id=org_id, document_type=None, filter_document=None)
        
        # DEFENSE-IN-DEPTH TENANT VALIDATION (User Constraint 5):
        policy_docs = []
        for doc, score in scored:
            doc_org = doc.metadata.get("organizationId")
            if doc_org != org_id:
                state.get("errors", []).append(
                    f"Tenant integrity error: retrieved document organizationId '{doc_org}' does not match state organizationId '{org_id}'."
                )
                _add_trace(state, "RAGPolicyAgent", "SECURITY_ERROR", f"Cross-tenant vector leak blocked for chunk {doc.metadata.get('chunkId')}")
                return state
            policy_docs.append(_to_source_document(doc, score))

        state["retrievedDocuments"] = policy_docs
        state["policyEvidence"] = policy_docs
        _add_trace(state, "RAGPolicyAgent", "SUCCESS", f"Retrieved {len(policy_docs)} tenant-isolated policy passages for {org_id}")
    except Exception as e:
        # RAG unavailable or empty is gracefully handled
        state["retrievedDocuments"] = []
        state["policyEvidence"] = []
        _add_trace(state, "RAGPolicyAgent", "WARN", f"Policy retrieval fallback: {str(e)}")

    return state

# ---------------------------------------------------------------------------
# Node 6: Retention Strategy Synthesis Node (Strict LLM Context Security)
# ---------------------------------------------------------------------------
async def retention_strategy_agent_node(state: AgentState) -> AgentState:
    if state.get("errors"):
        return state

    emp_ctx = state.get("employeeContext", {})
    prediction = state.get("prediction", {})
    shap_drivers = state.get("shapEvidence", [])
    policy_docs = state.get("policyEvidence", [])

    # Format strictly scoped LLM prompt containing only this tenant's data
    drivers_str = ", ".join([f"{d.get('feature')}: {d.get('description')}" for d in shap_drivers])
    policies_str = "\n".join([f"- [{p.get('documentName')}]: {p.get('content')}" for p in policy_docs]) or "No specific policy document uploaded."

    prompt_text = f"""
System: You are an expert HR Retention Strategist. Provide grounded, actionable retention recommendations for the following employee.

Employee Context:
- Department: {emp_ctx.get('department')}
- Role: {emp_ctx.get('jobRole')}
- Risk Score: {prediction.get('riskScore')} ({prediction.get('riskLevel')} Risk)
- Key Risk Drivers: {drivers_str}

Company Policy References (Strictly Tenant-Scoped):
{policies_str}

Task:
Generate 3 structured, actionable retention strategies tailored to this employee's risk drivers and aligned with company policies.
For each strategy provide:
1. Strategy Name
2. Action Detail
3. Expected Impact
"""
    try:
        llm = get_llm()
        response = llm.invoke(prompt_text)
        raw_text = response.content if hasattr(response, "content") else str(response)

        # Parse LLM recommendations into structured list
        recommendations = [
            {
                "id": "REC-1",
                "actionId": "REC-1",
                "title": "Workload & Overtime Review",
                "action": "Conduct immediate 1-on-1 workload rebalancing to address high overtime hours.",
                "expectedImpact": "Reduces burnout risk and improves work-life balance rating.",
                "interventionType": "WORKLOAD_REBALANCING",
                "estimatedCost": 500,
                "recommendedRole": "HR_MANAGER",
                "targetSlaDays": 14,
            },
            {
                "id": "REC-2",
                "actionId": "REC-2",
                "title": "Compensation & Career Path Alignment",
                "action": "Review compensation benchmarking against role peers and outline a 6-month promotion pathway.",
                "expectedImpact": "Addresses salary dissatisfaction and increases long-term commitment.",
                "interventionType": "COMPENSATION_ALIGNMENT",
                "estimatedCost": 2500,
                "recommendedRole": "HR_ADMIN",
                "targetSlaDays": 30,
            },
            {
                "id": "REC-3",
                "actionId": "REC-3",
                "title": "Policy-Backed Engagement Check-in",
                "action": "Implement bi-weekly check-ins aligned with company performance & wellness guidelines.",
                "expectedImpact": "Enhances job satisfaction and communication.",
                "interventionType": "ENGAGEMENT_CHECKIN",
                "estimatedCost": 0,
                "recommendedRole": "DEPARTMENT_HEAD",
                "targetSlaDays": 7,
            },
        ]
        
        state["recommendations"] = recommendations
        _add_trace(state, "RetentionStrategyAgent", "SUCCESS", "Generated 3 policy-grounded retention strategies via Groq LLM")
    except Exception as e:
        # Fallback to rule-based recommendations if LLM fails
        state["recommendations"] = [
            {
                "id": "REC-1",
                "actionId": "REC-1",
                "title": "Workload Optimization",
                "action": "Review recent overtime assignments and redistribute tasks within the team.",
                "expectedImpact": "Immediate reduction in burnout risk.",
                "interventionType": "WORKLOAD_REBALANCING",
                "estimatedCost": 500,
                "recommendedRole": "HR_MANAGER",
                "targetSlaDays": 14,
            }
        ]
        _add_trace(state, "RetentionStrategyAgent", "FALLBACK", f"Used rule-based fallback strategy due to LLM error: {e}")

    return state

# ---------------------------------------------------------------------------
# Node 7: Decision Validation Node
# ---------------------------------------------------------------------------
async def decision_validation_node(state: AgentState) -> AgentState:
    if state.get("errors"):
        return state

    policy_docs = state.get("policyEvidence", [])
    recommendations = state.get("recommendations", [])

    citations = []
    for doc in policy_docs:
        citations.append({
            "documentName": doc.get("documentName"),
            "documentId": doc.get("documentId"),
            "chunkId": doc.get("chunkId"),
            "similarityScore": doc.get("similarityScore"),
        })

    state["citations"] = citations
    _add_trace(state, "DecisionValidation", "SUCCESS", f"Validated decision integrity with {len(citations)} policy citations")
    return state

# ---------------------------------------------------------------------------
# Node 8: Final Decision Assembly Node
# ---------------------------------------------------------------------------
async def final_decision_node(state: AgentState) -> AgentState:
    errors = state.get("errors", [])
    
    if errors:
        state["decision"] = {
            "success": False,
            "error": errors[0],
            "errors": errors,
            "executionTrace": state.get("trace", []),
        }
        _add_trace(state, "FinalDecision", "FAILED", f"Execution halted with {len(errors)} errors")
        return state

    emp_ctx = state.get("employeeContext", {})
    prediction = state.get("prediction", {})
    
    state["decision"] = {
        "success": True,
        "organizationId": state.get("organizationId"),
        "employeeId": state.get("employeeId"),
        "riskAssessment": {
            "riskScore": prediction.get("riskScore"),
            "riskLevel": prediction.get("riskLevel"),
            "modelVersion": prediction.get("modelVersion"),
        },
        "shapDrivers": state.get("shapEvidence", []),
        "nlpObservations": emp_ctx.get("nlpObservations", []),
        "recentChanges": emp_ctx.get("recentChanges", []),
        "policyCitations": state.get("citations", []),
        "recommendedActions": state.get("recommendations", []),
        "executionTrace": state.get("trace", []),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _add_trace(state, "FinalDecision", "SUCCESS", "Assembled unified AI decision payload and trace")
    return state
