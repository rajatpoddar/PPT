import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { authOptions } from '@/lib/auth';

/**
 * DELETE /api/payments/[id]
 * Admin can delete any payment. Supervisor can only delete their own.
 */
export const DELETE = withAuth('*', async (_req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);

  const payment = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  if (session!.user.role === 'SUPERVISOR' && payment.supervisorId !== session!.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.payment.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
});
