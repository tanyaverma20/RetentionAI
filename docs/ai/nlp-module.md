# NLP Module Architecture

The RetentionAI Natural Language Processing (NLP) module resides within the `ai-service` (Python/FastAPI). Its primary function is to extract structured, actionable insights from unstructured HR text data, such as employee feedback, survey comments, and manager notes.

These insights serve as the foundational data layer for the upcoming RAG (Retrieval-Augmented Generation) and Agentic AI modules.

## Data Flow & Architecture

1. **Input:** The Node.js backend or frontend triggers the `POST /nlp/analyze` endpoint when new text data is submitted.
2. **Preprocessing:** Text is cleaned (HTML stripped, URLs removed, lowercase) and passed through a spaCy/NLTK pipeline for tokenization and lemmatization.
3. **NLP Pipeline:** The text passes through three core models:
   - **VADER Sentiment:** Fast, lexicon-based sentiment polarity (Positive, Neutral, Negative).
   - **Emotion Detection:** Hugging Face Transformer (`SamLowe/roberta-base-go_emotions`) maps fine-grained emotions to HR equivalents (Happy, Burnout, Stressed, Frustrated, etc.).
   - **Topic Classification:** Zero-shot DistilBART (`valhalla/distilbart-mnli-12-3`) classifies text into categories like "Compensation", "Leadership", or "Work-Life Balance".
4. **Risk Heuristics:** The outputs of the models are combined to compute confidence scores (0.0 - 1.0) for HR Risk Indicators:
   - Burnout Risk
   - Resignation Intent
   - Engagement Risk
   - Promotion Frustration
   - Manager Conflict
5. **Storage:** Results are asynchronously upserted into the MongoDB `nlp_insights` collection via Motor.

## Models Used

- **Sentiment:** `vaderSentiment` (Selected for its speed and accuracy on short-form social/feedback text).
- **Emotion:** `SamLowe/roberta-base-go_emotions` (Transformer fine-tuned on GoEmotions dataset).
- **Topics:** `valhalla/distilbart-mnli-12-3` (Fast zero-shot classification).
- **Lemmatization/Tokenization:** `spaCy` (`en_core_web_sm`).

## API Endpoints

All endpoints are prefixed with `/nlp`.

| Endpoint | Method | Description |
|---|---|---|
| `/nlp/analyze` | `POST` | Analyzes a single record and saves to MongoDB. |
| `/nlp/analyze/batch` | `POST` | Analyzes an array of records. |
| `/nlp/employee/{id}` | `GET` | Retrieves all NLP insights for a specific employee. |
| `/nlp/dashboard` | `GET` | Aggregates global NLP stats (avg sentiment, top topics, etc.). |
| `/nlp/statistics` | `GET` | Alias for `/dashboard`. |

## MongoDB Schema (`nlp_insights`)

```json
{
  "_id": "ObjectId",
  "employeeId": "String",
  "sourceCollection": "String (e.g., employee_feedback)",
  "sourceDocumentId": "String",
  "sentiment": "String (Positive | Neutral | Negative)",
  "sentimentScore": "Float (0-1)",
  "detectedEmotions": {
    "Happy": "Float",
    "Frustrated": "Float",
    "Burnout": "Float"
  },
  "detectedTopics": ["String"],
  "extractedKeywords": ["String"],
  "burnoutRisk": "Float (0-1)",
  "resignationIntent": "Float (0-1)",
  "engagementRisk": "Float (0-1)",
  "promotionFrustration": "Float (0-1)",
  "managerConflict": "Float (0-1)",
  "generatedAt": "ISO Date String"
}
```

## Performance & Optimization

- **Model Caching:** Transformer models are heavy. They are initialized once during the FastAPI application startup (`main.py` lifespan event) and held in memory to ensure API requests are processed with minimal latency.
- **Async DB Writes:** NLP processing is CPU-bound, but database writes are I/O bound. The `save_insight` functions are offloaded to FastAPI `BackgroundTasks` to immediately return the HTTP response while MongoDB handles the insert.
