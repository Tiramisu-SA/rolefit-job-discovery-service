import express, { NextFunction, Request, Response } from 'express';
import { UnimplementedAIModelAdapter } from './adapters/ai/ai.adapter';
import { DiscoveryController } from './controllers/discovery.controller';
import { loadConfig } from './config/env';
import { CandidateProfileClient } from './grpc/candidate-profile.client';
import { JobPostingClient } from './grpc/job-posting.client';
import { createClaimsVerifier, type ClaimsVerifier } from './auth/supabase';
import { authenticate } from './middleware/auth.middleware';
import { createDiscoveryRoutes } from './routes/discovery.routes';
import { DiscoveryService, type CandidateProfileGateway, type JobPostingGateway } from './services/discovery.service';
import type { AppConfig } from './config/env';
import { BadRequestError, ForbiddenError, UnauthorizedError } from './utils/errors';

export interface AppDependencies {
  config?: AppConfig;
  verifyClaims?: ClaimsVerifier;
  candidateProfileClient?: CandidateProfileGateway;
  jobPostingClient?: JobPostingGateway;
}

export function createApp(dependencies: AppDependencies = {}) {
  const config = dependencies.config ?? loadConfig();
  const verifyClaims = dependencies.verifyClaims ?? createClaimsVerifier(config.supabaseUrl, config.supabasePublishableKey);
  const candidateProfileClient = dependencies.candidateProfileClient ?? new CandidateProfileClient(config.candidateProfileGrpcUrl);
  const jobPostingClient = dependencies.jobPostingClient ?? new JobPostingClient(config.jobPostingGrpcUrl);
  const discoveryService = new DiscoveryService(
    candidateProfileClient,
    jobPostingClient,
    new UnimplementedAIModelAdapter(),
  );
  const controller = new DiscoveryController(discoveryService);
  const app = express();

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'job-discovery-service' });
  });
  app.use('/api', authenticate(verifyClaims), express.json(), createDiscoveryRoutes(controller));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof BadRequestError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    response.status(501).json({ error: message });
  });

  return { app, config };
}
