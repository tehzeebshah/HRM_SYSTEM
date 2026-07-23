import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/errors';
import { created, noContent, ok } from '../../common/response';
import {
  assignAssetSchema,
  createAssetSchema,
  returnAssetSchema,
  updateAssetSchema,
} from '@hrms/shared';
import * as service from './asset.service';

export const list = asyncHandler(async (req, res) => {
  return ok(res, await service.listAssets(req.tenantId!, { q: req.query.q as string | undefined, status: req.query.status as string | undefined }));
});

export const create = asyncHandler(async (req, res) => {
  const row = await service.createAsset(req.tenantId!, {
    ...req.body,
    ...(req.body.purchaseDate && { purchaseDate: new Date(req.body.purchaseDate) }),
  });
  return created(res, row);
});

export const update = asyncHandler(async (req, res) => {
  return ok(res, await service.updateAsset(req.tenantId!, req.params.id!, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteAsset(req.tenantId!, req.params.id!);
  return noContent(res);
});

export const assign = asyncHandler(async (req, res) => {
  await service.assignAsset(req.tenantId!, req.params.id!, req.body.employeeId, req.body.condition, req.body.notes);
  return ok(res, { assigned: true });
});

export const returnIt = asyncHandler(async (req, res) => {
  await service.returnAsset(req.tenantId!, req.params.id!, req.body.condition, req.body.notes);
  return ok(res, { returned: true });
});

export const history = asyncHandler(async (req, res) => {
  return ok(res, await service.assetHistory(req.tenantId!, req.params.id!));
});

export { assignAssetSchema, createAssetSchema, returnAssetSchema, updateAssetSchema };
