import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { createDprSchema } from '@/lib/validations/dpr';
import { sendPushToRole } from '@/lib/pushNotifications';

/**
 * POST /api/dpr
 * Submits a Daily Progress Report for a DailyPlan.
 * Requires Supervisor role.
 * Validates: Requirements 7.1, 7.2, 7.4, 7.5, 7.6, 7.8, 11.3, 11.5
 */
export const POST = withAuth('SUPERVISOR', async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
  }

  const result = createDprSchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const { planId, masons, helpers, length, breadth, height, voiceRemarkUrl } = result.data;

  const plan = await prisma.dailyPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: `DailyPlan with id "${planId}" not found` }, { status: 404 });
  }

  // Server-side timestamps — never derived from any client-provided value (Req 11.3, 11.5)
  const now = new Date();

  try {
    const [report] = await prisma.$transaction([
      prisma.dailyReport.create({
        data: { planId, masons, helpers, length, breadth, height, voiceRemarkUrl, submittedAt: now },
      }),
      prisma.dailyPlan.update({
        where: { id: planId },
        data: { status: 'COMPLETED', statusChangedAt: now },
      }),
    ]);

    // Send push notification to all admins (fire-and-forget)
    sendPushToRole('ADMIN', {
      title: '📊 DPR Submitted',
      body: `Supervisor has submitted the Daily Progress Report for plan on ${new Date(plan.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      url: '/admin/dashboard',
    }).catch(() => { /* ignore push errors */ });

    return NextResponse.json(report, { status: 201 });
  } catch (err: unknown) {    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'A Daily Progress Report has already been submitted for this plan' }, { status: 409 });
    }
    throw err;
  }
});
