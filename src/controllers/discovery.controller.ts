import { Request, Response } from 'express';
import { DiscoveryService } from '../services/discovery.service';
import { BadRequestError, ForbiddenError } from '../utils/errors';

function authenticated(request: Request): { userId: string; accessToken: string } {
  if (!request.auth) throw new Error('Authentication middleware was not applied');
  return request.auth;
}

function candidateIdFor(request: Request, candidateId: unknown): string {
  if (typeof candidateId !== 'string' || !candidateId.trim()) throw new BadRequestError('candidateId is required');
  if (candidateId !== authenticated(request).userId) throw new ForbiddenError();
  return candidateId;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestError(`${name} is required`);
  return value;
}

export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  searchJobs = async (request: Request, response: Response): Promise<void> => {
    const { accessToken } = authenticated(request);
    const skills = typeof request.query.skills === 'string' ? request.query.skills.split(',').map((skill) => skill.trim()).filter(Boolean) : [];
    const jobs = await this.discoveryService.searchJobs({
      query: typeof request.query.query === 'string' ? request.query.query : undefined,
      skills,
    }, accessToken);
    response.json({ jobs });
  };

  getRecommendations = async (request: Request, response: Response): Promise<void> => {
    const { accessToken } = authenticated(request);
    const candidateId = candidateIdFor(request, request.query.candidateId);
    const jobs = await this.discoveryService.getRecommendations(candidateId, accessToken);
    response.json({ jobs });
  };

  evaluateJobFit = async (request: Request, response: Response): Promise<void> => {
    const { accessToken } = authenticated(request);
    const { candidateId, jobId } = (request.body ?? {}) as { candidateId?: string; jobId?: string };
    const scopedCandidateId = candidateIdFor(request, candidateId);
    const evidence = await this.discoveryService.evaluateJobFit(scopedCandidateId, requiredString(jobId, 'jobId'), accessToken);
    response.json(evidence);
  };

  getMatchResult = async (request: Request, response: Response): Promise<void> => {
    const { accessToken } = authenticated(request);
    const candidateId = candidateIdFor(request, request.params.candidateId);
    const jobId = requiredString(request.params.jobId, 'jobId');
    const result = await this.discoveryService.getMatchResult(candidateId, jobId, accessToken);
    response.json(result);
  };
}
