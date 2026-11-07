import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env';
import { createExplanationAdapter } from '../src/app';
import { FallbackExplanationAdapter } from '../src/adapters/ai/fallback.adapter';
import { TemplateExplanationAdapter } from '../src/adapters/ai/template.adapter';

const KEYS = ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL'];

function withEnv(vars: Record<string, string>, fn: () => void) {
  const saved = KEYS.map((k) => [k, process.env[k]] as const);
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('AI_PROVIDER defaults to template', () => {
  withEnv({}, () => {
    const config = loadConfig();
    assert.equal(config.aiProvider, 'template');
    assert.equal(createExplanationAdapter(config) instanceof TemplateExplanationAdapter, true);
  });
});

test('AI_PROVIDER=gemini needs AI_API_KEY', () => {
  withEnv({ AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-x' }, () => {
    assert.throws(() => loadConfig(), /AI_API_KEY/);
  });
});

test('AI_PROVIDER=gemini needs AI_MODEL', () => {
  withEnv({ AI_PROVIDER: 'gemini', AI_API_KEY: 'k' }, () => {
    assert.throws(() => loadConfig(), /AI_MODEL/);
  });
});

test('AI_PROVIDER=gemini with key and model falls back to the template', () => {
  withEnv({ AI_PROVIDER: 'gemini', AI_API_KEY: 'k', AI_MODEL: 'gemini-x' }, () => {
    const config = loadConfig();
    assert.equal(config.aiProvider, 'gemini');
    assert.equal(config.aiApiKey, 'k');
    assert.equal(config.aiModel, 'gemini-x');
    assert.equal(createExplanationAdapter(config) instanceof FallbackExplanationAdapter, true);
  });
});

test('an unknown AI_PROVIDER is rejected', () => {
  withEnv({ AI_PROVIDER: 'other' }, () => {
    assert.throws(() => loadConfig(), /AI_PROVIDER/);
  });
});

test('AI_PROVIDER=rule-based (the Resume Preparation value) selects the template', () => {
  withEnv({ AI_PROVIDER: 'rule-based' }, () => {
    assert.equal(loadConfig().aiProvider, 'template');
  });
});

test('an empty AI_PROVIDER selects the template', () => {
  withEnv({ AI_PROVIDER: '' }, () => {
    assert.equal(loadConfig().aiProvider, 'template');
  });
});
