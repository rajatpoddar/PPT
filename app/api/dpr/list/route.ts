import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

/**
 * GET /api/dpr/list
 * Returns all submitted DPRs with plan and site info.
 * Requires Admin role.
 * Query params: siteId? (filter by site)
 */
export const GET = withAuth('ADMIN', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const siteIdFilter = searchParams.get('siteId');

  const reports = await prisma.dailyReport.findMany({
    orderBy: { submittedAt: 'desc' },
    include: {
      plan: {
        include: {
          site: { select: { id: true, name: true, location: true } },
        },
      },
    },
    where: siteIdFilter
      ? { plan: { siteId: siteIdFilter } }
      : undefined,
  });

  const result = reports.map((r) => ({
    id: r.id,
    planId: r.planId,
    masons: r.masons,
    helpers: r.helpers,
    length: r.length,
    breadth: r.breadth,
    height: r.height,
    voiceRemarkUrl: r.voiceRemarkUrl,
    submittedAt: r.submittedAt.toISOString(),
    planDate: r.plan.date.toISOString(),
    site: r.plan.site,
  }));

  return NextResponse.json(result, { status: 200 });
});
