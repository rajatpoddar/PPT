import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { z } from 'zod';

const updatePlanSchema = z.object({
  goals: z
    .array(z.string().trim().min(1, 'Goal must not be empty'))
    .min(1, 'At least one goal is required')
    .optional(),
  resources: z
    .array(z.object({ name: z.string().trim().min(1, 'Resource name must not be empty') }))
    .min(1, 'At least one resource is required')
    .optional(),
  voiceNoteUrl: z.string().nullable().optional(),
});

/**
 * GET /api/plans/[id]
 * Returns a single DailyPlan with its resources, photos, and report included.
 * Accessible by Admin or Supervisor (any authenticated user).
 *
 * Returns 404 if the plan does not exist.
 *
 * Validates: Requirements 3.9
 */
export const GET = withAuth(
  '*',
  async (_req: NextRequest, context: { params: Record<string, string> }) => {
    const { id } = context.params;

    const plan = await prisma.dailyPlan.findUnique({
      where: { id },
      include: {
        resources: true,
        photos: {
          orderBy: { uploadedAt: 'desc' },
        },
        report: true,
        site: true,
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Parse goals JSON string back to array
    return NextResponse.json(
      { ...plan, goals: JSON.parse(plan.goals) as string[] },
      { status: 200 }
    );
  }
);

/**
 * PATCH /api/plans/[id]
 * Updates goals, resources, and/or voiceNoteUrl of a plan.
 * Requires Admin role.
 */
export const PATCH = withAuth(
  'ADMIN',
  async (req: NextRequest, context: { params: Record<string, string> }) => {
    const { id } = context.params;

    const plan = await prisma.dailyPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
    }

    const result = updatePlanSchema.safeParse(body);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
        if (!errors[field]) errors[field] = [];
        errors[field].push(issue.message);
      }
      return NextResponse.json({ errors }, { status: 422 });
    }

    const { goals, resources, voiceNoteUrl } = result.data;

    // Update plan fields
    const updatedPlan = await prisma.dailyPlan.update({
      where: { id },
      data: {
        ...(goals !== undefined ? { goals: JSON.stringify(goals) } : {}),
        ...(voiceNoteUrl !== undefined ? { voiceNoteUrl } : {}),
      },
    });

    // Replace resources if provided
    if (resources !== undefined) {
      await prisma.$transaction([
        prisma.resourceTrack.deleteMany({ where: { planId: id } }),
        prisma.resourceTrack.createMany({
          data: resources.map((r) => ({ planId: id, name: r.name, status: 'PENDING' })),
        }),
      ]);
    }

    const fullPlan = await prisma.dailyPlan.findUnique({
      where: { id },
      include: { resources: true, site: true },
    });

    return NextResponse.json(
      { ...fullPlan, goals: JSON.parse(updatedPlan.goals) as string[] },
      { status: 200 }
    );
  }
);

/**
 * DELETE /api/plans/[id]
 * Deletes a plan and all associated resources, photos, and reports.
 * Requires Admin role.
 */
export const DELETE = withAuth(
  'ADMIN',
  async (_req: NextRequest, context: { params: Record<string, string> }) => {
    const { id } = context.params;

    const plan = await prisma.dailyPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.dailyReport.deleteMany({ where: { planId: id } }),
      prisma.sitePhoto.deleteMany({ where: { planId: id } }),
      prisma.resourceTrack.deleteMany({ where: { planId: id } }),
      prisma.dailyPlan.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  }
);
