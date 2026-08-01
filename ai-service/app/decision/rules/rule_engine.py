"""
app/decision/rules/rule_engine.py
==================================
Deterministic Business Rules engine for the AI Decision Intelligence Engine.

Why this exists
----------------
The reused agent orchestrator (app/agent/orchestrator/agent_orchestrator.py)
already produces free-text recommendations from an LLM — useful for
reasoning/description text, but not a fixed, auditable taxonomy: the LLM
picks whatever category name it wants. This module is the deterministic,
code-based counterpart the sprint calls "Business Rules" — it evaluates
plain Python conditions over the SAME evidence bundle the orchestrator
already assembles (no LLM call, no tool-selection loop, so this is not an
autonomous agent) and returns one canonical `recommendationType` from the
fixed taxonomy below, plus which rule(s) fired (for the "Reasoning"/
"Supporting Evidence" fields).

Why almost everyone used to get NO_ACTION_REQUIRED
----------------------------------------------------
Two independent bugs upstream of this file meant sentiment/burnout/topics
were always neutral/empty regardless of the employee's real data (fixed in
app/nlp/repository.py + app/agent/tools/nlp_tool.py +
app/preprocessing/enrichment.py), and any LLM failure aborted the whole
decision before this module ever ran (fixed in agent_orchestrator.py). But
even with real data flowing in, this module ITSELF had no rule that fired
for "elevated risk with no other specific corroborating signal" — every
rule below the top of the list demands a specific co-occurring condition
(a topic, a frustration score, a tenure band), so a HIGH or MEDIUM risk
employee who didn't happen to match one of those narrow combinations fell
straight through to the default. Real enterprise HR platforms don't leave
an at-risk employee with no action just because no single narrow driver was
identified — they escalate on risk tier alone. The `high_risk_retention_
meeting` and `medium_risk_monitor_weekly` catch-alls below close that gap.

Extensibility
-------------
Each rule is one independent `Rule` entry in RULES. Adding a new
recommendation type or condition means appending one entry — no existing
rule's code is read, modified, or reordered to add a new one (rules are
evaluated independently, in order; the first match wins).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List

# ---------------------------------------------------------------------------
# Fixed recommendation taxonomy — the only categories a Decision may carry.
# The five new tiered categories (IMMEDIATE_INTERVENTION, RETENTION_MEETING,
# PERFORMANCE_IMPROVEMENT_PLAN, MONITOR_WEEKLY, CAREER_DISCUSSION) sit
# alongside the existing specific-driver categories, which still fire first
# when their narrower conditions are met — the tiered ones only take over
# when nothing more specific applies, acting as the risk-tier-appropriate
# floor rather than replacing the richer rules.
# ---------------------------------------------------------------------------

RECOMMENDATION_TYPES = [
    "IMMEDIATE_INTERVENTION",
    "RETENTION_MEETING",
    "PERFORMANCE_IMPROVEMENT_PLAN",
    "MONITOR_WEEKLY",
    "CAREER_DISCUSSION",
    "RETENTION_PLAN",
    "PROMOTION_REVIEW",
    "COMPENSATION_REVIEW",
    "TRAINING_RECOMMENDATION",
    "MENTORSHIP_ASSIGNMENT",
    "MANAGER_INTERVENTION",
    "CAREER_DEVELOPMENT",
    "RECOGNITION_PROGRAM",
    "WORKLOAD_ADJUSTMENT",
    "WELLBEING_SUPPORT",
    "ROLE_CHANGE_SUGGESTION",
    "NO_ACTION_REQUIRED",
]

_PRIORITY_RANK = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}


@dataclass
class Rule:
    name: str
    recommendation_type: str
    priority: str  # HIGH | MEDIUM | LOW
    condition: Callable[[Dict[str, Any]], bool]
    reasoning: str  # human-readable explanation template, shown when this rule fires


def _risk_tier(e: Dict[str, Any]) -> str:
    """VERY_HIGH | HIGH | MEDIUM | LOW — see decision_service._build_rule_evidence
    for how mlRiskTier is derived from the model's own riskScore/threshold."""
    return e.get("mlRiskTier") or e.get("mlRiskLevel") or "LOW"


def _is_very_high_risk(e: Dict[str, Any]) -> bool:
    return _risk_tier(e) == "VERY_HIGH"


def _is_high_or_above(e: Dict[str, Any]) -> bool:
    return _risk_tier(e) in ("HIGH", "VERY_HIGH")


def _is_medium_or_high_risk(e: Dict[str, Any]) -> bool:
    return _risk_tier(e) in ("MEDIUM", "HIGH", "VERY_HIGH")


def _is_high_risk(e: Dict[str, Any]) -> bool:
    # Kept for the existing rules below that were written against the plain
    # ML riskLevel (HIGH/MEDIUM/LOW) rather than the new 4-tier split.
    return e.get("mlRiskLevel") == "HIGH"


def _negative_sentiment(e: Dict[str, Any]) -> bool:
    return e.get("sentiment") == "Negative"


def _has_topic(e: Dict[str, Any], *topics: str) -> bool:
    detected = set(e.get("detectedTopics") or [])
    return bool(detected.intersection(topics))


def _low_performance(e: Dict[str, Any]) -> bool:
    rating = e.get("performanceRating")
    return rating is not None and rating < 2.5


# ---------------------------------------------------------------------------
# Burnout thresholds — grounded in the REAL observed burnoutScore
# distribution (queried directly from the employeeintelligences collection),
# not arbitrary round numbers. The original 0.5/0.6/0.7 cutoffs used below
# were all unreachable: this workforce's real burnoutScore distribution is
# p50=0.27, p75=0.30, p90=0.35, p95=0.38, p99=max=0.46 — nobody has ever
# scored above 0.46, so any rule gated on >=0.5 or higher could never fire,
# no matter how genuinely burnt out an employee was relative to their peers.
# ELEVATED sits at the real 75th percentile; CRITICAL sits just under the
# real ceiling (~p99), so it stays meaningfully selective while remaining
# reachable by this population's most burnt-out real employees.
# ---------------------------------------------------------------------------
ELEVATED_BURNOUT = 0.30
CRITICAL_BURNOUT = 0.40


# ---------------------------------------------------------------------------
# Rules — ordered most-specific first. The first rule whose condition is
# true wins (deterministic, auditable — no ambiguity about which rule fired).
# ---------------------------------------------------------------------------

RULES: List[Rule] = [
    Rule(
        name="immediate_intervention",
        recommendation_type="IMMEDIATE_INTERVENTION",
        priority="HIGH",
        condition=lambda e: (
            _is_very_high_risk(e)
            and _negative_sentiment(e)
            and e.get("burnoutRisk", 0) >= CRITICAL_BURNOUT
        ),
        reasoning="Very high attrition risk combined with negative sentiment and high burnout is a crisis-level combination — it requires immediate manager intervention rather than a routine retention conversation.",
    ),
    Rule(
        name="high_risk_burnout_promotion_overdue",
        recommendation_type="PROMOTION_REVIEW",
        priority="HIGH",
        condition=lambda e: (
            _is_high_risk(e)
            and e.get("burnoutRisk", 0) >= ELEVATED_BURNOUT
            and e.get("promotionOverdue", False)
        ),
        reasoning="High attrition risk combined with high burnout and an overdue promotion cycle strongly indicates the employee is being held back from career progression.",
    ),
    Rule(
        name="high_risk_compensation_complaints",
        recommendation_type="COMPENSATION_REVIEW",
        priority="HIGH",
        condition=lambda e: (
            _is_high_risk(e)
            and _negative_sentiment(e)
            and (e.get("promotionFrustration", 0) >= 0.4 or _has_topic(e, "Compensation"))
        ),
        reasoning="High attrition risk with negative sentiment and compensation-related feedback/topics indicates pay dissatisfaction is a likely driver.",
    ),
    Rule(
        name="high_risk_manager_conflict",
        recommendation_type="MANAGER_INTERVENTION",
        priority="HIGH",
        condition=lambda e: (
            _is_medium_or_high_risk(e)
            and (e.get("managerConflict", 0) >= 0.4 or _has_topic(e, "Manager"))
        ),
        reasoning="Elevated attrition risk alongside manager-conflict signals from employee feedback indicates the manager relationship needs HR intervention.",
    ),
    Rule(
        name="high_burnout_workload",
        recommendation_type="WORKLOAD_ADJUSTMENT",
        priority="HIGH",
        condition=lambda e: (
            _is_medium_or_high_risk(e)
            and e.get("burnoutRisk", 0) >= ELEVATED_BURNOUT
            and (_has_topic(e, "Workload") or e.get("engagementRisk", 0) >= 0.5)
        ),
        reasoning="High burnout combined with workload-related feedback indicates the employee's current workload is unsustainable.",
    ),
    Rule(
        name="critical_burnout",
        recommendation_type="WELLBEING_SUPPORT",
        priority="HIGH",
        condition=lambda e: e.get("burnoutRisk", 0) >= CRITICAL_BURNOUT,
        reasoning="Burnout risk is at a critical level regardless of other factors — well-being support is the immediate priority.",
    ),
    Rule(
        name="role_mismatch_long_tenure",
        recommendation_type="ROLE_CHANGE_SUGGESTION",
        priority="MEDIUM",
        condition=lambda e: (
            _is_medium_or_high_risk(e)
            and _negative_sentiment(e)
            and _has_topic(e, "Culture", "Manager")
            and e.get("tenureMonths", 0) >= 24
            and not e.get("promotionOverdue", False)
        ),
        reasoning="Long tenure with persistent negative sentiment around culture/management, without an overdue promotion driving it, suggests a role or team mismatch rather than a compensation/growth issue.",
    ),
    Rule(
        name="new_hire_mentorship",
        recommendation_type="MENTORSHIP_ASSIGNMENT",
        priority="MEDIUM",
        condition=lambda e: (
            _is_medium_or_high_risk(e)
            and e.get("tenureMonths", 999) < 6
            and _has_topic(e, "Team", "Culture")
        ),
        reasoning="Elevated risk within the first 6 months alongside team/culture-related feedback suggests onboarding support via mentorship would help.",
    ),
    Rule(
        name="performance_improvement_plan",
        recommendation_type="PERFORMANCE_IMPROVEMENT_PLAN",
        priority="HIGH",
        condition=lambda e: _is_high_or_above(e) and _low_performance(e),
        reasoning="High attrition risk combined with a below-average performance rating indicates a formal Performance Improvement Plan is warranted alongside retention efforts.",
    ),
    Rule(
        name="career_growth_signal",
        recommendation_type="CAREER_DEVELOPMENT",
        priority="MEDIUM",
        condition=lambda e: (
            _is_medium_or_high_risk(e)
            and 0.15 <= e.get("promotionFrustration", 0) < 0.4
        ),
        reasoning="Moderate career-growth frustration signals (below the threshold for a full promotion review) suggest a structured career-development conversation.",
    ),
    Rule(
        name="training_gap",
        recommendation_type="TRAINING_RECOMMENDATION",
        priority="MEDIUM",
        condition=lambda e: (
            e.get("engagementRisk", 0) >= 0.3
            and _has_topic(e, "Learning", "Training")
        ),
        reasoning="Engagement risk combined with learning/training-related feedback indicates a skills or development gap worth addressing.",
    ),
    Rule(
        name="general_retention_plan",
        recommendation_type="RETENTION_PLAN",
        priority="MEDIUM",
        condition=lambda e: _is_medium_or_high_risk(e) and (_negative_sentiment(e) or e.get("resignationIntent", 0) >= 0.4),
        reasoning="Elevated attrition risk with negative sentiment or resignation-intent signals warrants a general retention plan even without one dominant specific driver.",
    ),
    Rule(
        name="career_discussion_declining_engagement",
        recommendation_type="CAREER_DISCUSSION",
        priority="MEDIUM",
        condition=lambda e: _risk_tier(e) == "MEDIUM" and e.get("engagementDeclining", False),
        reasoning="Medium attrition risk combined with a real drop in engagement score between the two most recent surveys suggests a career discussion would help re-engage the employee before risk escalates further.",
    ),
    Rule(
        name="high_risk_retention_meeting",
        recommendation_type="RETENTION_MEETING",
        priority="HIGH",
        condition=_is_high_or_above,
        reasoning="Elevated (high or very high) attrition risk on its own — even without one specific dominant driver identified above — warrants a retention meeting with the employee.",
    ),
    Rule(
        name="medium_risk_monitor_weekly",
        recommendation_type="MONITOR_WEEKLY",
        priority="MEDIUM",
        condition=lambda e: _risk_tier(e) == "MEDIUM",
        reasoning="Medium attrition risk warrants weekly monitoring even without a more specific driver identified above.",
    ),
    Rule(
        name="recognition_opportunity",
        recommendation_type="RECOGNITION_PROGRAM",
        priority="LOW",
        condition=lambda e: (
            _risk_tier(e) == "LOW"
            and e.get("sentiment") == "Positive"
            and any("performance" in f.lower() or "rating" in f.lower() for f in e.get("topProtectiveFeatures", []))
        ),
        reasoning="Low attrition risk, positive sentiment, and strong performance as a protective factor make this employee a good candidate for formal recognition.",
    ),
]

_DEFAULT_RULE = Rule(
    name="default_no_action",
    recommendation_type="NO_ACTION_REQUIRED",
    priority="LOW",
    condition=lambda e: True,
    reasoning="Low attrition risk with no elevated sentiment, burnout, or engagement signals — no action is needed at this time.",
)


def evaluate(evidence: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates all rules against the evidence bundle and returns the
    first (most specific) match, or the default "No Action Required" rule
    if nothing matches.

    Returns
    -------
    dict with keys: recommendationType, priority, ruleName, ruleReasoning
    """
    for rule in RULES:
        try:
            if rule.condition(evidence):
                return {
                    "recommendationType": rule.recommendation_type,
                    "priority": rule.priority,
                    "ruleName": rule.name,
                    "ruleReasoning": rule.reasoning,
                }
        except Exception:
            # A malformed/missing evidence field in one rule must not stop
            # evaluation of the rest — fail closed to "doesn't match", not
            # a crash of the whole decision pipeline.
            continue

    return {
        "recommendationType": _DEFAULT_RULE.recommendation_type,
        "priority": _DEFAULT_RULE.priority,
        "ruleName": _DEFAULT_RULE.name,
        "ruleReasoning": _DEFAULT_RULE.reasoning,
    }


def highest_priority(a: str, b: str) -> str:
    """Returns whichever of two HIGH/MEDIUM/LOW priority strings ranks higher."""
    return a if _PRIORITY_RANK.get(a, 0) >= _PRIORITY_RANK.get(b, 0) else b
