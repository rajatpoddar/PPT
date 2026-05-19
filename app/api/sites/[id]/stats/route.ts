import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

/**
 * GET /api/sites/[id]/stats
 * Returns detailed stats for a site:
 * - Total mason mandays, helper mandays
 * - Total work volume (sum of L×B×H from all DPRs)
 * - Total payments (mason, helper, combined)
 * - Total expenses by category
 * - Recent DPRs
 * Requires Admin role.
 */
export const GET = withAuth('ADMIN', async (_req: NextRequest, { params }) => {
  const site = await prisma.site.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, location: true, createdAt: true },
  });

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Get all DPRs for this site
  const reports = await prisma.dailyReport.findMany({
    where: { plan: { siteId: params.id } },
    include: {
      plan: { select: { date: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });

  const totalMasonDays = reports.reduce((sum, r) => sum + r.masons, 0);
  const totalHelperDays = reports.reduce((sum, r) => sum + r.helpers, 0);
  const totalVolume = reports.reduce((sum, r) => sum + r.length * r.breadth * r.height, 0);
  const totalDPRs = reports.length;

  // Payments summary
  const payments = await prisma.payment.findMany({
    where: { siteId: params.id },
    orderBy: { paymentDate: 'desc' },
    include: { supervisor: { select: { id: true, username: true } } },
  });

  const totalMasonPayment = payments
    .filter((p) => p.workerType === 'MASON')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalHelperPayment = payments
    .filter((p) => p.workerType === 'HELPER')
    .reduce((sum, p) => sum + p.amount, 0);

  // Expenses summary
  const expenses = await prisma.expense.findMany({
    where: { siteId: params.id },
    orderBy: { expenseDate: 'desc' },
    include: { supervisor: { select: { id: true, username: true } } },
  });

  const expenseByCategory: Record<string, number> = {};
  for (const e of expenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount;
  }
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Assigned supervisors
  const supervisors = await prisma.supervisorSite.findMany({
    where: { siteId: params.id },
    include: { user: { select: { id: true, username: true } } },
  });

  // Inventory assigned to this site
  const inventoryAssignments = await prisma.inventoryAssignment.findMany({
    where: { siteId: params.id },
    include: { item: { select: { id: true, name: true, unit: true } } },
  });

  return NextResponse.json({
    site,
    mandays: {
      totalMasonDays,
      totalHelperDays,
      totalDPRs,
    },
    workVolume: {
      totalVolume: Math.round(totalVolume * 100) / 100,
    },
    payments: {
      totalMasonPayment,
      totalHelperPayment,
      totalPayment: totalMasonPayment + totalHelperPayment,
      records: payments,
    },
    expenses: {
      totalExpenses,
      byCategory: expenseByCategory,
      records: expenses,
    },
    supervisors: supervisors.map((s) => s.user),
    inventory: inventoryAssignments,
    recentDPRs: reports.slice(0, 10).map((r) => ({
      id: r.id,
      planDate: r.plan.date.toISOString(),
      masons: r.masons,
      helpers: r.helpers,
      length: r.length,
      breadth: r.breadth,
      height: r.height,
      volume: Math.round(r.length * r.breadth * r.height * 100) / 100,
      submittedAt: r.submittedAt.toISOString(),
    })),
  }, { status: 200 });
});
