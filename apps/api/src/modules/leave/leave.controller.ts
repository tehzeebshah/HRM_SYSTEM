import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../../common/errors';
import { created, noContent, ok, paginate } from '../../common/response';
import {
  createLeaveRequestSchema,
  createLeaveTypeSchema,
  leaveBalanceQuerySchema,
  leaveDecisionSchema,
  leaveRequestQuerySchema,
  updateLeaveTypeSchema,
} from '@hrms/shared';
import { getCurrentEmployee } from '../../common/identity';
import * as service from './leave.service';

const currentYear = () => new Date().getFullYear();

// ---- leave types ----

export const listLeaveTypes = asyncHandler(async (req, res) => {
  const rows = await service.listLeaveTypes(req.tenantId!);
  return ok(res, rows);
});

export const createLeaveType = asyncHandler(async (req, res) => {
  const row = await service.createLeaveType(req.tenantId!, req.body);
  return created(res, row);
});

export const updateLeaveType = asyncHandler(async (req, res) => {
  const row = await service.updateLeaveType(req.tenantId!, req.params.id!, req.body);
  return ok(res, row);
});

export const deleteLeaveType = asyncHandler(async (req, res) => {
  await service.deleteLeaveType(req.tenantId!, req.params.id!);
  return noContent(res);
});

// ---- my requests (self-service) ----

export const myRequests = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const { rows, total, page, pageSize } = await service.listLeaveRequests(req.tenantId!, { employeeId: me.id });
  return paginate(res, rows, total, page, pageSize);
});

export const myBalances = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const year = (req.query.year ? Number(req.query.year) : currentYear()) || currentYear();
  const result = await service.getBalances(req.tenantId!, me.id, year);
  return ok(res, result);
});

export const createMyRequest = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const row = await service.createLeaveRequest(req.tenantId!, me.id, {
    leaveTypeId: req.body.leaveTypeId,
    fromDate: new Date(req.body.fromDate),
    toDate: new Date(req.body.toDate),
    reason: req.body.reason,
  });
  req.auditEntityId = row.id;
  return created(res, row);
});

export const cancelMyRequest = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const row = await service.cancelLeaveRequest(req.tenantId!, me.id, req.params.id!);
  return ok(res, row);
});

// ---- admin / manager views ----

export const listRequests = asyncHandler(async (req, res) => {
  const query = leaveRequestQuerySchema.parse(req.query);
  const { rows, total, page, pageSize } = await service.listLeaveRequests(req.tenantId!, query);
  return paginate(res, rows, total, page, pageSize);
});

export const approveReject = asyncHandler(async (req, res) => {
  const decision = leaveDecisionSchema.parse(req.body);
  const row = await service.decideLeaveRequest(req.tenantId!, req.auth!.userId, req.params.id!, decision);
  return ok(res, row);
});

export const employeeBalances = asyncHandler(async (req, res) => {
  const query = leaveBalanceQuerySchema.parse({ ...req.query, employeeId: req.params.id });
  const year = query.year ?? currentYear();
  const result = await service.getBalances(req.tenantId!, req.params.id!, year);
  return ok(res, result);
});

export const setAllocation = asyncHandler(async (req, res) => {
  if (typeof req.body.allocated !== 'number' || req.body.allocated < 0) {
    throw HttpError.badRequest('`allocated` must be a non-negative number.');
  }
  const year = req.body.year ? Number(req.body.year) : currentYear();
  const row = await service.setAllocation(
    req.tenantId!,
    req.params.id!,
    req.params.leaveTypeId!,
    year,
    req.body.allocated,
  );
  return ok(res, row);
});
