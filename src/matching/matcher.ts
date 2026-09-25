import { CandidateProfile, JobPosting } from '../types/domain.types';
import { MatchEvidence } from './matching.types';

export function evaluateJobFit(candidate: CandidateProfile, job: JobPosting): MatchEvidence {
  // TODO: implement the deterministic, structured matching algorithm.
  void candidate;
  void job;
  throw new Error('Not implemented: evaluateJobFit');
}
