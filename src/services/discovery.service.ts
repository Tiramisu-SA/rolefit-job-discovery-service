import { AIModelAdapter } from '../adapters/ai/ai.types';
import { CandidateProfileReader } from '../grpc/candidate-profile.client';
import { JobPostingReader } from '../grpc/job-posting.client';
import { evaluateJobFit } from '../matching/matcher';
import { JobWithMatch, MatchResult } from '../matching/matching.types';
import { CandidateProfile, experienceLevelFor, JobPosting, JobSearchFilters } from '../types/domain.types';

function formatLocation(location: JobPosting['location']): string {
  return [location.district, location.province, location.country].filter(Boolean).join(', ');
}

/**
 * Filters the Job Posting Service can't apply. `query` is sent upstream
 * (matches title or required skill names), so it is not re-checked here.
 */
export function matchesFilters(job: JobPosting, filters: JobSearchFilters): boolean {
  const loc = filters.location?.toLowerCase();
  if (loc && !(formatLocation(job.location).toLowerCase().includes(loc) || (loc === 'remote' && job.workArrangement === 'REMOTE'))) {
    return false;
  }
  if (filters.employmentTypes && !(job.employmentType && filters.employmentTypes.includes(job.employmentType))) return false;
  if (filters.arrangements && !(job.workArrangement && filters.arrangements.includes(job.workArrangement))) return false;
  if (filters.experienceLevels && !filters.experienceLevels.includes(experienceLevelFor(job.requirements.minimumExperienceYears))) {
    return false;
  }
  // A hidden salary is not compared, so it can't be guessed from filter results.
  if (filters.minSalary && job.salary.visible && (job.salary.maximum ?? job.salary.minimum ?? 0) < filters.minSalary) return false;
  return true;
}

/** Highest score first; ties keep the upstream order (newest published first). */
const byScore = (a: JobWithMatch, b: JobWithMatch) => b.match.score - a.match.score;

/**
 * All operations work for one seeker (`candidateId` = their user id). A seeker
 * without a profile is matched as an empty profile, like the frontend mock.
 */
export class DiscoveryService {
  constructor(
    private readonly candidateProfileClient: CandidateProfileReader,
    private readonly jobPostingClient: JobPostingReader,
    private readonly aiModelAdapter: AIModelAdapter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** OPEN jobs matching the filters, best match first. Explanations are left empty. */
  async searchJobs(candidateId: string, filters: JobSearchFilters): Promise<JobWithMatch[]> {
    const [jobs, candidate] = await Promise.all([
      this.jobPostingClient.listOpenJobs(filters.query),
      this.candidateProfileClient.getProfile(candidateId),
    ]);
    return jobs
      .filter((job) => matchesFilters(job, filters))
      .map((job) => this.withMatch(candidateId, candidate, job))
      .sort(byScore);
  }

  /** The `limit` best-matching OPEN jobs. Explanations are left empty. */
  async getRecommendations(candidateId: string, limit: number): Promise<JobWithMatch[]> {
    // TODO: decide whether recommendations should also use preferences to pre-filter
    // (e.g. preferred roles as the upstream query) instead of scoring every open job.
    const [jobs, candidate] = await Promise.all([
      this.jobPostingClient.listOpenJobs(),
      this.candidateProfileClient.getProfile(candidateId),
    ]);
    return jobs
      .map((job) => this.withMatch(candidateId, candidate, job))
      .sort(byScore)
      .slice(0, limit);
  }

  /** One job with its full match, including the AI explanation. */
  async evaluateJobFit(candidateId: string, jobId: string): Promise<JobWithMatch> {
    const [job, candidate] = await Promise.all([
      this.jobPostingClient.getJob(jobId),
      this.candidateProfileClient.getProfile(candidateId),
    ]);
    const { match } = this.withMatch(candidateId, candidate, job);
    // The explanation only describes the evidence; it never changes the score.
    const explanation = await this.aiModelAdapter.explainMatch({ evidence: match, job, candidate });
    return { ...job, match: { ...match, explanation: explanation.text } };
  }

  /** Same evaluation path as evaluateJobFit, returning only the match. */
  async getMatchResult(candidateId: string, jobId: string): Promise<MatchResult> {
    return (await this.evaluateJobFit(candidateId, jobId)).match;
  }

  private withMatch(candidateId: string, candidate: CandidateProfile | null, job: JobPosting): JobWithMatch {
    const evidence = evaluateJobFit(candidate, job);
    return {
      ...job,
      match: { ...evidence, candidateId, explanation: '', computedAt: this.now().toISOString() },
    };
  }
}
