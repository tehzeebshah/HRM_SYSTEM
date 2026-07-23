import { prisma } from '../../config/prisma';
import { HttpError } from '../../common/errors';
import type { Prisma } from '../../../prisma/generated';
import {
  computePay,
  type Bracket,
  type CatalogEntry,
  type StructureComponentInput,
} from './payroll.engine';

// Re-export the pure engine for callers that imported it from the service.
export * from './payroll.engine';

async function loadCatalog(tenantId: string): Promise<Map<string, CatalogEntry>> {
  const rows = await prisma.payComponent.findMany({ where: { tenantId } });
  return new Map(rows.map((r) => [r.code, { code: r.code, name: r.name, type: r.type as CatalogEntry['type'] }]));
}

async function loadBrackets(tenantId: string, year: number): Promise<Bracket[] | undefined> {
  const table = await prisma.taxTable.findFirst({
    where: { tenantId, year },
    orderBy: { createdAt: 'desc' },
  });
  if (!table) return undefined;
  return (table.brackets as unknown as Bracket[]) ?? [];
}

// ==================================================================
//  Pay components CRUD
// ==================================================================

export async function listComponents(tenantId: string) {
  return prisma.payComponent.findMany({ where: { tenantId }, orderBy: [{ type: 'asc' }, { code: 'asc' }] });
}

export async function createComponent(
  tenantId: string,
  data: { code: string; name: string; type: string; calcMode?: string; value?: number; taxable?: boolean },
) {
  return prisma.payComponent.create({
    data: {
      tenantId,
      code: data.code,
      name: data.name,
      type: data.type,
      calcMode: data.calcMode ?? 'fixed',
      value: data.value ?? 0,
      taxable: data.taxable ?? false,
    },
  });
}

export async function updateComponent(tenantId: string, id: string, data: Partial<{ code: string; name: string; type: string; calcMode: string; value: number; taxable: boolean }>) {
  return prisma.payComponent.update({ where: { id }, data: data as Prisma.PayComponentUpdateInput });
}

export async function deleteComponent(tenantId: string, id: string) {
  const inUse = await prisma.salaryStructure.findFirst({
    where: { tenantId, components: { path: ['$'], array_contains: id } },
  });
  if (inUse) throw HttpError.conflict('Cannot delete a component referenced by a salary structure.');
  await prisma.payComponent.deleteMany({ where: { id, tenantId } });
}

// ==================================================================
//  Salary structures CRUD
// ==================================================================

export async function listStructures(tenantId: string) {
  return prisma.salaryStructure.findMany({
    where: { tenantId },
    orderBy: [{ name: 'asc' }],
    include: { _count: { select: { assignments: true } } },
  });
}

export async function createStructure(
  tenantId: string,
  data: { name: string; components: StructureComponentInput[] },
) {
  return prisma.salaryStructure.create({
    data: { tenantId, name: data.name, components: data.components as unknown as Prisma.InputJsonValue },
  });
}

export async function updateStructure(
  tenantId: string,
  id: string,
  data: Partial<{ name: string; components: StructureComponentInput[] }>,
) {
  return prisma.salaryStructure.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.components !== undefined && { components: data.components as unknown as Prisma.InputJsonValue }),
    },
  });
}

export async function deleteStructure(tenantId: string, id: string) {
  const assigned = await prisma.employeeSalaryAssignment.findFirst({ where: { salaryStructureId: id, tenantId } });
  if (assigned) throw HttpError.conflict('Cannot delete a structure that is assigned to employees.');
  await prisma.salaryStructure.deleteMany({ where: { id, tenantId } });
}

// ==================================================================
//  Assign structure to employee
// ==================================================================

export async function assignStructure(
  tenantId: string,
  employeeId: string,
  salaryStructureId: string,
  effectiveFrom?: Date,
) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } });
  if (!employee) throw HttpError.notFound('Employee not found.');
  const structure = await prisma.salaryStructure.findFirst({ where: { id: salaryStructureId, tenantId } });
  if (!structure) throw HttpError.notFound('Salary structure not found.');

  // Close any current open-ended assignment, then create the new one.
  return prisma.$transaction(async (tx) => {
    await tx.employeeSalaryAssignment.updateMany({
      where: { employeeId, tenantId, effectiveTo: null },
      data: { effectiveTo: new Date() },
    });
    return tx.employeeSalaryAssignment.create({
      data: {
        tenantId,
        employeeId,
        salaryStructureId,
        effectiveFrom: effectiveFrom ?? new Date(),
      },
    });
  });
}

export async function getEmployeeStructure(tenantId: string, employeeId: string) {
  const assignment = await prisma.employeeSalaryAssignment.findFirst({
    where: { tenantId, employeeId, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
    include: { structure: true },
  });
  return assignment;
}

// ==================================================================
//  Tax tables
// ==================================================================

export async function listTaxTables(tenantId: string) {
  return prisma.taxTable.findMany({ where: { tenantId }, orderBy: [{ year: 'desc' }, { country: 'asc' }] });
}

export async function createTaxTable(
  tenantId: string,
  data: { name: string; country: string; year: number; brackets: Bracket[] },
) {
  return prisma.taxTable.create({
    data: {
      tenantId,
      name: data.name,
      country: data.country,
      year: data.year,
      brackets: data.brackets as unknown as Prisma.InputJsonValue,
    },
  });
}

// ==================================================================
//  Pay runs
// ==================================================================

export async function listPayRuns(tenantId: string) {
  return prisma.payRun.findMany({
    where: { tenantId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { _count: { select: { payslips: true } } },
  });
}

export async function getPayRun(tenantId: string, id: string) {
  const run = await prisma.payRun.findFirst({
    where: { id, tenantId },
    include: { payslips: { include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } } } } },
  });
  if (!run) throw HttpError.notFound('Pay run not found.');
  return run;
}

export async function createPayRun(tenantId: string, runById: string, month: number, year: number) {
  const existing = await prisma.payRun.findUnique({ where: { tenantId_month_year: { tenantId, month, year } } });
  if (existing) throw HttpError.conflict(`A pay run for ${month}/${year} already exists.`);
  return prisma.payRun.create({ data: { tenantId, month, year, status: 'draft', runById } });
}

/**
 * Processes a pay run: recomputes every active employee's payslip using their
 * current salary structure + the tenant component catalog + active tax table.
 * Allowed while status is `draft` (idempotent re-runs wipe & regenerate).
 */
export async function processPayRun(tenantId: string, runById: string, payRunId: string) {
  const run = await prisma.payRun.findFirst({ where: { id: payRunId, tenantId } });
  if (!run) throw HttpError.notFound('Pay run not found.');
  if (run.status === 'locked') throw HttpError.conflict('This pay run is locked and cannot be reprocessed.');

  const catalog = await loadCatalog(tenantId);
  const brackets = await loadBrackets(tenantId, run.year);

  // Active employees + their current structure assignment.
  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null, status: 'active' },
    select: {
      id: true,
      salaryAssignments: {
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        include: { structure: true },
      },
    },
  });

  const slips: Prisma.PayslipCreateManyInput[] = [];
  let totalGross = 0;
  let totalDeductions = 0;
  let totalTax = 0;
  let totalNet = 0;

  for (const emp of employees) {
    const assignment = emp.salaryAssignments[0];
    if (!assignment) continue; // employee without a salary structure → skipped
    const structureComponents = (assignment.structure.components as unknown as StructureComponentInput[]) ?? [];
    const pay = computePay(structureComponents, catalog, brackets);
    slips.push({
      tenantId,
      payRunId,
      employeeId: emp.id,
      gross: pay.gross,
      deductions: pay.totalDeductions,
      tax: pay.tax,
      net: pay.net,
      components: pay.components as unknown as Prisma.InputJsonValue,
      status: 'generated',
    });
    totalGross += pay.gross;
    totalDeductions += pay.totalDeductions;
    totalTax += pay.tax;
    totalNet += pay.net;
  }

  await prisma.$transaction(async (tx) => {
    // Idempotent: wipe previous drafts for this run before regenerating.
    await tx.payslip.deleteMany({ where: { payRunId } });
    if (slips.length) await tx.payslip.createMany({ data: slips });
    await tx.payRun.update({
      where: { id: payRunId },
      data: {
        status: 'completed',
        runById,
        runAt: new Date(),
        totals: { gross: totalGross, deductions: totalDeductions, tax: totalTax, net: totalNet, count: slips.length } as unknown as Prisma.InputJsonValue,
      },
    });
  });

  return getPayRun(tenantId, payRunId);
}

export async function lockPayRun(tenantId: string, payRunId: string) {
  const run = await prisma.payRun.findFirst({ where: { id: payRunId, tenantId } });
  if (!run) throw HttpError.notFound('Pay run not found.');
  if (run.status !== 'completed') throw HttpError.conflict('Only a completed pay run can be locked.');
  return prisma.payRun.update({ where: { id: payRunId }, data: { status: 'locked' } });
}

// ==================================================================
//  Payslips
// ==================================================================

export async function getPayslip(tenantId: string, payslipId: string) {
  const slip = await prisma.payslip.findFirst({
    where: { id: payslipId, tenantId },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
      payRun: { select: { id: true, month: true, year: true, status: true } },
    },
  });
  if (!slip) throw HttpError.notFound('Payslip not found.');
  return slip;
}

export async function listEmployeePayslips(tenantId: string, employeeId: string) {
  return prisma.payslip.findMany({
    where: { tenantId, employeeId },
    orderBy: { createdAt: 'desc' },
    include: { payRun: { select: { month: true, year: true, status: true } } },
  });
}
