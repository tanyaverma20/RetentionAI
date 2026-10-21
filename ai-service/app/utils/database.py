"""
database.py
===========
Async MongoDB connection management for the RetentionAI AI Service.

Uses Motor (AsyncIOMotorClient) throughout — no synchronous PyMongo calls
at runtime. Training-time data loading uses a separate synchronous pymongo
client inside pipeline.py, which is explicitly an offline, worker-thread
operation.

Connection settings
-------------------
- serverSelectionTimeoutMS=5000  — Motor raises after 5 s if no primary
  is reachable; prevents indefinite blocking at startup.
- connectTimeoutMS=5000          — individual socket-connect timeout.
- socketTimeoutMS=30000          — per-operation I/O timeout; guards against
  Atlas network blips stalling a live request.
- maxPoolSize=50                 — default is 100; 50 leaves headroom for the
  Node gateway's own Motor-equivalent connection pool on the same Atlas tier.

TLS validation is ENABLED by default in every environment.  Set
MONGODB_TLS_ALLOW_INVALID=true only for a local dev setup that terminates
TLS at a local proxy without a trusted CA.
"""

import logging
import os

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "retentionai")

# TLS — production default: validate certificates.
MONGODB_TLS_ALLOW_INVALID: bool = (
    os.getenv("MONGODB_TLS_ALLOW_INVALID", "false").lower() in ("true", "1", "yes")
)
MONGODB_TLS_CA_FILE: str | None = os.getenv("MONGODB_TLS_CA_FILE", None)

# Connection-pool / timeout tuning
_SERVER_SELECTION_TIMEOUT_MS: int = int(
    os.getenv("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "5000")
)
_CONNECT_TIMEOUT_MS: int = int(os.getenv("MONGODB_CONNECT_TIMEOUT_MS", "5000"))
_SOCKET_TIMEOUT_MS: int = int(os.getenv("MONGODB_SOCKET_TIMEOUT_MS", "30000"))
_MAX_POOL_SIZE: int = int(os.getenv("MONGODB_MAX_POOL_SIZE", "50"))


class Database:
    """Holds the live Motor client and database handle as module-level singletons."""

    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


db_instance = Database()


async def connect_db() -> None:
    """
    Creates the Motor client and verifies connectivity with a ping command.

    A failed ping is logged as a warning (not an exception) so the service
    can still start in degraded mode; callers that actually need the database
    will receive ``None`` from ``get_db()`` and should handle that explicitly.
    """
    # Mask credentials in logs — log only the host/port fragment.
    _safe_uri = MONGODB_URI.split("@")[-1] if "@" in MONGODB_URI else MONGODB_URI
    logger.info(
        "Connecting to MongoDB: host=%s db=%s pool_max=%d",
        _safe_uri,
        MONGODB_DB_NAME,
        _MAX_POOL_SIZE,
    )

    kwargs: dict = {
        "serverSelectionTimeoutMS": _SERVER_SELECTION_TIMEOUT_MS,
        "connectTimeoutMS": _CONNECT_TIMEOUT_MS,
        "socketTimeoutMS": _SOCKET_TIMEOUT_MS,
        "maxPoolSize": _MAX_POOL_SIZE,
    }
    if MONGODB_TLS_ALLOW_INVALID:
        logger.warning(
            "TLS certificate validation is DISABLED (MONGODB_TLS_ALLOW_INVALID=true). "
            "Do not use this setting in production."
        )
        kwargs["tlsAllowInvalidCertificates"] = True
    if MONGODB_TLS_CA_FILE and os.path.exists(MONGODB_TLS_CA_FILE):
        kwargs["tlsCAFile"] = MONGODB_TLS_CA_FILE

    db_instance.client = AsyncIOMotorClient(MONGODB_URI, **kwargs)
    db_instance.db = db_instance.client[MONGODB_DB_NAME]

    try:
        await db_instance.client.admin.command("ping")
        logger.info("MongoDB connection established: host=%s", _safe_uri)
    except Exception:
        logger.warning(
            "MongoDB ping failed — service will start in degraded mode "
            "(predictions that require DB writes will be skipped). "
            "Check MONGODB_URI and network access.",
            exc_info=False,
        )


async def disconnect_db() -> None:
    """Closes the Motor connection pool during application shutdown."""
    if db_instance.client is not None:
        db_instance.client.close()
        db_instance.client = None
        db_instance.db = None
        logger.info("MongoDB connection closed.")


def get_db() -> AsyncIOMotorDatabase | None:
    """
    Returns the active Motor database handle, or ``None`` if the connection
    was never established (e.g. startup in degraded mode).

    Callers **must** treat a ``None`` return as a service-degraded state and
    return an appropriate HTTP error or skip the DB operation, not crash.
    """
    return db_instance.db
