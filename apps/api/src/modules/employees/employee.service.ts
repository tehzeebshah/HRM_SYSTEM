import { prisma } from '../../config/prisma';
import { HttpError } from '../../common/errors';
import type { EmployeeQuery } from '@hrms/shared';
import type { Prisma } from '../../../prisma/generated';

const EMPLOYEE_INCLUDE = {
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  manager: { select: { id: true, firstName: true, lastName: true } },
} as const;

export type EmployeeWithRelations = Prisma.EmployeeGetPayload<{ include: typeof EMPLOYEE_INCLUDE }>;

function buildWhere(tenantId: string, query: EmployeeQuery): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = { tenantId, deletedAt: null };
  if (query.q) {
    where.OR = [
      { firstName: { contains: query.q, mode: 'insensitive' } },
      { lastName: { contains: query.q, mode: 'insensitive' } },
      { email: { contains: query.q, mode: 'insensitive' } },
      { employeeNo: { contains: query.q, mode: 'insensitive' } },
      { phone: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.status) where.status = query.status;
  if (query.employmentType) where.employmentType = query.employmentType;
  return where;
}

export async function listEmployees(tenantId: string, query: EmployeeQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const sortField = query.sort ?? 'createdAt';
  const where = buildWhere(tenantId, query);

  const [rows, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: EMPLOYEE_INCLUDE,
      orderBy: { [sortField]: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}

export async function getEmployee(tenantId: string, id: string) {
  const employee = await prisma.employee.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      ...EMPLOYEE_INCLUDE,
      documents: { orderBy: { uploadedAt: 'desc' } },
      _count: { select: { reports: true, leaveRequests: true } },
    },
  });
  if (!employee) throw HttpError.notFound('Employee not found.');
  return employee;
}

export async function createEmployee(
  tenantId: string,
  data: {
    employeeNo: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dob?: Date;
    gender?: string;
    maritalStatus?: string;
    nationality?: string;
    idNumber?: string;
    departmentId?: string | null;
    designationId?: string | null;
    locationId?: string | null;
    managerId?: string | null;
    employmentType?: string;
    status?: string;
    hireDate: Date;
    confirmDate?: Date;
  },
) {
  return prisma.employee.create({
    data: {
      tenantId,
      employeeNo: data.employeeNo,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      dob: data.dob,
      gender: data.gender ?? 'unspecified',
      maritalStatus: data.maritalStatus,
      nationality: data.nationality,
      idNumber: data.idNumber,
      departmentId: data.departmentId,
      designationId: data.designationId,
      locationId: data.locationId,
      managerId: data.managerId,
      employmentType: data.employmentType ?? 'full_time',
      status: data.status ?? 'active',
      hireDate: data.hireDate,
      confirmDate: data.confirmDate,
    },
    include: EMPLOYEE_INCLUDE,
  });
}

export async function updateEmployee(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
) {
  const existing = await prisma.employee.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw HttpError.notFound('Employee not found.');

  // Map input to updatable fields; nulls allowed for optional relations.
  const allowed = [
    'firstName', 'lastName', 'email', 'phone', 'dob', 'gender', 'maritalStatus',
    'nationality', 'idNumber', 'departmentId', 'designationId', 'locationId',
    'managerId', 'employmentType', 'status', 'confirmDate',
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  return prisma.employee.update({ where: { id }, data: update as Prisma.EmployeeUpdateInput, include: EMPLOYEE_INCLUDE });
}

export async function deleteEmployee(tenantId: string, id: string) {
  // Soft-delete so historical references (payslips, attendance) stay intact.
  await prisma.employee.updateMany({ where: { id, tenantId, deletedAt: null }, data: { deletedAt: new Date(), status: 'exited' } });
}

// ------------------------------------------------------------------
//  Documents
// ------------------------------------------------------------------

export async function listDocuments(tenantId: string, employeeId: string) {
  return prisma.employeeDocument.findMany({
    where: { tenantId, employeeId },
    orderBy: { uploadedAt: 'desc' },
  });
}

export async function createDocumentRecord(
  tenantId: string,
  employeeId: string,
  data: { type: string; name: string; storageKey: string; mimeType: string; size: number; expiry?: Date | null },
) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } });
  if (!employee) throw HttpError.notFound('Employee not found.');
  return prisma.employeeDocument.create({
    data: {
      tenantId,
      employeeId,
      type: data.type,
      name: data.name,
      storageKey: data.storageKey,
      mimeType: data.mimeType,
      size: data.size,
      expiry: data.expiry ?? null,
    },
  });
}

export async function deleteDocumentRecord(tenantId: string, employeeId: string, documentId: string) {
  const doc = await prisma.employeeDocument.findFirst({ where: { id: documentId, tenantId, employeeId } });
  if (!doc) throw HttpError.notFound('Document not found.');
  await prisma.employeeDocument.delete({ where: { id: documentId } });
  return doc.storageKey; // caller deletes the object from storage
}

// ------------------------------------------------------------------
//  Org chart
// ------------------------------------------------------------------

export interface OrgNode {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  department: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
  reports: OrgNode[];
}

export async function getOrgChart(tenantId: string, rootId?: string): Promise<OrgNode[]> {
  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null, status: 'active' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      managerId: true,
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
    },
    orderBy: { firstName: 'asc' },
  });

  const byId = new Map<string, OrgNode>();
  for (const e of employees) {
    byId.set(e.id, {
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      avatarUrl: e.avatarUrl,
      department: e.department,
      designation: e.designation,
      reports: [],
    });
  }

  const roots: OrgNode[] = [];
  for (const node of byId.values()) {
    const managerId = employees.find((e) => e.id === node.id)?.managerId ?? null;
    if (managerId && byId.has(managerId)) {
      byId.get(managerId)!.reports.push(node);
    } else {
      roots.push(node);
    }
  }

  return rootId ? (byId.get(rootId) ? [byId.get(rootId)!] : []) : roots;
}

// ------------------------------------------------------------------
//  Reference data (for forms)
// ------------------------------------------------------------------

export async function getFormReferenceData(tenantId: string) {
  const [departments, designations, locations] = await Promise.all([
    prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.designation.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.location.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return { departments, designations, locations };
}
