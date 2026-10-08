import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesFilters } from '../src/services/discovery.service';
import { experienceLevelFor } from '../src/types/domain.types';
import { parseRecommendationLimit, parseSearchFilters } from '../src/validation/discovery.validation';
import { ValidationError } from '../src/utils/errors';
import { job } from './fakes/fixtures';

test('parseSearchFilters parses comma lists and drops empty values', () => {
  assert.deepEqual(
    parseSearchFilters({ query: ' react ', location: '', employmentTypes: 'FULL_TIME, CONTRACT', experienceLevels: 'Entry level', minSalary: '30000' }),
    { query: 'react', employmentTypes: ['FULL_TIME', 'CONTRACT'], experienceLevels: ['Entry level'], minSalary: 30000 },
  );
  assert.deepEqual(parseSearchFilters({}), {});
});

test('parseSearchFilters rejects repeated params and unknown values', () => {
  assert.throws(() => parseSearchFilters({ query: ['a', 'b'] }), ValidationError);
  assert.throws(() => parseSearchFilters({ arrangements: 'OFFICE' }), ValidationError);
});

test('parseRecommendationLimit defaults to 6 and caps at 50', () => {
  assert.equal(parseRecommendationLimit({}), 6);
  assert.equal(parseRecommendationLimit({ limit: '3' }), 3);
  assert.throws(() => parseRecommendationLimit({ limit: '51' }), ValidationError);
});

test('experienceLevelFor uses the frontend bands', () => {
  assert.deepEqual([0, 1, 3, 5].map(experienceLevelFor), ['Internship', 'Entry level', 'Mid level', 'Senior']);
});

test('matchesFilters applies location, type, arrangement, level and salary', () => {
  const j = job();
  assert.ok(matchesFilters(j, {}));
  assert.ok(matchesFilters(j, { location: 'bangkok' }));
  assert.ok(!matchesFilters(j, { location: 'remote' }));
  assert.ok(matchesFilters(job({ workArrangement: 'REMOTE' }), { location: 'remote' }));
  assert.ok(!matchesFilters(j, { employmentTypes: ['CONTRACT'] }));
  assert.ok(!matchesFilters(j, { arrangements: ['ONSITE'] }));
  assert.ok(matchesFilters(j, { experienceLevels: ['Entry level'] }));
  assert.ok(!matchesFilters(j, { minSalary: 70000 }));
  // A hidden salary is never compared.
  assert.ok(matchesFilters(job({ salary: { minimum: 1, currency: 'THB', visible: false } }), { minSalary: 70000 }));
});
