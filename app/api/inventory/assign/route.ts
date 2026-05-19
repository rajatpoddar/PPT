import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { assignInventorySchema } from '@/lib/validations/inventory';

/**
 * POST /api/inventory/assign
 * Assigns (or updates) a quantity of an inventory item to a site.
 * If assignment already exists, it is updated (upsert).
 * Requires Admin role.
 */
export const POST = withAuth('ADMIN', async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { _root: ['Invalid JSON body'] } }, { status: 422 });
  }

  const result = assignInventorySchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const { itemId, siteId, quantity, note } = result.data;

  // Validate item exists
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) {
    return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
  }

  // Check total assigned qty won't exceed totalQty
  const otherAssignments = await prisma.inventoryAssignment.findMany({
    where: { itemId, siteId: { not: siteId } },
  });
  const otherTotal = otherAssignments.reduce((sum, a) => sum + a.quantity, 0);
  if (otherTotal + quantity > item.totalQty) {
    return NextResponse.json(
      { error: `Cannot assign ${quantity} ${item.unit} — only ${item.totalQty - otherTotal} available` },
      { status: 422 }
    );
  }

  const assignment = await prisma.inventoryAssignment.upsert({
    where: { itemId_siteId: { itemId, siteId } },
    create: { itemId, siteId, quantity, note: note ?? null },
    update: { quantity, note: note ?? null },
    include: {
      item: true,
      site: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(assignment, { status: 200 });
});
