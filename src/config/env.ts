import dotenv from 'dotenv';

// .env.local wins over .env (dotenv never overrides a variable that is already set).
dotenv.config({ path: ['.env.local', '.env'] });

export interface AppConfig {
  port: number;
  /** Web frontend origin allowed by CORS. */
  corsOrigin: string;
  candidateProfileGrpcUrl: string;
  jobPostingGrpcUrl: string;
  /** Deadline for each upstream gRPC call. */
  grpcDeadlineMs: number;
  aiProviderApiKey?: string;
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

export function loadConfig(): AppConfig {
  return {
    // 3000 is the frontend (Next.js), 3001 the Candidate Profile REST API.
    port: readPositiveInt('PORT', 3002),
    corsOrigin: process.env.CORS_ORIGIN?.trim() || 'http://localhost:3000',
    candidateProfileGrpcUrl: process.env.CANDIDATE_PROFILE_GRPC_URL ?? 'localhost:50051',
    jobPostingGrpcUrl: process.env.JOB_POSTING_GRPC_URL ?? 'localhost:50052',
    grpcDeadlineMs: readPositiveInt('GRPC_DEADLINE_MS', 5000),
    aiProviderApiKey: process.env.AI_PROVIDER_API_KEY || undefined,
  };
}
