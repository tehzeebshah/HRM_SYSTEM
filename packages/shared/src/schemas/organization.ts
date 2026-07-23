import { z } from 'zod';
import { EmploymentType, Gender } from '../enums';

export const genderSchema = z.nativeEnum(Gender);
export const employmentTypeSchema = z.nativeEnum(EmploymentType);

// ------------------------------------------------------------------
//  Department
// ------------------------------------------------------------------

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(40).optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

// ------------------------------------------------------------------
//  Designation
// ------------------------------------------------------------------

export const createDesignationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  grade: z.string().trim().max(40).optional(),
  description: z.string().max(500).optional(),
});

export const updateDesignationSchema = createDesignationSchema.partial();

export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;
export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>;

// ------------------------------------------------------------------
//  Location
// ------------------------------------------------------------------

export const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().max(240).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  timezone: z.string().max(60).optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
