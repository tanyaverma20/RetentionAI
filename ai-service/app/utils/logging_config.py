"""
logging_config.py
==================
Structured logging setup for the AI Service — Sprint 10, Part 5. Configures
Python's standard `logging` module (not a new dependency) with a JSON
formatter, console output, and a rotating file handler, then calls
`logging.getLogger(__name__)` everywhere gets that behavior for free.

Deliberately does NOT rewrite the ~50 existing `print(...)` statements
scattered across the prediction/RAG/NLP modules — that's unrelated churn
across files this sprint doesn't otherwise touch. `setup_logging()` upgrades
the app's actual logging infrastructure (rotation, JSON, request-ID
correlation) for the request/error/AI-call/decision events that matter most
operationally; the remaining print() call sites are documented as tech debt.
"""

import json
import logging
import os
from logging.handlers import TimedRotatingFileHandler

LOG_DIR = os.getenv("LOG_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "logs"))


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname.lower(),
            "message": record.getMessage(),
            "service": "retentionai-ai-service",
            "logger": record.name,
        }
        if hasattr(record, "request_id"):
            payload["requestId"] = record.request_id
        if record.exc_info:
            payload["stack"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def setup_logging(level: str = "INFO") -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    root = logging.getLogger()
    root.setLevel(level.upper())
    root.handlers.clear()

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(JsonFormatter())
    root.addHandler(console_handler)

    file_handler = TimedRotatingFileHandler(
        os.path.join(LOG_DIR, "ai-service.log"), when="midnight", backupCount=14, encoding="utf-8"
    )
    file_handler.setFormatter(JsonFormatter())
    root.addHandler(file_handler)
