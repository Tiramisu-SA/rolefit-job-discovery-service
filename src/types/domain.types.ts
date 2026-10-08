// Shared vocabulary: the exact values the Candidate Profile and Job Posting
// services store and send (enum prefixes stripped). These match the frontend's
// lib/types.ts so the frontend can use this service's responses unchanged.
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT'] as const;
export const WORK_ARRANGEMENTS = ['ONSITE', 'HYBRID', 'REMOTE'] as const;
export const SKILL_LEVELS = ['BASIC', 'INTERMEDIATE', 'ADVANCED'] as const;
export const EDUCATION_LEVELS = ['NONE', 'HIGH_SCHOOL', 'DIPLOMA', 'BACHELOR', 'MASTER', 'DOCTORATE'] as const;
export const JOB_STATUSES = ['DRAFT', 'OPEN', 'CLOSED'] as const;
/** Display-only level worked out from a job's minimum years of experience. */
export const EXPERIENCE_LEVELS = ['Internship', 'Entry level', 'Mid level', 'Senior'] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number];
export type SkillLevel = (typeof SKILL_LEVELS)[number];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** Same bands as the frontend's experienceLevelFor (lib/labels.ts). */
export function experienceLevelFor(minimumYears: number): ExperienceLevel {
  if (minimumYears >= 5) return 'Senior';
  if (minimumYears >= 3) return 'Mid level';
  if (minimumYears >= 1) return 'Entry level';
  return 'Internship';
}

// --- Job Posting Service (gRPC rolefit.jobposting.v1) ---------------------------

export interface RequiredSkill {
  name: string;
  level: SkillLevel;
  minimumYears: number;
}

export interface PreferredSkill {
  name: string;
  level: SkillLevel;
}

export interface JobRequirements {
  requiredSkills: RequiredSkill[];
  preferredSkills: PreferredSkill[];
  minimumExperienceYears: number;
  educationLevel: EducationLevel;
  acceptedFields: string[];
}

export interface JobLocation {
  country?: string;
  province?: string;
  district?: string;
}

export interface JobSalary {
  minimum?: number;
  maximum?: number;
  currency: string;
  visible: boolean;
}

export interface ApplicationSettings {
  /** ISO-8601 */
  applicationDeadline?: string;
  positionsAvailable: number;
  resumeTemplateId?: string;
  requireCoverLetter: boolean;
}

/** A job as the Job Posting Service returns it. */
export interface JobPosting {
  id: string;
  recruiterId: string;
  companyId: string;
  title: string;
  description: string;
  requirements: JobRequirements;
  responsibilities: string[];
  employmentType?: EmploymentType;
  workArrangement?: WorkArrangement;
  location: JobLocation;
  salary: JobSalary;
  applicationSettings: ApplicationSettings;
  status: JobStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Candidate Profile Service (gRPC rolefit.candidateprofile.v1) ---------------
// The gRPC message is a read-only view: no child ids, email, summary or links.

export interface Skill {
  name: string;
  proficiencyLevel: SkillLevel | null;
}

export interface Experience {
  companyName: string;
  jobTitle: string;
  /** YYYY-MM-DD */
  startDate: string | null;
  /** YYYY-MM-DD */
  endDate: string | null;
  isCurrent: boolean;
  bullets: string[];
}

export interface Education {
  institutionName: string;
  degree: string;
  fieldOfStudy: string | null;
  gpa: number | null;
  /** YYYY */
  year: string | null;
}

export interface Project {
  name: string;
  tech: string[];
  bullets: string[];
}

export interface CandidatePreferences {
  employmentTypes: EmploymentType[];
  preferredRoles: string[];
  workArrangements: WorkArrangement[];
  preferredLocations: string[];
  minimumSalary: number | null;
  salaryCurrency: string | null;
}

export interface CandidateProfile {
  /** Also the owner's user id (the seeker's X-User-Id). */
  id: string;
  name: string;
  headline: string | null;
  location: string | null;
  verified: boolean;
  totalExperienceMonths: number;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  preferences: CandidatePreferences | null;
  updatedAt: string;
}

// --- Job Discovery API -----------------------------------------------------------

/** Query parameters of GET /api/jobs/search (same shape as the frontend's JobSearchFilters). */
export interface JobSearchFilters {
  query?: string;
  location?: string;
  employmentTypes?: EmploymentType[];
  arrangements?: WorkArrangement[];
  experienceLevels?: ExperienceLevel[];
  minSalary?: number;
}
