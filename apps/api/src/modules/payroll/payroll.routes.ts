import { Router } from 'express';
import {
  assignStructureSchema,
  createPayComponentSchema,
  createPayRunSchema,
  createSalaryStructureSchema,
  createTaxTableSchema,
  updatePayComponentSchema,
  updateSalaryStructureSchema,
} from '@hrms/shared';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePermissions } from '../../common/middleware/rbac';
import { audit } from '../../common/middleware/audit';
import { Permission } from '@hrms/shared';
import * as ctrl from './payroll.controller';

export const payrollRouter = Router();

const manage = requirePermissions(Permission.PAYROLL_MANAGE);
const run = requirePermissions(Permission.PAYROLL_RUN);
const viewAll = requirePermissions(Permission.PAYROLL_VIEW_ALL);

// ---- components ----
payrollRouter.get('/components', manage, ctrl.listComponents);
payrollRouter.post('/components', manage, validate({ body: createPayComponentSchema }), ctrl.createComponent);
payrollRouter.patch('/components/:id', manage, validate({ body: updatePayComponentSchema }), ctrl.updateComponent);
payrollRouter.delete('/components/:id', manage, ctrl.deleteComponent);

// ---- structures ----
payrollRouter.get('/structures', manage, ctrl.listStructures);
payrollRouter.post('/structures', manage, validate({ body: createSalaryStructureSchema }), ctrl.createStructure);
payrollRouter.patch('/structures/:id', manage, validate({ body: updateSalaryStructureSchema }), ctrl.updateStructure);
payrollRouter.delete('/structures/:id', manage, ctrl.deleteStructure);

// ---- assignments (per employee) ----
payrollRouter.post('/employees/:id/assignment', manage, validate({ body: assignStructureSchema }), audit('assignment', 'create'), ctrl.assignStructure);
payrollRouter.get('/employees/:id/assignment', manage, ctrl.getEmployeeStructure);

// ---- tax tables ----
payrollRouter.get('/tax-tables', manage, ctrl.listTaxTables);
payrollRouter.post('/tax-tables', manage, validate({ body: createTaxTableSchema }), ctrl.createTaxTable);

// ---- pay runs ----
payrollRouter.get('/runs', viewAll, ctrl.listPayRuns);
payrollRouter.get('/runs/:id', viewAll, ctrl.getPayRun);
payrollRouter.post('/runs', run, validate({ body: createPayRunSchema }), audit('pay_run', 'create'), ctrl.createPayRun);
payrollRouter.post('/runs/:id/process', run, audit('pay_run', 'process'), ctrl.processPayRun);
payrollRouter.post('/runs/:id/lock', run, audit('pay_run', 'lock'), ctrl.lockPayRun);

// ---- payslips ----
payrollRouter.get('/payslips/:id', viewAll, ctrl.getPayslip);

// ---- self-service ----
payrollRouter.get('/me/payslips', requireAuth, ctrl.myPayslips);
