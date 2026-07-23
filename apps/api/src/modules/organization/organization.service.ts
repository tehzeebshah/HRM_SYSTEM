import { prisma } from '../../config/prisma';
import { HttpError } from '../../common/errors';

type DepartmentNode = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  description: string | null;
  children: DepartmentNode[];
  employeeCount: number;
};

// ==================================================================
//  Departments
// ==================================================================

export async function listDepartments(tenantId: string) {
  return prisma.department.findMany({
    where: { tenantId },
    orderBy: [{ name: 'asc' }],
    include: {
      _count: { select: { employees: true } },
      parent: { select: { id: true, name: true } },
    },
  });
}

/** Returns departments as a nested tree (built from parent/child edges). */
export async function getDepartmentTree(tenantId: string): Promise<DepartmentNode[]> {
  const rows = await prisma.department.findMany({
    where: { tenantId },
    orderBy: [{ name: 'asc' }],
    include: { _count: { select: { employees: true } } },
  });

  const nodes = new Map<string, DepartmentNode>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      name: r.name,
      code: r.code,
      parentId: r.parentId,
      description: r.description,
      children: [],
      employeeCount: r._count.employees,
    });
  }

  const roots: DepartmentNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function createDepartment(
  tenantId: string,
  data: { name: string; code?: string | null; parentId?: string | null; description?: string | null },
) {
  if (data.parentId) {
    const parent = await prisma.department.findFirst({ where: { id: data.parentId, tenantId } });
    if (!parent) throw HttpError.badRequest('Parent department not found.');
  }
  return prisma.department.create({
    data: { tenantId, name: data.name, code: data.code ?? null, parentId: data.parentId ?? null, description: data.description ?? null },
  });
}

export async function updateDepartment(
  tenantId: string,
  id: string,
  data: { name?: string; code?: string | null; parentId?: string | null; description?: string | null },
) {
  if (data.parentId) {
    if (data.parentId === id) throw HttpError.badRequest('A department cannot be its own parent.');
    const parent = await prisma.department.findFirst({ where: { id: data.parentId, tenantId } });
    if (!parent) throw HttpError.badRequest('Parent department not found.');
  }
  return prisma.department.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });
}

export async function deleteDepartment(tenantId: string, id: string) {
  const hasEmployees = await prisma.employee.findFirst({ where: { departmentId: id, tenantId } });
  if (hasEmployees) throw HttpError.conflict('Cannot delete a department that still has employees.');
  const hasChildren = await prisma.department.findFirst({ where: { parentId: id, tenantId } });
  if (hasChildren) throw HttpError.conflict('Cannot delete a department that has sub-departments.');
  await prisma.department.deleteMany({ where: { id, tenantId } });
}

// ==================================================================
//  Designations
// ==================================================================

export async function listDesignations(tenantId: string) {
  return prisma.designation.findMany({
    where: { tenantId },
    orderBy: [{ name: 'asc' }],
    include: { _count: { select: { employees: true } } },
  });
}

export async function createDesignation(
  tenantId: string,
  data: { name: string; grade?: string | null; description?: string | null },
) {
  return prisma.designation.create({
    data: { tenantId, name: data.name, grade: data.grade ?? null, description: data.description ?? null },
  });
}

export async function updateDesignation(
  tenantId: string,
  id: string,
  data: { name?: string; grade?: string | null; description?: string | null },
) {
  return prisma.designation.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.grade !== undefined && { grade: data.grade }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });
}

export async function deleteDesignation(tenantId: string, id: string) {
  const inUse = await prisma.employee.findFirst({ where: { designationId: id, tenantId } });
  if (inUse) throw HttpError.conflict('Cannot delete a designation that is assigned to employees.');
  await prisma.designation.deleteMany({ where: { id, tenantId } });
}

// ==================================================================
//  Locations
// ==================================================================

export async function listLocations(tenantId: string) {
  return prisma.location.findMany({
    where: { tenantId },
    orderBy: [{ name: 'asc' }],
    include: { _count: { select: { employees: true } } },
  });
}

export async function createLocation(
  tenantId: string,
  data: { name: string; address?: string | null; city?: string | null; country?: string | null; timezone?: string | null },
) {
  return prisma.location.create({
    data: {
      tenantId,
      name: data.name,
      address: data.address ?? null,
      city: data.city ?? null,
      country: data.country ?? null,
      timezone: data.timezone ?? null,
    },
  });
}

export async function updateLocation(
  tenantId: string,
  id: string,
  data: { name?: string; address?: string | null; city?: string | null; country?: string | null; timezone?: string | null },
) {
  return prisma.location.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.country !== undefined && { country: data.country }),
      ...(data.timezone !== undefined && { timezone: data.timezone }),
    },
  });
}

export async function deleteLocation(tenantId: string, id: string) {
  const inUse = await prisma.employee.findFirst({ where: { locationId: id, tenantId } });
  if (inUse) throw HttpError.conflict('Cannot delete a location that has employees assigned.');
  await prisma.location.deleteMany({ where: { id, tenantId } });
}
