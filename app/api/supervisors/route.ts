import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { createSupervisorSchema } from '@/lib/validations/supervisor';

/**
 * GET /api/supervisors
 * Returns all supervisors with their assigned sites.
 * Requires Admin role.
 */
export const GET = withAuth('ADMIN', async (_req: NextRequest) => {
  const supervisors = await prisma.user.findMany({
    where: { role: 'SUPERVISOR' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      siteId: true,
      supervisorSites: {
        select: {
          id: true,
          assignedAt: true,
          site: { select: { id: true, name: true, location: true } },
        },
      },
    },
  });

  return NextResponse.json(supervisors, { status: 200 });
});

/**
 * POST /api/supervisors
 * Creates a new supervisor account with optional site assignments.
 * Requires Admin role.
 * Body: { username, password, siteIds? }
 */
export const POST = withAuth('ADMIN', async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
  }

  const result = createSupervisorSchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const { username, password, siteIds } = result.data;

  // Check username uniqueness
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { errors: { username: ['Username already taken'] } },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Determine primary siteId (first in list, for backward compat)
  const primarySiteId = siteIds && siteIds.length > 0 ? siteIds[0] : null;

  const supervisor = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: 'SUPERVISOR',
      siteId: primarySiteId,
      supervisorSites: siteIds && siteIds.length > 0
        ? { create: siteIds.map((siteId) => ({ siteId })) }
        : undefined,
    },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      siteId: true,
      supervisorSites: {
        select: {
          id: true,
          assignedAt: true,
          site: { select: { id: true, name: true, location: true } },
        },
      },
    },
  });

  return NextResponse.json(supervisor, { status: 201 });
});
