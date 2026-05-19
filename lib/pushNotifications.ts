import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

// Configure VAPID details once
webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? 'mailto:admin@pptbuilders.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? ''
);

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

/**
 * Send a push notification to a specific user by userId.
 * Silently removes stale subscriptions (410 Gone).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const sub = await prisma.pushSubscription.findUnique({ where: { userId } });
  if (!sub) return;

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
  } catch (err: unknown) {
    // Remove stale subscription
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      const statusCode = (err as { statusCode: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await prisma.pushSubscription.deleteMany({ where: { userId } });
      }
    }
  }
}

/**
 * Send a push notification to all users with a given role.
 */
export async function sendPushToRole(role: string, payload: PushPayload): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role },
    select: { id: true },
  });

  await Promise.allSettled(users.map((u) => sendPushToUser(u.id, payload)));
}

/**
 * Send a push notification to all supervisors assigned to a specific site.
 */
export async function sendPushToSiteSupervisors(siteId: string, payload: PushPayload): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: 'SUPERVISOR', siteId },
    select: { id: true },
  });

  await Promise.allSettled(users.map((u) => sendPushToUser(u.id, payload)));
}
