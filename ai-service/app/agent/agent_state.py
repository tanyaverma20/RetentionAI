from typing import TypedDict, Optional, List, Dict, Any

class AgentState(TypedDict, total=False):
    """
    Immutable state passed through the LangGraph retention decision graph.
    `organizationId` is the authoritative server-supplied tenant anchor.
    """
    organizationId: str
    employeeId: str
    query: Optional[str]
    
    # Context & Evidence collected by nodes
    employeeContext: Optional[Dict[str, Any]]
    prediction: Optional[Dict[str, Any]]
    riskLevel: Optional[str]
    shapEvidence: Optional[List[Dict[str, Any]]]
    retrievedDocuments: Optional[List[Dict[str, Any]]]
    policyEvidence: Optional[List[Dict[str, Any]]]
    
    # Decisions & Output
    recommendations: Optional[List[Dict[str, Any]]]
    decision: Optional[Dict[str, Any]]
    citations: Optional[List[Dict[str, Any]]]
    
    # Diagnostic & Audit
    errors: List[str]
    trace: List[Dict[str, Any]]
