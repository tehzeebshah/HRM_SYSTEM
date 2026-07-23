import { Router } from 'express';
import {
  createApplicationSchema,
  createCandidateSchema,
  createJobOpeningSchema,
  moveApplicationSchema,
  updateJobOpeningSchema,
} from '@hrms/shared';
import { validate } from '../../common/middleware/validate';
import { requirePermissions } from '../../common/middleware/rbac';
import { audit } from '../../common/middleware/audit';
import { Permission } from '@hrms/shared';
import * as ctrl from './recruitment.controller';

export const recruitmentRouter = Router();

const manage = requirePermissions(Permission.RECRUIT_MANAGE);
const viewers = requirePermissions(Permission.RECRUIT_VIEW);

// openings
recruitmentRouter.get('/openings', viewers, ctrl.listOpenings);
recruitmentRouter.post('/openings', manage, validate({ body: createJobOpeningSchema }), audit('job_opening', 'create'), ctrl.createOpening);
recruitmentRouter.patch('/openings/:id', manage, validate({ body: updateJobOpeningSchema }), ctrl.updateOpening);
recruitmentRouter.delete('/openings/:id', manage, ctrl.deleteOpening);

// candidates
recruitmentRouter.get('/candidates', viewers, ctrl.listCandidates);
recruitmentRouter.post('/candidates', manage, validate({ body: createCandidateSchema }), audit('candidate', 'create'), ctrl.createCandidate);

// applications / pipeline
recruitmentRouter.get('/applications', viewers, ctrl.listApplications);
recruitmentRouter.post('/applications', manage, validate({ body: createApplicationSchema }), audit('application', 'create'), ctrl.createApplication);
recruitmentRouter.post('/applications/:id/move', manage, validate({ body: moveApplicationSchema }), audit('application', 'move'), ctrl.moveApplication);
