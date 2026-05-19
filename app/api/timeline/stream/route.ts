import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { TimelineEvent } from '../route';

/**
 * GET /api/timeline/stream
 * Server-Sent Events endpoint for the Admin Live Timeline.
 *
 * - Authenticates the session (Admin only).
 * - Opens a long-lived response stream with Content-Type: text/event-stream.
 * - Polls the database every 3 seconds for events newer than the last sent event.
 * - Sends a heartbeat comment (: ping) every 30 seconds.
 * - Pushes new events as JSON-encoded SSE messages with id: field.
 *
 * Validates: Requirements 8.4, 5.4, 6.3, 7.9
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return new Response('Forbidden', { status: 403 });
  }

  // Read Last-Event-ID header for resumption after reconnect
  const lastEventIdHeader = req.headers.get('last-event-id');

  // We track the last sent timestamp to avoid re-sending events.
  // Use the Last-Event-ID if provided, otherwise start from today midnight UTC.
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  // lastSentAt is the timestamp of the most recently sent event
  let lastSentAt: Date = todayStart;

  if (lastEventIdHeader) {
    // Last-Event-ID format: "{type}-{dbId}-{timestamp}"
    // We extract the timestamp portion to resume from there.
    const parts = lastEventIdHeader.split('-');
    const tsStr = parts[parts.length - 1];
    const ts = new Date(tsStr);
    if (!isNaN(ts.getTime())) {
      lastSentAt = ts;
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;

      function send(data: string) {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            closed = true;
          }
        }
      }

      function close() {
        if (!closed) {
          closed = true;
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          if (pollTimer) clearInterval(pollTimer);
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }

      // Send initial connection confirmation
      send(': connected\n\n');

      // Heartbeat every 30 seconds to keep connection alive through proxies
      heartbeatTimer = setInterval(() => {
        send(': ping\n\n');
      }, 30_000);

      // Poll database every 3 seconds for new events
      pollTimer = setInterval(async () => {
        if (closed) return;

        try {
          const events = await fetchNewEvents(lastSentAt);

          for (const event of events) {
            const ts = new Date(event.timestamp);
            if (ts > lastSentAt) {
              lastSentAt = ts;
            }

            // SSE format: id, event type, data
            const sseMessage =
              `id: ${event.id}-${event.timestamp}\n` +
              `event: timeline\n` +
              `data: ${JSON.stringify(event)}\n\n`;

            send(sseMessage);
          }
        } catch {
          // Database error — continue polling; don't close the stream
        }
      }, 3_000);

      // Clean up when the client disconnects
      req.signal.addEventListener('abort', () => {
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}

/**
 * Fetch all timeline events that occurred after `since`.
 * Returns events sorted by timestamp ascending (oldest first) so they are
 * sent in chronological order to the client.
 */
async function fetchNewEvents(since: Date): Promise<TimelineEvent[]> {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Fetch today's plans
  const plans = await prisma.dailyPlan.findMany({
    where: { date: todayStart },
    select: {
      id: true,
      siteId: true,
      site: { select: { name: true } },
    },
  });

  const planIds = plans.map((p) => p.id);
  const planMap = new Map(plans.map((p) => [p.id, p]));

  const events: TimelineEvent[] = [];

  if (planIds.length === 0) return events;

  // Resource arrivals newer than `since`
  const arrivals = await prisma.resourceTrack.findMany({
    where: {
      planId: { in: planIds },
      status: 'ARRIVED',
      arrivedAt: { gt: since, lt: todayEnd },
    },
    select: { id: true, planId: true, name: true, arrivedAt: true },
  });

  for (const arrival of arrivals) {
    const plan = planMap.get(arrival.planId);
    if (!plan || !arrival.arrivedAt) continue;
    events.push({
      id: `resource-${arrival.id}`,
      type: 'RESOURCE_ARRIVED',
      siteId: plan.siteId,
      siteName: plan.site.name,
      timestamp: arrival.arrivedAt.toISOString(),
      payload: { resourceName: arrival.name },
    });
  }

  // Photo uploads newer than `since`
  const photos = await prisma.sitePhoto.findMany({
    where: {
      planId: { in: planIds },
      uploadedAt: { gt: since, lt: todayEnd },
    },
    select: { id: true, planId: true, url: true, uploadedAt: true },
  });

  for (const photo of photos) {
    const plan = planMap.get(photo.planId);
    if (!plan) continue;
    events.push({
      id: `photo-${photo.id}`,
      type: 'PHOTO_UPLOADED',
      siteId: plan.siteId,
      siteName: plan.site.name,
      timestamp: photo.uploadedAt.toISOString(),
      payload: { photoUrl: photo.url, thumbnailUrl: photo.url },
    });
  }

  // DPR submissions newer than `since`
  const reports = await prisma.dailyReport.findMany({
    where: {
      planId: { in: planIds },
      submittedAt: { gt: since, lt: todayEnd },
    },
    select: { id: true, planId: true, submittedAt: true, voiceRemarkUrl: true },
  });

  for (const report of reports) {
    const plan = planMap.get(report.planId);
    if (!plan) continue;
    events.push({
      id: `dpr-${report.id}`,
      type: 'DPR_SUBMITTED',
      siteId: plan.siteId,
      siteName: plan.site.name,
      timestamp: report.submittedAt.toISOString(),
      payload: {
        voiceRemarkUrl: report.voiceRemarkUrl ?? undefined,
      },
    });
  }

  // Sort ascending so client receives them in chronological order
  events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return events;
}
