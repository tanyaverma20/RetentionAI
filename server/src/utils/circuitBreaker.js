import { logger } from './logger.js';

export const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

export class CircuitBreaker {
  constructor({
    name = 'AiServiceCircuitBreaker',
    failureThreshold = 5,
    resetTimeoutMs = 30000,
    requestTimeoutMs = 10000,
  } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.requestTimeoutMs = requestTimeoutMs;

    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.lastStateChange = Date.now();
    this.nextAttempt = Date.now();
  }

  getState() {
    if (this.state === CIRCUIT_STATES.OPEN && Date.now() >= this.nextAttempt) {
      this.state = CIRCUIT_STATES.HALF_OPEN;
      this.lastStateChange = Date.now();
      logger.info('circuit_breaker_state_change', {
        name: this.name,
        from: CIRCUIT_STATES.OPEN,
        to: CIRCUIT_STATES.HALF_OPEN,
      });
    }
    return this.state;
  }

  async execute(actionFn, { fallbackFn = null } = {}) {
    const currentState = this.getState();

    if (currentState === CIRCUIT_STATES.OPEN) {
      logger.warn('circuit_breaker_open_rejected', { name: this.name });
      if (fallbackFn) {
        return fallbackFn(new Error(`Circuit breaker '${this.name}' is OPEN.`));
      }
      throw new Error(`Circuit breaker '${this.name}' is OPEN. Request rejected.`);
    }

    try {
      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Operation timed out after ${this.requestTimeoutMs}ms`));
        }, this.requestTimeoutMs);
        if (typeof timer.unref === 'function') timer.unref();
      });

      const result = await Promise.race([actionFn(), timeoutPromise]);

      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);

      if (fallbackFn) {
        return fallbackFn(err);
      }
      throw err;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.state = CIRCUIT_STATES.CLOSED;
      this.lastStateChange = Date.now();
      logger.info('circuit_breaker_state_change', {
        name: this.name,
        from: CIRCUIT_STATES.HALF_OPEN,
        to: CIRCUIT_STATES.CLOSED,
      });
    }
  }

  onFailure(err) {
    // Non-transient 4xx errors should not increment circuit failures
    const isTransient = !err?.response || (err.response.status >= 500 || err.response.status === 429);
    if (!isTransient) return;

    this.failureCount += 1;
    logger.warn('circuit_breaker_failure', {
      name: this.name,
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: err.message,
    });

    if (this.failureCount >= this.failureThreshold && this.state !== CIRCUIT_STATES.OPEN) {
      this.state = CIRCUIT_STATES.OPEN;
      this.lastStateChange = Date.now();
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      logger.error('circuit_breaker_tripped_open', {
        name: this.name,
        failures: this.failureCount,
        nextAttemptInMs: this.resetTimeoutMs,
      });
    }
  }
}

// Singleton CircuitBreaker instance for AI service calls
export const aiServiceCircuitBreaker = new CircuitBreaker({
  name: 'AiService',
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  requestTimeoutMs: 10000,
});
