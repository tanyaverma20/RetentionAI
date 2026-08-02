"""
unavailable_routes.py
=====================
Stand-ins for the NLP and RAG routers when the running image was built
without the local inference stack (see app/features.py).

Why a stub router rather than simply not registering the real one
-----------------------------------------------------------------
Leaving the paths unregistered makes them 404, which the Node API reports to
the browser as a missing endpoint — indistinguishable from a typo, a routing
regression, or a version mismatch between the two services. A 503 with an
explicit code says the deployment is intentionally reduced and names what is
missing, which is what an operator actually needs to see.

503 is also the status the Node side already understands: aiService.js maps
an unavailable AI service onto AI_SERVICE_UNAVAILABLE, so the frontend
degrades the same way it does when the service is down entirely — the
inline "unavailable" panel it already renders, not a crash.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.features import UNAVAILABLE_DETAIL

router = APIRouter(tags=["Unavailable in this build"])

# Mirrors the real routers' surface: nlp_routes uses prefix="/nlp", while
# employee_intelligence_routes and rag_routes mount their paths at the root.
_NLP_PATHS = ["/nlp/{rest_of_path:path}", "/sentiment/{rest_of_path:path}", "/sentiment"]
_RAG_PATHS = [
    "/knowledge/{rest_of_path:path}",
    "/documents/{rest_of_path:path}",
    "/rag/{rest_of_path:path}",
]


def _unavailable(feature: str):
    # Takes only `Request`: FastAPI binds nothing else, so the declared
    # `{rest_of_path:path}` segment is ignored rather than validated. A
    # signature of `**kwargs` instead makes FastAPI treat the unknown
    # parameters as a required request body and answer 422 — which would
    # misreport a build limitation as a malformed client request.
    async def handler(request: Request):  # noqa: ARG001
        return JSONResponse(
            status_code=503,
            content={
                "detail": UNAVAILABLE_DETAIL,
                "code": "FEATURE_NOT_AVAILABLE_IN_BUILD",
                "feature": feature,
            },
        )

    return handler


def register_unavailable(nlp: bool, rag: bool) -> APIRouter:
    """Build a router covering whichever feature groups this image lacks."""
    if not nlp:
        for path in _NLP_PATHS:
            router.add_api_route(
                path,
                _unavailable("nlp"),
                methods=["GET", "POST"],
                include_in_schema=False,
            )
    if not rag:
        for path in _RAG_PATHS:
            router.add_api_route(
                path,
                _unavailable("rag"),
                methods=["GET", "POST"],
                include_in_schema=False,
            )
    return router
