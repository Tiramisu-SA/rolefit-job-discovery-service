import * as grpc from '@grpc/grpc-js';
import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  JobPosting,
  SKILL_LEVELS,
  WORK_ARRANGEMENTS,
} from '../types/domain.types';
import { jobNotFound } from '../utils/errors';
import { callUnary, defined, fromEnum, loadProto, Msg, strings, text, UnaryCall } from './grpc.utils';

const SERVICE = 'job';
/** The Job Posting Service caps ListJobs at 100 per page. */
const PAGE_SIZE = 100;
/** Upper bound on pages fetched per search (bounds latency and memory). */
const MAX_PAGES = 10;

/** What DiscoveryService needs from the Job Posting Service (lets tests pass a fake). */
export interface JobPostingReader {
  /** Any job visible to a seeker (OPEN or CLOSED). Rejects with JOB_NOT_FOUND. */
  getJob(jobId: string): Promise<JobPosting>;
  /** OPEN jobs, newest published first. `query` matches title or required skill names. */
  listOpenJobs(query?: string): Promise<JobPosting[]>;
}

type Loaded = {
  rolefit: { jobposting: { v1: { JobPostingService: grpc.ServiceClientConstructor } } };
};

const PREFIX = {
  status: 'JOB_STATUS_',
  level: 'SKILL_LEVEL_',
  employment: 'EMPLOYMENT_TYPE_',
  arrangement: 'WORK_ARRANGEMENT_',
  education: 'EDUCATION_LEVEL_',
} as const;

/** proto Job (rolefit.jobposting.v1) → domain JobPosting. Same mapping as the frontend's job-mapper.ts. */
export function toJobPosting(msg: Msg): JobPosting {
  const r: Msg = msg.requirements ?? {};
  const s: Msg = msg.salary ?? {};
  const a: Msg = msg.application_settings ?? {};
  const loc: Msg = msg.location ?? {};
  return defined<JobPosting>({
    id: msg.id,
    recruiterId: msg.recruiter_id,
    companyId: msg.company_id,
    title: msg.title,
    description: msg.description ?? '',
    requirements: {
      requiredSkills: (r.required_skills ?? []).map((x: Msg) => ({
        name: x.name,
        level: fromEnum(PREFIX.level, x.level, SKILL_LEVELS) ?? 'BASIC',
        minimumYears: x.minimum_years ?? 0,
      })),
      preferredSkills: (r.preferred_skills ?? []).map((x: Msg) => ({
        name: x.name,
        level: fromEnum(PREFIX.level, x.level, SKILL_LEVELS) ?? 'BASIC',
      })),
      minimumExperienceYears: r.minimum_experience_years ?? 0,
      educationLevel: fromEnum(PREFIX.education, r.education_level, EDUCATION_LEVELS) ?? 'NONE',
      acceptedFields: strings(r.accepted_fields),
    },
    responsibilities: strings(msg.responsibilities),
    employmentType: fromEnum(PREFIX.employment, msg.employment_type, EMPLOYMENT_TYPES),
    workArrangement: fromEnum(PREFIX.arrangement, msg.work_arrangement, WORK_ARRANGEMENTS),
    location: defined({ country: text(loc.country), province: text(loc.province), district: text(loc.district) }),
    salary: defined({
      minimum: typeof s.minimum === 'number' ? s.minimum : undefined,
      maximum: typeof s.maximum === 'number' ? s.maximum : undefined,
      currency: text(s.currency) ?? 'THB',
      visible: s.visible ?? true,
    }),
    applicationSettings: defined({
      applicationDeadline: text(a.application_deadline),
      positionsAvailable: a.positions_available || 1,
      resumeTemplateId: text(a.resume_template_id),
      requireCoverLetter: Boolean(a.require_cover_letter),
    }),
    status: fromEnum(PREFIX.status, msg.status, JOB_STATUSES) ?? 'DRAFT',
    publishedAt: text(msg.published_at),
    createdAt: msg.created_at,
    updatedAt: msg.updated_at,
  });
}

export class JobPostingClient implements JobPostingReader {
  private readonly getJobRpc: UnaryCall;
  private readonly listJobsRpc: UnaryCall;

  constructor(
    address: string,
    private readonly deadlineMs: number,
  ) {
    const loaded = loadProto('job-posting.proto') as unknown as Loaded;
    const client = new loaded.rolefit.jobposting.v1.JobPostingService(address, grpc.credentials.createInsecure());
    const rpc = client as unknown as { GetJob: UnaryCall; ListJobs: UnaryCall };
    this.getJobRpc = rpc.GetJob.bind(client);
    this.listJobsRpc = rpc.ListJobs.bind(client);
  }

  async getJob(jobId: string): Promise<JobPosting> {
    // No identity metadata is sent, so DRAFT jobs come back as NOT_FOUND.
    const response = await callUnary(SERVICE, this.getJobRpc, { job_id: jobId }, this.deadlineMs, (error) =>
      error.code === grpc.status.NOT_FOUND || error.code === grpc.status.INVALID_ARGUMENT ? jobNotFound() : undefined,
    );
    if (!response.job) throw jobNotFound();
    return toJobPosting(response.job);
  }

  async listOpenJobs(query = ''): Promise<JobPosting[]> {
    const jobs: JobPosting[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await callUnary(
        SERVICE,
        this.listJobsRpc,
        { status: `${PREFIX.status}OPEN`, query, page, limit: PAGE_SIZE },
        this.deadlineMs,
      );
      const batch: Msg[] = response.jobs ?? [];
      jobs.push(...batch.map(toJobPosting));
      if (batch.length < PAGE_SIZE || jobs.length >= (response.total ?? 0)) break;
    }
    return jobs;
  }
}
