import type { CandidateProfileReader } from '../../src/grpc/candidate-profile.client';
import type { JobPostingReader } from '../../src/grpc/job-posting.client';
import type { CandidateProfile, JobPosting } from '../../src/types/domain.types';
import { jobNotFound, ServiceUnavailableError } from '../../src/utils/errors';

export const SEEKER = '11111111-1111-4111-8111-111111111111';

export function job(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job_seed_frontend',
    recruiterId: 'user_1',
    companyId: 'co-brightline',
    title: 'Frontend Developer',
    description: 'Build dashboards',
    requirements: {
      requiredSkills: [{ name: 'React', level: 'INTERMEDIATE', minimumYears: 1 }],
      preferredSkills: [],
      minimumExperienceYears: 2,
      educationLevel: 'BACHELOR',
      acceptedFields: [],
    },
    responsibilities: [],
    employmentType: 'FULL_TIME',
    workArrangement: 'HYBRID',
    location: { country: 'Thailand', province: 'Bangkok' },
    salary: { minimum: 40000, maximum: 60000, currency: 'THB', visible: true },
    applicationSettings: { positionsAvailable: 1, requireCoverLetter: false },
    status: 'OPEN',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

export const profile: CandidateProfile = {
  id: SEEKER,
  name: 'Seeker',
  headline: null,
  location: 'Bangkok',
  verified: true,
  totalExperienceMonths: 30,
  skills: [{ name: 'React', proficiencyLevel: 'ADVANCED' }],
  experience: [],
  education: [],
  projects: [],
  preferences: null,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

export const fakeProfiles = (p: CandidateProfile | null = profile): CandidateProfileReader => ({
  getProfile: async () => p,
});

export const fakeJobs = (jobs: JobPosting[] = [job()]): JobPostingReader => ({
  getJob: async (id) => {
    const found = jobs.find((j) => j.id === id);
    if (!found) throw jobNotFound();
    return found;
  },
  listOpenJobs: async () => jobs,
});

export const downJobs: JobPostingReader = {
  getJob: async () => {
    throw new ServiceUnavailableError('job');
  },
  listOpenJobs: async () => {
    throw new ServiceUnavailableError('job');
  },
};
