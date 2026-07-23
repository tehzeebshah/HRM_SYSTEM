import type { RoleCode, Permission } from './enums';

/** Standard API error shape (produced by the central error handler). */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Successful single-resource response. */
export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/** Paginated list response. */
export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;
}

/** JWT access token payload. */
export interface AccessTokenPayload {
  sub: string; // userId
  tenantId: string;
  role: RoleCode;
  permissions: Permission[];
  mfaVerified: boolean;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tenantId: string;
  jti: string; // token id (for rotation / revocation)
  iat?: number;
  exp?: number;
}

/** Authenticated request context attached by middleware. */
export interface AuthContext {
  userId: string;
  tenantId: string;
  role: RoleCode;
  permissions: Permission[];
  mfaVerified: boolean;
}
