import datetime
from typing import Dict, List, Any
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from transformers import pipeline
import spacy
import collections

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


HR_TOPICS = [
    "Compensation", "Career Growth", "Work Environment", 
    "Leadership", "Team Collaboration", "Benefits", 
    "Learning & Development", "Performance", "Work-Life Balance", "Others"
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


def detect_emotions(text: str) -> Dict[str, float]:
    """
    Detects emotions using a Transformer model.
    Maps fine-grained emotions to HR-specific ones: Happy, Frustrated, Angry, Stressed, Burnout, Motivated, Disengaged.
    """
    if not text:
        return {}
        
    classifier = get_emotion_classifier()
    results = classifier(text)[0]
    
    # Map raw emotions to our HR set
    mapped_emotions = {
        "Happy": 0.0,
        "Frustrated": 0.0,
        "Angry": 0.0,
        "Stressed": 0.0,
        "Burnout": 0.0,
        "Motivated": 0.0,
        "Disengaged": 0.0
    }
    
    for r in results:
        label = r['label']
        score = r['score']
        
        if label in ['joy', 'amusement', 'optimism', 'approval']:
            mapped_emotions['Happy'] += score
            if label == 'optimism':
                mapped_emotions['Motivated'] += score
        elif label in ['annoyance', 'disappointment', 'disapproval']:
            mapped_emotions['Frustrated'] += score
        elif label == 'anger':
            mapped_emotions['Angry'] += score
        elif label in ['nervousness', 'fear']:
            mapped_emotions['Stressed'] += score
        elif label in ['sadness', 'grief', 'remorse']:
            mapped_emotions['Burnout'] += score
        elif label in ['boredom', 'indifference']:
            mapped_emotions['Disengaged'] += score
            
    # Normalize mapping
    return {k: min(1.0, v) for k, v in mapped_emotions.items() if v > 0.1}


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
        return ["Others"]
        
    classifier = get_zeroshot_classifier()
    result = classifier(text, candidate_labels=HR_TOPICS, multi_label=True)
    
    # Return topics with a score above 0.5
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
    burnout = emotions.get("Burnout", 0.0)
    wl_balance_issue = 1.0 if "Work-Life Balance" in topics or "Workload" in topics else 0.0
    risks["burnoutRisk"] = min(1.0, (stress * 0.4 + burnout * 0.6 + wl_balance_issue * 0.3) * (1 + neg_score))

    # 2. Resignation Intent
    frustration = emotions.get("Frustrated", 0.0)
    disengaged = emotions.get("Disengaged", 0.0)
    risks["resignationIntent"] = min(1.0, (frustration * 0.5 + disengaged * 0.5 + neg_score * 0.4))
    
    # 3. Engagement Risk (Low Engagement)
    risks["engagementRisk"] = min(1.0, (disengaged * 0.8 + neg_score * 0.3))
    
    # 4. Promotion Frustration
    if "Career Growth" in topics or "promotion" in topics or "Compensation" in topics:
        risks["promotionFrustration"] = min(1.0, frustration * 0.8 + neg_score * 0.5)
        
    # 5. Manager Conflict
    if "Leadership" in topics or "Manager" in topics:
        anger = emotions.get("Angry", 0.0)
        risks["managerConflict"] = min(1.0, anger * 0.6 + frustration * 0.4 + neg_score * 0.3)
        
    # Round to 2 decimal places
    return {k: round(v, 2) for k, v in risks.items()}


def analyze_hr_text(text: str, cleaned_text: str) -> Dict[str, Any]:
    """
    Orchestrates the full NLP pipeline for a single text record.
    """
    sentiment = analyze_sentiment(text)
    emotions = detect_emotions(text)
    keywords = extract_keywords(text, cleaned_text)
    topics = classify_topic(text)
    risks = calculate_risk_indicators(sentiment, emotions, topics)
    
    return {
        "sentiment": sentiment['label'],
        "sentimentScore": round(sentiment['score'], 2),
        "detectedEmotions": {k: round(v, 2) for k, v in emotions.items()},
        "detectedTopics": topics,
        "extractedKeywords": keywords,
        "burnoutRisk": risks["burnoutRisk"],
        "resignationIntent": risks["resignationIntent"],
        "engagementRisk": risks["engagementRisk"],
        "promotionFrustration": risks["promotionFrustration"],
        "managerConflict": risks["managerConflict"],
        "generatedAt": datetime.datetime.utcnow().isoformat()
    }
