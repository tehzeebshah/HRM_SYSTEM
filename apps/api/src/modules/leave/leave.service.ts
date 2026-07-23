import { prisma } from '../../config/prisma';
import { HttpError } from '../../common/errors';
import type { LeaveRequestQuery } from '@hrms/shared';
import type { Prisma } from '../../../prisma/generated';
import { workingDays } from './leave.engine';

// ------------------------------------------------------------------
//  Leave types (tenant-wide)
// ------------------------------------------------------------------

export async function listLeaveTypes(tenantId: string) {
  return prisma.leaveType.findMany({
    where: { tenantId },
    orderBy: [{ name: 'asc' }],
    include: { _count: { select: { requests: true } } },
  });
}

export async function createLeaveType(
  tenantId: string,
  data: { name: string; code: string; accrualRate?: number; carryForward?: boolean; paid?: boolean; color?: string | null },
) {
  return prisma.leaveType.create({
    data: {
      tenantId,
      name: data.name,
      code: data.code,
      accrualRate: data.accrualRate ?? 0,
      carryForward: data.carryForward ?? false,
      paid: data.paid ?? true,
      color: data.color ?? null,
    },
  });
}

export async function updateLeaveType(
  tenantId: string,
  id: string,
  data: Partial<{ name: string; code: string; accrualRate: number; carryForward: boolean; paid: boolean; color: string | null }>,
) {
  return prisma.leaveType.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.accrualRate !== undefined && { accrualRate: data.accrualRate }),
      ...(data.carryForward !== undefined && { carryForward: data.carryForward }),
      ...(data.paid !== undefined && { paid: data.paid }),
      ...(data.color !== undefined && { color: data.color }),
    },
  });
}

export async function deleteLeaveType(tenantId: string, id: string) {
  const inUse = await prisma.leaveRequest.findFirst({ where: { leaveTypeId: id, tenantId } });
  if (inUse) throw HttpError.conflict('Cannot delete a leave type that has requests.');
  await prisma.leaveType.deleteMany({ where: { id, tenantId } });
}

// ------------------------------------------------------------------
//  Leave requests
// ------------------------------------------------------------------



export async function createLeaveRequest(
  tenantId: string,
  employeeId: string,
  data: { leaveTypeId: string; fromDate: Date; toDate: Date; reason?: string },
) {
  const from = new Date(data.fromDate);
  const to = new Date(data.toDate);
  if (to < from) throw HttpError.badRequest('End date cannot be before start date.');

  const leaveType = await prisma.leaveType.findFirst({ where: { id: data.leaveTypeId, tenantId } });
  if (!leaveType) throw HttpError.notFound('Leave type not found.');

  // Overlap check: no overlapping approved/pending leave for the same employee.
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      tenantId,
      employeeId,
      status: { in: ['pending', 'approved'] },
      AND: [{ fromDate: { lte: to } }, { toDate: { gte: from } }],
    },
  });
  if (overlap) throw HttpError.conflict('You already have leave overlapping these dates.');

  const holidays = await prisma.holiday.findMany({
    where: { tenantId, date: { gte: from, lte: to } },
    select: { date: true },
  });
  const days = workingDays(from, to, holidays.map((h) => h.date));

  return prisma.leaveRequest.create({
    data: {
      tenantId,
      employeeId,
      leaveTypeId: data.leaveTypeId,
      fromDate: from,
      toDate: to,
      days,
      reason: data.reason ?? null,
      status: 'pending',
    },
    include: { leaveType: { select: { id: true, name: true, code: true, paid: true } } },
  });
}

export async function cancelLeaveRequest(tenantId: string, employeeId: string, requestId: string) {
  const req = await prisma.leaveRequest.findFirst({ where: { id: requestId, tenantId, employeeId } });
  if (!req) throw HttpError.notFound('Leave request not found.');
  if (req.status === 'approved') throw HttpError.conflict('Cannot cancel an approved request; ask your manager to reject it.');
  return prisma.leaveRequest.update({ where: { id: requestId }, data: { status: 'cancelled' } });
}

function buildWhere(tenantId: string, query: LeaveRequestQuery): Prisma.LeaveRequestWhereInput {
  const where: Prisma.LeaveRequestWhereInput = { tenantId };
  if (query.status) where.status = query.status;
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.pendingApprovalBy) {
    where.status = 'pending';
    where.employee = { managerId: query.pendingApprovalBy };
  }
  return where;
}

export async function listLeaveRequests(tenantId: string, query: LeaveRequestQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const where = buildWhere(tenantId, query);
  const [rows, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: { select: { id: true, name: true, code: true, paid: true } },
        employee: {
          select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.leaveRequest.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

export async function decideLeaveRequest(
  tenantId: string,
  approverId: string,
  requestId: string,
  decision: { status: 'approved' | 'rejected'; decisionNote?: string },
) {
  const req = await prisma.leaveRequest.findFirst({
    where: { id: requestId, tenantId },
    include: { employee: { select: { id: true, managerId: true } } },
  });
  if (!req) throw HttpError.notFound('Leave request not found.');
  if (req.status !== 'pending') throw HttpError.conflict('This request has already been processed.');

  // Run approval + balance update atomically.
  return prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: decision.status,
        approverId,
        decisionAt: new Date(),
        decisionNote: decision.decisionNote ?? null,
      },
    });

    if (decision.status === 'approved') {
      // Decrement the leave balance for the current year.
      const year = new Date(req.fromDate).getFullYear();
      const balance = await tx.leaveBalance.findUnique({
        where: { employeeId_leaveTypeId_year: { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, year } },
      });
      if (balance) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { used: { increment: req.days } },
        });
      } else {
        // No balance row yet → create with a negative allocation record (will show over-usage).
        await tx.leaveBalance.create({
          data: {
            tenantId,
            employeeId: req.employeeId,
            leaveTypeId: req.leaveTypeId,
            year,
            allocated: 0,
            used: req.days,
            carried: 0,
          },
        });
      }
    }
    return updated;
  });
}

// ------------------------------------------------------------------
//  Balances
// ------------------------------------------------------------------

export async function getBalances(tenantId: string, employeeId: string, year: number) {
  const balances = await prisma.leaveBalance.findMany({
    where: { tenantId, employeeId, year },
    include: { leaveType: { select: { id: true, name: true, code: true, paid: true, color: true } } },
  });

  // Ensure a row exists for every active leave type (read-friendly).
  const types = await prisma.leaveType.findMany({ where: { tenantId }, select: { id: true } });
  const have = new Set(balances.map((b) => b.leaveTypeId));
  const missing = types.filter((t) => !have.has(t.id));

  return {
    year,
    balances: balances.map((b) => ({
      id: b.id,
      leaveTypeId: b.leaveTypeId,
      name: b.leaveType.name,
      code: b.leaveType.code,
      paid: b.leaveType.paid,
      color: b.leaveType.color,
      allocated: b.allocated,
      used: b.used,
      carried: b.carried,
      remaining: Math.max(0, b.allocated + b.carried - b.used),
    })),
    missingTypeIds: missing.map((m) => m.id),
  };
}

/** HR: set the annual allocation for a leave type / employee. */
export async function setAllocation(
  tenantId: string,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  allocated: number,
) {
  return prisma.leaveBalance.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    create: { tenantId, employeeId, leaveTypeId, year, allocated, used: 0, carried: 0 },
    update: { allocated },
  });
}
