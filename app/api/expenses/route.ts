import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { authOptions } from '@/lib/auth';
import { createExpenseSchema } from '@/lib/validations/payment';

/**
 * GET /api/expenses
 * Admin: all expenses. Supervisor: only their assigned sites.
 * Query params: siteId? (filter by site)
 */
export const GET = withAuth('*', async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const siteIdFilter = searchParams.get('siteId');

  let siteIds: string[] | undefined;

  if (session!.user.role === 'SUPERVISOR') {
    const assignments = await prisma.supervisorSite.findMany({
      where: { userId: session!.user.id },
      select: { siteId: true },
    });
    siteIds = assignments.map((a) => a.siteId);
    if (siteIdFilter) {
      if (!siteIds.includes(siteIdFilter)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      siteIds = [siteIdFilter];
    }
  } else if (siteIdFilter) {
    siteIds = [siteIdFilter];
  }

  const expenses = await prisma.expense.findMany({
    where: siteIds ? { siteId: { in: siteIds } } : undefined,
    orderBy: { expenseDate: 'desc' },
    include: {
      site: { select: { id: true, name: true } },
      supervisor: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json(expenses, { status: 200 });
});

/**
 * POST /api/expenses
 * Creates an expense record.
 */
export const POST = withAuth('*', async (req: NextRequest) => {
  const session = await getServerSession(authOptions);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
  }

  const result = createExpenseSchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const { siteId, expenseDate, category, description, amount } = result.data;

  if (session!.user.role === 'SUPERVISOR') {
    const assignment = await prisma.supervisorSite.findFirst({
      where: { userId: session!.user.id, siteId },
    });
    if (!assignment) {
      return NextResponse.json({ error: 'Forbidden — not assigned to this site' }, { status: 403 });
    }
  }

  const expense = await prisma.expense.create({
    data: {
      siteId,
      supervisorId: session!.user.id,
      expenseDate: new Date(expenseDate),
      category,
      description,
      amount,
    },
    include: {
      site: { select: { id: true, name: true } },
      supervisor: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json(expense, { status: 201 });
});
