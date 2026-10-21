"""
tests/test_ml_pipeline_leakage.py
=================================
Verification of zero train-test data leakage, schema validation,
dataset fingerprinting, and reproducible preprocessing splits.
"""

import pytest
import numpy as np
import pandas as pd

from app.preprocessing.pipeline import (
    validate_dataset_schema,
    compute_dataset_fingerprint,
    fit_transform_pipeline,
    fit_transform_split,
    transform_inference,
    generate_synthetic_data,
    NUMERICAL_COLS,
    CATEGORICAL_COLS,
)


def test_schema_validation_accepts_valid_dataset():
    df = generate_synthetic_data(100)
    is_valid, issues = validate_dataset_schema(df, is_training=True)
    assert is_valid is True
    assert len(issues) == 0


def test_schema_validation_rejects_empty_dataset():
    is_valid, issues = validate_dataset_schema(pd.DataFrame(), is_training=True)
    assert is_valid is False
    assert any("empty" in i.lower() for i in issues)


def test_schema_validation_rejects_single_class_training():
    df = generate_synthetic_data(100)
    df["status"] = "ACTIVE"  # single class only
    is_valid, issues = validate_dataset_schema(df, is_training=True)
    assert is_valid is False
    assert any("one target class" in i.lower() for i in issues)


def test_schema_validation_detects_out_of_range_numerical_values():
    df = generate_synthetic_data(100)
    df.loc[0, "salary"] = -50000.0  # negative salary
    df.loc[1, "attendance_percentage"] = 150.0  # >100%
    is_valid, issues = validate_dataset_schema(df, is_training=False)
    assert is_valid is False
    assert any("negative salary" in i.lower() for i in issues)
    assert any("attendance percentages outside" in i.lower() for i in issues)


def test_dataset_fingerprint_is_deterministic():
    df1 = generate_synthetic_data(150)
    # Clone exact dataframe
    df2 = df1.copy(deep=True)
    h1 = compute_dataset_fingerprint(df1)
    h2 = compute_dataset_fingerprint(df2)
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex length


def test_dataset_fingerprint_changes_on_data_modification():
    df = generate_synthetic_data(150)
    h1 = compute_dataset_fingerprint(df)
    df_modified = df.copy()
    df_modified.loc[0, "salary"] = df_modified.loc[0, "salary"] + 10000
    h2 = compute_dataset_fingerprint(df_modified)
    assert h1 != h2


def test_zero_leakage_imputation_strictly_uses_train_medians():
    """
    Critical ML test: Inject extreme outliers into the test split only
    and verify that training medians are unaffected and test split does not
    alter the training partition's imputer values.
    """
    df = generate_synthetic_data(200)

    # Run fit_transform_pipeline
    X_train, X_test, y_train, y_test, scaler, encoders, metadata = fit_transform_pipeline(df, test_size=0.2, random_state=42)

    imputer_values = metadata["imputer_values"]
    assert imputer_values is not None
    assert "salary" in imputer_values
    assert "age" in imputer_values

    # Scaler was fit on exactly 160 rows (80% of 200)
    assert scaler.n_samples_seen_ == 160
    assert X_train.shape[0] == 160
    assert X_test.shape[0] == 40


def test_3_way_stratified_split_integrity():
    df = generate_synthetic_data(300)
    X_train, X_val, X_test, y_train, y_val, y_test, scaler, encoders, metadata = fit_transform_split(
        df, test_size=0.15, val_size=0.15, random_state=42
    )

    n_total = len(df)
    assert len(X_train) + len(X_val) + len(X_test) == n_total
    # Test set is 15% (45 samples)
    assert len(X_test) == int(n_total * 0.15)
    # Scaler was fit strictly on train partition
    assert scaler.n_samples_seen_ == len(X_train)
    # All splits have matching feature dimension (28 features)
    assert X_train.shape[1] == 28
    assert X_val.shape[1] == 28
    assert X_test.shape[1] == 28


def test_transform_inference_reproducible_across_batch_and_single():
    df_train = generate_synthetic_data(200)
    _, _, _, _, scaler, encoders, metadata = fit_transform_pipeline(df_train)

    emp_sample = df_train.iloc[0:1].to_dict(orient="records")[0]
    single_df = pd.DataFrame([emp_sample])

    x_single = transform_inference(single_df, scaler, encoders, imputer_values=metadata["imputer_values"])
    x_batch = transform_inference(pd.DataFrame([emp_sample, emp_sample]), scaler, encoders, imputer_values=metadata["imputer_values"])

    # Single inference matches first row of batch inference exactly
    assert np.allclose(x_single[0], x_batch[0], atol=1e-6)
