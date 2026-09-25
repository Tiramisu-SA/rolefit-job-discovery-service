import { MatchEvidence } from '../../matching/matching.types';

export interface MatchExplanation {
  text: string;
}

export interface AIModelAdapter {
  explainMatch(evidence: MatchEvidence): Promise<MatchExplanation>;
}
