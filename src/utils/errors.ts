/**
 * Base error type for this service. The error middleware turns it into
 * `{ error: { code, message, details? } }`, the same envelope the Candidate
 * Profile Service uses, so the frontend parses both the same way.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export interface FieldError {
  /** Name of the invalid field or query parameter, e.g. `employmentTypes`. */
  field: string;
  message: string;
}

export class ValidationError extends AppError {
  constructor(
    public readonly details: FieldError[],
    message = 'Some fields are invalid',
  ) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Missing or invalid X-User-Id header') {
    super(message, 401, 'UNAUTHENTICATED');
  }
}

/** 404 with a resource-specific code such as JOB_NOT_FOUND. */
export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(message, 404, code);
  }
}

/** An upstream service (Candidate Profile, Job Posting) is down or timed out. */
export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`The ${service} service is unavailable. Please try again.`, 503, 'SERVICE_UNAVAILABLE');
  }
}

/** An upstream service answered with an unexpected error. Details are logged, not returned. */
export class UpstreamError extends AppError {
  constructor(service: string) {
    super(`The ${service} service returned an error.`, 502, 'UPSTREAM_ERROR');
  }
}

/** A TODO in this template that has not been implemented yet. */
export class NotImplementedError extends AppError {
  constructor(feature: string) {
    super(`Not implemented: ${feature}`, 501, 'NOT_IMPLEMENTED');
  }
}

export const jobNotFound = () => new NotFoundError('JOB_NOT_FOUND', 'Job not found');
