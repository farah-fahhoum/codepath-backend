import Joi from "joi";

function normalizeRatingQuery(value: {
  minRating?: number | null;
  maxRating?: number | null;
}) {
  const min = value.minRating ?? null;
  const max = value.maxRating ?? null;
  if (min != null && max != null && min > max) {
    return { minRating: max, maxRating: min };
  }
  return { minRating: min, maxRating: max };
}

/** Shared query validation for problem list endpoints (CodePath + Codeforces). */
export const problemListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  minRating: Joi.number().integer().min(0).max(5000).optional().allow(null),
  maxRating: Joi.number().integer().min(0).max(5000).optional().allow(null),
  tag: Joi.string().max(80).optional().allow("").allow(null),
  search: Joi.string().max(200).optional().allow("").allow(null),
  sort: Joi.string()
    .valid("rating_asc", "rating_desc", "title_asc")
    .optional()
    .default("rating_asc"),
}).custom((value) => {
  const normalized = normalizeRatingQuery(value);
  return { ...value, ...normalized };
});

export type ProblemListQuery = {
  page: number;
  limit: number;
  minRating?: number | null;
  maxRating?: number | null;
  tag?: string | null;
  search?: string | null;
  sort: "rating_asc" | "rating_desc" | "title_asc";
};

export { normalizeRatingQuery };
