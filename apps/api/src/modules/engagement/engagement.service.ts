import { prisma } from '../../config/prisma';
import { HttpError } from '../../common/errors';
import type { Prisma } from '../../../prisma/generated';
import { uploadObject } from '../storage/storage.service';

// ==================================================================
//  Announcements
// ==================================================================

export async function listAnnouncements(tenantId: string, includeUnpublished = false) {
  return prisma.announcement.findMany({
    where: {
      tenantId,
      ...(includeUnpublished ? {} : { publishedAt: { not: null, lte: new Date() } }),
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createAnnouncement(
  tenantId: string,
  data: { title: string; body: string; audience: string; audienceRef?: string; expiry?: Date },
) {
  return prisma.announcement.create({
    data: {
      tenantId,
      title: data.title,
      body: data.body,
      audience: data.audience,
      audienceRef: data.audienceRef ?? null,
      publishedAt: new Date(), // publish immediately by default
      expiry: data.expiry ?? null,
    },
  });
}

export async function updateAnnouncement(
  tenantId: string,
  id: string,
  data: Partial<{ title: string; body: string; publishedAt: Date | null; expiry: Date | null }>,
) {
  const existing = await prisma.announcement.findFirst({ where: { id, tenantId } });
  if (!existing) throw HttpError.notFound('Announcement not found.');
  return prisma.announcement.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.body !== undefined && { body: data.body }),
      ...(data.publishedAt !== undefined && { publishedAt: data.publishedAt }),
      ...(data.expiry !== undefined && { expiry: data.expiry }),
    },
  });
}

export async function deleteAnnouncement(tenantId: string, id: string) {
  await prisma.announcement.deleteMany({ where: { id, tenantId } });
}

// ==================================================================
//  Document portal
// ==================================================================

export async function listPortalDocs(tenantId: string) {
  return prisma.documentPortalItem.findMany({
    where: { tenantId },
    orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
  });
}

export async function createPortalDoc(
  tenantId: string,
  uploadedBy: string | undefined,
  file: { originalname: string; mimetype: string; buffer: Buffer },
  data: { title: string; category?: string; audience?: string },
) {
  const upload = await uploadObject(tenantId, 'portal', file.originalname, file.mimetype, file.buffer);
  return prisma.documentPortalItem.create({
    data: {
      tenantId,
      title: data.title,
      category: data.category ?? null,
      storageKey: upload.key,
      mimeType: upload.mimeType,
      size: upload.size,
      audience: data.audience ?? 'all',
      version: 1,
    },
  });
}

export async function deletePortalDoc(tenantId: string, id: string) {
  await prisma.documentPortalItem.deleteMany({ where: { id, tenantId } });
}

// ==================================================================
//  Notifications
// ==================================================================

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  });
}

export async function unreadCount(userId: string) {
  const count = await prisma.notification.count({ where: { userId, readAt: null } });
  return { count };
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}

/** Creates a notification for a user (used internally by other modules). */
export async function notify(userId: string, type: string, payload: Record<string, unknown> = {}) {
  return prisma.notification.create({ data: { userId, type, payload: payload as unknown as Prisma.InputJsonValue } });
}
