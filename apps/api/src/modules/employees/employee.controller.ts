import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../../common/errors';
import { created, noContent, ok, paginate } from '../../common/response';
import { employeeQuerySchema } from '@hrms/shared';
import * as empService from './employee.service';
import { uploadObject, getDownloadUrl, deleteObject } from '../storage/storage.service';

export const listEmployees = asyncHandler(async (req, res) => {
  const query = employeeQuerySchema.parse(req.query);
  const { rows, total, page, pageSize } = await empService.listEmployees(req.tenantId!, query);
  return paginate(res, rows, total, page, pageSize);
});

export const getEmployee = asyncHandler(async (req, res) => {
  const employee = await empService.getEmployee(req.tenantId!, req.params.id!);
  return ok(res, employee);
});

export const createEmployee = asyncHandler(async (req, res) => {
  const data = {
    ...req.body,
    hireDate: new Date(req.body.hireDate),
    ...(req.body.dob && { dob: new Date(req.body.dob) }),
    ...(req.body.confirmDate && { confirmDate: new Date(req.body.confirmDate) }),
  };
  const row = await empService.createEmployee(req.tenantId!, data);
  req.auditEntityId = row.id;
  req.auditAfter = { id: row.id, employeeNo: row.employeeNo, email: row.email };
  return created(res, row);
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const data = {
    ...req.body,
    ...(req.body.dob !== undefined && { dob: req.body.dob ? new Date(req.body.dob) : null }),
    ...(req.body.confirmDate !== undefined && {
      confirmDate: req.body.confirmDate ? new Date(req.body.confirmDate) : null,
    }),
  };
  const row = await empService.updateEmployee(req.tenantId!, req.params.id!, data);
  return ok(res, row);
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  await empService.deleteEmployee(req.tenantId!, req.params.id!);
  return noContent(res);
});

// ---- reference data ----

export const getReferenceData = asyncHandler(async (req, res) => {
  const data = await empService.getFormReferenceData(req.tenantId!);
  return ok(res, data);
});

// ---- org chart ----

export const getOrgChart = asyncHandler(async (req, res) => {
  const tree = await empService.getOrgChart(req.tenantId!, req.query.root as string | undefined);
  return ok(res, tree);
});

// ---- documents ----

export const listDocuments = asyncHandler(async (req, res) => {
  const docs = await empService.listDocuments(req.tenantId!, req.params.id!);
  return ok(res, docs);
});

export const uploadDocument = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw HttpError.badRequest('No file uploaded.');
  if (file.size > 15 * 1024 * 1024) throw HttpError.badRequest('File exceeds 15 MB limit.');

  const upload = await uploadObject(req.tenantId!, `employees/${req.params.id!}`, file.originalname, file.mimetype, file.buffer);

  const doc = await empService.createDocumentRecord(req.tenantId!, req.params.id!, {
    type: req.body.type,
    name: req.body.name || file.originalname,
    storageKey: upload.key,
    mimeType: upload.mimeType,
    size: upload.size,
    ...(req.body.expiry && { expiry: new Date(req.body.expiry) }),
  });

  req.auditEntityId = doc.id;
  return created(res, doc);
});

export const downloadDocument = asyncHandler(async (req, res) => {
  const docs = await empService.listDocuments(req.tenantId!, req.params.id!);
  const doc = docs.find((d) => d.id === req.params.documentId!);
  if (!doc) throw HttpError.notFound('Document not found.');
  const url = await getDownloadUrl(doc.storageKey);
  return res.redirect(url);
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const key = await empService.deleteDocumentRecord(req.tenantId!, req.params.id!, req.params.documentId!);
  try {
    await deleteObject(key);
  } catch {
    // file may already be gone; ignore storage errors, record already deleted
  }
  return noContent(res);
});
