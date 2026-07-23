// Side-effect module: augments Express's Request with our auth context.
// Imported once from app.ts so the augmentation is guaranteed in the program.
import type { AuthContext } from '@hrms/shared';

/**
 * Augment Express's Request. The `Request` interface lives in
 * `express-serve-static-core` (express re-exports/extends it), so we augment
 * THAT module — augmenting `express` directly does not propagate to the
 * request objects passed to handlers.
 */
declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
    tenantId?: string;
    /** Optional per-request audit hooks (set by handlers for the audit middleware). */
    auditEntityId?: string;
    auditBefore?: unknown;
    auditAfter?: unknown;
  }
}

// Touch the import so the file is retained as a module even under aggressive
// type elision; keeps isolatedModules happy.
export type __AuthContext = AuthContext;
