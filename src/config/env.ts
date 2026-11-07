import dotenv from 'dotenv';

// .env.local wins over .env (dotenv never overrides a variable that is already set).
dotenv.config({ path: ['.env.local', '.env'] });

export type AiProvider = 'template' | 'gemini';

export interface AppConfig {
  port: number;
  /** Web frontend origin allowed by CORS. */
  corsOrigin: string;
  candidateProfileGrpcUrl: string;
  jobPostingGrpcUrl: string;
  /** Deadline for each upstream gRPC call. */
  grpcDeadlineMs: number;
  /** 'template' (default, no network) or 'gemini' (falls back to the template on errors). */
  aiProvider: AiProvider;
  aiApiKey?: string;
  /** Gemini model id from AI Studio. Required when aiProvider is 'gemini'. */
  aiModel?: string;
}

function readPositiveInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer (got "${raw}")`);
  }
  return value;
}

function readAiProvider(): AiProvider {
  const raw = process.env.AI_PROVIDER?.trim() || 'template';
  if (raw !== 'template' && raw !== 'gemini') {
    throw new Error(`AI_PROVIDER must be "template" or "gemini" (got "${raw}")`);
  }
  return raw;
}

export function loadConfig(): AppConfig {
  const aiProvider = readAiProvider();
  const aiApiKey = process.env.AI_API_KEY?.trim() || undefined;
  const aiModel = process.env.AI_MODEL?.trim() || undefined;
  if (aiProvider === 'gemini') {
    if (!aiApiKey) throw new Error('AI_API_KEY is required when AI_PROVIDER=gemini');
    if (!aiModel) throw new Error('AI_MODEL is required when AI_PROVIDER=gemini');
  }
  return {
    // 3000 is the frontend (Next.js), 3001 the Candidate Profile REST API.
    port: readPositiveInt('PORT', 3002),
    corsOrigin: process.env.CORS_ORIGIN?.trim() || 'http://localhost:3000',
    candidateProfileGrpcUrl: process.env.CANDIDATE_PROFILE_GRPC_URL ?? 'localhost:50051',
    jobPostingGrpcUrl: process.env.JOB_POSTING_GRPC_URL ?? 'localhost:50052',
    grpcDeadlineMs: readPositiveInt('GRPC_DEADLINE_MS', 5000),
    aiProvider,
    aiApiKey,
    aiModel,
  };
}
