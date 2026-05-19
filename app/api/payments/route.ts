import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { authOptions } from '@/lib/auth';
import { createPaymentSchema } from '@/lib/validations/payment';

/**
 * GET /api/payments
 * Admin: returns all payments across all sites.
 * Supervisor: returns payments for their assigned sites only.
 * Query params: siteId? (filter by site)
 */
export const GET = withAuth('*', async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const siteIdFilter = searchParams.get('siteId');

  let siteIds: string[] | undefined;

  if (session!.user.role === 'SUPERVISOR') {
    // Get supervisor's assigned sites
    const assignments = await prisma.supervisorSite.findMany({
      where: { userId: session!.user.id },
      select: { siteId: true },
    });
    siteIds = assignments.map((a) => a.siteId);
    // If filtering by a specific site, ensure it's one of theirs
    if (siteIdFilter) {
      if (!siteIds.includes(siteIdFilter)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      siteIds = [siteIdFilter];
    }
  } else if (siteIdFilter) {
    siteIds = [siteIdFilter];
  }

  const payments = await prisma.payment.findMany({
    where: siteIds ? { siteId: { in: siteIds } } : undefined,
    orderBy: { paymentDate: 'desc' },
    include: {
      site: { select: { id: true, name: true } },
      supervisor: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json(payments, { status: 200 });
});

/**
 * POST /api/payments
 * Creates a payment record.
 * Supervisor: can only record for their assigned sites.
 * Admin: can record for any site.
 */
export const POST = withAuth('*', async (req: NextRequest) => {
  const session = await getServerSession(authOptions);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
  }

  const result = createPaymentSchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const { siteId, paymentDate, workerType, workerName, amount, note } = result.data;

  // Supervisor can only record payments for their assigned sites
  if (session!.user.role === 'SUPERVISOR') {
    const assignment = await prisma.supervisorSite.findFirst({
      where: { userId: session!.user.id, siteId },
    });
    if (!assignment) {
      return NextResponse.json({ error: 'Forbidden — not assigned to this site' }, { status: 403 });
    }
  }

  const payment = await prisma.payment.create({
    data: {
      siteId,
      supervisorId: session!.user.id,
      paymentDate: new Date(paymentDate),
      workerType,
      workerName: workerName ?? null,
      amount,
      note: note ?? null,
    },
    include: {
      site: { select: { id: true, name: true } },
      supervisor: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json(payment, { status: 201 });
});
