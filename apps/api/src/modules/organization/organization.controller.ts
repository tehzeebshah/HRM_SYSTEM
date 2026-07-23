import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/errors';
import { created, noContent, ok, paginate, parsePagination } from '../../common/response';
import * as orgService from './organization.service';

// ---- departments ----

export const listDepartments = asyncHandler(async (req, res) => {
  const rows = await orgService.listDepartments(req.tenantId!);
  return ok(res, rows);
});

export const getDepartmentTree = asyncHandler(async (req, res) => {
  const tree = await orgService.getDepartmentTree(req.tenantId!);
  return ok(res, tree);
});

export const createDepartment = asyncHandler(async (req, res) => {
  const row = await orgService.createDepartment(req.tenantId!, req.body);
  return created(res, row);
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const row = await orgService.updateDepartment(req.tenantId!, req.params.id!, req.body);
  return ok(res, row);
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  await orgService.deleteDepartment(req.tenantId!, req.params.id!);
  return noContent(res);
});

// ---- designations ----

export const listDesignations = asyncHandler(async (req, res) => {
  const rows = await orgService.listDesignations(req.tenantId!);
  return ok(res, rows);
});

export const createDesignation = asyncHandler(async (req, res) => {
  const row = await orgService.createDesignation(req.tenantId!, req.body);
  return created(res, row);
});

export const updateDesignation = asyncHandler(async (req, res) => {
  const row = await orgService.updateDesignation(req.tenantId!, req.params.id!, req.body);
  return ok(res, row);
});

export const deleteDesignation = asyncHandler(async (req, res) => {
  await orgService.deleteDesignation(req.tenantId!, req.params.id!);
  return noContent(res);
});

// ---- locations ----

export const listLocations = asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const all = await orgService.listLocations(req.tenantId!);
  // Locations are usually few; simple slice pagination keeps the response shape uniform.
  const start = (page - 1) * pageSize;
  return paginate(res, all.slice(start, start + pageSize), all.length, page, pageSize);
});

export const createLocation = asyncHandler(async (req, res) => {
  const row = await orgService.createLocation(req.tenantId!, req.body);
  return created(res, row);
});

export const updateLocation = asyncHandler(async (req, res) => {
  const row = await orgService.updateLocation(req.tenantId!, req.params.id!, req.body);
  return ok(res, row);
});

export const deleteLocation = asyncHandler(async (req, res) => {
  await orgService.deleteLocation(req.tenantId!, req.params.id!);
  return noContent(res);
});
