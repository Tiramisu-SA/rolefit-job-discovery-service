import express, { NextFunction, Request, Response } from 'express';
import { UnimplementedAIModelAdapter } from './adapters/ai/ai.adapter';
import { DiscoveryController } from './controllers/discovery.controller';
import { loadConfig } from './config/env';
import { CandidateProfileClient } from './grpc/candidate-profile.client';
import { JobPostingClient } from './grpc/job-posting.client';
import { createDiscoveryRoutes } from './routes/discovery.routes';
import { DiscoveryService } from './services/discovery.service';

export function createApp() {
  const config = loadConfig();
  const candidateProfileClient = new CandidateProfileClient(config.candidateProfileGrpcUrl);
  const jobPostingClient = new JobPostingClient(config.jobPostingGrpcUrl);
  const discoveryService = new DiscoveryService(
    candidateProfileClient,
    jobPostingClient,
    new UnimplementedAIModelAdapter(),
  );
  const controller = new DiscoveryController(discoveryService);
  const app = express();

  app.use(express.json());
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'job-discovery-service' });
  });
  app.use('/api', createDiscoveryRoutes(controller));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Internal server error';
    response.status(501).json({ error: message });
  });

  return { app, config };
}
