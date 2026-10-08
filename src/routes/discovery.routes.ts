import { Router } from 'express';
import { DiscoveryController } from '../controllers/discovery.controller';

/** Mounted at /api, behind the identity middleware. Mirrors the frontend's lib/api/job-discovery.ts. */
export function createDiscoveryRoutes(controller: DiscoveryController): Router {
  const router = Router();

  router.get('/jobs/search', controller.searchJobs); // searchJobs(filters)
  router.get('/recommendations', controller.getRecommendations); // getRecommendations(limit)
  router.get('/jobs/:jobId/fit', controller.evaluateJobFit); // evaluateJobFit(jobId)
  router.get('/jobs/:jobId/match', controller.getMatchResult); // getMatchResult(jobId)

  return router;
}
