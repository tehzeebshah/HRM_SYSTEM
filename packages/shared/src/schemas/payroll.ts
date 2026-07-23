import { z } from 'zod';

// ------------------------------------------------------------------
//  Pay components (earnings / deductions / taxes)
// ------------------------------------------------------------------

export const componentTypeSchema = z.enum(['earning', 'deduction', 'tax']);
export const calcModeSchema = z.enum(['fixed', 'percentage', 'formula']);

export const createPayComponentSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(80),
  type: componentTypeSchema,
  calcMode: calcModeSchema.default('fixed'),
  value: z.number().default(0),
  taxable: z.boolean().default(false),
});

export const updatePayComponentSchema = createPayComponentSchema.partial();

export type CreatePayComponentInput = z.infer<typeof createPayComponentSchema>;
export type UpdatePayComponentInput = z.infer<typeof updatePayComponentSchema>;

// ------------------------------------------------------------------
//  Salary structures (a named bundle of components)
// ------------------------------------------------------------------

export const structureComponentSchema = z.object({
  code: z.string().min(1),
  calcMode: calcModeSchema,
  value: z.number(),
});

export const createSalaryStructureSchema = z.object({
  name: z.string().trim().min(2).max(80),
  components: z.array(structureComponentSchema).min(1),
});

export const updateSalaryStructureSchema = createSalaryStructureSchema.partial();

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>;
export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>;

// ------------------------------------------------------------------
//  Assign structure to employee
// ------------------------------------------------------------------

export const assignStructureSchema = z.object({
  salaryStructureId: z.string().uuid(),
  effectiveFrom: z.string().datetime().optional(),
});

export type AssignStructureInput = z.infer<typeof assignStructureSchema>;

// ------------------------------------------------------------------
//  Pay runs
// ------------------------------------------------------------------

export const createPayRunSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export type CreatePayRunInput = z.infer<typeof createPayRunSchema>;

// ------------------------------------------------------------------
//  Tax tables (generic progressive brackets)
// ------------------------------------------------------------------

export const taxBracketSchema = z.object({
  from: z.number().min(0),
  to: z.number().nullable(),
  rate: z.number().min(0).max(100),
});

export const createTaxTableSchema = z.object({
  name: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
  year: z.number().int().min(2000).max(2100),
  brackets: z.array(taxBracketSchema).min(1),
});

export type CreateTaxTableInput = z.infer<typeof createTaxTableSchema>;
