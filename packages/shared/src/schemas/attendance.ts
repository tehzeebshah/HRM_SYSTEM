import { z } from 'zod';

// ------------------------------------------------------------------
//  Attendance
// ------------------------------------------------------------------

export const clockInSchema = z.object({
  note: z.string().max(500).optional(),
});

export const clockOutSchema = z.object({
  note: z.string().max(500).optional(),
});

/** HR/manager manual entry / correction for a past day. */
export const manualAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().datetime(),
  clockIn: z.string().datetime().nullable().optional(),
  clockOut: z.string().datetime().nullable().optional(),
  status: z.enum(['present', 'late', 'absent', 'on_leave', 'half_day']).optional(),
  notes: z.string().max(500).optional(),
});

export const attendanceQuerySchema = z.object({
  page: z.coerce.number().min(1).optional(),
  pageSize: z.coerce.number().min(1).max(200).optional(),
  employeeId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.enum(['present', 'late', 'absent', 'on_leave', 'half_day']).optional(),
});

export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

// ------------------------------------------------------------------
//  Leave
// ------------------------------------------------------------------

export const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(1).max(40),
  accrualRate: z.number().min(0).default(0),
  carryForward: z.boolean().default(false),
  paid: z.boolean().default(true),
  color: z.string().max(20).optional(),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid(),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  reason: z.string().max(1000).optional(),
});

export const leaveDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  decisionNote: z.string().max(1000).optional(),
});

export const leaveRequestQuerySchema = z.object({
  page: z.coerce.number().min(1).optional(),
  pageSize: z.coerce.number().min(1).max(200).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  employeeId: z.string().uuid().optional(),
  pendingApprovalBy: z.string().uuid().optional(),
});

export const leaveBalanceQuerySchema = z.object({
  year: z.coerce.number().min(2000).max(2100).optional(),
  employeeId: z.string().uuid().optional(),
});

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type LeaveDecisionInput = z.infer<typeof leaveDecisionSchema>;
export type LeaveRequestQuery = z.infer<typeof leaveRequestQuerySchema>;
export type LeaveBalanceQuery = z.infer<typeof leaveBalanceQuerySchema>;
