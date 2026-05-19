// One-time admin creation script — run inside container:
// node scripts/create-admin.mjs
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bcrypt = require('/app/node_modules/bcryptjs/index.js');

const prisma = new PrismaClient();

const username = process.env.ADMIN_USER || 'admin';
const password = process.env.ADMIN_PASS || 'admin123';

const hash = await bcrypt.hash(password, 10);

try {
  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash: hash },
    create: { username, passwordHash: hash, role: 'ADMIN' },
  });
  console.log(`✅ Admin user ready: ${user.username}`);
} catch (e) {
  console.error('❌ Failed:', e.message);
} finally {
  await prisma.$disconnect();
}
