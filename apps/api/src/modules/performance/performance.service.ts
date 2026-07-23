import { prisma } from '../../config/prisma';
import { HttpError } from '../../common/errors';
import type { Prisma } from '../../../prisma/generated';

// ==================================================================
//  Goals
// ==================================================================

export async function listGoalsForEmployee(tenantId: string, employeeId: string) {
  return prisma.goal.findMany({
    where: { tenantId, employeeId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function createGoal(
  tenantId: string,
  employeeId: string,
  data: { title: string; description?: string; weight: number; dueDate?: Date },
) {
  return prisma.goal.create({
    data: {
      tenantId,
      employeeId,
      title: data.title,
      description: data.description ?? null,
      weight: data.weight,
      dueDate: data.dueDate ?? null,
      status: 'active',
    },
  });
}

export async function updateGoal(
  tenantId: string,
  goalId: string,
  data: Partial<{ title: string; description: string; weight: number; progress: number; status: string; dueDate: Date | null }>,
) {
  const existing = await prisma.goal.findFirst({ where: { id: goalId, tenantId } });
  if (!existing) throw HttpError.notFound('Goal not found.');
  return prisma.goal.update({
    where: { id: goalId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.weight !== undefined && { weight: data.weight }),
      ...(data.progress !== undefined && { progress: data.progress }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
    },
  });
}

export async function deleteGoal(tenantId: string, goalId: string) {
  await prisma.goal.deleteMany({ where: { id: goalId, tenantId } });
}

/** Weighted average progress across an employee's active goals. */
export async function goalProgressSummary(tenantId: string, employeeId: string) {
  const goals = await prisma.goal.findMany({ where: { tenantId, employeeId, status: 'active' } });
  const totalWeight = goals.reduce((s, g) => s + g.weight, 0);
  const weighted = goals.reduce((s, g) => s + g.progress * g.weight, 0);
  const overall = totalWeight > 0 ? Math.round(weighted / totalWeight) : 0;
  return { totalGoals: goals.length, overallProgress: overall };
}

// ==================================================================
//  Review cycles
// ==================================================================

export async function listCycles(tenantId: string) {
  return prisma.reviewCycle.findMany({
    where: { tenantId },
    orderBy: [{ startDate: 'desc' }],
    include: { _count: { select: { reviews: true } } },
  });
}

export async function createCycle(
  tenantId: string,
  data: { name: string; period: string; type: string; startDate: Date; endDate: Date },
) {
  if (data.endDate < data.startDate) throw HttpError.badRequest('End date cannot be before start date.');
  return prisma.reviewCycle.create({
    data: {
      tenantId,
      name: data.name,
      period: data.period,
      type: data.type,
      status: 'open',
      startDate: data.startDate,
      endDate: data.endDate,
    },
  });
}

export async function updateCycle(
  tenantId: string,
  id: string,
  data: Partial<{ name: string; status: string; startDate: Date; endDate: Date }>,
) {
  return prisma.reviewCycle.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
    },
  });
}

// ==================================================================
//  Reviews
// ==================================================================

export async function listReviews(
  tenantId: string,
  filters: { cycleId?: string; employeeId?: string; reviewerId?: string; status?: string },
) {
  return prisma.review.findMany({
    where: {
      tenantId,
      ...(filters.cycleId && { cycleId: filters.cycleId }),
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.reviewerId && { reviewerId: filters.reviewerId }),
      ...(filters.status && { status: filters.status }),
    },
    include: {
      cycle: { select: { id: true, name: true, period: true, status: true } },
      employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createReview(
  tenantId: string,
  data: { cycleId: string; employeeId: string; reviewerId: string; dueDate?: Date },
) {
  // Validate references + tenant scope.
  const cycle = await prisma.reviewCycle.findFirst({ where: { id: data.cycleId, tenantId } });
  if (!cycle) throw HttpError.notFound('Review cycle not found.');
  const employee = await prisma.employee.findFirst({ where: { id: data.employeeId, tenantId, deletedAt: null } });
  if (!employee) throw HttpError.notFound('Employee not found.');
  const reviewer = await prisma.employee.findFirst({ where: { id: data.reviewerId, tenantId, deletedAt: null } });
  if (!reviewer) throw HttpError.notFound('Reviewer not found.');

  // No duplicate (same cycle + employee + reviewer).
  const existing = await prisma.review.findFirst({
    where: { tenantId, cycleId: data.cycleId, employeeId: data.employeeId, reviewerId: data.reviewerId },
  });
  if (existing) throw HttpError.conflict('A review for this employee/reviewer already exists in this cycle.');

  return prisma.review.create({
    data: {
      tenantId,
      cycleId: data.cycleId,
      employeeId: data.employeeId,
      reviewerId: data.reviewerId,
      status: 'pending',
      dueDate: data.dueDate ?? null,
      sections: [],
    },
  });
}

/**
 * Submit a review: stores structured ratings + comments as a Feedback record
 * (360-style), marks the review submitted, and sets the overall rating.
 * Only the assigned reviewer (or HR/admin) may submit.
 */
export async function submitReview(
  tenantId: string,
  reviewerEmployeeId: string,
  reviewId: string,
  payload: { ratings: Record<string, number>; comments?: string; overallRating?: number },
  options: { bypassReviewerCheck?: boolean } = {},
) {
  const review = await prisma.review.findFirst({
    where: { id: reviewId, tenantId },
    include: { cycle: { select: { status: true } } },
  });
  if (!review) throw HttpError.notFound('Review not found.');
  if (review.cycle.status === 'closed') throw HttpError.conflict('This review cycle is closed.');
  if (!options.bypassReviewerCheck && review.reviewerId !== reviewerEmployeeId) {
    throw HttpError.forbidden('Only the assigned reviewer can submit this review.');
  }

  return prisma.$transaction(async (tx) => {
    // Persist a 360 feedback record (reviewer → reviewee).
    await tx.feedback.create({
      data: {
        tenantId,
        reviewId,
        reviewerId: review.reviewerId,
        revieweeId: review.employeeId,
        ratings: payload.ratings as unknown as Prisma.InputJsonValue,
        comments: payload.comments ?? null,
      },
    });
    return tx.review.update({
      where: { id: reviewId },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        sections: payload.ratings as unknown as Prisma.InputJsonValue,
        overallRating: payload.overallRating ?? null,
      },
    });
  });
}

export async function getReview(tenantId: string, reviewId: string) {
  const review = await prisma.review.findFirst({
    where: { id: reviewId, tenantId },
    include: {
      cycle: { select: { id: true, name: true, period: true, type: true, status: true } },
      employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
      feedback: { include: { reviewer: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  if (!review) throw HttpError.notFound('Review not found.');
  return review;
}

// ==================================================================
//  Rating scales
// ==================================================================

export async function listRatingScales(tenantId: string) {
  return prisma.ratingScale.findMany({ where: { tenantId }, orderBy: [{ name: 'asc' }] });
}

export async function createRatingScale(
  tenantId: string,
  data: { name: string; levels: { value: number; label: string; color?: string }[] },
) {
  return prisma.ratingScale.create({
    data: {
      tenantId,
      name: data.name,
      levels: data.levels as unknown as Prisma.InputJsonValue,
    },
  });
}
