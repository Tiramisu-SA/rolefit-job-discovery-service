import { AIModelAdapter, ExplainMatchInput, MatchExplanation } from './ai.types';
import { NotImplementedError } from '../../utils/errors';

export class UnimplementedAIModelAdapter implements AIModelAdapter {
  async explainMatch(input: ExplainMatchInput): Promise<MatchExplanation> {
    // TODO: connect an approved provider and generate language from evidence only.
    void input;
    throw new NotImplementedError('AIModelAdapter.explainMatch');
  }
}
