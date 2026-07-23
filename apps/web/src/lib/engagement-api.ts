import { get, post, patch, del } from './api';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string | null;
  expiry: string | null;
  createdAt: string;
}

export interface PortalDoc {
  id: string;
  title: string;
  category: string | null;
  mimeType: string;
  size: number;
  audience: string;
  version: number;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export const engagementApi = {
  // announcements
  listAnnouncements: () => get<Announcement[]>('/engagement/announcements'),
  createAnnouncement: (data: { title: string; body: string; audience?: string }) =>
    post<Announcement>('/engagement/announcements', data),
  deleteAnnouncement: (id: string) => del<void>(`/engagement/announcements/${id}`),

  // portal docs
  listPortalDocs: () => get<PortalDoc[]>('/engagement/portal'),
  uploadPortalDoc: (file: File, fields: { title: string; category?: string }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('title', fields.title);
    if (fields.category) form.append('category', fields.category);
    return post<PortalDoc>('/engagement/portal', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deletePortalDoc: (id: string) => del<void>(`/engagement/portal/${id}`),
  portalDocUrl: (id: string) =>
    `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/engagement/portal/${id}/download`,

  // notifications
  listNotifications: () => get<NotificationItem[]>('/engagement/notifications'),
  unreadCount: () => get<{ count: number }>('/engagement/notifications/unread'),
  markAllRead: () => post('/engagement/notifications/read-all', {}),
};
