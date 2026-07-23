import { Router } from 'express';
import { requireAuth, requirePermissions } from '../../common/middleware/rbac';
import { Permission } from '@hrms/shared';
import * as ctrl from './reports.controller';

export const reportsRouter = Router();

// Dashboard is self-scoped per role; any authenticated user.
reportsRouter.get('/dashboard', requireAuth, ctrl.dashboard);

// Detailed reports: managers+ view most; HR/admin for payroll.
const viewers = requirePermissions(Permission.REPORT_VIEW);
reportsRouter.get('/headcount', viewers, ctrl.headcount);
reportsRouter.get('/headcount.csv', viewers, ctrl.headcountCsv);
reportsRouter.get('/attendance', viewers, ctrl.attendance);
reportsRouter.get('/leave', viewers, ctrl.leave);
reportsRouter.get('/payroll', viewers, ctrl.payroll);
reportsRouter.get('/payroll.csv', viewers, ctrl.payrollCsv);
reportsRouter.get('/assets', viewers, ctrl.assets);
reportsRouter.get('/employees.csv', viewers, ctrl.employeesCsv);
