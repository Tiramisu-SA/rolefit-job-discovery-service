export interface CandidateProfile {
  candidateId: string;
  skills: string[];
  experience: string[];
  education: string[];
}

export interface JobPosting {
  jobId: string;
  title: string;
  description: string;
  requiredSkills: string[];
  requirements: string[];
}

export interface JobSearchCriteria {
  query?: string;
  skills?: string[];
}
