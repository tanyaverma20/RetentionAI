from typing import List, Dict, Any, Optional
from bson import ObjectId
from app.utils.database import get_db

async def get_nlp_collection():
    # get_db() is a plain synchronous function (returns the already-connected
    # Motor database handle) — it must never be awaited. Awaiting it here
    # previously raised TypeError on every call, silently breaking every
    # read/write in this module (background-task writes swallow the error;
    # the GET endpoints below surfaced it as a 500).
    db = get_db()
    return db["nlp_insights"]


async def get_latest_employee_intelligence(employee_id: str) -> Optional[Dict[str, Any]]:
    """
    Returns the most recent Employee Intelligence profile for one employee.

    Root cause this fixes: the Decision Engine's evidence step previously
    called get_employee_insights(), which reads this service's OWN
    `nlp_insights` collection — written only by the legacy /nlp/analyze and
    /nlp/analyze/batch endpoints. Nothing in the actual "Generate Employee
    Intelligence" flow (server/src/services/employeeIntelligenceService.js,
    called via POST /employee-intelligence and /employee-intelligence/batch
    below) ever writes there — it persists into its own `employeeintelligences`
    collection instead. `nlp_insights` is therefore permanently empty, so
    every employee's NLP evidence silently defaulted to Neutral/0.0/[],
    starving nearly every Business Rule of the sentiment/burnout/topic
    signals it needs and collapsing every decision to NO_ACTION_REQUIRED.
    This queries the collection that is actually populated, on the same
    shared MongoDB database both services connect to.
    """
    db = get_db()
    try:
        oid = ObjectId(employee_id)
    except Exception:
        return None
    doc = await db["employeeintelligences"].find_one(
        {"employeeId": oid},
        sort=[("generatedAt", -1)],
    )
    return doc

async def find_cached_insight(source_document_id: str, text_hash: str) -> Dict[str, Any] | None:
    """
    Returns a previously-computed insight for this exact source document if its
    text hasn't changed since (same sourceDocumentId + same textHash) — lets
    callers skip re-running the transformer models on unchanged text.
    """
    collection = await get_nlp_collection()
    doc = await collection.find_one({"sourceDocumentId": source_document_id, "textHash": text_hash})
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc

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
            "topComplaints": [],
            "sentimentDistribution": {"Positive": 0, "Neutral": 0, "Negative": 0},
            "burnoutDistribution": {"Low": 0, "Medium": 0, "High": 0},
            "emotionDistribution": {},
            "trendingTopics": [],
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

    # Sentiment distribution (Sentiment Distribution / Trending Topics widgets)
    sentiment_dist_rows = await collection.aggregate([
        {"$group": {"_id": "$sentiment", "count": {"$sum": 1}}},
    ]).to_list(length=10)
    sentiment_distribution = {"Positive": 0, "Neutral": 0, "Negative": 0}
    for row in sentiment_dist_rows:
        if row["_id"] in sentiment_distribution:
            sentiment_distribution[row["_id"]] = row["count"]

    # Burnout distribution (categorical, derived the same way analyzer.py buckets it)
    burnout_dist_rows = await collection.aggregate([
        {
            "$bucket": {
                "groupBy": "$burnoutRisk",
                "boundaries": [0, 0.34, 0.64, 1.01],
                "default": "Unknown",
                "output": {"count": {"$sum": 1}},
            }
        }
    ]).to_list(length=10)
    burnout_distribution = {"Low": 0, "Medium": 0, "High": 0}
    burnout_bucket_labels = {0: "Low", 0.34: "Medium", 0.64: "High"}
    for row in burnout_dist_rows:
        label = burnout_bucket_labels.get(row["_id"])
        if label:
            burnout_distribution[label] = row["count"]

    # Emotion distribution — dominantEmotion is set per-record by analyzer.py
    emotion_dist_rows = await collection.aggregate([
        {"$match": {"dominantEmotion": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$dominantEmotion", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(length=10)
    emotion_distribution = {row["_id"]: row["count"] for row in emotion_dist_rows}

    # Trending topics — same shape as topTopics but explicitly named for the
    # "Trending Topics" dashboard widget (most recent 200 records only).
    trending_pipeline = [
        {"$sort": {"generatedAt": -1}},
        {"$limit": 200},
        {"$unwind": "$detectedTopics"},
        {"$group": {"_id": "$detectedTopics", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 8},
    ]
    trending_rows = await collection.aggregate(trending_pipeline).to_list(length=8)
    trending_topics = [{"topic": r["_id"], "count": r["count"]} for r in trending_rows]

    return {
        "overallSentiment": overall_sent,
        "averageSentimentScore": round(avg_sent, 2),
        "burnoutTrend": round(stats.get("avgBurnoutRisk", 0.0), 2),
        "engagementTrend": round(stats.get("avgEngagementRisk", 0.0), 2),
        "topTopics": [t["_id"] for t in top_topics],
        "topComplaints": [c["_id"] for c in top_complaints],
        "sentimentDistribution": sentiment_distribution,
        "burnoutDistribution": burnout_distribution,
        "emotionDistribution": emotion_distribution,
        "trendingTopics": trending_topics,
    }
