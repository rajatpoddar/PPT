import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { updateSupervisorSchema } from '@/lib/validations/supervisor';

/**
 * GET /api/supervisors/[id]
 * Returns a single supervisor with their assigned sites.
 * Requires Admin role.
 */
export const GET = withAuth('ADMIN', async (_req: NextRequest, { params }) => {
  const supervisor = await prisma.user.findFirst({
    where: { id: params.id, role: 'SUPERVISOR' },
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

  if (!supervisor) {
    return NextResponse.json({ error: 'Supervisor not found' }, { status: 404 });
  }

  return NextResponse.json(supervisor, { status: 200 });
});

/**
 * PATCH /api/supervisors/[id]
 * Updates supervisor username, password, and/or site assignments.
 * Requires Admin role.
 * Body: { username?, password?, siteIds? }
 */
export const PATCH = withAuth('ADMIN', async (req: NextRequest, { params }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
  }

  const result = updateSupervisorSchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const existing = await prisma.user.findFirst({
    where: { id: params.id, role: 'SUPERVISOR' },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Supervisor not found' }, { status: 404 });
  }

  const { username, password, siteIds } = result.data;

  // Check username uniqueness if changing
  if (username && username !== existing.username) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken) {
      return NextResponse.json(
        { errors: { username: ['Username already taken'] } },
        { status: 409 }
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (username) updateData.username = username;
  if (password) updateData.passwordHash = await bcrypt.hash(password, 12);

  // Update site assignments if provided
  if (siteIds !== undefined) {
    // Replace all site assignments
    await prisma.supervisorSite.deleteMany({ where: { userId: params.id } });
    if (siteIds.length > 0) {
      await prisma.supervisorSite.createMany({
        data: siteIds.map((siteId) => ({ userId: params.id, siteId })),
      });
    }
    // Update primary siteId for backward compat
    updateData.siteId = siteIds.length > 0 ? siteIds[0] : null;
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
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

  return NextResponse.json(updated, { status: 200 });
});

/**
 * DELETE /api/supervisors/[id]
 * Deletes a supervisor account.
 * Requires Admin role.
 */
export const DELETE = withAuth('ADMIN', async (_req: NextRequest, { params }) => {
  const existing = await prisma.user.findFirst({
    where: { id: params.id, role: 'SUPERVISOR' },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Supervisor not found' }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
});
