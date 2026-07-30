# ML Model Evaluation Report — Sprint 8 (Production Readiness)

This report documents the Sprint 8 ML subsystem overhaul: root-cause audit,
dataset rebuild, feature engineering, 5-model benchmark, hyperparameter
tuning, probability calibration, and threshold optimization. Raw numbers
live in `models/active/plots/training/model_report.json`; plots referenced
below are in the same directory. Regenerated automatically by
`python train_model.py` (`ai-service/app/training/reports.py`).

## 1. Root cause (Phase 1 audit)

The prior model consistently scored extreme high-risk employee profiles as
`LOW`. Direct measurement (not guesswork) found two independent causes:

1. **Label defect**: `generate_synthetic_data()`'s attrition label was a
   function of only 4 signals (salary, tenure, employment type, work
   location) — every "soft" HR signal (job satisfaction, work-life
   balance, overtime, performance, promotion gap) had a measured
   correlation with the label of **|r| < 0.05** (statistical noise).
2. **Feature defect**: 13 of the 17 numerical features had no data source
   anywhere but the `employees` collection — real per-employee Attendance,
   Performance, PromotionHistory, TrainingHistory, and Survey records were
   never joined into training or inference, so real predictions always
   used defaults for most of the feature vector regardless of model
   quality.

## 2. Dataset (Phase 2)

- **Real data**: `load_data_from_db()` now joins Employee with Attendance,
  Performance, PromotionHistory, TrainingHistory, Survey, EmployeeFeedback,
  and Sprint 5's NLP insights (`nlp_insights` collection) via aggregation
  pipelines, so training and inference draw from the platform's actual HR
  sub-modules instead of only the Employee document.
- **IBM HR Analytics CSV**: `load_ibm_attrition_csv()` remains wired and is
  preferred automatically when `IBM_DATASET_CSV_PATH` points at a real
  file — not available in this environment (no file, no download
  capability), so training falls back to the rebuilt synthetic generator.
- **Synthetic data (fallback, this environment)**: rebuilt from 1,000 to
  5,000 records, with a logistic latent-utility label that is now a
  genuine, noisy (never deterministic) function of every engineered
  feature, calibrated to a ~19.6% base attrition rate (matching the real
  IBM benchmark's ~16%, adjusted for this project's fuller feature set).

## 3. Feature engineering (Phase 3)

**Removed** (no real data source anywhere in the schema — previously
silently defaulted in production, so removed rather than fabricated):
`distance_from_home`, `environment_satisfaction`, `years_in_current_role`.

**Added** (each backed by a real, joinable collection):

| Feature | Source |
|---|---|
| `promotion_gap_ratio` | PromotionHistory ÷ tenure |
| `salary_growth_pct` | PromotionHistory.salaryIncreasePercentage |
| `training_completion_rate` | TrainingHistory.certificationEarned |
| `leave_frequency` | Attendance leave days ÷ tenure |
| `engagement_score` | Survey.engagementScore |
| `sentiment_score` | Sprint 5 NLP insight (`sentimentScore`) |
| `burnout_score` | Sprint 5 NLP insight (`burnoutRisk`) |
| `promotion_frustration_nlp`, `manager_conflict_nlp` | Sprint 5 NLP insight |

Not added (Phase 3 suggested these, but no data source exists anywhere in
the platform — not fabricated): Internal Transfer Count, Manager Change
Count, Performance Trend / Attendance Trend (no historical snapshots are
stored, only latest-value collections).

**Leakage fix**: `StandardScaler`/`LabelEncoder` are now fit on the
training split only, after the train/test split — previously fit on the
full dataset before splitting.

## 4. Model benchmark (Phase 4)

5 algorithms trained on an identical stratified 80/20 split (n=5,000):

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | Train time | Model size |
|---|---|---|---|---|---|---|---|---|
| LogisticRegression | 0.796 | 0.488 | 0.811 | 0.609 | 0.882 | 0.671 | 0.03s | 1.1 KB |
| RandomForest | 0.854 | 0.719 | 0.418 | 0.529 | 0.876 | 0.650 | 0.93s | 14.4 MB |
| XGBoost | 0.833 | 0.573 | 0.582 | 0.577 | 0.862 | 0.600 | 0.29s | 325 KB |
| **LightGBM (selected)** | 0.825 | 0.542 | 0.699 | 0.610 | 0.877 | 0.626 | 0.37s | 346 KB |
| CatBoost | 0.822 | 0.535 | 0.709 | 0.610 | 0.872 | 0.631 | 6.57s | 1.1 MB |

LightGBM selected (highest F1, ROC-AUC tiebreak) — all figures at the
default 0.5 threshold, before Phase 5-7 tuning/calibration/threshold
optimization.

## 5. Hyperparameter tuning (Phase 5)

`RandomizedSearchCV` (25 iterations × 5-fold stratified CV, scored on F1)
over LightGBM's `n_estimators`, `max_depth`, `learning_rate`,
`min_child_weight`, `subsample`, `colsample_bytree`, `reg_alpha`,
`reg_lambda`. Selected:

```json
{
  "subsample": 0.6, "reg_lambda": 1.5, "reg_alpha": 0.1,
  "n_estimators": 200, "min_child_weight": 0.001,
  "max_depth": 6, "learning_rate": 0.03, "colsample_bytree": 0.7
}
```

## 6. Probability calibration (Phase 6)

Isotonic calibration (`CalibratedClassifierCV`, 5-fold) wraps the tuned
LightGBM model. The Decision Engine consumes `riskScore` as a probability
directly, so this is not cosmetic — see `calibration_curve.png` (reliability
diagram: predicted probability vs. observed attrition rate per bin).

## 7. Threshold optimization (Phase 7)

0.5 was never assumed. Thresholds were swept on out-of-fold cross-validated
predictions (train split only — the test split stays a clean, untouched
final hold-out), maximizing F2 (recall weighted 2× precision, matching
"prioritize identifying employees likely to leave while maintaining
reasonable precision") subject to a 0.3 minimum-precision floor.

**Selected threshold: 0.16** (vs. the naive 0.5).

| | @ 0.5 (naive) | @ 0.16 (selected) |
|---|---|---|
| Accuracy | 0.847 | 0.763 |
| Precision | 0.627 | 0.447 |
| **Recall** | **0.541** | **0.883** |
| F1 | 0.581 | 0.593 |

Recall nearly doubles at the selected threshold — directly serving the
"prioritize identifying employees likely to leave" objective — at an
accepted, deliberate precision cost. Production risk-level bucketing
(`prediction_service.py`) now anchors HIGH/MEDIUM/LOW on this threshold
instead of the old, never-evaluated fixed 0.34/0.64 split.

## 8. SHAP compatibility (Phase 8)

- Feature names/order still derive dynamically from the trained bundle's
  `feature_metadata` — no hardcoded list, verified via
  `test_feature_names_derived_from_pipeline_not_hardcoded`.
- **Bug found and fixed**: `shap_explainer.py` tried to wrap
  `bundle["model"]` directly — but that's now always a
  `CalibratedClassifierCV` (Phase 6), which `TreeExplainer`/
  `LinearExplainer` cannot introspect. Fixed to explain the tuned,
  uncalibrated `importance_estimator` instead (isotonic calibration is
  monotonic, so which features drove the decision is unaffected).
- **Bug found and fixed**: `local_explainer.py` had its own hardcoded
  0.34/0.64 risk-bucketing, independent of (and now inconsistent with)
  `prediction_service.py`'s. Both now read the same bundle threshold, so
  `/explain` and `/predict` never disagree on an employee's risk level.
- **Bug found and fixed**: `/explain/{id}`, `/explain/batch`, and
  `/plots/local/{id}` fetched the raw Employee document and explained it
  directly, without the real Attendance/Performance/Survey/NLP enrichment
  `predict_single()` applies — meaning SHAP would have explained a
  different (mostly-default) feature vector than the one actually used for
  the employee's real prediction. All three now call the same
  `enrich_employee_doc()` used by prediction, via a new shared
  `app/preprocessing/enrichment.py` module.

## 9. Persona validation (Phase 9)

Verified directly against the retrained, calibrated model:

| Persona | Expected | Result |
|---|---|---|
| High performer, 4.5 years since last promotion, sentiment 0.08, burnout 0.85, compensation frustration 0.8 | HIGH | **riskScore=0.971 → HIGH** |
| Recently promoted (0.2 years), sentiment 0.92, burnout 0.05, excellent performance | LOW | **riskScore≈0.000 → LOW** |

The first persona is the exact profile type the Phase 1 audit found
scoring LOW under the old model — now correctly flagged HIGH, and the SHAP
explanation correctly attributes it to Avg. Survey Score, Burnout Score,
Promotion Frustration, and Sentiment Score (in that order).

## 10. Production validation (Phase 10)

- `ai-service/tests/test_ml.py` (28 tests) and `test_explainability.py`
  (SHAP/local/global/plots/API routes) updated for the new
  `fit_transform_pipeline`/`train_and_select_best_model` signatures and
  re-run against the live FastAPI app — all passing.
- Full FastAPI app import (`app.main`, 50 routes) succeeds with no errors.
- Decision Engine orchestrator (`orchestrate_recommendation`) re-run
  directly against the new model bundle — ML, SHAP, and LLM reasoning all
  completed correctly with no code changes to rule evaluation or
  recommendation logic.
- **API contracts unchanged**: `riskScore`/`riskLevel`/`confidence`/
  `employeeId` field names and types are identical; Node (`aiService.js`,
  `explainService.js`) and the React client require zero changes —
  confirmed no hardcoded algorithm names or metrics-key assumptions exist
  on either side.
- Not verified in this environment: a live click-through of the Employee
  Profile/Dashboard UI (no running MongoDB with real employee/HR-module
  data in this session) — API-contract equivalence was confirmed
  statically instead; a live UI pass is recommended before sign-off.

## Deliverables

- Retrained model + pipeline: `models/active/attrition_model.joblib`
- Reports/plots: `models/active/plots/training/{model_report.json,
  confusion_matrix.png, roc_curve.png, pr_curve.png, calibration_curve.png,
  feature_importance.png}`
- This document
