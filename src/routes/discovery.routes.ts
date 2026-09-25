import { Router } from 'express';
import { DiscoveryController } from '../controllers/discovery.controller';

export function createDiscoveryRoutes(controller: DiscoveryController): Router {
  const router = Router();

  router.get('/jobs/search', controller.searchJobs);
  router.get('/recommendations', controller.getRecommendations);
  router.post('/job-fit/evaluate', controller.evaluateJobFit);
  router.get('/job-fit/:candidateId/:jobId', controller.getMatchResult);

  return router;
}
