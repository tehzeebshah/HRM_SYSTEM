import { prisma } from '../../config/prisma';
import { maybeGetCurrentEmployee } from '../../common/identity';
import type { AuthContext } from '@hrms/shared';

type Role = AuthContext['role'];

/**
 * Role-scoped dashboard aggregate.
 * - admin/hr  → org-wide KPIs
 * - manager   → team KPIs (reports to them)
 * - employee  → personal KPIs
 */
export async function getDashboard(tenantId: string, auth: AuthContext) {
  const me = await maybeGetCurrentEmployee(tenantId, auth.userId);

  if (auth.role === 'admin' || auth.role === 'hr') {
    return orgDashboard(tenantId);
  }
  if (auth.role === 'manager' && me) {
    return teamDashboard(tenantId, me);
  }
  if (me) {
    return personalDashboard(tenantId, me);
  }
  // No employee profile (e.g. an admin without a record) → minimal.
  return { scope: 'none', tenant: { headcount: await headcountTotal(tenantId) } };
}

async function orgDashboard(tenantId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [headcount, departments, onLeaveToday, pendingApprovals, gender, employment, assets, lastPayRun] = await Promise.all([
    headcountTotal(tenantId),
    prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true, _count: { select: { employees: { where: { deletedAt: null } } } } }, orderBy: { name: 'asc' } }),
    prisma.leaveRequest.count({ where: { tenantId, status: 'approved', fromDate: { lte: today }, toDate: { gte: today } } }),
    prisma.leaveRequest.count({ where: { tenantId, status: 'pending' } }),
    prisma.employee.groupBy({ by: ['gender'], where: { tenantId, deletedAt: null }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ['employmentType'], where: { tenantId, deletedAt: null }, _count: { _all: true } }),
    prisma.asset.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }),
    prisma.payRun.findFirst({ where: { tenantId }, orderBy: { year: 'desc' }, select: { month: true, year: true, totals: true, status: true } }),
  ]);

  return {
    scope: 'org',
    headcount,
    onLeaveToday,
    pendingApprovals,
    lastPayRun,
    departments: departments.map((d) => ({ name: d.name, count: d._count.employees })),
    gender: breakdown(gender, 'gender'),
    employmentTypes: breakdown(employment, 'employmentType'),
    assets: breakdown(assets, 'status'),
  };
}

async function teamDashboard(tenantId: string, managerId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const reports = await prisma.employee.findMany({
    where: { tenantId, managerId, deletedAt: null },
    select: { id: true },
  });
  const reportIds = reports.map((r) => r.id);

  const [teamSize, pendingApprovals, onLeaveToday] = await Promise.all([
    reportIds.length,
    prisma.leaveRequest.count({ where: { tenantId, status: 'pending', employeeId: { in: reportIds } } }),
    prisma.leaveRequest.count({
      where: { tenantId, status: 'approved', employeeId: { in: reportIds }, fromDate: { lte: today }, toDate: { gte: today } },
    }),
  ]);

  return { scope: 'team', teamSize, pendingApprovals, onLeaveToday };
}

async function personalDashboard(tenantId: string, employeeId: string) {
  const year = new Date().getFullYear();
  const [balances, lastPayslip, pendingLeave] = await Promise.all([
    prisma.leaveBalance.findMany({ where: { tenantId, employeeId, year }, include: { leaveType: { select: { name: true } } } }),
    prisma.payslip.findFirst({ where: { tenantId, employeeId }, orderBy: { createdAt: 'desc' }, include: { payRun: { select: { month: true, year: true } } } }),
    prisma.leaveRequest.count({ where: { tenantId, employeeId, status: 'pending' } }),
  ]);

  const leaveRemaining = balances.reduce((s, b) => s + Math.max(0, b.allocated + b.carried - b.used), 0);

  return {
    scope: 'personal',
    leaveRemaining,
    leaveBreakdown: balances.map((b) => ({ name: b.leaveType.name, remaining: Math.max(0, b.allocated + b.carried - b.used) })),
    lastPayslip: lastPayslip ? { net: lastPayslip.net, month: lastPayslip.payRun.month, year: lastPayslip.payRun.year } : null,
    pendingLeave,
  };
}

// ------------------------------------------------------------------
//  Detailed reports
// ------------------------------------------------------------------

export async function headcountReport(tenantId: string) {
  const [byDept, byStatus, byType, byGender, total] = await Promise.all([
    prisma.department.findMany({
      where: { tenantId },
      select: { name: true, _count: { select: { employees: { where: { deletedAt: null } } } } },
      orderBy: { name: 'asc' },
    }),
    prisma.employee.groupBy({ by: ['status'], where: { tenantId, deletedAt: null }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ['employmentType'], where: { tenantId, deletedAt: null }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ['gender'], where: { tenantId, deletedAt: null }, _count: { _all: true } }),
    headcountTotal(tenantId),
  ]);
  return { total, byDepartment: byDept.map((d) => ({ name: d.name, count: d._count.employees })), byStatus: breakdown(byStatus, 'status'), byEmploymentType: breakdown(byType, 'employmentType'), byGender: breakdown(byGender, 'gender') };
}

export async function attendanceReport(tenantId: string, from: Date, to: Date) {
  const grouped = await prisma.attendance.groupBy({
    by: ['status'],
    where: { tenantId, date: { gte: from, lte: to } },
    _count: { _all: true },
    _sum: { overtimeMins: true },
  });
  return { from: from.toISOString(), to: to.toISOString(), byStatus: grouped.map((g) => ({ status: g.status, count: g._count._all, overtimeMins: g._sum.overtimeMins ?? 0 })) };
}

export async function leaveReport(tenantId: string, year: number) {
  const rows = await prisma.leaveRequest.findMany({
    where: { tenantId, status: 'approved', fromDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
    select: { days: true, leaveTypeId: true, leaveType: { select: { name: true, code: true } } },
  });
  const byType = new Map<string, { name: string; code: string; days: number; count: number }>();
  for (const r of rows) {
    const key = r.leaveTypeId;
    const entry = byType.get(key) ?? { name: r.leaveType.name, code: r.leaveType.code, days: 0, count: 0 };
    entry.days += r.days;
    entry.count += 1;
    byType.set(key, entry);
  }
  return { year, byType: [...byType.values()], totalDays: [...byType.values()].reduce((s, t) => s + t.days, 0) };
}

export async function payrollReport(tenantId: string) {
  const runs = await prisma.payRun.findMany({
    where: { tenantId, status: { in: ['completed', 'locked'] } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    select: { month: true, year: true, totals: true, status: true, _count: { select: { payslips: true } } },
    take: 12,
  });
  return {
    runs: runs.map((r) => ({
      period: `${r.year}-${String(r.month).padStart(2, '0')}`,
      status: r.status,
      payslips: r._count.payslips,
      ...(r.totals as object),
    })),
  };
}

export async function assetReport(tenantId: string) {
  const grouped = await prisma.asset.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } });
  const totalValue = await prisma.asset.aggregate({ where: { tenantId }, _sum: { value: true } });
  return { byStatus: grouped.map((g) => ({ status: g.status, count: g._count._all })), totalValue: totalValue._sum.value ?? 0 };
}

// ------------------------------------------------------------------
//  helpers
// ------------------------------------------------------------------

async function headcountTotal(tenantId: string): Promise<number> {
  return prisma.employee.count({ where: { tenantId, deletedAt: null, status: 'active' } });
}

function breakdown<T extends Record<string, unknown>>(rows: T[], key: keyof T): { label: string; count: number }[] {
  return rows.map((r) => ({ label: String(r[key] ?? 'unknown'), count: (r._count as { _all: number })._all }));
}
