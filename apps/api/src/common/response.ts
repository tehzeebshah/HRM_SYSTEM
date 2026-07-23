import type { Response } from 'express';
import type { Paginated } from '@hrms/shared';

/** Send a single-resource success response with a 200 (or override). */
export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data });
}

/** Send a 201 Created response. */
export function created<T>(res: Response, data: T) {
  return res.status(201).json({ data });
}

/** Send a 204 No Content (e.g. after a delete). */
export function noContent(res: Response) {
  return res.status(204).send();
}

/** Send a paginated list response. */
export function paginate<T>(res: Response, rows: T[], total: number, page: number, pageSize: number) {
  const payload: Paginated<T> = {
    data: rows,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / Math.max(pageSize, 1)),
    },
  };
  return res.status(200).json(payload);
}

/** Parse pagination query params with sane clamps. */
export function parsePagination(query: { page?: unknown; pageSize?: unknown }) {
  const page = clampInt(query.page, 1, 1, 1_000_000);
  const pageSize = clampInt(query.pageSize, 25, 1, 200);
  return { page, pageSize };
}

function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
