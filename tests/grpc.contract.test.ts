import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as grpc from '@grpc/grpc-js';
import { CandidateProfileClient } from '../src/grpc/candidate-profile.client';
import { loadProto } from '../src/grpc/grpc.utils';
import { JobPostingClient } from '../src/grpc/job-posting.client';
import { SEEKER } from './fakes/fixtures';

// Fake upstream servers built from the same .proto files (copied from the
// owning services). If a package, RPC or field name drifts, these fail.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Handlers = Record<string, (req: any) => any>;

async function serve(protoFile: string, servicePath: string[], handlers: Handlers): Promise<{ address: string; stop: () => void }> {
  let node: any = loadProto(protoFile);
  for (const key of servicePath) node = node[key];
  const server = new grpc.Server();
  const impl: grpc.UntypedServiceImplementation = {};
  for (const [name, fn] of Object.entries(handlers)) {
    impl[name] = (call: any, callback: any) => {
      try {
        callback(null, fn(call.request));
      } catch (error) {
        callback(error, null);
      }
    };
  }
  server.addService(node.service, impl);
  const port = await new Promise<number>((resolve, reject) =>
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (e, p) => (e ? reject(e) : resolve(p))),
  );
  return { address: `127.0.0.1:${port}`, stop: () => server.forceShutdown() };
}

const notFound = () => Object.assign(new Error('not found'), { code: grpc.status.NOT_FOUND, details: 'not found' });

test('CandidateProfileClient reads rolefit.candidateprofile.v1 GetProfile', async () => {
  const upstream = await serve('candidate-profile.proto', ['rolefit', 'candidateprofile', 'v1', 'CandidateProfileService'], {
    GetProfile: (req) => {
      if (req.candidate_id !== SEEKER) throw notFound();
      return {
        profile: {
          candidate_id: SEEKER,
          name: 'Ada',
          headline: '',
          location: 'Bangkok',
          total_experience_months: 30,
          skills: [{ name: 'React', proficiency_level: 'ADVANCED' }, { name: 'Go', proficiency_level: '' }],
          experience: [{ company_name: 'Acme', job_title: 'Dev', start_date: '2024-01-01', end_date: '', is_current: true, bullets: ['x'] }],
          education: [{ institution_name: 'KU', degree: 'BSc', field_of_study: '', gpa: 0, year: '2023' }],
          projects: [],
          preferences: { employment_types: ['FULL_TIME'], preferred_roles: [], work_arrangements: ['REMOTE'], preferred_locations: ['Bangkok'], minimum_salary: 0, salary_currency: '' },
          verified: true,
          updated_at: '2026-09-01T00:00:00.000Z',
        },
      };
    },
  });
  try {
    const client = new CandidateProfileClient(upstream.address, 2000);
    const p = await client.getProfile(SEEKER);
    assert.ok(p);
    assert.equal(p.name, 'Ada');
    assert.equal(p.headline, null);
    assert.equal(p.totalExperienceMonths, 30);
    assert.deepEqual(p.skills, [{ name: 'React', proficiencyLevel: 'ADVANCED' }, { name: 'Go', proficiencyLevel: null }]);
    assert.deepEqual(p.experience[0], { companyName: 'Acme', jobTitle: 'Dev', startDate: '2024-01-01', endDate: null, isCurrent: true, bullets: ['x'] });
    assert.deepEqual(p.education[0], { institutionName: 'KU', degree: 'BSc', fieldOfStudy: null, gpa: null, year: '2023' });
    assert.deepEqual(p.preferences?.workArrangements, ['REMOTE']);
    assert.equal(p.preferences?.minimumSalary, null);

    // No profile yet → null, not an error.
    assert.equal(await client.getProfile('22222222-2222-4222-8222-222222222222'), null);
  } finally {
    upstream.stop();
  }
});

const protoJob = (id: string) => ({
  id,
  title: 'Frontend Developer',
  status: 'JOB_STATUS_OPEN',
  recruiter_id: 'user_1',
  company_id: 'co-brightline',
  requirements: {
    required_skills: [{ name: 'React', level: 'SKILL_LEVEL_INTERMEDIATE', minimum_years: 1 }],
    minimum_experience_years: 2,
    education_level: 'EDUCATION_LEVEL_BACHELOR',
  },
  employment_type: 'EMPLOYMENT_TYPE_FULL_TIME',
  work_arrangement: 'WORK_ARRANGEMENT_UNSPECIFIED',
  location: { country: 'Thailand', province: 'Bangkok', district: '' },
  salary: { minimum: 40000, currency: 'THB', visible: true },
  application_settings: { positions_available: 0 },
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
});

test('JobPostingClient reads rolefit.jobposting.v1 GetJob / ListJobs', async () => {
  const requests: any[] = [];
  const total = 130;
  const upstream = await serve('job-posting.proto', ['rolefit', 'jobposting', 'v1', 'JobPostingService'], {
    GetJob: (req) => {
      if (req.job_id !== 'job_1') throw notFound();
      return { job: protoJob('job_1') };
    },
    ListJobs: (req) => {
      requests.push(req);
      const start = (req.page - 1) * req.limit;
      const count = Math.max(0, Math.min(req.limit, total - start));
      return { jobs: Array.from({ length: count }, (_, i) => protoJob(`job_${start + i}`)), total, page: req.page, limit: req.limit };
    },
  });
  try {
    const client = new JobPostingClient(upstream.address, 2000);
    const job = await client.getJob('job_1');
    assert.equal(job.status, 'OPEN');
    assert.deepEqual(job.requirements.requiredSkills, [{ name: 'React', level: 'INTERMEDIATE', minimumYears: 1 }]);
    assert.equal(job.requirements.educationLevel, 'BACHELOR');
    assert.equal(job.employmentType, 'FULL_TIME');
    assert.equal(job.workArrangement, undefined);
    assert.deepEqual(job.location, { country: 'Thailand', province: 'Bangkok' });
    assert.deepEqual(job.salary, { minimum: 40000, currency: 'THB', visible: true });
    assert.equal(job.applicationSettings.positionsAvailable, 1);

    await assert.rejects(client.getJob('job_missing'), { code: 'JOB_NOT_FOUND' });

    const jobs = await client.listOpenJobs('react');
    assert.equal(jobs.length, total);
    assert.deepEqual(
      requests.map((r) => [r.status, r.query, r.page, r.limit]),
      [
        ['JOB_STATUS_OPEN', 'react', 1, 100],
        ['JOB_STATUS_OPEN', 'react', 2, 100],
      ],
    );
  } finally {
    upstream.stop();
  }
});

test('an unreachable upstream → SERVICE_UNAVAILABLE', async () => {
  const client = new JobPostingClient('127.0.0.1:1', 500);
  await assert.rejects(client.listOpenJobs(), { code: 'SERVICE_UNAVAILABLE', httpStatus: 503 });
});
