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

import numpy as np
import shap
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier

# ---------------------------------------------------------------------------
# Human-readable display names for every feature column
# Order must match FEATURE_COLS in pipeline.py:
# ['salary','age','tenure_months','salary_per_tenure','age_at_joining',
#  'gender','employmentType','workLocation','designation','departmentId']
# ---------------------------------------------------------------------------
FEATURE_DISPLAY_NAMES = [
    "Monthly Salary",
    "Employee Age",
    "Tenure (Months)",
    "Salary per Tenure Month",
    "Age at Joining",
    "Gender",
    "Employment Type",
    "Work Location",
    "Designation / Role",
    "Department",
]

FEATURE_KEYS = [
    "salary",
    "age",
    "tenure_months",
    "salary_per_tenure",
    "age_at_joining",
    "gender",
    "employmentType",
    "workLocation",
    "designation",
    "departmentId",
]


class ShapExplainerCache:
    """
    Singleton that holds the fitted SHAP explainer and background dataset.

    Attributes
    ----------
    explainer        : fitted shap.TreeExplainer or shap.LinearExplainer
    background_data  : np.ndarray used to fit the explainer (None for XGBoost)
    feature_names    : list of raw feature keys (10 items)
    display_names    : list of HR-friendly display names (10 items)
    model_name       : algorithm name from the bundle
    is_xgboost       : bool — True when using XGBoost path
    is_ready         : bool — True once initialised successfully
    """

    def __init__(self):
        self.explainer = None
        self.background_data = None
        self.feature_names = FEATURE_KEYS
        self.display_names = FEATURE_DISPLAY_NAMES
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
            'model', 'model_name', 'scaler', 'encoders'.
        """
        from app.preprocessing.pipeline import generate_synthetic_data, fit_transform_pipeline
        import xgboost as xgb

        model = model_bundle["model"]
        self.model_name = model_bundle.get("model_name", "Unknown")
        self.is_xgboost = isinstance(model, xgb.XGBClassifier)

        # Build background data for non-XGBoost models
        print("SHAP: Generating background dataset …")
        bg_df = generate_synthetic_data(150)
        X_bg, _, _, _, _ = fit_transform_pipeline(bg_df)
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
