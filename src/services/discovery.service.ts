import { AIModelAdapter } from '../adapters/ai/ai.types';
import { CandidateProfileClient } from '../grpc/candidate-profile.client';
import { JobPostingClient } from '../grpc/job-posting.client';
import { evaluateJobFit } from '../matching/matcher';
import { MatchEvidence } from '../matching/matching.types';
import { CandidateProfile, JobPosting, JobSearchCriteria } from '../types/domain.types';

export class DiscoveryService {
  constructor(
    private readonly candidateProfileClient: CandidateProfileClient,
    private readonly jobPostingClient: JobPostingClient,
    private readonly aiModelAdapter: AIModelAdapter,
  ) {}

  async searchJobs(criteria: JobSearchCriteria): Promise<JobPosting[]> {
    return this.jobPostingClient.listJobs(criteria);
  }

  async getRecommendations(candidateId: string): Promise<JobPosting[]> {
    // TODO: get the candidate, list jobs, evaluate each job, then rank recommendations.
    void candidateId;
    throw new Error('Not implemented: getRecommendations');
  }

  async evaluateJobFit(candidateId: string, jobId: string): Promise<MatchEvidence> {
    const [candidate, job] = await Promise.all([
      this.candidateProfileClient.getProfile(candidateId),
      this.jobPostingClient.getJob(jobId),
    ]);
    return evaluateJobFit(candidate, job);
  }

  async getMatchResult(candidateId: string, jobId: string): Promise<unknown> {
    // TODO: combine structured match evidence with AIModelAdapter.explainMatch(evidence).
    void candidateId;
    void jobId;
    void this.aiModelAdapter;
    throw new Error('Not implemented: getMatchResult');
  }

  async getCandidate(candidateId: string): Promise<CandidateProfile> {
    return this.candidateProfileClient.getProfile(candidateId);
  }
}
