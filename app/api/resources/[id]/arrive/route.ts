import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { sendPushToRole } from '@/lib/pushNotifications';

/**
 * POST /api/resources/[id]/arrive
 * Marks a ResourceTrack as arrived. Server-side timestamp only.
 * Requires Supervisor role.
 * Validates: Requirements 5.2, 5.5, 11.1
 */
export const POST = withAuth(
  'SUPERVISOR',
  async (_req: NextRequest, context: { params: Record<string, string> }) => {
    const { id } = context.params;

    const resource = await prisma.resourceTrack.findUnique({ where: { id } });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    if (resource.status === 'ARRIVED') {
      return NextResponse.json({ error: 'Resource has already been marked as arrived' }, { status: 409 });
    }

    // Server-side timestamp — never derived from any client-provided value (Req 11.1)
    const arrivedAt = new Date();

    const updated = await prisma.resourceTrack.update({
      where: { id },
      data: { status: 'ARRIVED', arrivedAt },
    });

    // Notify admins (fire-and-forget)
    sendPushToRole('ADMIN', {
      title: '🚛 Resource Arrived',
      body: `${resource.name} has arrived at the site`,
      url: '/admin/dashboard',
    }).catch(() => {});

    return NextResponse.json(updated, { status: 200 });
  }
);
