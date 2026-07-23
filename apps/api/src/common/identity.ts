import { prisma } from '../config/prisma';
import { HttpError } from './errors';

/**
 * Resolves the Employee record linked to the authenticated user within the
 * active tenant. Used by self-service endpoints (clock in/out, my leave, …).
 *
 * Throws 403 if the user has no employee profile in this tenant (e.g. an admin
 * who isn't on the payroll) so the caller can present a friendly message.
 */
export async function getCurrentEmployee(tenantId: string, userId: string) {
  const employee = await prisma.employee.findFirst({
    where: { tenantId, userId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      departmentId: true,
      managerId: true,
      status: true,
      employmentType: true,
    },
  });
  if (!employee) {
    throw HttpError.forbidden(
      'Your user account is not linked to an employee record in this organization.',
      'no_employee_profile',
    );
  }
  return employee;
}

export type CurrentEmployee = Awaited<ReturnType<typeof getCurrentEmployee>>;

/**
 * Returns the employee id if the user is linked to one, otherwise null.
 * Use for endpoints that should work for both linked users and admins.
 */
export async function maybeGetCurrentEmployee(tenantId: string, userId: string): Promise<string | null> {
  const row = await prisma.employee.findFirst({
    where: { tenantId, userId, deletedAt: null },
    select: { id: true },
  });
  return row?.id ?? null;
}
