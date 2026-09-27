import { AIModelAdapter } from '../adapters/ai/ai.types';
import { evaluateJobFit } from '../matching/matcher';
import { MatchEvidence } from '../matching/matching.types';
import { CandidateProfile, JobPosting, JobSearchCriteria } from '../types/domain.types';

export interface CandidateProfileGateway {
  getProfile(candidateId: string): Promise<CandidateProfile>;
}

export interface JobPostingGateway {
  getJob(jobId: string, accessToken: string): Promise<JobPosting>;
  listJobs(criteria: JobSearchCriteria, accessToken: string): Promise<JobPosting[]>;
}

export class DiscoveryService {
  constructor(
    private readonly candidateProfileClient: CandidateProfileGateway,
    private readonly jobPostingClient: JobPostingGateway,
    private readonly aiModelAdapter: AIModelAdapter,
  ) {}

  async searchJobs(criteria: JobSearchCriteria, accessToken: string): Promise<JobPosting[]> {
    return this.jobPostingClient.listJobs(criteria, accessToken);
  }

  async getRecommendations(candidateId: string, accessToken: string): Promise<JobPosting[]> {
    // TODO: get the candidate, list jobs, evaluate each job, then rank recommendations.
    void candidateId;
    void accessToken;
    throw new Error('Not implemented: getRecommendations');
  }

  async evaluateJobFit(candidateId: string, jobId: string, accessToken: string): Promise<MatchEvidence> {
    const [candidate, job] = await Promise.all([
      this.candidateProfileClient.getProfile(candidateId),
      this.jobPostingClient.getJob(jobId, accessToken),
    ]);
    return evaluateJobFit(candidate, job);
  }

  async getMatchResult(candidateId: string, jobId: string, accessToken: string): Promise<unknown> {
    // TODO: combine structured match evidence with AIModelAdapter.explainMatch(evidence).
    void candidateId;
    void jobId;
    void accessToken;
    void this.aiModelAdapter;
    throw new Error('Not implemented: getMatchResult');
  }

  async getCandidate(candidateId: string): Promise<CandidateProfile> {
    return this.candidateProfileClient.getProfile(candidateId);
  }
}
