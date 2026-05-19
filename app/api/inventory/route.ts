import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { createInventoryItemSchema } from '@/lib/validations/inventory';

/**
 * GET /api/inventory
 * Returns all inventory items with their site assignments.
 * Accessible by Admin and Supervisor.
 */
export const GET = withAuth('*', async (_req: NextRequest) => {
  const items = await prisma.inventoryItem.findMany({
    orderBy: { name: 'asc' },
    include: {
      assignments: {
        include: {
          site: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Compute assigned total and available qty for each item
  const result = items.map((item) => {
    const assignedQty = item.assignments.reduce((sum, a) => sum + a.quantity, 0);
    return {
      ...item,
      assignedQty,
      availableQty: item.totalQty - assignedQty,
    };
  });

  return NextResponse.json(result, { status: 200 });
});

/**
 * POST /api/inventory
 * Creates a new inventory item.
 * Requires Admin role.
 */
export const POST = withAuth('ADMIN', async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
  }

  const result = createInventoryItemSchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const { name, unit, totalQty, note } = result.data;

  const item = await prisma.inventoryItem.create({
    data: { name, unit, totalQty, note: note ?? null },
    include: {
      assignments: {
        include: { site: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ ...item, assignedQty: 0, availableQty: item.totalQty }, { status: 201 });
});
