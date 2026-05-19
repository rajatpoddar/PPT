import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { authOptions } from '@/lib/auth';

/**
 * DELETE /api/expenses/[id]
 * Admin can delete any expense. Supervisor can only delete their own.
 */
export const DELETE = withAuth('*', async (_req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);

  const expense = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  if (session!.user.role === 'SUPERVISOR' && expense.supervisorId !== session!.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.expense.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
});
