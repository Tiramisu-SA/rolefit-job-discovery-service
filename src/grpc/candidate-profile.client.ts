import * as grpc from '@grpc/grpc-js';
import {
  CandidateProfile,
  EMPLOYMENT_TYPES,
  SKILL_LEVELS,
  WORK_ARRANGEMENTS,
} from '../types/domain.types';
import { NotFoundError } from '../utils/errors';
import { callUnary, fromEnum, loadProto, Msg, strings, text, UnaryCall } from './grpc.utils';

const SERVICE = 'profile';

/** What DiscoveryService needs from the Candidate Profile Service (lets tests pass a fake). */
export interface CandidateProfileReader {
  /** The candidate's profile, or null when they have not created one yet. */
  getProfile(candidateId: string): Promise<CandidateProfile | null>;
}

type Loaded = {
  rolefit: { candidateprofile: { v1: { CandidateProfileService: grpc.ServiceClientConstructor } } };
};

/** Keeps the values of a string list that belong to `allowed` (the profile sends bare enum names). */
function oneOfEach<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  return strings(value).flatMap((item) => fromEnum('', item, allowed) ?? []);
}

/** proto CandidateProfile (rolefit.candidateprofile.v1) → domain CandidateProfile. */
export function toCandidateProfile(msg: Msg): CandidateProfile {
  const prefs: Msg | null | undefined = msg.preferences;
  return {
    id: msg.candidate_id,
    name: msg.name ?? '',
    headline: text(msg.headline) ?? null,
    location: text(msg.location) ?? null,
    verified: Boolean(msg.verified),
    totalExperienceMonths: msg.total_experience_months ?? 0,
    skills: (msg.skills ?? []).map((s: Msg) => ({
      name: s.name,
      proficiencyLevel: fromEnum('', s.proficiency_level, SKILL_LEVELS) ?? null,
    })),
    experience: (msg.experience ?? []).map((e: Msg) => ({
      companyName: e.company_name,
      jobTitle: e.job_title,
      startDate: text(e.start_date) ?? null,
      endDate: text(e.end_date) ?? null,
      isCurrent: Boolean(e.is_current),
      bullets: strings(e.bullets),
    })),
    education: (msg.education ?? []).map((e: Msg) => ({
      institutionName: e.institution_name,
      degree: e.degree,
      fieldOfStudy: text(e.field_of_study) ?? null,
      gpa: e.gpa ? Number(e.gpa) : null,
      year: text(e.year) ?? null,
    })),
    projects: (msg.projects ?? []).map((p: Msg) => ({ name: p.name, tech: strings(p.tech), bullets: strings(p.bullets) })),
    preferences: prefs
      ? {
          employmentTypes: oneOfEach(prefs.employment_types, EMPLOYMENT_TYPES),
          preferredRoles: strings(prefs.preferred_roles),
          workArrangements: oneOfEach(prefs.work_arrangements, WORK_ARRANGEMENTS),
          preferredLocations: strings(prefs.preferred_locations),
          minimumSalary: prefs.minimum_salary ? Number(prefs.minimum_salary) : null,
          salaryCurrency: text(prefs.salary_currency) ?? null,
        }
      : null,
    updatedAt: msg.updated_at ?? '',
  };
}

export class CandidateProfileClient implements CandidateProfileReader {
  private readonly getProfileRpc: UnaryCall;

  constructor(
    address: string,
    private readonly deadlineMs: number,
  ) {
    const loaded = loadProto('candidate-profile.proto') as unknown as Loaded;
    const client = new loaded.rolefit.candidateprofile.v1.CandidateProfileService(address, grpc.credentials.createInsecure());
    this.getProfileRpc = (client as unknown as { GetProfile: UnaryCall }).GetProfile.bind(client);
  }

  async getProfile(candidateId: string): Promise<CandidateProfile | null> {
    try {
      const response = await callUnary(SERVICE, this.getProfileRpc, { candidate_id: candidateId }, this.deadlineMs, (error) =>
        error.code === grpc.status.NOT_FOUND ? new NotFoundError('PROFILE_NOT_FOUND', 'Profile not found') : undefined,
      );
      return response.profile ? toCandidateProfile(response.profile) : null;
    } catch (error) {
      // No profile yet is normal for a new seeker: discovery matches against an empty profile.
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  }
}
