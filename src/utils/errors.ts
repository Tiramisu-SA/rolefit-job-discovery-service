export class UnauthorizedError extends Error {
  readonly status = 401;
  readonly code = 'UNAUTHENTICATED';

  constructor(message = 'Missing or invalid bearer token') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  readonly code = 'FORBIDDEN';

  constructor(message = 'The requested candidate does not match the authenticated user') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class BadRequestError extends Error {
  readonly status = 400;
  readonly code = 'INVALID_ARGUMENT';

  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}
