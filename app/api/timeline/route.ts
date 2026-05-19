import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * TimelineEvent shape returned by this endpoint.
 * Validates: Requirements 8.1, 8.2, 8.3, 8.6
 */
export type TimelineEvent = {
  id: string;
  type: 'RESOURCE_ARRIVED' | 'PHOTO_UPLOADED' | 'DPR_SUBMITTED';
  siteId: string;
  siteName: string;
  timestamp: string; // ISO 8601
  payload: {
    resourceName?: string;  // for RESOURCE_ARRIVED
    photoUrl?: string;      // for PHOTO_UPLOADED
    thumbnailUrl?: string;  // for PHOTO_UPLOADED
    voiceRemarkUrl?: string; // for DPR_SUBMITTED
  };
};

/**
 * GET /api/timeline
 * Returns all timeline events for today across all Admin-accessible sites.
 * Supports optional ?siteId= filter.
 * Events are sorted by timestamp descending (most recent first).
 *
 * Requires Admin role.
 * Validates: Requirements 8.1, 8.2, 8.3, 8.6
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const siteIdFilter = searchParams.get('siteId') ?? undefined;

  // Today's date range (UTC midnight to midnight)
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Build site filter for plan queries
  const siteWhere = siteIdFilter ? { siteId: siteIdFilter } : {};

  // Fetch all today's plans (with site info) to get siteId → siteName mapping
  const plans = await prisma.dailyPlan.findMany({
    where: {
      date: todayStart,
      ...siteWhere,
    },
    select: {
      id: true,
      siteId: true,
      site: { select: { name: true } },
    },
  });

  const planIds = plans.map((p) => p.id);
  const planMap = new Map(plans.map((p) => [p.id, p]));

  const events: TimelineEvent[] = [];

  if (planIds.length > 0) {
    // 1. Resource arrivals
    const arrivals = await prisma.resourceTrack.findMany({
      where: {
        planId: { in: planIds },
        status: 'ARRIVED',
        arrivedAt: { gte: todayStart, lt: todayEnd },
      },
      select: {
        id: true,
        planId: true,
        name: true,
        arrivedAt: true,
      },
    });

    for (const arrival of arrivals) {
      const plan = planMap.get(arrival.planId);
      if (!plan || !arrival.arrivedAt) continue;
      events.push({
        id: `resource-${arrival.id}`,
        type: 'RESOURCE_ARRIVED',
        siteId: plan.siteId,
        siteName: plan.site.name,
        timestamp: arrival.arrivedAt.toISOString(),
        payload: { resourceName: arrival.name },
      });
    }

    // 2. Photo uploads
    const photos = await prisma.sitePhoto.findMany({
      where: {
        planId: { in: planIds },
        uploadedAt: { gte: todayStart, lt: todayEnd },
      },
      select: {
        id: true,
        planId: true,
        url: true,
        uploadedAt: true,
      },
    });

    for (const photo of photos) {
      const plan = planMap.get(photo.planId);
      if (!plan) continue;
      events.push({
        id: `photo-${photo.id}`,
        type: 'PHOTO_UPLOADED',
        siteId: plan.siteId,
        siteName: plan.site.name,
        timestamp: photo.uploadedAt.toISOString(),
        payload: {
          photoUrl: photo.url,
          thumbnailUrl: photo.url, // same URL; client can use CSS to size it
        },
      });
    }

    // 3. DPR submissions
    const reports = await prisma.dailyReport.findMany({
      where: {
        planId: { in: planIds },
        submittedAt: { gte: todayStart, lt: todayEnd },
      },
      select: {
        id: true,
        planId: true,
        submittedAt: true,
        voiceRemarkUrl: true,
      },
    });

    for (const report of reports) {
      const plan = planMap.get(report.planId);
      if (!plan) continue;
      events.push({
        id: `dpr-${report.id}`,
        type: 'DPR_SUBMITTED',
        siteId: plan.siteId,
        siteName: plan.site.name,
        timestamp: report.submittedAt.toISOString(),
        payload: {
          voiceRemarkUrl: report.voiceRemarkUrl ?? undefined,
        },
      });
    }
  }

  // Sort by timestamp descending (most recent first) — Requirement 8.1
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json(events, { status: 200 });
}
