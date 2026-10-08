import { MatchEvidence } from '../../matching/matching.types';
import { CandidateProfile, JobPosting } from '../../types/domain.types';

export interface MatchExplanation {
  text: string;
}

/** Context the adapter may use for wording. The evidence stays the source of truth. */
export interface ExplainMatchInput {
  evidence: MatchEvidence;
  job: JobPosting;
  candidate: CandidateProfile | null;
}

export interface AIModelAdapter {
  explainMatch(input: ExplainMatchInput): Promise<MatchExplanation>;
}
