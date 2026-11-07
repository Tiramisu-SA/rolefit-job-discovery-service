import type { AIModelAdapter, ExplainMatchInput, MatchExplanation } from './ai.types';
import type { GenerateJson } from './gemini.client';
import { assertGroundedExplanation } from './grounding';
import { experienceLevelFor } from '../../types/domain.types';

export const EXPLANATION_SCHEMA = {
  type: 'OBJECT',
  properties: { text: { type: 'STRING' } },
  required: ['text'],
};

const SYSTEM_INSTRUCTION = `You explain a job match to a job seeker.
Return JSON {"text": string}. 1-3 short sentences for a job seeker.
Mention strengths from matchedSkills and gaps from missingSkills. Do not mention any other skill. Do not invent facts.`;

/**
 * AI Model Adapter backed by Gemini. Only the evidence (skills and score
 * breakdown) and the job title/level are sent, never candidate personal data.
 * The answer must pass the grounding check; any failure throws so the caller
 * can fall back to the template adapter.
 */
export class GeminiExplanationAdapter implements AIModelAdapter {
  constructor(private readonly generate: GenerateJson) {}

  async explainMatch(input: ExplainMatchInput): Promise<MatchExplanation> {
    const { evidence, job } = input;
    const prompt = JSON.stringify({
      jobTitle: job.title,
      experienceLevel: experienceLevelFor(job.requirements.minimumExperienceYears),
      matchedSkills: evidence.matchedSkills,
      missingSkills: evidence.missingSkills,
      breakdown: evidence.breakdown,
    });
    const answer = await this.generate({ systemInstruction: SYSTEM_INSTRUCTION, prompt, schema: EXPLANATION_SCHEMA });
    const text = (answer as { text?: unknown } | null)?.text;
    if (typeof text !== 'string') throw new Error('Gemini answer has an invalid text');
    assertGroundedExplanation(text, input);
    return { text: text.trim() };
  }
}
