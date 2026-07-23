import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { createEmployeeSchema, updateEmployeeSchema, documentTypeSchema } from '@hrms/shared';
import { validate } from '../../common/middleware/validate';
import { requirePermissions, requireRoles } from '../../common/middleware/rbac';
import { audit } from '../../common/middleware/audit';
import { Permission, RoleCode } from '@hrms/shared';
import * as ctrl from './employee.controller';

export const employeeRouter = Router();

// Read access: admin, hr, manager (employees use a separate self-service view later).
const readers = requireRoles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER);
const writers = requirePermissions(Permission.EMPLOYEE_CREATE, Permission.EMPLOYEE_UPDATE);
const deleter = requirePermissions(Permission.EMPLOYEE_DELETE);

// Multipart parser for document uploads (in-memory; storage adapter persists).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

// Reference data + org chart (must come before /:id to avoid shadowing)
employeeRouter.get('/reference-data', readers, ctrl.getReferenceData);
employeeRouter.get('/org-chart', readers, ctrl.getOrgChart);

employeeRouter.get('/', readers, ctrl.listEmployees);
employeeRouter.post(
  '/',
  writers,
  validate({ body: createEmployeeSchema }),
  audit('employee', 'create'),
  ctrl.createEmployee,
);

employeeRouter.get('/:id', readers, ctrl.getEmployee);
employeeRouter.patch('/:id', writers, validate({ body: updateEmployeeSchema }), audit('employee', 'update'), ctrl.updateEmployee);
employeeRouter.delete('/:id', deleter, audit('employee', 'delete'), ctrl.deleteEmployee);

// Documents
employeeRouter.get('/:id/documents', readers, ctrl.listDocuments);
employeeRouter.post(
  '/:id/documents',
  writers,
  upload.single('file'),
  validate({ body: z.object({ type: documentTypeSchema }) }),
  audit('employee_document', 'create'),
  ctrl.uploadDocument,
);
employeeRouter.get('/:id/documents/:documentId/download', readers, ctrl.downloadDocument);
employeeRouter.delete('/:id/documents/:documentId', deleter, audit('employee_document', 'delete'), ctrl.deleteDocument);
