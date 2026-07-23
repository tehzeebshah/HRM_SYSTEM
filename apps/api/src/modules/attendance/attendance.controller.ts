import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../../common/errors';
import { created, ok, paginate } from '../../common/response';
import { attendanceQuerySchema, manualAttendanceSchema } from '@hrms/shared';
import { getCurrentEmployee } from '../../common/identity';
import * as service from './attendance.service';

// ---- self-service ----

export const clockIn = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const row = await service.clockIn(req.tenantId!, me.id, req.body.note);
  return created(res, row);
});

export const clockOut = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const row = await service.clockOut(req.tenantId!, me.id, req.body.note);
  return ok(res, row);
});

export const myToday = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const row = await service.getMyToday(req.tenantId!, me.id);
  return ok(res, row);
});

// ---- timesheet (manager/hr) ----

export const list = asyncHandler(async (req, res) => {
  const query = attendanceQuerySchema.parse(req.query);
  const { rows, total, page, pageSize } = await service.listAttendance(req.tenantId!, query);
  return paginate(res, rows, total, page, pageSize);
});

export const summary = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 86400_000);
  const to = req.query.to ? new Date(req.query.to as string) : new Date();
  const employeeId = (req.query.employeeId as string | undefined) ?? undefined;
  const result = await service.getSummary(req.tenantId!, employeeId, from, to);
  return ok(res, result);
});

// ---- manual entry / correction (hr) ----

export const upsertManual = asyncHandler(async (req, res) => {
  const input = manualAttendanceSchema.parse(req.body);
  if (input.clockIn && input.clockOut && new Date(input.clockOut) < new Date(input.clockIn)) {
    throw HttpError.badRequest('Clock-out cannot be before clock-in.');
  }
  const row = await service.upsertManual(req.tenantId!, {
    employeeId: input.employeeId,
    date: new Date(input.date),
    clockIn: input.clockIn ? new Date(input.clockIn) : null,
    clockOut: input.clockOut ? new Date(input.clockOut) : null,
    status: input.status,
    notes: input.notes,
  });
  return ok(res, row);
});
