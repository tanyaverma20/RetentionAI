"""
ai-service/app/registry/experiment_tracker.py
=============================================
Durable local experiment tracking and model lineage registry.
Provides structured run comparison, parameter/metric logging,
artifact lineage, and optional MLflow tracking adapter without
requiring external cloud dependencies or paid services.
"""

import os
import json
import uuid
import datetime
from typing import Dict, Any, List, Optional
from pymongo import MongoClient

_DEFAULT_EXPERIMENTS_DIR = os.getenv("EXPERIMENTS_DIR", "../models/experiments")
_DEFAULT_RUNS_FILE = "runs.json"


class LocalExperimentTracker:
    """
    Lightweight, durable local experiment tracking system.
    Persists experiment run manifests to local JSON files and optionally MongoDB.
    Provides candidate-versus-champion comparison and lineage auditing.
    """

    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir or _DEFAULT_EXPERIMENTS_DIR
        os.makedirs(self.base_dir, exist_ok=True)
        self.runs_path = os.path.join(self.base_dir, _DEFAULT_RUNS_FILE)
        self._init_store()

    def _init_store(self):
        if not os.path.exists(self.runs_path):
            with open(self.runs_path, "w", encoding="utf-8") as f:
                json.dump({"runs": []}, f, indent=2)

    def _load_store(self) -> dict:
        try:
            with open(self.runs_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"runs": []}

    def _save_store(self, data: dict):
        with open(self.runs_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def log_run(
        self,
        experiment_name: str,
        model_name: str,
        parameters: Dict[str, Any],
        metrics: Dict[str, Any],
        dataset_fingerprint: str,
        artifact_path: str,
        artifact_sha256: str,
        validation_metrics: Optional[Dict[str, Any]] = None,
        baseline_metrics: Optional[Dict[str, Any]] = None,
        candidate_benchmarks: Optional[Dict[str, Any]] = None,
        tags: Optional[Dict[str, Any]] = None,
        is_champion: bool = False,
    ) -> str:
        """
        Records a completed experiment run with full hyperparameters, metrics,
        dataset fingerprint, and artifact checksum.
        """
        run_id = f"run_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        record = {
            "run_id": run_id,
            "experiment_name": experiment_name,
            "model_name": model_name,
            "timestamp": datetime.datetime.now().isoformat(),
            "status": "COMPLETED",
            "dataset_fingerprint": dataset_fingerprint,
            "parameters": parameters,
            "metrics": metrics,
            "validation_metrics": validation_metrics or metrics,
            "baseline_metrics": baseline_metrics or {},
            "candidate_benchmarks": candidate_benchmarks or {},
            "artifact_path": artifact_path,
            "artifact_sha256": artifact_sha256,
            "is_champion": is_champion,
            "tags": tags or {},
        }

        store = self._load_store()
        store["runs"].append(record)
        self._save_store(store)

        # Optional MLflow sync if installed and configured
        self._sync_mlflow_if_available(record)

        return run_id

    def list_runs(self, experiment_name: Optional[str] = None) -> List[Dict[str, Any]]:
        store = self._load_store()
        runs = store.get("runs", [])
        if experiment_name:
            runs = [r for r in runs if r.get("experiment_name") == experiment_name]
        return runs

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        for r in self.list_runs():
            if r.get("run_id") == run_id:
                return r
        return None

    def get_champion_run(self, experiment_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        runs = self.list_runs(experiment_name)
        champion_runs = [r for r in runs if r.get("is_champion")]
        if champion_runs:
            return champion_runs[-1]
        # Fallback to run with highest test PR-AUC
        if runs:
            return max(runs, key=lambda r: r.get("metrics", {}).get("prAuc", 0.0))
        return None

    def compare_runs(self, candidate_run_id: str, baseline_run_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Computes metric deltas between a candidate run and a baseline (or champion) run.
        """
        candidate = self.get_run(candidate_run_id)
        if not candidate:
            raise ValueError(f"Candidate run '{candidate_run_id}' not found.")

        if baseline_run_id:
            baseline = self.get_run(baseline_run_id)
            if not baseline:
                raise ValueError(f"Baseline run '{baseline_run_id}' not found.")
        else:
            baseline = self.get_champion_run(candidate.get("experiment_name"))
            if not baseline or baseline["run_id"] == candidate_run_id:
                baseline = candidate

        c_metrics = candidate.get("metrics", {})
        b_metrics = baseline.get("metrics", {})

        deltas = {}
        for metric_name in ["prAuc", "rocAuc", "recall", "precision", "f1", "f2", "accuracy", "brierScore"]:
            c_val = c_metrics.get(metric_name)
            b_val = b_metrics.get(metric_name)
            if c_val is not None and b_val is not None:
                deltas[metric_name] = {
                    "candidate": float(c_val),
                    "baseline": float(b_val),
                    "delta": float(c_val - b_val),
                    "improved": bool(c_val > b_val if metric_name != "brierScore" else c_val < b_val),
                }

        return {
            "candidate_run_id": candidate_run_id,
            "baseline_run_id": baseline.get("run_id"),
            "candidate_model": candidate.get("model_name"),
            "baseline_model": baseline.get("model_name"),
            "deltas": deltas,
            "candidate_dataset_fingerprint": candidate.get("dataset_fingerprint"),
            "baseline_dataset_fingerprint": baseline.get("dataset_fingerprint"),
        }

    def _sync_mlflow_if_available(self, record: dict):
        """Optional zero-failure adapter: logs to MLflow if installed and configured."""
        try:
            import mlflow
            tracking_uri = os.getenv("MLFLOW_TRACKING_URI", "file:./mlruns")
            mlflow.set_tracking_uri(tracking_uri)
            mlflow.set_experiment(record.get("experiment_name", "retention_ai"))
            with mlflow.start_run(run_name=record.get("run_id")):
                for k, v in record.get("parameters", {}).items():
                    if isinstance(v, (int, float, str, bool)):
                        mlflow.log_param(k, v)
                for k, v in record.get("metrics", {}).items():
                    if isinstance(v, (int, float)):
                        mlflow.log_metric(k, float(v))
                mlflow.set_tags(record.get("tags", {}))
                mlflow.set_tag("dataset_fingerprint", record.get("dataset_fingerprint"))
                mlflow.set_tag("artifact_sha256", record.get("artifact_sha256"))
        except Exception:
            # MLflow not installed or tracking server unreachable — silent local fallback
            pass


experiment_tracker = LocalExperimentTracker()
