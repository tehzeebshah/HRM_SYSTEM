import { z } from 'zod';

// ------------------------------------------------------------------
//  Goals
// ------------------------------------------------------------------

export const createGoalSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().max(2000).optional(),
  weight: z.number().min(0).max(10).default(1),
  dueDate: z.string().datetime().optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().max(2000).optional(),
  weight: z.number().min(0).max(10).optional(),
  progress: z.number().min(0).max(100).optional(),
  status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

// ------------------------------------------------------------------
//  Review cycles
// ------------------------------------------------------------------

export const createReviewCycleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  period: z.string().trim().min(2).max(40),
  type: z.enum(['annual', 'quarterly', 'probation', 'project']).default('annual'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const updateReviewCycleSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(['open', 'closed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type CreateReviewCycleInput = z.infer<typeof createReviewCycleSchema>;
export type UpdateReviewCycleInput = z.infer<typeof updateReviewCycleSchema>;

// ------------------------------------------------------------------
//  Reviews + feedback
// ------------------------------------------------------------------

export const createReviewSchema = z.object({
  cycleId: z.string().uuid(),
  employeeId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  dueDate: z.string().datetime().optional(),
});

export const submitReviewSchema = z.object({
  // Free-form structured ratings: { competency: ratingValue, ... }
  ratings: z.record(z.string(), z.number()).default({}),
  comments: z.string().max(5000).optional(),
  overallRating: z.number().min(0).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

// ------------------------------------------------------------------
//  Rating scales
// ------------------------------------------------------------------

export const ratingLevelSchema = z.object({
  value: z.number(),
  label: z.string(),
  color: z.string().optional(),
});

export const createRatingScaleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  levels: z.array(ratingLevelSchema).min(2),
});

export type CreateRatingScaleInput = z.infer<typeof createRatingScaleSchema>;
