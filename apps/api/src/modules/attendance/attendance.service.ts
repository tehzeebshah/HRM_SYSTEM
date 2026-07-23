import { prisma } from '../../config/prisma';
import { HttpError } from '../../common/errors';
import type { AttendanceQuery } from '@hrms/shared';
import type { Prisma } from '../../../prisma/generated';

/** Computes status from clock-in time vs a 09:00 default + grace. */
function deriveStatus(clockIn: Date): 'present' | 'late' {
  const hours = clockIn.getUTCHours();
  const minutes = clockIn.getUTCMinutes();
  const totalMin = hours * 60 + minutes;
  // 09:15 default cutoff (configurable later per shift); anything later = late.
  return totalMin > 9 * 60 + 15 ? 'late' : 'present';
}

/** Day boundary in UTC for the given timestamp (used as the unique key per day). */
function dayOf(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

// ------------------------------------------------------------------
//  Clock in / out (self-service)
// ------------------------------------------------------------------

export async function clockIn(tenantId: string, employeeId: string, note?: string) {
  const today = dayOf(new Date());
  const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date: today } } });
  if (existing?.clockOut) {
    throw HttpError.conflict('You have already clocked out today.');
  }
  if (existing?.clockIn) {
    throw HttpError.conflict('You have already clocked in today.');
  }
  const now = new Date();
  return prisma.attendance.create({
    data: {
      tenantId,
      employeeId,
      date: today,
      clockIn: now,
      status: deriveStatus(now),
      source: 'web',
      notes: note ?? null,
    },
  });
}

export async function clockOut(tenantId: string, employeeId: string, note?: string) {
  const today = dayOf(new Date());
  const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date: today } } });
  if (!existing) throw HttpError.badRequest('You have not clocked in today.');
  if (!existing.clockIn) throw HttpError.badRequest('You have not clocked in today.');
  if (existing.clockOut) throw HttpError.conflict('You have already clocked out today.');

  const now = new Date();
  const overtimeMins = computeOvertime(existing.clockIn, now);
  return prisma.attendance.update({
    where: { id: existing.id },
    data: {
      clockOut: now,
      overtimeMins,
      notes: note ? (existing.notes ? `${existing.notes}\n${note}` : note) : existing.notes,
    },
  });
}

/** Today's status for the self-service widget. */
export async function getMyToday(tenantId: string, employeeId: string) {
  const today = dayOf(new Date());
  const record = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  });
  return record;
}

function computeOvertime(clockIn: Date, clockOut: Date): number {
  const workedMin = Math.round((clockOut.getTime() - clockIn.getTime()) / 60_000);
  const standard = 8 * 60; // 8h standard day
  return Math.max(0, workedMin - standard);
}

// ------------------------------------------------------------------
//  List / timesheet
// ------------------------------------------------------------------

function buildWhere(tenantId: string, query: AttendanceQuery): Prisma.AttendanceWhereInput {
  const where: Prisma.AttendanceWhereInput = { tenantId };
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = dayOf(new Date(query.from));
    if (query.to) where.date.lte = dayOf(new Date(query.to));
  }
  return where;
}

export async function listAttendance(tenantId: string, query: AttendanceQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const where = buildWhere(tenantId, query);

  const [rows, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true, department: { select: { name: true } } } },
      },
      orderBy: [{ date: 'desc' }, { employee: { firstName: 'asc' } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.attendance.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

// ------------------------------------------------------------------
//  Manual entry / correction (HR/manager)
// ------------------------------------------------------------------

export async function upsertManual(
  tenantId: string,
  data: {
    employeeId: string;
    date: Date;
    clockIn: Date | null;
    clockOut: Date | null;
    status?: string;
    notes?: string;
  },
) {
  const employee = await prisma.employee.findFirst({ where: { id: data.employeeId, tenantId, deletedAt: null } });
  if (!employee) throw HttpError.notFound('Employee not found.');

  const day = dayOf(data.date);
  return prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: data.employeeId, date: day } },
    create: {
      tenantId,
      employeeId: data.employeeId,
      date: day,
      clockIn: data.clockIn,
      clockOut: data.clockOut,
      status: data.status ?? (data.clockIn ? deriveStatus(data.clockIn) : 'present'),
      source: 'manual',
      notes: data.notes ?? null,
    },
    update: {
      clockIn: data.clockIn,
      clockOut: data.clockOut,
      ...(data.status && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

// ------------------------------------------------------------------
//  Summary
// ------------------------------------------------------------------

export async function getSummary(tenantId: string, employeeId: string | undefined, from: Date, to: Date) {
  const where: Prisma.AttendanceWhereInput = {
    tenantId,
    date: { gte: dayOf(from), lte: dayOf(to) },
    ...(employeeId && { employeeId }),
  };
  const grouped = await prisma.attendance.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
    _sum: { overtimeMins: true },
  });
  const summary: Record<string, { count: number; overtimeMins: number }> = {};
  for (const g of grouped) {
    summary[g.status] = { count: g._count._all, overtimeMins: g._sum.overtimeMins ?? 0 };
  }
  return summary;
}
