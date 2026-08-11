import logging
from langgraph.graph import StateGraph, END
from app.agent.agent_state import AgentState
from app.agent.nodes import (
    context_validation_node,
    ml_risk_agent_node,
    explainability_agent_node,
    employee_context_agent_node,
    rag_policy_agent_node,
    retention_strategy_agent_node,
    decision_validation_node,
    final_decision_node,
)

logger = logging.getLogger(__name__)

def build_retention_graph():
    """
    Compiles the 8-node LangGraph retention decision workflow.
    Entry point: context_validation_node (enforces organizationId & employee validation).
    """
    workflow = StateGraph(AgentState)

    # Add Nodes
    workflow.add_node("context_validation", context_validation_node)
    workflow.add_node("ml_risk", ml_risk_agent_node)
    workflow.add_node("explainability", explainability_agent_node)
    workflow.add_node("employee_context", employee_context_agent_node)
    workflow.add_node("rag_policy", rag_policy_agent_node)
    workflow.add_node("retention_strategy", retention_strategy_agent_node)
    workflow.add_node("decision_validation", decision_validation_node)
    workflow.add_node("final_decision", final_decision_node)

    # Set Entry Point
    workflow.set_entry_point("context_validation")

    # Define Linear Graph Pipeline Edges
    workflow.add_edge("context_validation", "ml_risk")
    workflow.add_edge("ml_risk", "explainability")
    workflow.add_edge("explainability", "employee_context")
    workflow.add_edge("employee_context", "rag_policy")
    workflow.add_edge("rag_policy", "retention_strategy")
    workflow.add_edge("retention_strategy", "decision_validation")
    workflow.add_edge("decision_validation", "final_decision")
    workflow.add_edge("final_decision", END)

    app = workflow.compile()
    return app

# Singleton compiled graph instance
retention_graph_app = build_retention_graph()
