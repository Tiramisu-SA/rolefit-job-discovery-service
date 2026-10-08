import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TemplateExplanationAdapter } from '../src/adapters/ai/template.adapter';
import { evaluateJobFit } from '../src/matching/matcher';
import type { CandidatePreferences, CandidateProfile, JobPosting } from '../src/types/domain.types';
import { job as baseJob } from './fakes/fixtures';

// Moved here from the frontend's former src/lib/match.test.ts.

function job(overrides: Partial<JobPosting> = {}): JobPosting {
  return baseJob({
    id: 'job_1',
    requirements: {
      requiredSkills: [
        { name: 'Python', level: 'BASIC', minimumYears: 0 },
        { name: 'PostgreSQL', level: 'BASIC', minimumYears: 0 },
      ],
      preferredSkills: [],
      minimumExperienceYears: 2,
      educationLevel: 'BACHELOR',
      acceptedFields: [],
    },
    employmentType: 'FULL_TIME',
    workArrangement: 'HYBRID',
    location: { country: 'Thailand', province: 'Bangkok' },
    ...overrides,
  });
}

const PREFS: CandidatePreferences = {
  employmentTypes: ['FULL_TIME'],
  preferredRoles: [],
  workArrangements: ['HYBRID'],
  preferredLocations: ['bangkok'],
  minimumSalary: null,
  salaryCurrency: null,
};

function profile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    id: 'p1',
    name: 'Pim',
    headline: null,
    location: null,
    verified: true,
    totalExperienceMonths: 24,
    skills: [
      { name: 'python', proficiencyLevel: null },
      { name: 'Go', proficiencyLevel: null },
    ],
    experience: [],
    education: [{ institutionName: 'CU', degree: 'B.Eng.', fieldOfStudy: null, gpa: null, year: null }],
    projects: [],
    preferences: PREFS,
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

const explain = async (candidate: CandidateProfile | null, j: JobPosting) =>
  (await new TemplateExplanationAdapter().explainMatch({ evidence: evaluateJobFit(candidate, j), job: j, candidate })).text;

test('matches required skills ignoring case', () => {
  const m = evaluateJobFit(profile(), job());
  assert.deepEqual(m.matchedSkills, ['Python']);
  assert.deepEqual(m.missingSkills, ['PostgreSQL']);
  assert.equal(m.breakdown.skills, 50);
});

test('compares experience months with the required years', () => {
  assert.equal(evaluateJobFit(profile({ totalExperienceMonths: 24 }), job()).breakdown.experience, 100);
  assert.equal(evaluateJobFit(profile({ totalExperienceMonths: 12 }), job()).breakdown.experience, 50);
  const noYearsNeeded = job({ requirements: { ...job().requirements, minimumExperienceYears: 0 } });
  assert.equal(evaluateJobFit(profile({ totalExperienceMonths: 0 }), noYearsNeeded).breakdown.experience, 100);
});

test('scores education 100 with any education and 50 without', () => {
  assert.equal(evaluateJobFit(profile(), job()).breakdown.education, 100);
  assert.equal(evaluateJobFit(profile({ education: [] }), job()).breakdown.education, 50);
});

test('gives preference points for arrangement (40), location (30) and employment type (30)', () => {
  assert.equal(evaluateJobFit(profile(), job()).breakdown.preferences, 100);
  assert.equal(evaluateJobFit(profile(), job({ workArrangement: 'ONSITE' })).breakdown.preferences, 60);
  assert.equal(evaluateJobFit(profile(), job({ location: { province: 'Chiang Mai' } })).breakdown.preferences, 70);
  assert.equal(evaluateJobFit(profile(), job({ employmentType: 'CONTRACT' })).breakdown.preferences, 70);
  // A remote job counts as matching any location.
  const remote = job({ workArrangement: 'REMOTE', location: { province: 'Chiang Mai' } });
  assert.equal(evaluateJobFit(profile({ preferences: { ...PREFS, workArrangements: ['REMOTE'] } }), remote).breakdown.preferences, 100);
  assert.equal(evaluateJobFit(profile({ preferences: null }), job()).breakdown.preferences, 0);
});

test('weights the parts 50 / 25 / 10 / 15', () => {
  // skills 50, experience 100, education 100, preferences 100
  assert.equal(evaluateJobFit(profile(), job()).score, Math.round(50 * 0.5 + 100 * 0.25 + 100 * 0.1 + 100 * 0.15));
});

test('works without a profile and gives a low score', () => {
  const m = evaluateJobFit(null, job());
  assert.ok(m.score < 30);
  assert.deepEqual(m.missingSkills, ['Python', 'PostgreSQL']);
});

test('lists strengths and gaps', () => {
  const m = evaluateJobFit(profile({ totalExperienceMonths: 12 }), job());
  assert.deepEqual(m.strengths, ['Python in your profile', 'Location and work arrangement match your preferences']);
  assert.deepEqual(m.gaps, ['PostgreSQL is required but not in your profile', 'The role asks for about 2+ years; your profile shows 1']);
});

test('treats a job with no required skills as a full skills match', async () => {
  const j = job({ requirements: { ...job().requirements, requiredSkills: [] } });
  assert.equal(evaluateJobFit(profile(), j).breakdown.skills, 100);
  assert.match(await explain(profile(), j), /no missing required skills/);
});

test('the template explanation describes the evidence', async () => {
  assert.equal(
    await explain(profile(), job()),
    'You meet 1 of 2 required skills, including Python. Your experience meets the level this role asks for. The main gap is PostgreSQL.',
  );
});
