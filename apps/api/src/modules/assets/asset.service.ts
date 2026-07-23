import { prisma } from '../../config/prisma';
import { HttpError } from '../../common/errors';
import type { Prisma } from '../../../prisma/generated';

const ASSET_INCLUDE = {
  assignments: {
    where: { returnedAt: null },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    take: 1,
  },
} as const;

export async function listAssets(tenantId: string, query: { q?: string; status?: string }) {
  const where: Prisma.AssetWhereInput = { tenantId };
  if (query.status) where.status = query.status;
  if (query.q) {
    where.OR = [
      { code: { contains: query.q, mode: 'insensitive' } },
      { name: { contains: query.q, mode: 'insensitive' } },
      { serial: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  return prisma.asset.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: ASSET_INCLUDE,
  });
}

export async function createAsset(
  tenantId: string,
  data: { code: string; name: string; category?: string; serial?: string; purchaseDate?: Date; value?: number; notes?: string },
) {
  return prisma.asset.create({
    data: {
      tenantId,
      code: data.code,
      name: data.name,
      category: data.category ?? null,
      serial: data.serial ?? null,
      purchaseDate: data.purchaseDate ?? null,
      value: data.value ?? null,
      notes: data.notes ?? null,
      status: 'available',
    },
  });
}

export async function updateAsset(
  tenantId: string,
  id: string,
  data: Partial<{ name: string; category: string; serial: string; status: string; value: number; notes: string }>,
) {
  const existing = await prisma.asset.findFirst({ where: { id, tenantId } });
  if (!existing) throw HttpError.notFound('Asset not found.');
  return prisma.asset.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.serial !== undefined && { serial: data.serial }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.value !== undefined && { value: data.value }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

export async function deleteAsset(tenantId: string, id: string) {
  const assigned = await prisma.assetAssignment.findFirst({ where: { assetId: id, returnedAt: null } });
  if (assigned) throw HttpError.conflict('Cannot delete an asset that is currently issued.');
  await prisma.asset.deleteMany({ where: { id, tenantId } });
}

/** Issue an asset to an employee (closes any prior open assignment implicitly via status). */
export async function assignAsset(
  tenantId: string,
  assetId: string,
  employeeId: string,
  condition?: string,
  notes?: string,
) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw HttpError.notFound('Asset not found.');
  if (asset.status === 'assigned') throw HttpError.conflict('Asset is already assigned.');
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } });
  if (!employee) throw HttpError.notFound('Employee not found.');

  return prisma.$transaction([
    prisma.assetAssignment.create({
      data: { tenantId, assetId, employeeId, condition: condition ?? null, notes: notes ?? null },
    }),
    prisma.asset.update({ where: { id: assetId }, data: { status: 'assigned' } }),
  ]);
}

/** Return an asset: marks the open assignment returned, sets asset available. */
export async function returnAsset(tenantId: string, assetId: string, condition?: string, notes?: string) {
  const open = await prisma.assetAssignment.findFirst({ where: { assetId, tenantId, returnedAt: null } });
  if (!open) throw HttpError.badRequest('This asset is not currently issued.');

  return prisma.$transaction([
    prisma.assetAssignment.update({
      where: { id: open.id },
      data: { returnedAt: new Date(), condition: condition ?? open.condition, notes: notes ?? open.notes },
    }),
    prisma.asset.update({ where: { id: assetId }, data: { status: 'available' } }),
  ]);
}

/** Assignment history for a single asset (audit trail). */
export async function assetHistory(tenantId: string, assetId: string) {
  return prisma.assetAssignment.findMany({
    where: { tenantId, assetId },
    orderBy: { issuedAt: 'desc' },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });
}
