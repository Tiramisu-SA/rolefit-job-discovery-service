import express, { type Express } from 'express';
import { AIModelAdapter } from './adapters/ai/ai.types';
import { FallbackExplanationAdapter } from './adapters/ai/fallback.adapter';
import { GeminiExplanationAdapter } from './adapters/ai/gemini.adapter';
import { createGeminiClient } from './adapters/ai/gemini.client';
import { TemplateExplanationAdapter } from './adapters/ai/template.adapter';
import { DiscoveryController } from './controllers/discovery.controller';
import { AppConfig, loadConfig } from './config/env';
import { CandidateProfileClient, CandidateProfileReader } from './grpc/candidate-profile.client';
import { JobPostingClient, JobPostingReader } from './grpc/job-posting.client';
import { cors } from './middleware/cors.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { identifyFromHeader } from './middleware/identity.middleware';
import { requestContext } from './middleware/request-context.middleware';
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
  // After /health, so the health checks polling every few seconds are not logged.
  app.use(requestContext);
  app.use('/api', identifyFromHeader);
  app.use(express.json());
  app.use('/api', createDiscoveryRoutes(controller));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/** AI_PROVIDER=gemini: Gemini with the template as fallback on errors. Otherwise the template only. */
export function createExplanationAdapter(config: AppConfig): AIModelAdapter {
  if (config.aiProvider === 'gemini' && config.aiApiKey && config.aiModel) {
    const client = createGeminiClient({ apiKey: config.aiApiKey, model: config.aiModel });
    return new FallbackExplanationAdapter(new GeminiExplanationAdapter(client), new TemplateExplanationAdapter());
  }
  return new TemplateExplanationAdapter();
}

/** The app wired to the real gRPC services. */
export function createApp(): { app: Express; config: AppConfig } {
  const config = loadConfig();
  const app = buildApp({
    candidateProfile: new CandidateProfileClient(config.candidateProfileGrpcUrl, config.grpcDeadlineMs),
    jobPosting: new JobPostingClient(config.jobPostingGrpcUrl, config.grpcDeadlineMs),
    aiModelAdapter: createExplanationAdapter(config),
    corsOrigin: config.corsOrigin,
  });
  return { app, config };
}
