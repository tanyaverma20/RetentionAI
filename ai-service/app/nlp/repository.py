from typing import List, Dict, Any
from app.utils.database import get_db

async def get_nlp_collection():
    db = await get_db()
    return db["nlp_insights"]

async def save_insight(insight: Dict[str, Any]):
    """
    Saves a single NLP insight to MongoDB.
    """
    collection = await get_nlp_collection()
    # Upsert based on sourceDocumentId to avoid duplicates
    await collection.update_one(
        {"sourceDocumentId": insight["sourceDocumentId"]},
        {"$set": insight},
        upsert=True
    )

async def save_insights_batch(insights: List[Dict[str, Any]]):
    """
    Saves a batch of NLP insights to MongoDB.
    """
    collection = await get_nlp_collection()
    for insight in insights:
        await collection.update_one(
            {"sourceDocumentId": insight["sourceDocumentId"]},
            {"$set": insight},
            upsert=True
        )

async def get_employee_insights(employee_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves all NLP insights for a specific employee.
    """
    collection = await get_nlp_collection()
    cursor = collection.find({"employeeId": employee_id}).sort("generatedAt", -1)
    results = await cursor.to_list(length=100)
    
    # Convert ObjectId to string for JSON serialization
    for r in results:
        r["_id"] = str(r["_id"])
    return results

async def get_dashboard_statistics() -> Dict[str, Any]:
    """
    Aggregates statistics for the dashboard.
    """
    collection = await get_nlp_collection()
    
    total_docs = await collection.count_documents({})
    if total_docs == 0:
        return {
            "overallSentiment": "Neutral",
            "averageSentimentScore": 0.5,
            "burnoutTrend": 0.0,
            "engagementTrend": 0.0,
            "topTopics": [],
            "topComplaints": []
        }
        
    pipeline = [
        {
            "$group": {
                "_id": None,
                "avgSentimentScore": {"$avg": "$sentimentScore"},
                "avgBurnoutRisk": {"$avg": "$burnoutRisk"},
                "avgEngagementRisk": {"$avg": "$engagementRisk"}
            }
        }
    ]
    
    agg_results = await collection.aggregate(pipeline).to_list(length=1)
    stats = agg_results[0] if agg_results else {}
    
    avg_sent = stats.get("avgSentimentScore", 0.5)
    overall_sent = "Positive" if avg_sent > 0.6 else "Negative" if avg_sent < 0.4 else "Neutral"
    
    # Get top topics
    topic_pipeline = [
        {"$unwind": "$detectedTopics"},
        {"$group": {"_id": "$detectedTopics", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    top_topics = await collection.aggregate(topic_pipeline).to_list(length=5)
    
    # Get top complaints (topics where sentiment is negative)
    complaint_pipeline = [
        {"$match": {"sentiment": "Negative"}},
        {"$unwind": "$detectedTopics"},
        {"$group": {"_id": "$detectedTopics", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    top_complaints = await collection.aggregate(complaint_pipeline).to_list(length=5)

    return {
        "overallSentiment": overall_sent,
        "averageSentimentScore": round(avg_sent, 2),
        "burnoutTrend": round(stats.get("avgBurnoutRisk", 0.0), 2),
        "engagementTrend": round(stats.get("avgEngagementRisk", 0.0), 2),
        "topTopics": [t["_id"] for t in top_topics],
        "topComplaints": [c["_id"] for c in top_complaints]
    }
