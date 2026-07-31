import os
import uuid
import asyncio
import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status, BackgroundTasks
from typing import Optional
from app.api.schemas import (
    SinglePredictionRequest, 
    BatchPredictionRequest, 
    HealthStatusResponse
)
from app.prediction.prediction_service import prediction_service, ModelNotLoadedException
from app.utils.database import get_db
from train_model import train_model

router = APIRouter()

# Security dependency: Verify microservice authorization token
async def verify_auth_token(authorization: Optional[str] = Header(None)):
    expected_token = os.getenv("AI_SERVICE_TOKEN")
    if not expected_token or expected_token == "replace-with-a-service-token":
        # If token is not configured (e.g. locally or in testing), bypass token verification
        return True
        
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header"
        )
        
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Must be Bearer <token>"
        )
        
    token = parts[1]
    if token != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized. Invalid token."
        )
    return True

def serialize_doc(doc: dict) -> dict:
    """Helper to convert MongoDB object structures into JSON serializable dicts"""
    if not doc:
        return doc
    new_doc = doc.copy()
    for key, value in new_doc.items():
        if isinstance(value, ObjectId):
            new_doc[key] = str(value)
        elif isinstance(value, datetime.datetime):
            new_doc[key] = value.isoformat()
    return new_doc

@router.post("/predict", response_model=dict, dependencies=[Depends(verify_auth_token)])
async def predict_single(request: SinglePredictionRequest):
    """
    Predict attrition risk for a single employee.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable"
        )
        
    try:
        emp_id = ObjectId(request.employeeId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid employeeId format: {request.employeeId}"
        )
        
    employee = await db["employees"].find_one({"_id": emp_id, "isDeleted": {"$ne": True}})
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {request.employeeId} not found"
        )
        
    try:
        serialized_emp = serialize_doc(employee)
        result = await prediction_service.predict_single(serialized_emp)
        return {"success": True, "data": result}
    except ModelNotLoadedException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction error: {str(e)}"
        )

@router.post("/predict/batch", response_model=dict, dependencies=[Depends(verify_auth_token)])
async def predict_batch(request: BatchPredictionRequest):
    """
    Predict attrition risk for a batch of employees (filtered by department or list of IDs).
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable"
        )
        
    query = {"isDeleted": {"$ne": True}}
    
    # Apply filters
    if request.employeeIds:
        try:
            object_ids = [ObjectId(eid) for eid in request.employeeIds]
            query["_id"] = {"$in": object_ids}
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more employee IDs are invalid ObjectIds"
            )
    elif request.departmentId:
        try:
            query["departmentId"] = ObjectId(request.departmentId)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid departmentId format: {request.departmentId}"
            )
    else:
        # If neither is specified, predict for all active employees
        query["status"] = "ACTIVE"
        
    employees = []
    async for emp in db["employees"].find(query):
        employees.append(emp)
        
    if not employees:
        return {
            "success": True,
            "data": {
                "runId": str(uuid.uuid4()),
                "status": "COMPLETED",
                "totalCount": 0,
                "successCount": 0,
                "failedCount": 0,
                "predictions": [],
                "predictedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
        }
        
    run_id = f"batch_{int(datetime.datetime.now(datetime.timezone.utc).timestamp())}"

    # Root cause of predict/batch timing out: this ran one employee at a time,
    # each doing predict_single()'s full enrich_employee_doc() (attendance/
    # performance/promotion/training/survey/feedback/nlp lookups) sequentially
    # over the network to Atlas — the same bottleneck already fixed for
    # explain_batch, employee_intelligence_batch, and decision_batch. Same
    # bounded-concurrency fix, same semaphore width as explain_batch/employee-
    # intelligence (no external LLM call here, so no reason to be as
    # conservative as decision_service.py's batch).
    semaphore = asyncio.Semaphore(50)

    async def _predict_one(emp):
        async with semaphore:
            try:
                serialized_emp = serialize_doc(emp)
                return await prediction_service.predict_single(serialized_emp, run_id=run_id)
            except Exception as e:
                print(f"Failed prediction for employee {emp.get('_id')}: {e}")
                return None

    results = await asyncio.gather(*(_predict_one(emp) for emp in employees))
    predictions = [p for p in results if p is not None]
    failed_count = len(results) - len(predictions)

    result = {
        "runId": run_id,
        "status": "COMPLETED" if failed_count == 0 else "PARTIALLY_COMPLETED",
        "totalCount": len(employees),
        "successCount": len(predictions),
        "failedCount": failed_count,
        "predictions": predictions,
        "predictedAt": datetime.datetime.now(datetime.timezone.utc)
    }
    
    return {"success": True, "data": serialize_doc(result)}

@router.get("/model/info", response_model=dict, dependencies=[Depends(verify_auth_token)])
async def get_model_info():
    """
    Get current active model details.
    """
    try:
        info = prediction_service.get_model_info()
        return {"success": True, "data": info}
    except ModelNotLoadedException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.get("/model/metrics", response_model=dict, dependencies=[Depends(verify_auth_token)])
async def get_model_metrics():
    """
    Get evaluation performance metrics for the active model.
    """
    try:
        metrics = prediction_service.get_model_metrics()
        return {"success": True, "data": metrics}
    except ModelNotLoadedException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.get("/health", response_model=HealthStatusResponse)
async def health_check():
    """
    Check the health of the prediction service and connections.
    """
    db = get_db()
    mongodb_connected = False
    if db is not None:
        try:
            await db.client.admin.command('ping')
            mongodb_connected = True
        except Exception:
            mongodb_connected = False
            
    model_loaded = prediction_service.model_bundle is not None
    model_version = prediction_service.model_bundle.get("version") if model_loaded else None
    
    return HealthStatusResponse(
        status="healthy" if mongodb_connected and model_loaded else "degraded",
        mongodbConnected=mongodb_connected,
        modelLoaded=model_loaded,
        modelVersion=model_version
    )

@router.post("/train", response_model=dict, dependencies=[Depends(verify_auth_token)])
async def train_new_model(background_tasks: BackgroundTasks):
    """
    Trigger the model training pipeline in the background.
    """
    background_tasks.add_task(train_model)
    return {
        "success": True, 
        "message": "Model training started in the background. Check logs for progress."
    }
