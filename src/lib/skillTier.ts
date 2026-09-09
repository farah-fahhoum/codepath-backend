/** Map a competitive programming rating to a CodePath skill tier title. */
export function tierFromRating(rating: number): string {
  if (rating < 1200) return "Beginner";
  if (rating < 1400) return "Intermediate";
  if (rating < 1600) return "Advanced";
  if (rating < 1900) return "Expert";
  return "Master";
}

export const NOT_ASSESSED_TIER = "Not Assessed";

export const CODEPATH_MIN_SOLVED_FOR_ESTIMATE = 3;
export const CONTEST_MIN_FINISHED_FOR_ESTIMATE = 1;
