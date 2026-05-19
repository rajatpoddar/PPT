import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { updateInventoryItemSchema } from '@/lib/validations/inventory';

/**
 * PATCH /api/inventory/[id]
 * Updates an inventory item.
 * Requires Admin role.
 */
export const PATCH = withAuth('ADMIN', async (req: NextRequest, { params }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
  }

  const result = updateInventoryItemSchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const existing = await prisma.inventoryItem.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const updated = await prisma.inventoryItem.update({
    where: { id: params.id },
    data: result.data,
    include: {
      assignments: {
        include: { site: { select: { id: true, name: true } } },
      },
    },
  });

  const assignedQty = updated.assignments.reduce((sum, a) => sum + a.quantity, 0);
  return NextResponse.json({ ...updated, assignedQty, availableQty: updated.totalQty - assignedQty }, { status: 200 });
});

/**
 * DELETE /api/inventory/[id]
 * Deletes an inventory item and all its assignments.
 * Requires Admin role.
 */
export const DELETE = withAuth('ADMIN', async (_req: NextRequest, { params }) => {
  const existing = await prisma.inventoryItem.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.inventoryAssignment.deleteMany({ where: { itemId: params.id } }),
    prisma.inventoryItem.delete({ where: { id: params.id } }),
  ]);

  return new NextResponse(null, { status: 204 });
});
