import { Router } from 'express';
import {
  createLeaveRequestSchema,
  createLeaveTypeSchema,
  leaveDecisionSchema,
  updateLeaveTypeSchema,
} from '@hrms/shared';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePermissions } from '../../common/middleware/rbac';
import { audit } from '../../common/middleware/audit';
import { Permission } from '@hrms/shared';
import * as ctrl from './leave.controller';

export const leaveRouter = Router();

// ---- leave types ----
leaveRouter.get('/types', requireAuth, ctrl.listLeaveTypes);
leaveRouter.post('/types', requirePermissions(Permission.LEAVE_MANAGE), validate({ body: createLeaveTypeSchema }), ctrl.createLeaveType);
leaveRouter.patch('/types/:id', requirePermissions(Permission.LEAVE_MANAGE), validate({ body: updateLeaveTypeSchema }), ctrl.updateLeaveType);
leaveRouter.delete('/types/:id', requirePermissions(Permission.LEAVE_MANAGE), ctrl.deleteLeaveType);

// ---- self-service ----
leaveRouter.get('/me/requests', requireAuth, ctrl.myRequests);
leaveRouter.get('/me/balances', requireAuth, ctrl.myBalances);
leaveRouter.post(
  '/me/requests',
  requireAuth,
  validate({ body: createLeaveRequestSchema }),
  audit('leave_request', 'create'),
  ctrl.createMyRequest,
);
leaveRouter.delete('/me/requests/:id', requireAuth, audit('leave_request', 'cancel'), ctrl.cancelMyRequest);

// ---- approvals & administration ----
// Managers see requests pending their approval; HR sees all.
leaveRouter.get('/requests', requirePermissions(Permission.LEAVE_APPROVE), ctrl.listRequests);
leaveRouter.post(
  '/requests/:id/decision',
  requirePermissions(Permission.LEAVE_APPROVE),
  validate({ body: leaveDecisionSchema }),
  audit('leave_request', 'decision'),
  ctrl.approveReject,
);

// Employee balances (HR view) + allocation editing.
leaveRouter.get('/employees/:id/balances', requirePermissions(Permission.LEAVE_MANAGE), ctrl.employeeBalances);
leaveRouter.put(
  '/employees/:id/balances/:leaveTypeId',
  requirePermissions(Permission.LEAVE_MANAGE),
  audit('leave_balance', 'update'),
  ctrl.setAllocation,
);
