import { z } from 'zod';

// ==================================================================
//  Recruitment / ATS
// ==================================================================

export const createJobOpeningSchema = z.object({
  title: z.string().trim().min(2).max(160),
  departmentId: z.string().uuid().nullable().optional(),
  headcount: z.number().int().min(1).default(1),
  type: z.string().default('full_time'),
  description: z.string().max(8000).optional(),
});

export const updateJobOpeningSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  headcount: z.number().int().min(1).optional(),
  type: z.string().optional(),
  status: z.enum(['open', 'on_hold', 'closed']).optional(),
  description: z.string().max(8000).optional(),
  departmentId: z.string().uuid().nullable().optional(),
});

export const createCandidateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).optional(),
  source: z.string().trim().max(80).optional(),
});

export const createApplicationSchema = z.object({
  jobOpeningId: z.string().uuid(),
  candidateId: z.string().uuid(),
});

export const moveApplicationSchema = z.object({
  stage: z.enum(['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']),
  rejectedReason: z.string().max(500).optional(),
});

export type CreateJobOpeningInput = z.infer<typeof createJobOpeningSchema>;
export type UpdateJobOpeningInput = z.infer<typeof updateJobOpeningSchema>;
export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type MoveApplicationInput = z.infer<typeof moveApplicationSchema>;

// ==================================================================
//  Assets
// ==================================================================

export const createAssetSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().max(60).optional(),
  serial: z.string().trim().max(80).optional(),
  purchaseDate: z.string().datetime().optional(),
  value: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateAssetSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  category: z.string().trim().max(60).optional(),
  serial: z.string().trim().max(80).optional(),
  status: z.enum(['available', 'assigned', 'in_repair', 'retired']).optional(),
  value: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

export const assignAssetSchema = z.object({
  employeeId: z.string().uuid(),
  condition: z.string().max(80).optional(),
  notes: z.string().max(1000).optional(),
});

export const returnAssetSchema = z.object({
  condition: z.string().max(80).optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

// ==================================================================
//  Engagement
// ==================================================================

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().min(1).max(20000),
  audience: z.enum(['all', 'department', 'role']).default('all'),
  audienceRef: z.string().optional(),
  expiry: z.string().datetime().optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  body: z.string().min(1).max(20000).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  expiry: z.string().datetime().nullable().optional(),
});

export const createPortalDocSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().max(60).optional(),
  audience: z.enum(['all', 'department', 'role']).default('all'),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type CreatePortalDocInput = z.infer<typeof createPortalDocSchema>;
