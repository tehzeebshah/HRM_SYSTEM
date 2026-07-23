import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok } from '../../common/response';
import { sendCsv } from '../../common/csv';
import * as service from './reports.service';
import { prisma } from '../../config/prisma';

export const dashboard = asyncHandler(async (req, res) => {
  return ok(res, await service.getDashboard(req.tenantId!, req.auth!));
});

export const headcount = asyncHandler(async (req, res) => {
  return ok(res, await service.headcountReport(req.tenantId!));
});

export const headcountCsv = asyncHandler(async (req, res) => {
  const report = await service.headcountReport(req.tenantId!);
  sendCsv(res, 'headcount.csv', report.byDepartment);
});

export const attendance = asyncHandler(async (req, res) => {
  const to = new Date();
  const from = new Date(Date.now() - 30 * 86400_000);
  return ok(res, await service.attendanceReport(req.tenantId!, from, to));
});

export const leave = asyncHandler(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  return ok(res, await service.leaveReport(req.tenantId!, year));
});

export const payroll = asyncHandler(async (req, res) => {
  return ok(res, await service.payrollReport(req.tenantId!));
});

export const payrollCsv = asyncHandler(async (req, res) => {
  const report = await service.payrollReport(req.tenantId!);
  sendCsv(res, 'payroll.csv', report.runs as unknown as Record<string, unknown>[]);
});

export const assets = asyncHandler(async (req, res) => {
  return ok(res, await service.assetReport(req.tenantId!));
});

/** Raw employees export — useful for off-system processing. */
export const employeesCsv = asyncHandler(async (req, res) => {
  const rows = await prisma.employee.findMany({
    where: { tenantId: req.tenantId!, deletedAt: null },
    select: { employeeNo: true, firstName: true, lastName: true, email: true, status: true, employmentType: true, hireDate: true },
    orderBy: { firstName: 'asc' },
  });
  sendCsv(
    res,
    'employees.csv',
    rows.map((r) => ({ ...r, hireDate: r.hireDate.toISOString().slice(0, 10) })),
  );
});
