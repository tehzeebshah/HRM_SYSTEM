import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../../common/errors';
import { created, noContent, ok } from '../../common/response';
import {
  createGoalSchema,
  createRatingScaleSchema,
  createReviewCycleSchema,
  createReviewSchema,
  submitReviewSchema,
  updateGoalSchema,
  updateReviewCycleSchema,
} from '@hrms/shared';
import { getCurrentEmployee } from '../../common/identity';
import * as service from './performance.service';

// ---- goals (self-service) ----

export const myGoals = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const [goals, summary] = await Promise.all([
    service.listGoalsForEmployee(req.tenantId!, me.id),
    service.goalProgressSummary(req.tenantId!, me.id),
  ]);
  return ok(res, { goals, summary });
});

export const createMyGoal = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const row = await service.createGoal(req.tenantId!, me.id, {
    title: req.body.title,
    description: req.body.description,
    weight: req.body.weight,
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
  });
  return created(res, row);
});

export const updateGoal = asyncHandler(async (req, res) => {
  const row = await service.updateGoal(req.tenantId!, req.params.id!, {
    ...(req.body.title !== undefined && { title: req.body.title }),
    ...(req.body.description !== undefined && { description: req.body.description }),
    ...(req.body.weight !== undefined && { weight: req.body.weight }),
    ...(req.body.progress !== undefined && { progress: req.body.progress }),
    ...(req.body.status !== undefined && { status: req.body.status }),
    ...(req.body.dueDate !== undefined && { dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null }),
  });
  return ok(res, row);
});

export const deleteGoal = asyncHandler(async (req, res) => {
  await service.deleteGoal(req.tenantId!, req.params.id!);
  return noContent(res);
});

export const employeeGoals = asyncHandler(async (req, res) => {
  const [goals, summary] = await Promise.all([
    service.listGoalsForEmployee(req.tenantId!, req.params.id!),
    service.goalProgressSummary(req.tenantId!, req.params.id!),
  ]);
  return ok(res, { goals, summary });
});

// ---- cycles (admin) ----

export const listCycles = asyncHandler(async (req, res) => {
  return ok(res, await service.listCycles(req.tenantId!));
});

export const createCycle = asyncHandler(async (req, res) => {
  const row = await service.createCycle(req.tenantId!, {
    name: req.body.name,
    period: req.body.period,
    type: req.body.type,
    startDate: new Date(req.body.startDate),
    endDate: new Date(req.body.endDate),
  });
  return created(res, row);
});

export const updateCycle = asyncHandler(async (req, res) => {
  const row = await service.updateCycle(req.tenantId!, req.params.id!, {
    ...(req.body.name !== undefined && { name: req.body.name }),
    ...(req.body.status !== undefined && { status: req.body.status }),
    ...(req.body.startDate !== undefined && { startDate: new Date(req.body.startDate) }),
    ...(req.body.endDate !== undefined && { endDate: new Date(req.body.endDate) }),
  });
  return ok(res, row);
});

// ---- reviews ----

export const listReviews = asyncHandler(async (req, res) => {
  const rows = await service.listReviews(req.tenantId!, {
    cycleId: req.query.cycleId as string | undefined,
    employeeId: req.query.employeeId as string | undefined,
    reviewerId: req.query.reviewerId as string | undefined,
    status: req.query.status as string | undefined,
  });
  return ok(res, rows);
});

export const createReview = asyncHandler(async (req, res) => {
  const row = await service.createReview(req.tenantId!, {
    cycleId: req.body.cycleId,
    employeeId: req.body.employeeId,
    reviewerId: req.body.reviewerId,
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
  });
  return created(res, row);
});

export const getReview = asyncHandler(async (req, res) => {
  return ok(res, await service.getReview(req.tenantId!, req.params.id!));
});

export const submitReview = asyncHandler(async (req, res) => {
  const me = await getCurrentEmployee(req.tenantId!, req.auth!.userId);
  const row = await service.submitReview(
    req.tenantId!,
    me.id,
    req.params.id!,
    {
      ratings: req.body.ratings,
      comments: req.body.comments,
      overallRating: req.body.overallRating,
    },
    { bypassReviewerCheck: req.auth!.role === 'admin' || req.auth!.role === 'hr' },
  );
  return ok(res, row);
});

// ---- rating scales ----

export const listRatingScales = asyncHandler(async (req, res) => {
  return ok(res, await service.listRatingScales(req.tenantId!));
});

export const createRatingScale = asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body.levels) || req.body.levels.length < 2) {
    throw HttpError.badRequest('A rating scale needs at least 2 levels.');
  }
  return created(res, await service.createRatingScale(req.tenantId!, req.body));
});
