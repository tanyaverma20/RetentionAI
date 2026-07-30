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
    const e = new Error('AI service is currently unavailable. Please try again later.');
    e.statusCode = 503;
    e.code = 'AI_SERVICE_UNAVAILABLE';
    return e;
  }

  const status = err.response.status;
  const detail = err.response.data?.detail || err.message || fallbackMessage;

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
