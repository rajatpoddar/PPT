import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { createPlanSchema } from '@/lib/validations/plan';
import { Prisma } from '@prisma/client';
import { sendPushToSiteSupervisors } from '@/lib/pushNotifications';

/**
 * GET /api/plans
 * Returns a list of all plans with their resources and site included.
 * Accessible by Admin or Supervisor (any authenticated user).
 *
 * Validates: Requirements 3.9
 */
export const GET = withAuth('*', async (_req: NextRequest) => {
  const plans = await prisma.dailyPlan.findMany({
    orderBy: { date: 'desc' },
    include: {
      resources: true,
      site: true,
      report: {
        select: {
          id: true,
          voiceRemarkUrl: true,
          submittedAt: true,
        },
      },
    },
  });

  // Parse goals JSON string back to array for each plan
  const result = plans.map((plan) => ({
    ...plan,
    goals: JSON.parse(plan.goals) as string[],
  }));

  return NextResponse.json(result, { status: 200 });
});

/**
 * POST /api/plans
 * Creates a new DailyPlan with associated ResourceTrack records.
 * Requires Admin role.
 *
 * Body: { siteId, date, goals, resources, voiceNoteUrl? }
 *
 * Returns 201 with the created plan on success.
 * Returns 409 on duplicate site+date (@@unique constraint violation).
 * Returns 422 with { errors } on validation failure.
 *
 * Validates: Requirements 3.1, 3.6, 3.7, 3.10, 11.5
 */
export const POST = withAuth('ADMIN', async (req: NextRequest) => {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { errors: { _root: ['Invalid JSON body'] } },
      { status: 422 }
    );
  }

  const result = createPlanSchema.safeParse(body);

  if (!result.success) {
    // Transform Zod errors into { field: string[] } shape
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) {
        errors[field] = [];
      }
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const { siteId, date, goals, resources, voiceNoteUrl } = result.data;

  // Server-side timestamps — never accepted from the client
  const now = new Date();

  try {
    const plan = await prisma.dailyPlan.create({
      data: {
        siteId,
        date,
        goals: JSON.stringify(goals),
        status: 'PENDING',
        statusChangedAt: now,
        voiceNoteUrl: voiceNoteUrl ?? null,
        resources: {
          create: resources.map((r) => ({
            name: r.name,
            status: 'PENDING',
          })),
        },
      },
      include: {
        resources: true,
        site: true,
      },
    });

    // Return goals as a parsed array
    const response = NextResponse.json(
      { ...plan, goals: JSON.parse(plan.goals) as string[] },
      { status: 201 }
    );

    // Send push notification to supervisors assigned to this site (fire-and-forget)
    const planDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
    sendPushToSiteSupervisors(siteId, {
      title: '📋 New Plan Created',
      body: `Admin has created a plan for ${plan.site.name} on ${planDate}`,
      url: '/supervisor/execution',
    }).catch(() => { /* ignore push errors */ });

    return response;
  } catch (err) {    // Prisma unique constraint violation — duplicate site+date
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'A plan for this site and date already exists' },
        { status: 409 }
      );
    }

    throw err;
  }
});
