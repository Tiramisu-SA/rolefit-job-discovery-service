import { CandidatePreferences, CandidateProfile, experienceLevelFor, JobPosting } from '../types/domain.types';
import { MatchEvidence } from './matching.types';
import { scoreMatch } from './scoring';

// Deterministic job fit, moved here from the frontend's former in-browser mock
// (rolefit-frontend src/lib/match.ts, computeMatch), so scores did not change.

const norm = (s: string) => s.trim().toLowerCase();

/** Share of required skills the candidate lists, by name, ignoring case. No required skills = 100. */
function scoreSkills(candidate: CandidateProfile | null, job: JobPosting) {
  const have = new Set((candidate?.skills ?? []).map((s) => norm(s.name)));
  const required = job.requirements.requiredSkills.map((s) => s.name);
  const matchedSkills = required.filter((s) => have.has(norm(s)));
  const missingSkills = required.filter((s) => !have.has(norm(s)));
  const skills = required.length ? Math.round((matchedSkills.length / required.length) * 100) : 100;
  return { skills, required, matchedSkills, missingSkills };
}

/** Candidate years (one decimal) against the job's minimum, capped at 100. */
function scoreExperience(candidate: CandidateProfile | null, job: JobPosting) {
  const years = Math.round(((candidate?.totalExperienceMonths ?? 0) / 12) * 10) / 10;
  const needed = job.requirements.minimumExperienceYears;
  const experience = needed === 0 ? 100 : Math.min(100, Math.round((years / needed) * 100));
  return { experience, years, needed };
}

/** Any education = 100, none = 50. Does not yet compare against the job's education level. */
function scoreEducation(candidate: CandidateProfile | null): number {
  return candidate?.education.length ? 100 : 50;
}

/** Arrangement 40 + location 30 + employment type 30. No preferences = 0. A remote job matches any location. */
function scorePreferences(prefs: CandidatePreferences | null | undefined, job: JobPosting): number {
  if (!prefs) return 0;
  const province = job.location.province ? norm(job.location.province) : '';
  const locationOk =
    job.workArrangement === 'REMOTE' ||
    (province !== '' &&
      prefs.preferredLocations.some((l) => norm(l) === province || province.includes(norm(l)) || norm(l).includes(province)));
  let preferences = 0;
  if (job.workArrangement && prefs.workArrangements.includes(job.workArrangement)) preferences += 40;
  if (locationOk) preferences += 30;
  if (job.employmentType && prefs.employmentTypes.includes(job.employmentType)) preferences += 30;
  return preferences;
}

/** `candidate` is null when the seeker has no profile yet: it is matched as an empty profile. */
export function evaluateJobFit(candidate: CandidateProfile | null, job: JobPosting): MatchEvidence {
  const { skills, matchedSkills, missingSkills } = scoreSkills(candidate, job);
  const { experience, years, needed } = scoreExperience(candidate, job);
  const education = scoreEducation(candidate);
  const preferences = scorePreferences(candidate?.preferences, job);
  const breakdown = { skills, experience, education, preferences };
  const level = experienceLevelFor(needed).toLowerCase();

  const strengths = [
    matchedSkills.length ? `${matchedSkills.slice(0, 3).join(', ')} in your profile` : '',
    experience >= 100 ? `${years} years of experience meets the ${level} requirement` : '',
    preferences >= 70 ? 'Location and work arrangement match your preferences' : '',
  ].filter(Boolean);
  const gaps = [
    ...missingSkills.map((s) => `${s} is required but not in your profile`),
    experience < 100 ? `The role asks for about ${needed}+ years; your profile shows ${years}` : '',
  ].filter(Boolean);

  return {
    jobId: job.id,
    candidateId: candidate?.id ?? '',
    score: scoreMatch(breakdown),
    breakdown,
    matchedSkills,
    missingSkills,
    strengths,
    gaps,
  };
}
