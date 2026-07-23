import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../../common/errors';
import { created, noContent, ok } from '../../common/response';
import {
  assignStructureSchema,
  createPayComponentSchema,
  createPayRunSchema,
  createSalaryStructureSchema,
  createTaxTableSchema,
  updatePayComponentSchema,
  updateSalaryStructureSchema,
} from '@hrms/shared';
import { getCurrentEmployee } from '../../common/identity';
import * as service from './payroll.service';

// ---- components ----

export const listComponents = asyncHandler(async (req, res) => {
  const rows = await service.listComponents(req.tenantId!);
  return ok(res, rows);
});

export const createComponent = asyncHandler(async (req, res) => {
  const row = await service.createComponent(req.tenantId!, req.body);
  return created(res, row);
});

export const updateComponent = asyncHandler(async (req, res) => {
  const row = await service.updateComponent(req.tenantId!, req.params.id!, req.body);
  return ok(res, row);
});

export const deleteComponent = asyncHandler(async (req, res) => {
  await service.deleteComponent(req.tenantId!, req.params.id!);
  return noContent(res);
});

// ---- structures ----

export const listStructures = asyncHandler(async (req, res) => {
  const rows = await service.listStructures(req.tenantId!);
  return ok(res, rows);
});

export const createStructure = asyncHandler(async (req, res) => {
  const row = await service.createStructure(req.tenantId!, req.body);
  return created(res, row);
});

export const updateStructure = asyncHandler(async (req, res) => {
  const row = await service.updateStructure(req.tenantId!, req.params.id!, req.body);
  return ok(res, row);
});

export const deleteStructure = asyncHandler(async (req, res) => {
  await service.deleteStructure(req.tenantId!, req.params.id!);
  return noContent(res);
});

export const assignStructure = asyncHandler(async (req, res) => {
  const input = assignStructureSchema.parse(req.body);
  const row = await service.assignStructure(
    req.tenantId!,
    req.params.id!,
    input.salaryStructureId,
    input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
  );
  return created(res, row);
});

export const getEmployeeStructure = asyncHandler(async (req, res) => {
  const row = await service.getEmployeeStructure(req.tenantId!, req.params.id!);
  return ok(res, row);
});

// ---- tax tables ----

export const listTaxTables = asyncHandler(async (req, res) => {
  const rows = await service.listTaxTables(req.tenantId!);
  return ok(res, rows);
});

export const createTaxTable = asyncHandler(async (req, res) => {
  const row = await service.createTaxTable(req.tenantId!, req.body);
  return created(res, row);
});

// ---- pay runs ----

export const listPayRuns = asyncHandler(async (req, res) => {
  const rows = await service.listPayRuns(req.tenantId!);
  return ok(res, rows);
});

export const getPayRun = asyncHandler(async (req, res) => {
  const row = await service.getPayRun(req.tenantId!, req.params.id!);
  return ok(res, row);
});

export const createPayRun = asyncHandler(async (req, res) => {
  const input = createPayRunSchema.parse(req.body);
  const row = await service.createPayRun(req.tenantId!, req.auth!.userId, input.month, input.year);
  return created(res, row);
});

export const processPayRun = asyncHandler(async (req, res) => {
  const row = await service.processPayRun(req.tenantId!, req.auth!.userId, req.params.id!);
  return ok(res, row);
});

export const lockPayRun = asyncHandler(async (req, res) => {
  const row = await service.lockPayRun(req.tenantId!, req.params.id!);
  return ok(res, row);
});

// ---- payslips ----

export const getPayslip = asyncHandler(async (req, res) => {
  const row = await service.getPayslip(req.tenantId!, req.params.id!);
  return ok(res, row);
});

export const myPayslips = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const rows = await service.listEmployeePayslips(req.tenantId!, me.id);
  return ok(res, rows);
});
