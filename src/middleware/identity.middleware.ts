import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError } from '../utils/errors';
import { isUuid } from '../validation/discovery.validation';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The seeker's user id, which is also their candidate profile id. Set by `identifyFromHeader`. */
      userId?: string;
    }
  }
}

/**
 * Mock identity (auth is not wired yet): trusts the `X-User-Id` header (a
 * UUID), the same header the frontend sends to the Candidate Profile Service.
 * When real auth arrives, only this middleware changes.
 */
export function identifyFromHeader(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.get('x-user-id');
  if (!isUuid(userId)) {
    next(new UnauthenticatedError());
    return;
  }
  req.userId = userId;
  next();
}
