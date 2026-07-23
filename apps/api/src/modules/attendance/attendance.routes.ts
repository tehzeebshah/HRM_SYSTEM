import { Router } from 'express';
import { clockInSchema, clockOutSchema } from '@hrms/shared';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePermissions } from '../../common/middleware/rbac';
import { audit } from '../../common/middleware/audit';
import { Permission } from '@hrms/shared';
import * as ctrl from './attendance.controller';

export const attendanceRouter = Router();

// Self-service (any authenticated user with an employee profile)
attendanceRouter.post('/clock-in', requireAuth, validate({ body: clockInSchema }), audit('attendance', 'clock_in'), ctrl.clockIn);
attendanceRouter.post('/clock-out', requireAuth, validate({ body: clockOutSchema }), audit('attendance', 'clock_out'), ctrl.clockOut);
attendanceRouter.get('/me/today', requireAuth, ctrl.myToday);

// Read timesheet (managers + hr)
attendanceRouter.get('/', requirePermissions(Permission.ATTENDANCE_VIEW), ctrl.list);
attendanceRouter.get('/summary', requirePermissions(Permission.ATTENDANCE_VIEW), ctrl.summary);

// Manual entry / correction (hr)
attendanceRouter.post(
  '/manual',
  requirePermissions(Permission.ATTENDANCE_MANAGE),
  audit('attendance', 'manual_entry'),
  ctrl.upsertManual,
);
