import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/app';
import { TemplateExplanationAdapter } from '../src/adapters/ai/template.adapter';
import type { JobPostingReader } from '../src/grpc/job-posting.client';
import type { CandidateProfileReader } from '../src/grpc/candidate-profile.client';
import { downJobs, fakeJobs, fakeProfiles, job, SEEKER } from './fakes/fixtures';

const ORIGIN = 'http://localhost:3000';

async function withApi(
  fn: (get: (path: string, headers?: Record<string, string>, method?: string) => Promise<Response>) => Promise<void>,
  jobPosting: JobPostingReader = fakeJobs(),
  candidateProfile: CandidateProfileReader = fakeProfiles(),
) {
  const app = buildApp({
    candidateProfile,
    jobPosting,
    aiModelAdapter: new TemplateExplanationAdapter(),
    corsOrigin: ORIGIN,
  });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await fn((path, headers = { 'X-User-Id': SEEKER }, method = 'GET') => fetch(base + path, { method, headers }));
  } finally {
    server.close();
  }
}

const errorOf = async (res: Response) => ((await res.json()) as { error: { code: string; details?: { field: string }[] } }).error;

test('GET /health needs no identity', async () => {
  await withApi(async (get) => {
    const res = await get('/health', {});
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', service: 'job-discovery-service' });
  });
});

test('CORS preflight allows the frontend origin and X-User-Id', async () => {
  await withApi(async (get) => {
    const res = await get('/api/jobs/search', {}, 'OPTIONS');
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.match(res.headers.get('access-control-allow-headers') ?? '', /X-User-Id/);
  });
});

test('API routes require a UUID X-User-Id', async () => {
  await withApi(async (get) => {
    for (const headers of [{}, { 'X-User-Id': 'not-a-uuid' }]) {
      const res = await get('/api/recommendations', headers);
      assert.equal(res.status, 401);
      assert.equal((await errorOf(res)).code, 'UNAUTHENTICATED');
    }
  });
});

test('search rejects unknown filter values with field details', async () => {
  await withApi(async (get) => {
    const res = await get('/api/jobs/search?employmentTypes=FULL_TIME,FREELANCE&minSalary=-5&experienceLevels=Senior');
    assert.equal(res.status, 400);
    const error = await errorOf(res);
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.deepEqual(error.details?.map((d) => d.field), ['employmentTypes', 'minSalary']);
  });
});

test('recommendations rejects an out-of-range limit', async () => {
  await withApi(async (get) => {
    const res = await get('/api/recommendations?limit=0');
    assert.equal(res.status, 400);
  });
});

const JOBS = [
  job({ id: 'job_go', title: 'Go Developer', requirements: { ...job().requirements, requiredSkills: [{ name: 'Go', level: 'BASIC', minimumYears: 0 }] } }),
  job({ id: 'job_react', employmentType: 'CONTRACT' }),
  job({ id: 'job_senior', requirements: { ...job().requirements, minimumExperienceYears: 6 } }),
];

test('search filters, matches and sorts best match first', async () => {
  await withApi(async (get) => {
    const res = await get('/api/jobs/search?experienceLevels=Entry%20level,Senior');
    assert.equal(res.status, 200);
    const { jobs } = (await res.json()) as { jobs: { id: string; match: { score: number; candidateId: string; explanation: string } }[] };
    assert.deepEqual(jobs.map((j) => j.id), ['job_react', 'job_senior', 'job_go']);
    assert.ok(jobs[0].match.score >= jobs[1].match.score && jobs[1].match.score >= jobs[2].match.score);
    assert.equal(jobs[0].match.candidateId, SEEKER);
    assert.equal(jobs[0].match.explanation, '');

    const filtered = (await (await get('/api/jobs/search?employmentTypes=CONTRACT')).json()) as { jobs: { id: string }[] };
    assert.deepEqual(filtered.jobs.map((j) => j.id), ['job_react']);
  }, fakeJobs(JOBS));
});

test('recommendations return the top `limit` matches', async () => {
  await withApi(async (get) => {
    const { jobs } = (await (await get('/api/recommendations?limit=2')).json()) as { jobs: { id: string }[] };
    assert.deepEqual(jobs.map((j) => j.id), ['job_react', 'job_senior']);
  }, fakeJobs(JOBS));
});

test('fit returns the job with an explained match; match returns the same match', async () => {
  await withApi(async (get) => {
    const fit = (await (await get('/api/jobs/job_react/fit')).json()) as { id: string; title: string; match: Record<string, unknown> };
    assert.equal(fit.id, 'job_react');
    assert.equal(fit.title, 'Frontend Developer');
    assert.deepEqual(fit.match.matchedSkills, ['React']);
    assert.match(String(fit.match.explanation), /^You meet 1 of 1 required skills/);

    const match = (await (await get('/api/jobs/job_react/match')).json()) as Record<string, unknown>;
    const { computedAt: _a, ...rest } = match;
    const { computedAt: _b, ...fitRest } = fit.match;
    assert.deepEqual(rest, fitRest);
  }, fakeJobs(JOBS));
});

test('a seeker without a profile still gets matches (as an empty profile)', async () => {
  await withApi(async (get) => {
    const res = await get('/api/jobs/job_react/match');
    assert.equal(res.status, 200);
    const match = (await res.json()) as { missingSkills: string[]; candidateId: string; breakdown: { preferences: number } };
    assert.deepEqual(match.missingSkills, ['React']);
    assert.equal(match.candidateId, SEEKER);
    assert.equal(match.breakdown.preferences, 0);
  }, fakeJobs(JOBS), fakeProfiles(null));
});

test('unknown job → 404 JOB_NOT_FOUND; malformed job id → 400', async () => {
  await withApi(async (get) => {
    const missing = await get('/api/jobs/job_nope/fit');
    assert.equal(missing.status, 404);
    assert.equal((await errorOf(missing)).code, 'JOB_NOT_FOUND');
    const bad = await get('/api/jobs/bad%20id/match');
    assert.equal(bad.status, 400);
  });
});

test('an upstream outage → 503 SERVICE_UNAVAILABLE', async () => {
  await withApi(async (get) => {
    const res = await get('/api/recommendations');
    assert.equal(res.status, 503);
    assert.equal((await errorOf(res)).code, 'SERVICE_UNAVAILABLE');
  }, downJobs);
});

test('unknown routes → 404 ROUTE_NOT_FOUND', async () => {
  await withApi(async (get) => {
    const res = await get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal((await errorOf(res)).code, 'ROUTE_NOT_FOUND');
  });
});
