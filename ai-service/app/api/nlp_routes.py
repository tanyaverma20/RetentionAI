from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List
import asyncio

from app.nlp.schemas import (
    NLPAnalyzeRequest, 
    NLPBatchAnalyzeRequest, 
    NLPInsightsResponse, 
    NLPBatchResponse, 
    DashboardStatistics
)
from app.nlp.preprocessing import clean_text
from app.nlp.analyzer import analyze_hr_text
from app.nlp.repository import save_insight, save_insights_batch, get_employee_insights, get_dashboard_statistics

router = APIRouter(prefix="/nlp", tags=["NLP"])

def process_single_record(record: NLPAnalyzeRequest) -> NLPInsightsResponse:
    cleaned_text = clean_text(record.text)
    
    # Run NLP pipeline
    analysis = analyze_hr_text(record.text, cleaned_text)
    
    return NLPInsightsResponse(
        employeeId=record.employeeId,
        sourceCollection=record.sourceCollection,
        sourceDocumentId=record.sourceDocumentId,
        sentiment=analysis["sentiment"],
        sentimentScore=analysis["sentimentScore"],
        detectedEmotions=analysis["detectedEmotions"],
        detectedTopics=analysis["detectedTopics"],
        extractedKeywords=analysis["extractedKeywords"],
        burnoutRisk=analysis["burnoutRisk"],
        resignationIntent=analysis["resignationIntent"],
        engagementRisk=analysis["engagementRisk"],
        promotionFrustration=analysis["promotionFrustration"],
        managerConflict=analysis["managerConflict"],
        generatedAt=analysis["generatedAt"]
    )

@router.post("/analyze", response_model=NLPInsightsResponse)
async def analyze_text(request: NLPAnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Analyzes a single text record and saves the result to MongoDB.
    """
    try:
        # For a single record, process synchronously but save asynchronously in background
        insight = process_single_record(request)
        
        # Save to DB in background so API is fast
        background_tasks.add_task(save_insight, insight.model_dump())
        
        return insight
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NLP Analysis failed: {str(e)}")

@router.post("/analyze/batch", response_model=NLPBatchResponse)
async def analyze_batch(request: NLPBatchAnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Analyzes a batch of text records. 
    Ideal for processing historical data or daily syncs.
    """
    try:
        # In a real heavy-load scenario, we would use Celery.
        # Here we process sequentially (or via asyncio.gather if IO bound, but this is CPU bound)
        insights = []
        for record in request.records:
            insights.append(process_single_record(record))
            
        # Save batch in background
        background_tasks.add_task(save_insights_batch, [i.model_dump() for i in insights])
        
        return NLPBatchResponse(
            success=True,
            processedCount=len(insights),
            insights=insights
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch Analysis failed: {str(e)}")

@router.get("/employee/{employeeId}", response_model=List[NLPInsightsResponse])
async def get_employee_nlp_insights(employeeId: str):
    """
    Retrieves all stored NLP insights for a given employee.
    """
    try:
        results = await get_employee_insights(employeeId)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch insights: {str(e)}")

@router.get("/dashboard", response_model=DashboardStatistics)
async def get_nlp_dashboard():
    """
    Retrieves aggregated NLP statistics for the HR dashboard.
    """
    try:
        stats = await get_dashboard_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard stats: {str(e)}")

@router.get("/statistics", response_model=DashboardStatistics)
async def get_nlp_statistics():
    """
    Alias for dashboard stats.
    """
    try:
        stats = await get_dashboard_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch statistics: {str(e)}")
