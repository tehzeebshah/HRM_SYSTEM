import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../../common/errors';
import { created, noContent, ok } from '../../common/response';
import { createAnnouncementSchema, createPortalDocSchema, updateAnnouncementSchema } from '@hrms/shared';
import { getDownloadUrl } from '../storage/storage.service';
import * as service from './engagement.service';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

// ---- announcements ----

export const listAnnouncements = asyncHandler(async (req, res) => {
  const includeUnpublished = req.auth?.role === 'admin' || req.auth?.role === 'hr';
  return ok(res, await service.listAnnouncements(req.tenantId!, includeUnpublished));
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const row = await service.createAnnouncement(req.tenantId!, {
    ...req.body,
    ...(req.body.expiry && { expiry: new Date(req.body.expiry) }),
  });
  return created(res, row);
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const row = await service.updateAnnouncement(req.tenantId!, req.params.id!, {
    ...req.body,
    ...(req.body.publishedAt !== undefined && {
      publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : null,
    }),
    ...(req.body.expiry !== undefined && {
      expiry: req.body.expiry ? new Date(req.body.expiry) : null,
    }),
  });
  return ok(res, row);
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  await service.deleteAnnouncement(req.tenantId!, req.params.id!);
  return noContent(res);
});

// ---- document portal ----

export const listPortalDocs = asyncHandler(async (req, res) => {
  return ok(res, await service.listPortalDocs(req.tenantId!));
});

export const uploadPortalDoc = [
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw HttpError.badRequest('No file uploaded.');
    const row = await service.createPortalDoc(req.tenantId!, req.auth?.userId, file, req.body);
    return created(res, row);
  }),
];

export const downloadPortalDoc = asyncHandler(async (req, res) => {
  const docs = await service.listPortalDocs(req.tenantId!);
  const doc = docs.find((d) => d.id === req.params.id);
  if (!doc) throw HttpError.notFound('Document not found.');
  const url = await getDownloadUrl(doc.storageKey);
  return res.redirect(url);
});

export const deletePortalDoc = asyncHandler(async (req, res) => {
  await service.deletePortalDoc(req.tenantId!, req.params.id!);
  return noContent(res);
});

// ---- notifications (self-service) ----

export const myNotifications = asyncHandler(async (req, res) => {
  return ok(res, await service.listNotifications(req.auth!.userId));
});

export const myUnreadCount = asyncHandler(async (req, res) => {
  return ok(res, await service.unreadCount(req.auth!.userId));
});

export const markAllRead = asyncHandler(async (req, res) => {
  return ok(res, await service.markAllRead(req.auth!.userId));
});
