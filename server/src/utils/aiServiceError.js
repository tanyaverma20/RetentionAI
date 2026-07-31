/**
 * @file aiServiceError.js
 * @description Shared axios-failure normalizer for services that proxy the FastAPI AI service.
 *
 * Why this file exists
 * --------------------
 * Turns a raw axios error into a plain Error carrying `.statusCode`/`.code` so
 * controllers can surface the right HTTP status instead of always 502. Used
 * by the new Employee Intelligence service; existing services (aiService.js,
 * explainService.js) keep their own copies to avoid touching the working
 * Prediction/SHAP code paths in this sprint.
 */
export function toAiServiceError(err, fallbackMessage, options = {}) {
  const { notReadyMessage = 'The AI service is not ready yet.', notFoundMessage = 'Resource not found.' } = options;

  if (!err.response) {
    // A response-less axios error covers two very different failures, and
    // collapsing them into AI_SERVICE_UNAVAILABLE actively misleads: it says
    // "the service is down" when in reality the service was up and still
    // working, and the client simply gave up first. Split them so the status
    // code carries the truth — 504 means "too slow" (raise the budget or
    // shrink the request), 503 means "nothing is listening" (start it).
    const timedOut = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
    if (timedOut) {
      const e = new Error(
        `AI service did not respond within ${err.config?.timeout ?? 'the configured'}ms. The request may be too large — try a smaller batch.`,
      );
      e.statusCode = 504;
      e.code = 'AI_SERVICE_TIMEOUT';
      return e;
    }
    const e = new Error('AI service is currently unavailable. Please try again later.');
    e.statusCode = 503;
    e.code = 'AI_SERVICE_UNAVAILABLE';
    return e;
  }

  const status = err.response.status;
  const detail = err.response.data?.detail || err.message || fallbackMessage;

  // The Decision/RAG pipelines call an LLM (Groq) — reproduced directly
  // against this service: a plain 500 whose detail was the raw Groq 429
  // payload ("Rate limit reached ... tokens per day ... org_..."). Without
  // this, that entire technical blob (including an internal org id) would
  // otherwise flow into a user-facing message under the generic case below.
  if (detail.includes('rate_limit_exceeded') || detail.includes('Rate limit reached')) {
    const e = new Error('The AI service hit its LLM rate limit. Please try again in a few minutes.');
    e.statusCode = 429;
    e.code = 'AI_RATE_LIMITED';
    return e;
  }

  if (status === 503) {
    const e = new Error(notReadyMessage);
    e.statusCode = 503;
    e.code = 'MODEL_NOT_TRAINED';
    return e;
  }
  if (status === 404) {
    const e = new Error(notFoundMessage);
    e.statusCode = 404;
    e.code = 'NOT_FOUND';
    return e;
  }
  const e = new Error(`${fallbackMessage}: ${detail}`);
  e.statusCode = status === 400 ? 400 : 502;
  e.code = status === 400 ? 'INVALID_REQUEST' : 'AI_SERVICE_ERROR';
  return e;
}
