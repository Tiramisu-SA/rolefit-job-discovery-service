import { AIModelAdapter, MatchExplanation } from './ai.types';
import { MatchEvidence } from '../../matching/matching.types';

export class UnimplementedAIModelAdapter implements AIModelAdapter {
  async explainMatch(evidence: MatchEvidence): Promise<MatchExplanation> {
    // TODO: connect an approved provider and generate language from evidence only.
    void evidence;
    throw new Error('Not implemented: AIModelAdapter.explainMatch');
  }
}
