import { AIModelAdapter, ExplainMatchInput, MatchExplanation } from './ai.types';

/**
 * Deterministic stand-in for the AI adapter: builds the explanation from the
 * evidence with a fixed template (the same text as the frontend mock). Used
 * until an LLM-backed adapter replaces it (TODO 8).
 */
export class TemplateExplanationAdapter implements AIModelAdapter {
  async explainMatch({ evidence }: ExplainMatchInput): Promise<MatchExplanation> {
    const { matchedSkills, missingSkills, breakdown } = evidence;
    const required = matchedSkills.length + missingSkills.length;
    const text =
      `You meet ${matchedSkills.length} of ${required} required skills` +
      (matchedSkills.length ? `, including ${matchedSkills.slice(0, 2).join(' and ')}` : '') +
      '. ' +
      (breakdown.experience >= 100
        ? 'Your experience meets the level this role asks for. '
        : 'Your experience is below the level this role asks for. ') +
      (missingSkills.length ? `The main gap is ${missingSkills[0]}.` : 'There are no missing required skills.');
    return { text };
  }
}
