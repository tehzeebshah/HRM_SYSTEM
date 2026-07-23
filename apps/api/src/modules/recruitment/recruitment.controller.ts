import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/errors';
import { created, noContent, ok } from '../../common/response';
import {
  createApplicationSchema,
  createCandidateSchema,
  createJobOpeningSchema,
  moveApplicationSchema,
  updateJobOpeningSchema,
} from '@hrms/shared';
import { maybeGetCurrentEmployee } from '../../common/identity';
import { prisma } from '../../config/prisma';
import * as service from './recruitment.service';

// ---- openings ----

export const listOpenings = asyncHandler(async (req, res) => {
  return ok(res, await service.listOpenings(req.tenantId!));
});

export const createOpening = asyncHandler(async (req, res) => {
  const me = await maybeGetCurrentEmployee(req.tenantId!, req.auth!.userId);
  return created(res, await service.createOpening(req.tenantId!, me ?? undefined, req.body));
});

export const updateOpening = asyncHandler(async (req, res) => {
  return ok(res, await service.updateOpening(req.tenantId!, req.params.id!, req.body));
});

export const deleteOpening = asyncHandler(async (req, res) => {
  await prisma.jobOpening.deleteMany({ where: { id: req.params.id!, tenantId: req.tenantId! } });
  return noContent(res);
});

// ---- candidates ----

export const listCandidates = asyncHandler(async (req, res) => {
  return ok(res, await service.listCandidates(req.tenantId!, req.query.q as string | undefined));
});

export const createCandidate = asyncHandler(async (req, res) => {
  return created(res, await service.createCandidate(req.tenantId!, req.body));
});

// ---- applications ----

export const listApplications = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.listApplications(req.tenantId!, {
      jobOpeningId: req.query.jobOpeningId as string | undefined,
      stage: req.query.stage as string | undefined,
    }),
  );
});

export const createApplication = asyncHandler(async (req, res) => {
  return created(res, await service.createApplication(req.tenantId!, req.body.jobOpeningId, req.body.candidateId));
});

export const moveApplication = asyncHandler(async (req, res) => {
  return ok(res, await service.moveApplication(req.tenantId!, req.params.id!, req.body.stage, req.body.rejectedReason));
});

export const schemaValidators = {
  createOpening: createJobOpeningSchema,
  updateOpening: updateJobOpeningSchema,
  createCandidate: createCandidateSchema,
  createApplication: createApplicationSchema,
  moveApplication: moveApplicationSchema,
};
