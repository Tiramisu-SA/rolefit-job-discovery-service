import express, { type Express } from 'express';
import { AIModelAdapter } from './adapters/ai/ai.types';
import { TemplateExplanationAdapter } from './adapters/ai/template.adapter';
import { DiscoveryController } from './controllers/discovery.controller';
import { AppConfig, loadConfig } from './config/env';
import { CandidateProfileClient, CandidateProfileReader } from './grpc/candidate-profile.client';
import { JobPostingClient, JobPostingReader } from './grpc/job-posting.client';
import { cors } from './middleware/cors.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { identifyFromHeader } from './middleware/identity.middleware';
import { createDiscoveryRoutes } from './routes/discovery.routes';
import { DiscoveryService } from './services/discovery.service';

export interface AppDependencies {
  candidateProfile: CandidateProfileReader;
  jobPosting: JobPostingReader;
  aiModelAdapter: AIModelAdapter;
  /** The web frontend origin allowed by CORS, e.g. http://localhost:3000. */
  corsOrigin: string;
}

/** Builds the Express app (REST API). Does not listen on a port, which keeps it easy to test. */
export function buildApp({ candidateProfile, jobPosting, aiModelAdapter, corsOrigin }: AppDependencies): Express {
  const controller = new DiscoveryController(new DiscoveryService(candidateProfile, jobPosting, aiModelAdapter));
  const app = express();

  app.use(cors(corsOrigin));
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'job-discovery-service' });
  });
  app.use('/api', identifyFromHeader);
  app.use(express.json());
  app.use('/api', createDiscoveryRoutes(controller));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/** The app wired to the real gRPC services. */
export function createApp(): { app: Express; config: AppConfig } {
  const config = loadConfig();
  const app = buildApp({
    candidateProfile: new CandidateProfileClient(config.candidateProfileGrpcUrl, config.grpcDeadlineMs),
    jobPosting: new JobPostingClient(config.jobPostingGrpcUrl, config.grpcDeadlineMs),
    // TODO 8: swap for an LLM-backed adapter (see ai.adapter.ts).
    aiModelAdapter: new TemplateExplanationAdapter(),
    corsOrigin: config.corsOrigin,
  });
  return { app, config };
}
