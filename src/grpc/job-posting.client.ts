import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { JobPosting, JobSearchCriteria } from '../types/domain.types';

const PROTO_PATH = path.resolve(__dirname, '../../proto/job-posting.proto');

type JobPostingGrpcClient = grpc.Client & {
  getJob(
    request: { job_id: string },
    callback: (error: grpc.ServiceError | null, response: Record<string, unknown>) => void,
  ): void;
  listJobs(
    request: { query?: string; skills?: string[] },
    callback: (error: grpc.ServiceError | null, response: Record<string, unknown>) => void,
  ): void;
};

function toJobPosting(response: Record<string, unknown>): JobPosting {
  return {
    jobId: String(response.job_id ?? ''),
    title: String(response.title ?? ''),
    description: String(response.description ?? ''),
    requiredSkills: Array.isArray(response.required_skills) ? response.required_skills.map(String) : [],
    requirements: Array.isArray(response.requirements) ? response.requirements.map(String) : [],
  };
}

export class JobPostingClient {
  private readonly client: JobPostingGrpcClient;

  constructor(address: string) {
    const definition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const loaded = grpc.loadPackageDefinition(definition) as unknown as {
      jobposting: { JobPostingService: new (address: string, credentials: grpc.ChannelCredentials) => JobPostingGrpcClient };
    };
    this.client = new loaded.jobposting.JobPostingService(address, grpc.credentials.createInsecure());
  }

  getJob(jobId: string): Promise<JobPosting> {
    return new Promise((resolve, reject) => {
      this.client.getJob({ job_id: jobId }, (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(toJobPosting(response));
      });
    });
  }

  listJobs(criteria: JobSearchCriteria = {}): Promise<JobPosting[]> {
    return new Promise((resolve, reject) => {
      this.client.listJobs(criteria, (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        const jobs = Array.isArray(response.jobs) ? response.jobs.map((job) => toJobPosting(job as Record<string, unknown>)) : [];
        resolve(jobs);
      });
    });
  }
}
