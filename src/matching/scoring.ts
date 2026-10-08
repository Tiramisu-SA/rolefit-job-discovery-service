import { MatchBreakdown } from './matching.types';

/** Weight of each area in the overall score (sums to 1). Same as the frontend mock. */
export const WEIGHTS: Readonly<MatchBreakdown> = {
  skills: 0.5,
  experience: 0.25,
  education: 0.1,
  preferences: 0.15,
};

/** Combines the per-area scores (0-100 each) into the overall 0-100 score. */
export function scoreMatch(breakdown: MatchBreakdown): number {
  return Math.round(
    breakdown.skills * WEIGHTS.skills +
      breakdown.experience * WEIGHTS.experience +
      breakdown.education * WEIGHTS.education +
      breakdown.preferences * WEIGHTS.preferences,
  );
}
