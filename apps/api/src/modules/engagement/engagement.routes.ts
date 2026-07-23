import { Router } from 'express';
import { createAnnouncementSchema, createPortalDocSchema, updateAnnouncementSchema } from '@hrms/shared';
import { validate } from '../../common/middleware/validate';
import { requireAuth, requirePermissions } from '../../common/middleware/rbac';
import { audit } from '../../common/middleware/audit';
import { Permission } from '@hrms/shared';
import * as ctrl from './engagement.controller';

export const engagementRouter = Router();

const manage = requirePermissions(Permission.ENGAGEMENT_MANAGE);

// announcements — anyone authenticated reads; HR/admin writes
engagementRouter.get('/announcements', requireAuth, ctrl.listAnnouncements);
engagementRouter.post('/announcements', manage, validate({ body: createAnnouncementSchema }), audit('announcement', 'create'), ctrl.createAnnouncement);
engagementRouter.patch('/announcements/:id', manage, validate({ body: updateAnnouncementSchema }), ctrl.updateAnnouncement);
engagementRouter.delete('/announcements/:id', manage, ctrl.deleteAnnouncement);

// document portal
engagementRouter.get('/portal', requireAuth, ctrl.listPortalDocs);
engagementRouter.post('/portal', manage, ctrl.uploadPortalDoc);
engagementRouter.get('/portal/:id/download', requireAuth, ctrl.downloadPortalDoc);
engagementRouter.delete('/portal/:id', manage, ctrl.deletePortalDoc);

// notifications (self-service)
engagementRouter.get('/notifications', requireAuth, ctrl.myNotifications);
engagementRouter.get('/notifications/unread', requireAuth, ctrl.myUnreadCount);
engagementRouter.post('/notifications/read-all', requireAuth, ctrl.markAllRead);
