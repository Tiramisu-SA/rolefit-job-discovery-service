import { Request, Response } from 'express';
import { DiscoveryService } from '../services/discovery.service';
import { parseJobId, parseRecommendationLimit, parseSearchFilters } from '../validation/discovery.validation';

/**
 * HTTP adapter only: parses input, calls DiscoveryService, sends JSON. The
 * candidate is always the caller (`req.userId`, set by the identity middleware).
 */
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  searchJobs = async (req: Request, res: Response): Promise<void> => {
    const filters = parseSearchFilters(req.query);
    const jobs = await this.discoveryService.searchJobs(req.userId!, filters);
    res.json({ jobs });
  };

  getRecommendations = async (req: Request, res: Response): Promise<void> => {
    const limit = parseRecommendationLimit(req.query);
    const jobs = await this.discoveryService.getRecommendations(req.userId!, limit);
    res.json({ jobs });
  };

  evaluateJobFit = async (req: Request, res: Response): Promise<void> => {
    const job = await this.discoveryService.evaluateJobFit(req.userId!, parseJobId(req.params.jobId));
    res.json(job);
  };

  getMatchResult = async (req: Request, res: Response): Promise<void> => {
    const match = await this.discoveryService.getMatchResult(req.userId!, parseJobId(req.params.jobId));
    res.json(match);
  };
}
