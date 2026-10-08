import { CandidateProfile, JobPosting } from '../types/domain.types';

/** Per-area scores, each 0-100. */
export interface MatchBreakdown {
  skills: number;
  experience: number;
  education: number;
  preferences: number;
}

/**
 * Deterministic output of the matcher: everything except the natural-language
 * explanation. The score is final; the AI adapter may only describe it.
 */
export interface MatchEvidence {
  jobId: string;
  candidateId: string;
  /** 0-100 */
  score: number;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  gaps: string[];
}

/** What the API returns (same shape as the frontend's MatchResult). */
export interface MatchResult extends MatchEvidence {
  /** Empty in list responses (search, recommendations); filled for a single job. */
  explanation: string;
  /** ISO-8601 */
  computedAt: string;
}

export interface JobWithMatch extends JobPosting {
  match: MatchResult;
}

/** A missing profile (seeker has not created one) is matched as an empty one. */
export type MatchInput = {
  candidate: CandidateProfile | null;
  job: JobPosting;
};
