import { Router } from 'express';
import { assignAssetSchema, createAssetSchema, returnAssetSchema, updateAssetSchema } from '@hrms/shared';
import { validate } from '../../common/middleware/validate';
import { requirePermissions } from '../../common/middleware/rbac';
import { audit } from '../../common/middleware/audit';
import { Permission } from '@hrms/shared';
import * as ctrl from './asset.controller';

export const assetRouter = Router();

const manage = requirePermissions(Permission.ASSET_MANAGE);
const viewers = requirePermissions(Permission.ASSET_VIEW);

assetRouter.get('/', viewers, ctrl.list);
assetRouter.post('/', manage, validate({ body: createAssetSchema }), audit('asset', 'create'), ctrl.create);
assetRouter.patch('/:id', manage, validate({ body: updateAssetSchema }), ctrl.update);
assetRouter.delete('/:id', manage, ctrl.remove);

assetRouter.post('/:id/assign', manage, validate({ body: assignAssetSchema }), audit('asset_assignment', 'assign'), ctrl.assign);
assetRouter.post('/:id/return', manage, validate({ body: returnAssetSchema }), audit('asset_assignment', 'return'), ctrl.returnIt);
assetRouter.get('/:id/history', viewers, ctrl.history);
