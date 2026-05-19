import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

const createPhotoSchema = z.object({
  planId: z.string().min(1, 'planId is required'),
  url: z.string().min(1, 'url is required'),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

/**
 * POST /api/photos
 * Creates a SitePhoto record linked to a DailyPlan.
 * uploadedAt is set server-side via Prisma default.
 * Validates: Requirements 6.2, 6.3, 11.2
 */
export const POST = withAuth('SUPERVISOR', async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
  }

  const result = createPhotoSchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const { planId, url, latitude, longitude } = result.data;

  const plan = await prisma.dailyPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: `DailyPlan with id "${planId}" not found` }, { status: 404 });
  }

  // Server-side timestamp via Prisma default (Req 11.2)
  const photo = await prisma.sitePhoto.create({
    data: {
      planId,
      url,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    },
  });

  return NextResponse.json(photo, { status: 201 });
});
