import { logger } from '../../utils/logger';
import type { AIModelAdapter, ExplainMatchInput, MatchExplanation } from './ai.types';

/**
 * Tries the primary (LLM) adapter and uses the template adapter when it fails
 * (provider down, quota, malformed or ungrounded answer). Only the reason is
 * logged, never the explanation text.
 */
export class FallbackExplanationAdapter implements AIModelAdapter {
  constructor(
    private readonly primary: AIModelAdapter,
    private readonly fallback: AIModelAdapter,
  ) {}

  async explainMatch(input: ExplainMatchInput): Promise<MatchExplanation> {
    try {
      return await this.primary.explainMatch(input);
    } catch (err) {
      logger.warn('AI explanation failed, using the template adapter', { reason: err instanceof Error ? err.message : String(err) });
      return this.fallback.explainMatch(input);
    }
  }
}
