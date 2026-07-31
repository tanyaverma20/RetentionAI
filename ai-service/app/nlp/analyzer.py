import datetime
from typing import Dict, List, Any
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from transformers import pipeline
from langdetect import detect as _detect_lang, LangDetectException
import spacy

# Load NLP Models
try:
    nlp_spacy = spacy.load("en_core_web_sm")
except OSError:
    import spacy.cli
    spacy.cli.download("en_core_web_sm")
    nlp_spacy = spacy.load("en_core_web_sm")

vader_analyzer = SentimentIntensityAnalyzer()

# Lazy loading for transformers to optimize startup if not used immediately
_emotion_classifier = None
_zeroshot_classifier = None

def get_emotion_classifier():
    global _emotion_classifier
    if _emotion_classifier is None:
        # Fine-tuned RoBERTa for emotion detection
        _emotion_classifier = pipeline("text-classification", model="SamLowe/roberta-base-go_emotions", top_k=None)
    return _emotion_classifier

def get_zeroshot_classifier():
    global _zeroshot_classifier
    if _zeroshot_classifier is None:
        # DistilBART for fast zero-shot classification
        _zeroshot_classifier = pipeline("zero-shot-classification", model="valhalla/distilbart-mnli-12-3")
    return _zeroshot_classifier


# Employee Intelligence sprint topic taxonomy (kept close to the original list,
# renamed/split to match required categories, plus a couple of extras and a
# catch-all so nothing that was previously classifiable becomes unclassifiable).
HR_TOPICS = [
    "Compensation", "Manager", "Promotion", "Training", "Culture",
    "Workload", "Recognition", "Work-Life Balance", "Learning", "Team",
    "Benefits", "Performance", "Other",
]

HR_KEYWORDS = {
    "promotion", "salary", "workload", "burnout", "manager", 
    "training", "career", "growth", "balance", "team", "culture", "recognition",
    "stress", "leadership", "benefits", "compensation", "learning", "development",
    "overtime", "support", "communication"
}

def analyze_sentiment(text: str) -> Dict[str, Any]:
    """
    Analyzes sentiment using VADER.
    """
    if not text:
        return {"label": "Neutral", "score": 0.5}
        
    scores = vader_analyzer.polarity_scores(text)
    compound = scores['compound']
    
    # Map compound score (-1 to 1) to a 0-1 confidence score
    confidence = (compound + 1) / 2 
    
    if compound >= 0.05:
        label = "Positive"
    elif compound <= -0.05:
        label = "Negative"
    else:
        label = "Neutral"
        
    return {"label": label, "score": confidence}


# Employee Intelligence sprint emotion taxonomy (required set).
EMOTION_CATEGORIES = ["Happy", "Satisfied", "Frustrated", "Stressed", "Burned Out", "Demotivated"]

def detect_emotions(text: str) -> Dict[str, float]:
    """
    Detects emotions using a Transformer model (go_emotions, 28 fine-grained
    labels) and maps them onto the HR emotion taxonomy required by this sprint:
    Happy, Satisfied, Frustrated, Stressed, Burned Out, Demotivated.
    """
    if not text:
        return {}

    classifier = get_emotion_classifier()
    results = classifier(text)[0]

    mapped_emotions = {k: 0.0 for k in EMOTION_CATEGORIES}

    for r in results:
        label = r['label']
        score = r['score']

        if label in ['joy', 'amusement', 'excitement', 'love']:
            mapped_emotions['Happy'] += score
        elif label in ['approval', 'gratitude', 'pride', 'relief', 'optimism', 'caring', 'admiration']:
            mapped_emotions['Satisfied'] += score
        elif label in ['annoyance', 'disappointment', 'disapproval', 'anger']:
            mapped_emotions['Frustrated'] += score
        elif label in ['nervousness', 'fear', 'embarrassment', 'confusion']:
            mapped_emotions['Stressed'] += score
        elif label in ['sadness', 'grief', 'remorse']:
            mapped_emotions['Burned Out'] += score
        elif label in ['disgust', 'realization', 'disappointment']:
            mapped_emotions['Demotivated'] += score

    # Normalize mapping — keep only categories with a meaningful signal.
    return {k: min(1.0, v) for k, v in mapped_emotions.items() if v > 0.1}


def dominant_emotion(emotions: Dict[str, float]) -> str:
    """Returns the single strongest emotion, defaulting to 'Satisfied' when no signal fires."""
    if not emotions:
        return "Satisfied"
    return max(emotions.items(), key=lambda kv: kv[1])[0]


SUPPORTED_LANGUAGE = "en"


def detect_language(text: str) -> str:
    """
    Best-effort language detection. Every model in this pipeline (VADER,
    the go_emotions/DistilBART transformers, the HR keyword lemma set) is
    English-only — running them on other languages silently produces
    meaningless output rather than an error, so callers should gate on this
    first. Returns 'unknown' rather than raising when detection itself fails
    (e.g. text too short) — treated as unsupported by callers, not fatal.
    """
    if not text or not text.strip():
        return "unknown"
    try:
        return _detect_lang(text)
    except LangDetectException:
        return "unknown"


def burnout_level(burnout_score: float) -> str:
    """
    Buckets the continuous burnoutRisk score (0-1) into Low/Medium/High,
    using the same 0.34/0.64 thresholds already established for risk
    categorization elsewhere in this service (see local_explainer.py).
    """
    if burnout_score <= 0.34:
        return "Low"
    if burnout_score <= 0.64:
        return "Medium"
    return "High"


def extract_keywords(text: str, cleaned_text: str) -> List[str]:
    """
    Extracts HR-related keywords and general noun chunks.
    """
    if not text:
        return []
        
    doc = nlp_spacy(cleaned_text.lower())
    found_keywords = set()
    
    # Check predefined HR keywords
    for token in doc:
        if token.lemma_ in HR_KEYWORDS:
            found_keywords.add(token.lemma_)
            
    # Extract noun chunks from original text to capture phrases
    orig_doc = nlp_spacy(text)
    for chunk in orig_doc.noun_chunks:
        phrase = chunk.text.lower().strip()
        if len(phrase.split()) <= 3 and len(phrase) > 2:
            # Simple heuristic to avoid stopword only chunks
            if not all(t.is_stop for t in chunk):
                found_keywords.add(phrase)
                
    # Sort by frequency or just return list (limit to top 10)
    return list(found_keywords)[:10]


def classify_topic(text: str) -> List[str]:
    """
    Uses Zero-Shot Classification to map text to predefined HR topics.
    """
    if not text:
        return ["Other"]

    classifier = get_zeroshot_classifier()
    result = classifier(text, candidate_labels=HR_TOPICS, multi_label=True)

    # Return topics with a score above 0.4
    topics = [label for label, score in zip(result['labels'], result['scores']) if score > 0.4]

    if not topics:
        topics = [result['labels'][0]] # Return top 1 if none > 0.4

    return topics


def calculate_risk_indicators(sentiment: Dict, emotions: Dict[str, float], topics: List[str]) -> Dict[str, float]:
    """
    Calculates risk indicators based on combined signals.
    Returns scores between 0 and 1.
    """
    risks = {
        "burnoutRisk": 0.0,
        "resignationIntent": 0.0,
        "engagementRisk": 0.0,
        "promotionFrustration": 0.0,
        "managerConflict": 0.0
    }
    
    is_negative = sentiment['label'] == 'Negative'
    neg_score = 1.0 - sentiment['score'] if is_negative else 0.0

    # 1. Burnout Risk
    stress = emotions.get("Stressed", 0.0)
    burned_out = emotions.get("Burned Out", 0.0)
    wl_balance_issue = 1.0 if "Work-Life Balance" in topics or "Workload" in topics else 0.0
    risks["burnoutRisk"] = min(1.0, (stress * 0.4 + burned_out * 0.6 + wl_balance_issue * 0.3) * (1 + neg_score))

    # 2. Resignation Intent
    frustration = emotions.get("Frustrated", 0.0)
    demotivated = emotions.get("Demotivated", 0.0)
    risks["resignationIntent"] = min(1.0, (frustration * 0.5 + demotivated * 0.5 + neg_score * 0.4))

    # 3. Engagement Risk (Low Engagement)
    risks["engagementRisk"] = min(1.0, (demotivated * 0.8 + neg_score * 0.3))

    # 4. Promotion Frustration
    if "Promotion" in topics or "Compensation" in topics:
        risks["promotionFrustration"] = min(1.0, frustration * 0.8 + neg_score * 0.5)

    # 5. Manager Conflict
    if "Manager" in topics:
        risks["managerConflict"] = min(1.0, frustration * 0.6 + neg_score * 0.3)

    # Round to 2 decimal places
    return {k: round(v, 2) for k, v in risks.items()}


_SENTIMENT_PHRASES = {
    "Positive": "positive",
    "Neutral": "neutral",
    "Negative": "increasingly negative",
}

_BURNOUT_PHRASES = {
    "Low": "low",
    "Medium": "moderate",
    "High": "high — this warrants prompt attention",
}


def generate_summary(sentiment: Dict[str, Any], emotion: str, burnout: str, topics: List[str]) -> str:
    """
    Composes a plain-English, template-based summary from the analysis —
    no LLM/generative call, same approach as the SHAP narrative builder.
    """
    parts: List[str] = []

    topic_list = [t for t in topics if t != "Other"]
    if topic_list:
        topics_str = ", ".join(topic_list[:3]).lower()
        parts.append(f"The employee has expressed {_SENTIMENT_PHRASES.get(sentiment['label'], 'mixed')} sentiment, primarily regarding {topics_str}.")
    else:
        parts.append(f"The employee has expressed {_SENTIMENT_PHRASES.get(sentiment['label'], 'mixed')} sentiment.")

    if emotion in ("Frustrated", "Stressed", "Burned Out", "Demotivated"):
        parts.append(f"The dominant emotional signal is {emotion.lower()}.")
    elif emotion in ("Happy", "Satisfied"):
        parts.append(f"The dominant emotional signal is {emotion.lower()}, a positive sign.")

    parts.append(f"Burnout risk is {_BURNOUT_PHRASES.get(burnout, burnout.lower())}.")

    return " ".join(parts)


def analyze_hr_text(text: str, cleaned_text: str) -> Dict[str, Any]:
    """
    Orchestrates the full NLP pipeline for a single text record.
    """
    sentiment = analyze_sentiment(text)
    emotions = detect_emotions(text)
    keywords = extract_keywords(text, cleaned_text)
    topics = classify_topic(text)
    risks = calculate_risk_indicators(sentiment, emotions, topics)
    emotion = dominant_emotion(emotions)
    burnout = burnout_level(risks["burnoutRisk"])
    summary = generate_summary(sentiment, emotion, burnout, topics)

    # Confidence blends the sentiment model's confidence with how strongly the
    # dominant emotion fired — a simple, explainable proxy for "how sure is the
    # pipeline about this read", not a separate model.
    dominant_emotion_score = emotions.get(emotion, 0.5)
    confidence = round((abs(sentiment['score'] - 0.5) * 2 * 0.5) + (dominant_emotion_score * 0.5), 2)

    return {
        "sentiment": sentiment['label'],
        "sentimentScore": round(sentiment['score'], 2),
        "detectedEmotions": {k: round(v, 2) for k, v in emotions.items()},
        "dominantEmotion": emotion,
        "detectedTopics": topics,
        "extractedKeywords": keywords,
        "burnoutRisk": risks["burnoutRisk"],
        "burnoutLevel": burnout,
        "resignationIntent": risks["resignationIntent"],
        "engagementRisk": risks["engagementRisk"],
        "promotionFrustration": risks["promotionFrustration"],
        "managerConflict": risks["managerConflict"],
        "confidence": confidence,
        "summary": summary,
        "generatedAt": datetime.datetime.utcnow().isoformat()
    }
