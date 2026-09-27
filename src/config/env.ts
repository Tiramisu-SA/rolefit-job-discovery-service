import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  candidateProfileGrpcUrl: string;
  jobPostingGrpcUrl: string;
  aiProviderApiKey?: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export function loadConfig(): AppConfig {
  const port = Number.parseInt(process.env.PORT ?? '3003', 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be a positive integer');
  }

  return {
    port,
    candidateProfileGrpcUrl: process.env.CANDIDATE_PROFILE_GRPC_URL ?? 'localhost:50051',
    jobPostingGrpcUrl: process.env.JOB_POSTING_GRPC_URL ?? 'localhost:50052',
    aiProviderApiKey: process.env.AI_PROVIDER_API_KEY || undefined,
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
  };
}
