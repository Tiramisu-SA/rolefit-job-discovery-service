import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FallbackExplanationAdapter } from '../src/adapters/ai/fallback.adapter';
import { GeminiExplanationAdapter } from '../src/adapters/ai/gemini.adapter';
import { assertGroundedExplanation } from '../src/adapters/ai/grounding';
import type { AIModelAdapter, ExplainMatchInput } from '../src/adapters/ai/ai.types';
import { TemplateExplanationAdapter } from '../src/adapters/ai/template.adapter';
import { job, profile } from './fakes/fixtures';

const base = job();
const input: ExplainMatchInput = {
  job: {
    ...base,
    requirements: {
      ...base.requirements,
      requiredSkills: [
        { name: 'TypeScript', level: 'INTERMEDIATE', minimumYears: 1 },
        { name: 'Node.js', level: 'INTERMEDIATE', minimumYears: 1 },
        { name: 'Docker', level: 'BASIC', minimumYears: 0 },
      ],
      preferredSkills: [{ name: 'Kubernetes', level: 'BASIC' }],
    },
  },
  candidate: { ...profile, skills: [{ name: 'TypeScript', proficiencyLevel: 'ADVANCED' }, { name: 'Node.js', proficiencyLevel: 'ADVANCED' }] },
  evidence: {
    jobId: base.id,
    candidateId: profile.id,
    score: 70,
    breakdown: { skills: 66, experience: 100, education: 100, preferences: 50 },
    matchedSkills: ['TypeScript', 'Node.js'],
    missingSkills: ['Docker'],
    strengths: [],
    gaps: [],
  },
};

const GOOD = 'You meet 2 of 3 required skills, including TypeScript and Node.js. The main gap is Docker.';
const client = (answer: unknown) => async () => answer;

test('returns the model text when it only names evidence skills', async () => {
  const adapter = new GeminiExplanationAdapter(client({ text: GOOD }));
  assert.deepEqual(await adapter.explainMatch(input), { text: GOOD });
});

test('assertGroundedExplanation rejects a skill outside the evidence', () => {
  assert.throws(() => assertGroundedExplanation('You also know Kubernetes well.', input), /outside the evidence/);
  assert.doesNotThrow(() => assertGroundedExplanation(GOOD, input));
});

test('adapter throws on an ungrounded answer', async () => {
  const adapter = new GeminiExplanationAdapter(client({ text: 'Great fit, Kubernetes is a plus.' }));
  await assert.rejects(adapter.explainMatch(input));
});

test('adapter throws on an invalid answer shape', async () => {
  await assert.rejects(new GeminiExplanationAdapter(client('not json')).explainMatch(input));
  await assert.rejects(new GeminiExplanationAdapter(client({ text: 5 })).explainMatch(input));
});

test('adapter throws on empty or too long text', async () => {
  await assert.rejects(new GeminiExplanationAdapter(client({ text: '   ' })).explainMatch(input));
  await assert.rejects(new GeminiExplanationAdapter(client({ text: 'a'.repeat(601) })).explainMatch(input));
});

test('prompt carries evidence but no candidate personal data', async () => {
  let prompt = '';
  const adapter = new GeminiExplanationAdapter(async (r) => {
    prompt = r.prompt;
    return { text: GOOD };
  });
  await adapter.explainMatch(input);
  assert.match(prompt, /Docker/);
  assert.doesNotMatch(prompt, new RegExp(profile.name));
});

test('fallback adapter returns the template text when the primary throws', async () => {
  const failing: AIModelAdapter = { explainMatch: async () => { throw new Error('quota'); } };
  const template = new TemplateExplanationAdapter();
  const result = await new FallbackExplanationAdapter(failing, template).explainMatch(input);
  assert.deepEqual(result, await template.explainMatch(input));
});

test('fallback adapter passes through the primary result when it works', async () => {
  const primary = new GeminiExplanationAdapter(client({ text: GOOD }));
  const result = await new FallbackExplanationAdapter(primary, new TemplateExplanationAdapter()).explainMatch(input);
  assert.equal(result.text, GOOD);
});

test('assertGroundedExplanation catches an ungrounded skill at the end of a sentence', () => {
  assert.throws(() => assertGroundedExplanation('Great fit, plus Kubernetes.', input), /outside the evidence/);
  assert.throws(() => assertGroundedExplanation('The main gap is Kubernetes. Keep learning.', input), /outside the evidence/);
  assert.doesNotThrow(() => assertGroundedExplanation('You know Node.js.', input));
});

test('assertGroundedExplanation does not match a skill inside a longer name', () => {
  const withNode = { ...input, candidate: null, evidence: { ...input.evidence, matchedSkills: ['TypeScript'] } };
  const nodeOnly = { ...withNode, job: { ...input.job, requirements: { ...input.job.requirements, requiredSkills: [{ name: 'Node', level: 'BASIC' as const, minimumYears: 0 }] } } };
  assert.doesNotThrow(() => assertGroundedExplanation('You know Node.js well.', nodeOnly));
});
