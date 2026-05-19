import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { z } from 'zod';

const updateSiteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').optional(),
  location: z.string().trim().min(1, 'Location is required').optional(),
});

/**
 * PATCH /api/sites/[id]
 * Updates a site's name and/or location.
 * Requires Admin role.
 */
export const PATCH = withAuth(
  'ADMIN',
  async (req: NextRequest, context: { params: Record<string, string> }) => {
    const { id } = context.params;

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
    }

    const result = updateSiteSchema.safeParse(body);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
        if (!errors[field]) errors[field] = [];
        errors[field].push(issue.message);
      }
      return NextResponse.json({ errors }, { status: 422 });
    }

    const updated = await prisma.site.update({
      where: { id },
      data: result.data,
    });

    return NextResponse.json(updated, { status: 200 });
  }
);

/**
 * DELETE /api/sites/[id]
 * Deletes a site and all associated plans, resources, photos, and reports.
 * Requires Admin role.
 */
export const DELETE = withAuth(
  'ADMIN',
  async (_req: NextRequest, context: { params: Record<string, string> }) => {
    const { id } = context.params;

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Cascade delete: reports → photos → resources → plans → site
    const plans = await prisma.dailyPlan.findMany({
      where: { siteId: id },
      select: { id: true },
    });
    const planIds = plans.map((p) => p.id);

    await prisma.$transaction([
      prisma.dailyReport.deleteMany({ where: { planId: { in: planIds } } }),
      prisma.sitePhoto.deleteMany({ where: { planId: { in: planIds } } }),
      prisma.resourceTrack.deleteMany({ where: { planId: { in: planIds } } }),
      prisma.dailyPlan.deleteMany({ where: { siteId: id } }),
      // Unassign supervisors from this site
      prisma.user.updateMany({ where: { siteId: id }, data: { siteId: null } }),
      prisma.site.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  }
);
