import { prisma } from '../../config/prisma';
import { HttpError } from '../../common/errors';

// ---- job openings ----

export async function listOpenings(tenantId: string) {
  return prisma.jobOpening.findMany({
    where: { tenantId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { department: { select: { id: true, name: true } }, _count: { select: { applications: true } } },
  });
}

export async function createOpening(
  tenantId: string,
  hiringManagerId: string | undefined,
  data: { title: string; departmentId?: string | null; headcount: number; type: string; description?: string },
) {
  return prisma.jobOpening.create({
    data: {
      tenantId,
      title: data.title,
      departmentId: data.departmentId ?? null,
      headcount: data.headcount,
      type: data.type,
      description: data.description ?? null,
      hiringManagerId: hiringManagerId ?? null,
      status: 'open',
      postedAt: new Date(),
    },
  });
}

export async function updateOpening(tenantId: string, id: string, data: Record<string, unknown>) {
  const existing = await prisma.jobOpening.findFirst({ where: { id, tenantId } });
  if (!existing) throw HttpError.notFound('Job opening not found.');
  const allowed = ['title', 'headcount', 'type', 'status', 'description', 'departmentId'];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (data[k] !== undefined) update[k] = data[k];
  return prisma.jobOpening.update({ where: { id }, data: update });
}

// ---- candidates ----

export async function listCandidates(tenantId: string, q?: string) {
  return prisma.candidate.findMany({
    where: {
      tenantId,
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { applications: true } } },
  });
}

export async function createCandidate(
  tenantId: string,
  data: { name: string; email: string; phone?: string; source?: string },
) {
  return prisma.candidate.create({
    data: { tenantId, name: data.name, email: data.email, phone: data.phone, source: data.source ?? null, tags: [] },
  });
}

// ---- applications / pipeline ----

export async function listApplications(tenantId: string, filters: { jobOpeningId?: string; stage?: string }) {
  return prisma.application.findMany({
    where: {
      tenantId,
      ...(filters.jobOpeningId && { jobOpeningId: filters.jobOpeningId }),
      ...(filters.stage && { stage: filters.stage }),
    },
    include: {
      candidate: { select: { id: true, name: true, email: true, phone: true, source: true } },
      jobOpening: { select: { id: true, title: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createApplication(tenantId: string, jobOpeningId: string, candidateId: string) {
  const job = await prisma.jobOpening.findFirst({ where: { id: jobOpeningId, tenantId } });
  if (!job) throw HttpError.notFound('Job opening not found.');
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, tenantId } });
  if (!candidate) throw HttpError.notFound('Candidate not found.');
  return prisma.application.create({
    data: { tenantId, jobOpeningId, candidateId, stage: 'applied' },
  });
}

export async function moveApplication(tenantId: string, applicationId: string, stage: string, rejectedReason?: string) {
  const app = await prisma.application.findFirst({ where: { id: applicationId, tenantId } });
  if (!app) throw HttpError.notFound('Application not found.');

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      stage,
      ...(stage === 'rejected' && { rejectedReason: rejectedReason ?? null }),
    },
  });

  // Auto-convert hired candidates into an Employee record (if not already converted).
  if (stage === 'hired') {
    await convertToEmployee(tenantId, applicationId);
  }
  return updated;
}

/** Promotes a hired candidate to an Employee + links the candidate's future user account. */
async function convertToEmployee(tenantId: string, applicationId: string) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId },
    include: { candidate: true, jobOpening: { select: { title: true, departmentId: true } } },
  });
  if (!app) return;
  const c = app.candidate;

  const employeeNo = `HIRE-${c.id.slice(0, 6).toUpperCase()}`;
  const exists = await prisma.employee.findFirst({ where: { tenantId, email: c.email, deletedAt: null } });
  if (exists) return; // already an employee

  await prisma.employee.create({
    data: {
      tenantId,
      employeeNo,
      firstName: c.name.split(' ')[0] ?? c.name,
      lastName: c.name.split(' ').slice(1).join(' ') || '-',
      email: c.email,
      phone: c.phone,
      departmentId: app.jobOpening.departmentId ?? null,
      designationId: null,
      employmentType: 'full_time',
      status: 'active',
      hireDate: new Date(),
    },
  });
}
