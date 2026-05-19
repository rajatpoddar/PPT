import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ─── Sites ────────────────────────────────────────────────────────────────
  const site1 = await prisma.site.upsert({
    where: { id: 'seed-site-1' },
    update: {},
    create: {
      id: 'seed-site-1',
      name: 'Main Construction Site',
      location: '123 Builder Street',
    },
  });

  const site2 = await prisma.site.upsert({
    where: { id: 'seed-site-2' },
    update: {},
    create: {
      id: 'seed-site-2',
      name: 'Secondary Site',
      location: '456 Construction Ave',
    },
  });

  console.log('✅ Sites seeded:', site1.name, '|', site2.name);

  // ─── Users ────────────────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      siteId: null,
    },
  });

  console.log('✅ Admin user seeded:', admin.username);

  const supervisorPasswordHash = await bcrypt.hash('supervisor123', 10);
  const supervisor = await prisma.user.upsert({
    where: { username: 'supervisor' },
    update: {},
    create: {
      username: 'supervisor',
      passwordHash: supervisorPasswordHash,
      role: 'SUPERVISOR',
      siteId: site1.id,
    },
  });

  console.log('✅ Supervisor user seeded:', supervisor.username, '→ site:', site1.name);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
