# RetentionAI — Final ML Verification & Gap-Closure Audit

**Date:** October 19, 2026  
**Auditor:** Senior ML Engineer, MLOps Engineer & Statistical Experimentation Specialist  
**Target System:** RetentionAI — AI-Powered Employee Retention Analytics SaaS  
**Baseline Test Verification:** **146 / 146 passed** in 185.96s (`pytest -q` on `ai-service/tests/`)  
**Upgraded Test Suite:** **164 / 164 passed** (100% pass rate) with zero failures  
**Frontend Production Build:** Vite v6.4.3 transformed 2,563 modules, compiled `dist/` in 22.24s with zero errors.

---

## 1. Requirement-by-Requirement Status Matrix

| ID | Area / Requirement | Status | Evidence / Implementation Source | Resolution / Verified Fix |
|---|---|---|---|---|
| **REQ-1** | **Strict Final Test-Set Isolation** | **Implemented & Verified** | `app/preprocessing/pipeline.py` & `app/training/trainer.py` | Implemented strict 3-way split (Train 70%, Val 15%, Holdout Test 15%). Model benchmarking, hyperparameter search, calibration, and threshold sweep run exclusively on Train and Val. Final holdout test evaluated exactly once with zero leakage. Verified by `tests/test_test_set_isolation.py`. |
| **REQ-2** | **Evaluation & Training Reproducibility** | **Implemented & Verified** | `train_model.py`, `app/training/reports.py` | Added CLI argument parser (`--seed`, `--samples`, `--val-size`, `--test-size`). Model training produces deterministic dataset SHA-256 fingerprint (`707fd767...`), dual `model_report.json` and `model_report.md` reports, and logged experiment run in `models/experiments/runs.json`. |
| **REQ-3** | **Experiment Tracking & MLflow Assessment** | **Implemented & Verified** | `app/registry/experiment_tracker.py` | Architected `LocalExperimentTracker` with zero external binary/cloud dependencies. Persists run parameters, validation vs holdout metrics, dataset fingerprint, and model SHA-256 integrity checksum. Supports run comparison and champion identification. Zero-failure MLflow sync adapter included. Verified by `tests/test_experiment_tracker.py`. |
| **REQ-4** | **Inference Observability & Privacy** | **Implemented & Verified** | `app/prediction/inference_logger.py`, `app/prediction/prediction_service.py` | Added `InferenceTelemetryLogger` measuring preprocessing and inference latency in milliseconds. Computes P50, P90, P95 latency percentiles, error rates, and score distributions. Strictly enforces PII exclusion (no names, emails, raw salaries, or tokens) and hashes employee IDs via salted SHA-256. Verified by `tests/test_inference_observability.py`. |
| **REQ-5** | **Drift Monitoring & False-Alert Behavior** | **Implemented & Verified** | `app/monitoring/drift_detector.py`, `tests/test_drift_rigor.py` | Multi-dimensional drift detection tested for false alarms and sensitivity. Verified: identical distributions produce $PSI < 0.05$ and $p > 0.05$ (zero false alerts); +1.5 std shifted distributions reliably trigger `SEVERE_DRIFT` ($PSI \ge 0.25$); categorical frequency shifts, prediction score drift, and delayed ground truth performance verified. |
| **REQ-6** | **Statistical Validity in A/B Testing** | **Implemented & Verified** | `app/experimentation/` | Verified statistical power calculation, two-proportion z-test, Fisher's exact test fallback, Wilson score 95% confidence intervals, and demographic parity checks across subgroups. |
| **REQ-7** | **End-to-End Tests & Backward Compatibility** | **Implemented & Verified** | `ai-service/tests/`, `client/` | 164 total tests passing in `ai-service/tests/`. Maintained backward compatibility for 2-way splits (`fit_transform_pipeline`) and legacy calls to `train_and_select_best_model`. Frontend production build compiles cleanly without errors. |

---

## 2. Verified Benchmark and Holdout Test Results (Source of Truth)

The 3-way split training pipeline was executed with seed `42`, 5,000 synthetic employee samples, 15% validation partition (750 records), and 15% holdout test partition (750 records).

### Holdout Evaluation vs Baseline (Zero Leakage)

| Metric | Champion Model (LogisticRegression) | Dummy Baseline (Most Frequent) | Absolute Lift |
|---|---|---|---|
| **PR-AUC** | **0.6847** | 0.1960 | **+0.4887** |
| **Recall (Attrition Catch Rate)** | **89.12%** | 0.00% | **+89.12%** |
| **ROC-AUC** | **0.8895** | 0.5000 | **+0.3895** |
| **F2-Score** | **0.7384** | 0.0000 | **+0.7384** |
| **F1-Score** | **0.5874** | 0.0000 | **+0.5874** |
| **Accuracy** | **75.47%** | 80.40% | -4.93% (Expected for high recall) |
| **Brier Score (Calibration)** | **0.0980** | 0.1960 | **-0.0980** (lower is better) |

### Holdout Confusion Matrix
$$\begin{pmatrix} TN = 435 & FP = 168 \\ FN = 16 & TP = 131 \end{pmatrix}$$
- **False Negative Rate:** only $16 / 147 = 10.88\%$ of true attrition cases were missed.
- **True Positives Caught:** 131 out of 147 at-risk employees successfully flagged for HR retention intervention.

### 5-Model Benchmark Comparison on Validation Partition (Development Data Only)

| Model Family | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC (CV Mean ± SE) | Train Time |
|---|---|---|---|---|---|---|---|
| **LogisticRegression** | **0.803** | 0.498 | **0.823** | **0.621** | **0.893** | **0.679 ± 0.024** | 0.02s |
| **CatBoost** | 0.829 | 0.553 | 0.673 | 0.607 | 0.874 | 0.658 ± 0.019 | 5.44s |
| **LightGBM** | 0.827 | 0.552 | 0.619 | 0.583 | 0.869 | 0.639 ± 0.015 | 0.33s |
| **RandomForest** | 0.848 | 0.762 | 0.327 | 0.457 | 0.868 | 0.638 ± 0.021 | 2.97s |
| **XGBoost** | 0.835 | 0.583 | 0.551 | 0.566 | 0.854 | 0.624 ± 0.013 | 0.50s |

**Selection Rationale:** LogisticRegression achieved the highest cross-validated PR-AUC ($0.6795 \pm 0.0236$), outperforming complex ensemble methods while offering superior calibration and interpretability.

---

## 3. MLflow Assessment & Architecture Decision Record (ADR)

### Context
Evaluating whether MLflow should be integrated into RetentionAI.

### Decision
**Implement a lightweight, durable local experiment tracker (`LocalExperimentTracker`) and provide an optional zero-failure MLflow adapter.**

### Justification
1. **Infrastructure Footprint:** MLflow requires dedicated server instances, tracking databases (Postgres/MySQL), artifact stores (S3/GCS), and native binary wheels. For RetentionAI, which already deploys with MongoDB Atlas and local disk packaging, introducing a mandatory MLflow server increases deployment cost and maintenance complexity without functional benefit.
2. **Feature Parity:** The built-in `LocalExperimentTracker` (`ai-service/app/registry/experiment_tracker.py`):
   - Logs experiment runs with hyperparameters, validation metrics, holdout test metrics, dataset fingerprint, and SHA-256 artifact checksum.
   - Provides run comparison (`compare_runs`) computing metric deltas.
   - Identifies champion runs (`get_champion_run`).
   - Generates dual JSON (`model_report.json`) and Markdown (`model_report.md`) reports.
3. **Extensibility:** If an organization mandates MLflow in enterprise environments, the tracker automatically mirrors runs to `MLFLOW_TRACKING_URI` via `_sync_mlflow_if_available` if `mlflow` is installed, silently falling back to local storage if absent.

---

## 4. Reproducibility Guide

To reproduce model training, evaluation, and report generation from scratch:

```powershell
# 1. Activate virtual environment
cd "c:\Users\Tanya Verma\OneDrive\Desktop\RetentionAI\ai-service"

# 2. Run deterministic training with strict 3-way split
python train_model.py --seed 42 --samples 5000 --val-size 0.15 --test-size 0.15

# 3. Verify generated artifacts
Get-Item ../models/active/attrition_model.joblib
Get-Content ../models/active/manifest.json
Get-Content ../models/active/plots/training/model_report.md
Get-Content ../models/experiments/runs.json

# 4. Run automated test suite
pytest -q
```

---

## 5. Verification Sign-Off

- **Strict Test-Set Isolation:** Verified with zero leakage; holdout test perturbed without affecting training or validation metrics.
- **Evaluation Reproducibility:** Verified with SHA-256 dataset fingerprint and fixed seed CLI entry point.
- **Experiment Tracking:** Verified with local run lineage and comparison tools.
- **Inference Observability:** Verified with request correlation, latency measurement, and strict PII exclusion.
- **Drift Monitoring:** Verified with false-alert and sensitivity tests.
- **Overall Quality:** 164 passing tests across the entire ML and platform surface.
