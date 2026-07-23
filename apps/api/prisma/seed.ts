import { PrismaClient } from './generated';
import { DEFAULT_ROLE_PERMISSIONS, RoleCode } from '@hrms/shared';
import { hashPassword } from '../src/common/password';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding HRMS baseline...');

  // --- permissions catalog ---
  const allPermissions = Array.from(
    new Set(Object.values(DEFAULT_ROLE_PERMISSIONS).flat()),
  );
  const permissionByCode = new Map<string, { id: string }>();
  for (const code of allPermissions) {
    const group = code.split('.')[0] ?? 'misc';
    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name: code, group },
    });
    permissionByCode.set(code, { id: perm.id });
  }

  // --- demo tenant ---
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'acme.demo' },
    update: {},
    create: {
      name: 'Acme Demo Co.',
      legalName: 'Acme Demo Company Ltd',
      domain: 'acme.demo',
      currency: 'USD',
      locale: 'en',
      timezone: 'UTC',
      status: 'active',
      plan: 'free',
    },
  });

  await prisma.tenantDomain.upsert({
    where: { domain: 'acme.demo' },
    update: { verified: true },
    create: { tenantId: tenant.id, domain: 'acme.demo', verified: true },
  });

  // --- system roles + permissions ---
  const roleIdByCode = new Map<string, string>();
  for (const code of Object.values(RoleCode)) {
    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: {},
      create: {
        tenantId: tenant.id,
        code,
        name: code.charAt(0).toUpperCase() + code.slice(1),
        isSystem: true,
      },
    });
    roleIdByCode.set(code, role.id);

    const perms = DEFAULT_ROLE_PERMISSIONS[code];
    for (const permCode of perms) {
      const perm = permissionByCode.get(permCode);
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // --- owner / admin user ---
  const email = 'admin@acme.demo';
  const passwordHash = await hashPassword('Admin123456');

  const owner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      firstName: 'Ada',
      lastName: 'Admin',
      status: 'active',
    },
  });

  await prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
    update: {},
    create: {
      userId: owner.id,
      tenantId: tenant.id,
      roleId: roleIdByCode.get(RoleCode.ADMIN)!,
      status: 'active',
    },
  });

  console.log('Seed complete.');
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`  Admin:  ${email} / Admin123456`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
