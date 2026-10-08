import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  JobSearchFilters,
  WORK_ARRANGEMENTS,
} from '../types/domain.types';
import { FieldError, ValidationError } from '../utils/errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXT = 200;
const MAX_LIST = 10;
/** Job ids from the Job Posting Service: `job_<ULID>`, or `job_seed_<slug>` for seed data. */
const JOB_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export const DEFAULT_RECOMMENDATIONS = 6;
export const MAX_RECOMMENDATIONS = 50;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

type Query = Record<string, unknown>;

/** A query value given once (`?a=x`) — repeated values (`?a=x&a=y`) are rejected. */
function single(query: Query, field: string, errors: FieldError[]): string | undefined {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Must be given once' });
    return undefined;
  }
  return value.trim();
}

function text(query: Query, field: string, errors: FieldError[]): string | undefined {
  const value = single(query, field, errors);
  if (!value) return undefined;
  if (value.length > MAX_TEXT) {
    errors.push({ field, message: `Must be at most ${MAX_TEXT} characters` });
    return undefined;
  }
  return value;
}

/** Comma-separated list of allowed values, e.g. `employmentTypes=FULL_TIME,CONTRACT`. */
function list<T extends string>(query: Query, field: string, allowed: readonly T[], errors: FieldError[]): T[] | undefined {
  const value = single(query, field, errors);
  if (!value) return undefined;
  const items = [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
  if (items.length > MAX_LIST) {
    errors.push({ field, message: `Must have at most ${MAX_LIST} values` });
    return undefined;
  }
  const invalid = items.filter((item) => !allowed.includes(item as T));
  if (invalid.length) {
    errors.push({ field, message: `Must be one of ${allowed.join(', ')}` });
    return undefined;
  }
  return items.length ? (items as T[]) : undefined;
}

function wholeNumber(query: Query, field: string, min: number, max: number, errors: FieldError[]): number | undefined {
  const value = single(query, field, errors);
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    errors.push({ field, message: `Must be a whole number between ${min} and ${max}` });
    return undefined;
  }
  return n;
}

function throwIfAny(errors: FieldError[]): void {
  if (errors.length) throw new ValidationError(errors);
}

/** Query of GET /api/jobs/search. Every filter is optional. */
export function parseSearchFilters(query: Query): JobSearchFilters {
  const errors: FieldError[] = [];
  const filters: JobSearchFilters = {
    query: text(query, 'query', errors),
    location: text(query, 'location', errors),
    employmentTypes: list(query, 'employmentTypes', EMPLOYMENT_TYPES, errors),
    arrangements: list(query, 'arrangements', WORK_ARRANGEMENTS, errors),
    experienceLevels: list(query, 'experienceLevels', EXPERIENCE_LEVELS, errors),
    minSalary: wholeNumber(query, 'minSalary', 0, 100_000_000, errors),
  };
  throwIfAny(errors);
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)) as JobSearchFilters;
}

/** `limit` of GET /api/recommendations. */
export function parseRecommendationLimit(query: Query): number {
  const errors: FieldError[] = [];
  const limit = wholeNumber(query, 'limit', 1, MAX_RECOMMENDATIONS, errors);
  throwIfAny(errors);
  return limit ?? DEFAULT_RECOMMENDATIONS;
}

export function parseJobId(value: unknown): string {
  if (typeof value !== 'string' || !JOB_ID_RE.test(value)) {
    throw new ValidationError([{ field: 'jobId', message: 'Must be a valid job id' }]);
  }
  return value;
}
