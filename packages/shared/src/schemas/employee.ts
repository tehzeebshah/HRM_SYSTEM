import { z } from 'zod';
import { EmploymentType, EmployeeStatus, Gender } from '../enums';

// ------------------------------------------------------------------
//  Employee
// ------------------------------------------------------------------

export const createEmployeeSchema = z.object({
  employeeNo: z.string().trim().min(1).max(40),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).optional(),
  dob: z.string().datetime().optional(),
  gender: z.nativeEnum(Gender).optional(),
  maritalStatus: z.string().trim().max(40).optional(),
  nationality: z.string().trim().max(80).optional(),
  idNumber: z.string().trim().max(80).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  designationId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  hireDate: z.string().datetime(),
  confirmDate: z.string().datetime().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ employeeNo: true });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const employeeQuerySchema = z.object({
  page: z.coerce.number().min(1).optional(),
  pageSize: z.coerce.number().min(1).max(200).optional(),
  q: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  sort: z.enum(['firstName', 'lastName', 'employeeNo', 'hireDate', 'createdAt']).optional(),
});

export type EmployeeQuery = z.infer<typeof employeeQuerySchema>;

// ------------------------------------------------------------------
//  Employee document
// ------------------------------------------------------------------

export const documentTypeSchema = z.enum(['id', 'contract', 'certificate', 'other']);

export const createEmployeeDocumentSchema = z.object({
  type: documentTypeSchema,
  name: z.string().trim().min(1).max(160),
  expiry: z.string().datetime().optional(),
});

export type CreateEmployeeDocumentInput = z.infer<typeof createEmployeeDocumentSchema>;
