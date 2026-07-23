import { Router } from 'express';
import {
  createGoalSchema,
  createRatingScaleSchema,
  createReviewCycleSchema,
  createReviewSchema,
  submitReviewSchema,
  updateGoalSchema,
  updateReviewCycleSchema,
} from '@hrms/shared';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePermissions } from '../../common/middleware/rbac';
import { audit } from '../../common/middleware/audit';
import { Permission } from '@hrms/shared';
import * as ctrl from './performance.controller';

export const performanceRouter = Router();

const manage = requirePermissions(Permission.PERFORMANCE_MANAGE);
const viewers = requirePermissions(Permission.PERFORMANCE_VIEW);

// ---- goals (self-service) ----
performanceRouter.get('/me/goals', requireAuth, ctrl.myGoals);
performanceRouter.post('/me/goals', requireAuth, validate({ body: createGoalSchema }), audit('goal', 'create'), ctrl.createMyGoal);
performanceRouter.patch('/goals/:id', requireAuth, validate({ body: updateGoalSchema }), audit('goal', 'update'), ctrl.updateGoal);
performanceRouter.delete('/goals/:id', requireAuth, audit('goal', 'delete'), ctrl.deleteGoal);

// View an employee's goals (manager/hr).
performanceRouter.get('/employees/:id/goals', viewers, ctrl.employeeGoals);

// ---- review cycles (admin) ----
performanceRouter.get('/cycles', viewers, ctrl.listCycles);
performanceRouter.post('/cycles', manage, validate({ body: createReviewCycleSchema }), audit('review_cycle', 'create'), ctrl.createCycle);
performanceRouter.patch('/cycles/:id', manage, validate({ body: updateReviewCycleSchema }), ctrl.updateCycle);

// ---- reviews ----
performanceRouter.get('/reviews', viewers, ctrl.listReviews);
performanceRouter.get('/reviews/:id', viewers, ctrl.getReview);
performanceRouter.post('/reviews', manage, validate({ body: createReviewSchema }), audit('review', 'create'), ctrl.createReview);
performanceRouter.post(
  '/reviews/:id/submit',
  requireAuth,
  validate({ body: submitReviewSchema }),
  audit('review', 'submit'),
  ctrl.submitReview,
);

// ---- rating scales ----
performanceRouter.get('/rating-scales', viewers, ctrl.listRatingScales);
performanceRouter.post('/rating-scales', manage, validate({ body: createRatingScaleSchema }), ctrl.createRatingScale);
