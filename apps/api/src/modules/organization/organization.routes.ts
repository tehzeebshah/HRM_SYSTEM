import { Router } from 'express';
import {
  createDepartmentSchema,
  createDesignationSchema,
  createLocationSchema,
  updateDepartmentSchema,
  updateDesignationSchema,
  updateLocationSchema,
} from '@hrms/shared';
import { validate } from '../../common/middleware/validate';
import { requirePermissions, requireRoles } from '../../common/middleware/rbac';
import { Permission, RoleCode } from '@hrms/shared';
import * as ctrl from './organization.controller';

export const organizationRouter = Router();

// Anyone authenticated can read; managers+ can manage.
const readers = requireRoles(RoleCode.ADMIN, RoleCode.HR, RoleCode.MANAGER);
const managers = requirePermissions(Permission.ORG_MANAGE);

// Departments
organizationRouter.get('/departments', readers, ctrl.listDepartments);
organizationRouter.get('/departments/tree', readers, ctrl.getDepartmentTree);
organizationRouter.post('/departments', managers, validate({ body: createDepartmentSchema }), ctrl.createDepartment);
organizationRouter.patch('/departments/:id', managers, validate({ body: updateDepartmentSchema }), ctrl.updateDepartment);
organizationRouter.delete('/departments/:id', managers, ctrl.deleteDepartment);

// Designations
organizationRouter.get('/designations', readers, ctrl.listDesignations);
organizationRouter.post('/designations', managers, validate({ body: createDesignationSchema }), ctrl.createDesignation);
organizationRouter.patch('/designations/:id', managers, validate({ body: updateDesignationSchema }), ctrl.updateDesignation);
organizationRouter.delete('/designations/:id', managers, ctrl.deleteDesignation);

// Locations
organizationRouter.get('/locations', readers, ctrl.listLocations);
organizationRouter.post('/locations', managers, validate({ body: createLocationSchema }), ctrl.createLocation);
organizationRouter.patch('/locations/:id', managers, validate({ body: updateLocationSchema }), ctrl.updateLocation);
organizationRouter.delete('/locations/:id', managers, ctrl.deleteLocation);
