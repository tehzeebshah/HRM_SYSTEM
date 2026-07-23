import type { RequestHandler } from 'express';
import { HttpError } from '../errors';
import type { Permission, RoleCode } from '@hrms/shared';
import { authenticate } from './auth';

/**
 * Require that the caller is authenticated AND holds one of the given roles
 * within the active tenant. Always runs `authenticate` first.
 */
export function requireRoles(...roles: RoleCode[]): RequestHandler[] {
  return [
    authenticate,
    (req, _res, next) => {
      if (!req.auth) return next(HttpError.unauthorized());
      if (!roles.includes(req.auth.role)) {
        return next(HttpError.forbidden('Your role does not have access to this resource.'));
      }
      next();
    },
  ];
}

/**
 * Require that the caller is authenticated AND holds every listed permission.
 * The access token carries the permission list (seeded from the role matrix);
 * for custom roles the token is re-issued on permission changes.
 */
export function requirePermissions(...permissions: Permission[]): RequestHandler[] {
  return [
    authenticate,
    (req, _res, next) => {
      if (!req.auth) return next(HttpError.unauthorized());
      const hasAll = permissions.every((p) => req.auth!.permissions.includes(p));
      if (!hasAll) {
        return next(
          new HttpError(403, 'forbidden', 'Missing required permission(s).', {
            required: permissions as readonly string[],
          }),
        );
      }
      next();
    },
  ];
}

/** Shorthand for authenticated-any (valid token, any role). */
export const requireAuth: RequestHandler[] = [authenticate];
