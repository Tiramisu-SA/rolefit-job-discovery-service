import { Request, Response } from 'express';
import { DiscoveryService } from '../services/discovery.service';

export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  searchJobs = async (request: Request, response: Response): Promise<void> => {
    const skills = typeof request.query.skills === 'string' ? request.query.skills.split(',').map((skill) => skill.trim()).filter(Boolean) : [];
    const jobs = await this.discoveryService.searchJobs({
      query: typeof request.query.query === 'string' ? request.query.query : undefined,
      skills,
    });
    response.json({ jobs });
  };

  getRecommendations = async (request: Request, response: Response): Promise<void> => {
    const jobs = await this.discoveryService.getRecommendations(request.query.candidateId as string);
    response.json({ jobs });
  };

  evaluateJobFit = async (request: Request, response: Response): Promise<void> => {
    const { candidateId, jobId } = request.body as { candidateId?: string; jobId?: string };
    const evidence = await this.discoveryService.evaluateJobFit(String(candidateId), String(jobId));
    response.json(evidence);
  };

  getMatchResult = async (request: Request, response: Response): Promise<void> => {
    const result = await this.discoveryService.getMatchResult(String(request.params.candidateId), String(request.params.jobId));
    response.json(result);
  };
}
