import { CandidateProfile, JobPosting } from '../types/domain.types';

export interface MatchEvidence {
  candidateId: string;
  jobId: string;
  score?: number;
  matchedRequirements: string[];
  missingRequirements: string[];
  details?: Record<string, unknown>;
}

export type MatchInput = {
  candidate: CandidateProfile;
  job: JobPosting;
};
