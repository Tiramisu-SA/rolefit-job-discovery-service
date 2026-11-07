import type { ExplainMatchInput } from './ai.types';

export const MAX_EXPLANATION_LENGTH = 600;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The explanation may only describe the evidence. Throws when it is empty, too
 * long, or names a job/candidate skill that is not a matched or missing skill
 * (the model would be inventing a strength or gap).
 */
export function assertGroundedExplanation(text: string, input: ExplainMatchInput): void {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_EXPLANATION_LENGTH) throw new Error('Explanation is empty or too long');

  const { evidence, job, candidate } = input;
  const allowed = new Set([...evidence.matchedSkills, ...evidence.missingSkills].map((s) => s.trim().toLowerCase()));
  const known = new Set(
    [...job.requirements.requiredSkills, ...job.requirements.preferredSkills, ...(candidate?.skills ?? [])]
      .map((s) => s.name.trim().toLowerCase())
      .filter(Boolean),
  );

  const lower = trimmed.toLowerCase();
  for (const skill of known) {
    if (allowed.has(skill)) continue;
    if (new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(skill)}(?=$|[^a-z0-9+#.]|\\.(?:$|\\s))`).test(lower)) {
      throw new Error('Explanation names a skill outside the evidence');
    }
  }
}
