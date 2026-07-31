"""
shap_explainer.py
=================
SHAP Explainer Cache — the central engine for the XAI module.

Why this file exists
--------------------
Computing a SHAP explainer is expensive (requires fitting on background data).
This module holds a singleton `ShapExplainerCache` that is initialised once at
startup and reused for every explanation request.

Design decisions
----------------
- XGBoost: TreeExplainer with `feature_perturbation="tree_path_dependent"` and
  NO background data (XGBoost handles the baseline internally).  This is the
  only SHAP-supported mode for XGBoost with categorical-encoded inputs.
  Returns shape (n, features) for binary classification.
- Random Forest: TreeExplainer with `feature_perturbation="interventional"` and
  a 100-row background dataset.  Returns shape (n, features, 2); we take [:,:,1].
- Logistic Regression: LinearExplainer with background data.
  Returns shape (n, features) directly.
"""

import re

import numpy as np
import shap
from sklearn.linear_model import LogisticRegression

# ---------------------------------------------------------------------------
# Human-readable display name overrides.
#
# Feature keys/order are NEVER hardcoded here — see initialise() below, which
# derives them from the trained model bundle's own feature_metadata (the same
# numerical_cols/categorical_cols produced by
# app.preprocessing.pipeline.fit_transform_pipeline() at training time). This
# dict only supplies nicer wording for known keys; any feature not listed
# here still gets a readable name via humanize_feature_name()'s fallback, so
# a pipeline change (new/removed column) can never drift out of sync with
# what the explainer reports — unlike the previous hardcoded 10-item list,
# which silently diverged from the real ~22-column pipeline output.
# ---------------------------------------------------------------------------
_DISPLAY_NAME_OVERRIDES = {
    "age": "Employee Age",
    "salary": "Annual Salary",
    "tenure_months": "Tenure (Months)",
    "years_since_last_promotion": "Years Since Last Promotion",
    "promotion_count": "Promotion Count",
    "promotion_gap_ratio": "Promotion Gap Ratio",
    "salary_growth_pct": "Salary Growth %",
    "training_hours": "Training Hours",
    "training_completion_rate": "Training Completion %",
    "performance_rating": "Performance Rating",
    "overtime_hours": "Overtime Hours",
    "attendance_percentage": "Attendance %",
    "leave_count": "Leave Count",
    "leave_frequency": "Leave Frequency",
    "job_satisfaction": "Job Satisfaction",
    "work_life_balance": "Work-Life Balance",
    "avg_survey_score": "Avg. Survey Score",
    "engagement_score": "Engagement Score",
    "feedback_frequency": "Feedback Frequency",
    "sentiment_score": "Sentiment Score",
    "burnout_score": "Burnout Score",
    "promotion_frustration_nlp": "Promotion Frustration",
    "manager_conflict_nlp": "Manager Conflict Signal",
    "gender": "Gender",
    "employmentType": "Employment Type",
    "workLocation": "Work Location",
    "designation": "Designation / Role",
    "departmentId": "Department",
}


def humanize_feature_name(key: str) -> str:
    """
    Returns a human-readable display name for a raw feature key. Known keys
    use the curated override above; anything else (e.g. a column added to
    the pipeline later) falls back to splitting snake_case/camelCase into
    Title Case words, so the explainer never silently mislabels or drops a
    feature just because this dict wasn't updated.
    """
    if key in _DISPLAY_NAME_OVERRIDES:
        return _DISPLAY_NAME_OVERRIDES[key]
    spaced = re.sub(r'(?<!^)(?=[A-Z])', ' ', key)  # camelCase -> spaced
    spaced = spaced.replace('_', ' ')               # snake_case -> spaced
    return spaced.strip().title()


class ShapExplainerCache:
    """
    Singleton that holds the fitted SHAP explainer and background dataset.

    Attributes
    ----------
    explainer        : fitted shap.TreeExplainer or shap.LinearExplainer
    background_data  : np.ndarray used to fit the explainer (None for XGBoost)
    feature_names    : list of raw feature keys, derived from the trained
                        model bundle's feature_metadata (numerical_cols +
                        categorical_cols, in that order — matching the exact
                        column order fit_transform_pipeline/transform_inference
                        actually build). NOT hardcoded.
    categorical_keys : set of feature_names that are categorical (vs numerical)
    display_names    : list of HR-friendly display names, one per feature_names entry
    model_name       : algorithm name from the bundle
    is_xgboost       : bool — True when using XGBoost path
    is_ready         : bool — True once initialised successfully
    """

    def __init__(self):
        self.explainer = None
        self.background_data = None
        self.feature_names = []
        self.categorical_keys = set()
        self.display_names = []
        self.model_name = None
        self.is_xgboost = False
        self.is_ready = False

    def initialise(self, model_bundle: dict):
        """
        Fit the appropriate SHAP explainer given the trained model bundle.

        Parameters
        ----------
        model_bundle : dict
            The Joblib bundle produced by trainer.py. Must contain keys:
            'model', 'model_name', 'scaler', 'encoders', 'feature_metadata'.
        """
        from app.preprocessing.pipeline import generate_synthetic_data, fit_transform_pipeline
        import xgboost as xgb

        # SHAP explains the tuned base estimator (importance_estimator — the
        # same algorithm/hyperparameters/training data as the shipped model,
        # just without the Phase 6 CalibratedClassifierCV wrapper), not the
        # calibrated model itself: TreeExplainer/LinearExplainer need direct
        # access to a tree/linear model's internals, which a calibration
        # wrapper doesn't expose. Calibration (isotonic) is monotonic, so
        # which features drove the decision is unaffected — only the
        # final probability display (computed separately from bundle["model"]
        # in local_explainer.py) differs. Falls back to bundle["model"] for
        # any older bundle saved before this key existed.
        model = model_bundle.get("importance_estimator") or model_bundle["model"]
        self.model_name = model_bundle.get("model_name", "Unknown")
        self.is_xgboost = isinstance(model, xgb.XGBClassifier)

        # Derive feature names/order from the ACTUAL trained pipeline's
        # metadata rather than a hardcoded list. X_processed is always built
        # as hstack([X_numerical, X_categorical]) — see
        # app.preprocessing.pipeline.fit_transform_pipeline/transform_inference
        # — so numerical_cols + categorical_cols (in that order) is the real,
        # authoritative column order for every SHAP value this cache computes.
        feature_metadata = model_bundle.get("feature_metadata") or {}
        numerical_cols = list(feature_metadata.get("numerical_cols") or [])
        categorical_cols = list(feature_metadata.get("categorical_cols") or [])
        if not numerical_cols and not categorical_cols:
            raise RuntimeError(
                "Model bundle has no feature_metadata (numerical_cols/categorical_cols). "
                "Retrain the model — SHAP cannot derive feature names from an old bundle."
            )
        self.feature_names = numerical_cols + categorical_cols
        self.categorical_keys = set(categorical_cols)
        self.display_names = [humanize_feature_name(k) for k in self.feature_names]

        # Build background data for non-XGBoost models
        print("SHAP: Generating background dataset …")
        bg_df = generate_synthetic_data(150)
        X_bg, _, _, _, _, _, _ = fit_transform_pipeline(bg_df)
        rng = np.random.default_rng(42)
        idx = rng.choice(len(X_bg), size=min(100, len(X_bg)), replace=False)
        self.background_data = X_bg[idx]

        print(f"SHAP: Fitting {self.model_name} explainer …")

        if isinstance(model, LogisticRegression):
            # LinearExplainer works well with background data
            self.explainer = shap.LinearExplainer(
                model,
                self.background_data,
                feature_perturbation="interventional",
            )

        elif self.is_xgboost:
            # XGBoost + interventional + background = NotImplementedError for
            # categorical splits. Use tree_path_dependent (no background needed).
            self.explainer = shap.TreeExplainer(
                model,
                feature_perturbation="tree_path_dependent",
            )

        else:
            # RandomForest and other sklearn tree ensembles
            self.explainer = shap.TreeExplainer(
                model,
                data=self.background_data,
                feature_perturbation="interventional",
            )

        self.is_ready = True
        print(f"SHAP: Explainer ready ({type(self.explainer).__name__}).")

    def compute_shap_values(self, X: np.ndarray) -> np.ndarray:
        """
        Return SHAP values for the given feature matrix X.

        Always returns shape (n_samples, n_features) for the positive class
        (attrition=1), regardless of model type.

        SHAP output formats handled:
        - XGBoost/tree_path_dependent  → (n, features)        already positive class
        - RandomForest/interventional  → (n, features, 2)     take [:, :, 1]
        - LinearExplainer              → (n, features)        direct
        """
        if not self.is_ready:
            raise RuntimeError("SHAP explainer has not been initialised.")

        # TreeExplainer (LightGBM/RandomForest/XGBoost) runs an additivity
        # sanity check by default — sum(shap_values) should equal model
        # output minus the base value. Reproduced directly against this
        # service: "Additivity check failed in TreeExplainer! ... sum of the
        # SHAP values was -3.432395, while the model output was -3.249611."
        # This is a documented, occasionally-hit floating-point tolerance
        # issue with boosted-tree models (SHAP's own error message names
        # check_additivity=False as the accepted mitigation) — it crashed the
        # ENTIRE batch explain request (500) rather than degrading one
        # sample, for a difference too small to matter for feature-attribution
        # display purposes. LinearExplainer has no such check/kwarg, so this
        # only applies to TreeExplainer.
        if isinstance(self.explainer, shap.TreeExplainer):
            raw = self.explainer.shap_values(X, check_additivity=False)
        else:
            raw = self.explainer.shap_values(X)

        if isinstance(raw, list):
            # Older SHAP: list[0]=class-0, list[1]=class-1
            return np.array(raw[1]) if len(raw) > 1 else np.array(raw[0])

        if isinstance(raw, np.ndarray):
            if raw.ndim == 3:
                # Shape (n, features, 2) — take positive class
                return raw[:, :, 1]
            # Shape (n, features) — already correct
            return raw

        return np.array(raw)

    def get_expected_value(self) -> float:
        """Return the base (expected) value for the positive class."""
        ev = self.explainer.expected_value
        if isinstance(ev, (list, np.ndarray)):
            ev_arr = np.asarray(ev).flatten()
            return float(ev_arr[1]) if len(ev_arr) > 1 else float(ev_arr[0])
        return float(ev)


# Global singleton — imported by all other explainability modules
shap_cache = ShapExplainerCache()
