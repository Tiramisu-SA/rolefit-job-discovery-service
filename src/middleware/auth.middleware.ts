import type { NextFunction, Request, Response } from 'express';
import type { ClaimsVerifier } from '../auth/supabase';
import { UnauthorizedError } from '../utils/errors';

export interface AuthContext {
  userId: string;
  accessToken: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/** Validate the bearer token and attach its signed subject for route authorization. */
export function authenticate(verifyClaims: ClaimsVerifier) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    const authorization = request.get('authorization') ?? '';
    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!match) {
      next(new UnauthorizedError());
      return;
    }

    try {
      const claims = await verifyClaims(match[1]);
      if (!claims || typeof claims.sub !== 'string' || !claims.sub.trim()) {
        next(new UnauthorizedError());
        return;
      }
      request.auth = { userId: claims.sub, accessToken: match[1] };
      next();
    } catch {
      next(new UnauthorizedError());
    }
  };
}
