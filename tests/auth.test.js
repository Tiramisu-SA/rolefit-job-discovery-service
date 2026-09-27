const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../dist/app.js');
const { JobPostingClient } = require('../dist/grpc/job-posting.client.js');

const USER = '11111111-1111-4111-8111-111111111111';

async function withApi(run) {
  const forwarded = [];
  const { app } = createApp({
    verifyClaims: async (token) => token === 'valid-token' ? { sub: USER } : null,
    candidateProfileClient: { getProfile: async (candidateId) => ({ candidateId }) },
    jobPostingClient: {
      listJobs: async (criteria, accessToken) => {
        forwarded.push({ criteria, accessToken });
        return [];
      },
      getJob: async (_jobId, accessToken) => {
        forwarded.push({ accessToken });
        return {};
      },
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, options = {}) => fetch(`${base}${path}`, {
    method,
    headers: options.headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  try {
    await run(call, forwarded);
  } finally {
    server.close();
  }
}

test('health is public; /api rejects missing, malformed, and invalid bearer tokens', async () => {
  await withApi(async (call) => {
    assert.equal((await call('GET', '/health')).status, 200);
    assert.equal((await call('GET', '/api/jobs/search')).status, 401);
    assert.equal((await call('GET', '/api/jobs/search', { headers: { authorization: 'Bearer token with spaces' } })).status, 401);
    assert.equal((await call('GET', '/api/jobs/search', { headers: { authorization: 'Bearer expired-token' } })).status, 401);
    assert.equal((await call('GET', '/api/jobs/search', { headers: { 'x-user-id': USER } })).status, 401);
  });
});

test('candidate-scoped routes reject a candidateId that differs from JWT sub', async () => {
  await withApi(async (call) => {
    const headers = { authorization: 'Bearer valid-token', 'content-type': 'application/json' };
    assert.equal((await call('GET', '/api/recommendations?candidateId=someone-else', { headers })).status, 403);
    assert.equal((await call('POST', '/api/job-fit/evaluate', {
      headers,
      body: { candidateId: 'someone-else', jobId: 'job-1' },
    })).status, 403);
    assert.equal((await call('GET', '/api/job-fit/someone-else/job-1', { headers })).status, 403);
  });
});

test('search forwards the exact verified bearer token to Job Posting', async () => {
  await withApi(async (call, forwarded) => {
    const response = await call('GET', '/api/jobs/search?query=typescript', {
      headers: { authorization: 'Bearer valid-token' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(forwarded, [{ criteria: { query: 'typescript', skills: [] }, accessToken: 'valid-token' }]);
  });
});

test('Job Posting gRPC client adds bearer authorization metadata', async () => {
  let metadataSeen;
  const rpcClient = {
    listJobs(_request, metadata, callback) {
      metadataSeen = metadata;
      callback(null, { jobs: [] });
    },
    getJob(_request, metadata, callback) {
      metadataSeen = metadata;
      callback(null, { job_id: 'job-1', title: 'Engineer' });
    },
  };
  const client = new JobPostingClient('unused:50052', rpcClient);
  await client.listJobs({}, 'valid-token');
  assert.deepEqual(metadataSeen.get('authorization'), ['Bearer valid-token']);
  await client.getJob('job-1', 'valid-token');
  assert.deepEqual(metadataSeen.get('authorization'), ['Bearer valid-token']);
});
