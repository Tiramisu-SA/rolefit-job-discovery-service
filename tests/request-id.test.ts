import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import * as grpc from '@grpc/grpc-js';
import { buildApp, type AppDependencies } from '../src/app';
import { TemplateExplanationAdapter } from '../src/adapters/ai/template.adapter';
import { CandidateProfileClient } from '../src/grpc/candidate-profile.client';
import { loadProto } from '../src/grpc/grpc.utils';
import { JobPostingClient, type JobPostingReader } from '../src/grpc/job-posting.client';
import { logger } from '../src/utils/logger';
import { withCapturedLogs } from './fakes/capture-logs';
import { fakeJobs, fakeProfiles, SEEKER } from './fakes/fixtures';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const seeker = { 'X-User-Id': SEEKER };

async function withApi(fn: (base: string) => Promise<void>, overrides: Partial<AppDependencies> = {}) {
  const app = buildApp({
    candidateProfile: fakeProfiles(),
    jobPosting: fakeJobs(),
    aiModelAdapter: new TemplateExplanationAdapter(),
    corsOrigin: 'http://localhost:3000',
    ...overrides,
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

/** A real gRPC server from the service's .proto file that records the request id of every call. */
async function recordingUpstream(
  protoFile: string,
  servicePath: string[],
  method: string,
  respond: (callback: grpc.sendUnaryData<unknown>) => void,
): Promise<{ address: string; seen: unknown[]; stop: () => void }> {
  let node: any = loadProto(protoFile); // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const key of servicePath) node = node[key];
  const seen: unknown[] = [];
  const server = new grpc.Server();
  server.addService(node.service, {
    [method]: (call: grpc.ServerUnaryCall<unknown, unknown>, callback: grpc.sendUnaryData<unknown>) => {
      seen.push(call.metadata.get('x-request-id')[0]);
      respond(callback);
    },
  });
  const port = await new Promise<number>((resolve, reject) =>
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (e, p) => (e ? reject(e) : resolve(p))),
  );
  return { address: `127.0.0.1:${port}`, seen, stop: () => server.forceShutdown() };
}

test('a request logs one JSON line with its id, method, path, status and duration', async () => {
  await withCapturedLogs(async (logs) => {
    await withApi(async (base) => {
      const res = await fetch(`${base}/api/recommendations?limit=1`, { headers: { ...seeker, 'X-Request-Id': 'req-abc_1.2' } });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-request-id'), 'req-abc_1.2');

      const line = await logs.waitFor((l) => l.path === '/api/recommendations');
      assert.equal(line.requestId, 'req-abc_1.2');
      assert.equal(line.service, 'job-discovery');
      assert.equal(line.level, 'info');
      assert.equal(line.method, 'GET');
      assert.equal(line.status, 200);
      assert.equal(typeof line.durationMs, 'number');
    });
  });
});

test('a rejected request is logged too, with its id and status', async () => {
  await withCapturedLogs(async (logs) => {
    await withApi(async (base) => {
      const res = await fetch(`${base}/api/recommendations`, { headers: { 'X-Request-Id': 'req-no-identity' } });
      assert.equal(res.status, 401);
      const line = await logs.waitFor((l) => l.requestId === 'req-no-identity' && l.path === '/api/recommendations');
      assert.equal(line.status, 401);
    });
  });
});

test('a missing or unsafe incoming id is replaced with a generated one', async () => {
  await withCapturedLogs(async (logs) => {
    await withApi(async (base) => {
      for (const incoming of [undefined, 'has spaces', '<script>', 'x'.repeat(129)]) {
        const headers: Record<string, string> = { ...seeker, ...(incoming ? { 'X-Request-Id': incoming } : {}) };
        const res = await fetch(`${base}/api/recommendations`, { headers });
        const id = res.headers.get('x-request-id') ?? '';
        assert.match(id, UUID, `incoming: ${incoming}`);
        await logs.waitFor((l) => l.requestId === id && l.path === '/api/recommendations');
      }
    });
  });
});

test('the id reaches both gRPC upstreams', async () => {
  const profiles = await recordingUpstream('candidate-profile.proto', ['rolefit', 'candidateprofile', 'v1', 'CandidateProfileService'], 'GetProfile', (cb) =>
    cb({ code: grpc.status.NOT_FOUND, details: 'no profile' }),
  );
  const jobs = await recordingUpstream('job-posting.proto', ['rolefit', 'jobposting', 'v1', 'JobPostingService'], 'ListJobs', (cb) =>
    cb(null, { jobs: [], total: 0, page: 1, limit: 100 }),
  );
  try {
    await withCapturedLogs(async () => {
      await withApi(
        async (base) => {
          const res = await fetch(`${base}/api/recommendations`, { headers: { ...seeker, 'X-Request-Id': 'req-hop-2' } });
          assert.equal(res.status, 200);
        },
        {
          candidateProfile: new CandidateProfileClient(profiles.address, 2000),
          jobPosting: new JobPostingClient(jobs.address, 2000),
        },
      );
    });
    assert.deepEqual(profiles.seen, ['req-hop-2']);
    assert.deepEqual(jobs.seen, ['req-hop-2']);
  } finally {
    profiles.stop();
    jobs.stop();
  }
});

test('an unexpected error is logged with the id of the request that caused it, even when requests overlap', async () => {
  const failing: JobPostingReader = {
    getJob: async () => {
      throw new Error('not used');
    },
    listOpenJobs: async (query = '') => {
      await new Promise((resolve) => setTimeout(resolve, query === 'slow' ? 40 : 5));
      throw new Error(`boom-${query}`);
    },
  };
  await withCapturedLogs(async (logs) => {
    await withApi(
      async (base) => {
        const search = (query: string) => fetch(`${base}/api/jobs/search?query=${query}`, { headers: { ...seeker, 'X-Request-Id': `req-${query}` } });
        const [slow, fast] = await Promise.all([search('slow'), search('fast')]);
        assert.equal(slow.status, 500);
        assert.equal(fast.status, 500);

        const errorOf = (message: string) => logs.waitFor((l) => l.level === 'error' && (l.error as { message?: string } | undefined)?.message === message);
        assert.equal((await errorOf('boom-slow')).requestId, 'req-slow');
        assert.equal((await errorOf('boom-fast')).requestId, 'req-fast');
      },
      { jobPosting: failing },
    );
  });
});

test('an unreachable upstream is logged with the request id and the upstream name', async () => {
  await withCapturedLogs(async (logs) => {
    await withApi(
      async (base) => {
        const res = await fetch(`${base}/api/recommendations`, { headers: { ...seeker, 'X-Request-Id': 'req-down' } });
        assert.equal(res.status, 503);
        const line = await logs.waitFor((l) => l.requestId === 'req-down' && l.level === 'error');
        assert.equal(line.upstream, 'job');
        assert.equal(line.message, 'job service is unavailable');
      },
      { jobPosting: new JobPostingClient('127.0.0.1:1', 1000) },
    );
  });
});

test('health checks are not logged, so polling does not bury real requests', async () => {
  await withCapturedLogs(async (logs) => {
    await withApi(async (base) => {
      await fetch(`${base}/health`);
      await fetch(`${base}/api/recommendations`, { headers: seeker });
      await logs.waitFor((l) => l.path === '/api/recommendations');
      assert.equal(logs.lines().filter((l) => l.path === '/health').length, 0);
    });
  });
});

test('the logger writes an Error as JSON instead of an empty object', async () => {
  await withCapturedLogs(async (logs) => {
    logger.error('It failed', new TypeError('bad input'));
    const line = await logs.waitFor((l) => l.message === 'It failed');
    const error = line.error as { name: string; message: string; stack: string };
    assert.equal(error.name, 'TypeError');
    assert.equal(error.message, 'bad input');
    assert.match(error.stack, /request-id\.test/);
  });
});

test('the logger never throws on a value JSON cannot represent', async () => {
  await withCapturedLogs(async (logs) => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    logger.error('Circular detail', circular);
    logger.error('BigInt detail', { size: 10n });
    await logs.waitFor((l) => l.message === 'Circular detail');
    await logs.waitFor((l) => l.message === 'BigInt detail');
  });
});
