/**
 * @jest-environment node
 *
 * Integration test: Live Timeline SSE event delivery.
 *
 * Tests the database polling logic that powers the SSE endpoint.
 * Verifies that when a Supervisor marks a resource as arrived, the event
 * appears in the timeline query within the expected timeframe.
 *
 * Note: Full SSE stream testing (EventSource connection) requires a running
 * HTTP server and is covered by the SSE endpoint implementation in
 * app/api/timeline/stream/route.ts. This test validates the underlying
 * data layer that the SSE endpoint polls.
 *
 * Requirements: 5.4, 8.4
 */

process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import type { TimelineEvent } from "@/app/api/timeline/route";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toDateOnly(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.dailyReport.deleteMany({});
  await prisma.sitePhoto.deleteMany({});
  await prisma.resourceTrack.deleteMany({});
  await prisma.dailyPlan.deleteMany({});
  await prisma.site.deleteMany({ where: { name: { startsWith: "SSE Site" } } });
});

/**
 * Simulate the timeline query from app/api/timeline/route.ts.
 * Returns events for today sorted by timestamp descending.
 */
async function queryTimelineEvents(
  planIds: string[],
  planMap: Map<string, { siteId: string; siteName: string }>,
  since?: Date
): Promise<TimelineEvent[]> {
  const now = new Date();
  const todayStart = toDateOnly(now);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const events: TimelineEvent[] = [];

  if (planIds.length === 0) return events;

  const arrivedAtFilter = since
    ? { gt: since, lt: todayEnd }
    : { gte: todayStart, lt: todayEnd };

  const arrivals = await prisma.resourceTrack.findMany({
    where: {
      planId: { in: planIds },
      status: "ARRIVED",
      arrivedAt: arrivedAtFilter,
    },
    select: { id: true, planId: true, name: true, arrivedAt: true },
  });

  for (const arrival of arrivals) {
    const plan = planMap.get(arrival.planId);
    if (!plan || !arrival.arrivedAt) continue;
    events.push({
      id: `resource-${arrival.id}`,
      type: "RESOURCE_ARRIVED",
      siteId: plan.siteId,
      siteName: plan.siteName,
      timestamp: arrival.arrivedAt.toISOString(),
      payload: { resourceName: arrival.name },
    });
  }

  const uploadedAtFilter = since
    ? { gt: since, lt: todayEnd }
    : { gte: todayStart, lt: todayEnd };

  const photos = await prisma.sitePhoto.findMany({
    where: {
      planId: { in: planIds },
      uploadedAt: uploadedAtFilter,
    },
    select: { id: true, planId: true, url: true, uploadedAt: true },
  });

  for (const photo of photos) {
    const plan = planMap.get(photo.planId);
    if (!plan) continue;
    events.push({
      id: `photo-${photo.id}`,
      type: "PHOTO_UPLOADED",
      siteId: plan.siteId,
      siteName: plan.siteName,
      timestamp: photo.uploadedAt.toISOString(),
      payload: { photoUrl: photo.url, thumbnailUrl: photo.url },
    });
  }

  const submittedAtFilter = since
    ? { gt: since, lt: todayEnd }
    : { gte: todayStart, lt: todayEnd };

  const reports = await prisma.dailyReport.findMany({
    where: {
      planId: { in: planIds },
      submittedAt: submittedAtFilter,
    },
    select: { id: true, planId: true, submittedAt: true },
  });

  for (const report of reports) {
    const plan = planMap.get(report.planId);
    if (!plan) continue;
    events.push({
      id: `dpr-${report.id}`,
      type: "DPR_SUBMITTED",
      siteId: plan.siteId,
      siteName: plan.siteName,
      timestamp: report.submittedAt.toISOString(),
      payload: {},
    });
  }

  events.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return events;
}

describe("Integration: Live Timeline SSE event delivery", () => {
  it("Resource arrival event appears in timeline query immediately after marking arrived (Requirement 5.4)", async () => {
    const today = toDateOnly(new Date());

    const site = await prisma.site.create({
      data: { name: `SSE Site ${uid()}`, location: "Test" },
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: today,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
        resources: {
          create: [{ name: "JCB", status: "PENDING" }],
        },
      },
      include: { resources: true },
    });

    const planMap = new Map([
      [plan.id, { siteId: site.id, siteName: site.name }],
    ]);

    // Before arrival — no events
    const eventsBefore = await queryTimelineEvents([plan.id], planMap);
    const arrivalEventsBefore = eventsBefore.filter(
      (e) => e.type === "RESOURCE_ARRIVED"
    );
    expect(arrivalEventsBefore).toHaveLength(0);

    // Mark resource as arrived (simulates POST /api/resources/[id]/arrive)
    const arrivedAt = new Date();
    await prisma.resourceTrack.update({
      where: { id: plan.resources[0].id },
      data: { status: "ARRIVED", arrivedAt },
    });

    // After arrival — event must appear immediately (within the same poll cycle)
    const eventsAfter = await queryTimelineEvents([plan.id], planMap);
    const arrivalEventsAfter = eventsAfter.filter(
      (e) => e.type === "RESOURCE_ARRIVED"
    );

    expect(arrivalEventsAfter).toHaveLength(1);
    expect(arrivalEventsAfter[0].type).toBe("RESOURCE_ARRIVED");
    expect(arrivalEventsAfter[0].siteId).toBe(site.id);
    expect(arrivalEventsAfter[0].siteName).toBe(site.name);
    expect(arrivalEventsAfter[0].payload.resourceName).toBe("JCB");

    // Timestamp must be a valid ISO 8601 string
    expect(new Date(arrivalEventsAfter[0].timestamp).toISOString()).toBe(
      arrivalEventsAfter[0].timestamp
    );
  });

  it("Photo upload event appears in timeline query immediately after upload (Requirement 6.3)", async () => {
    const today = toDateOnly(new Date());

    const site = await prisma.site.create({
      data: { name: `SSE Site ${uid()}`, location: "Test" },
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: today,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });

    const planMap = new Map([
      [plan.id, { siteId: site.id, siteName: site.name }],
    ]);

    // Before upload — no photo events
    const eventsBefore = await queryTimelineEvents([plan.id], planMap);
    expect(eventsBefore.filter((e) => e.type === "PHOTO_UPLOADED")).toHaveLength(0);

    // Upload photo (simulates POST /api/photos)
    const photo = await prisma.sitePhoto.create({
      data: { planId: plan.id, url: `/uploads/photo-${uid()}.jpg` },
    });

    // After upload — event must appear immediately
    const eventsAfter = await queryTimelineEvents([plan.id], planMap);
    const photoEvents = eventsAfter.filter((e) => e.type === "PHOTO_UPLOADED");

    expect(photoEvents).toHaveLength(1);
    expect(photoEvents[0].payload.photoUrl).toBe(photo.url);
    expect(photoEvents[0].payload.thumbnailUrl).toBe(photo.url);
  });

  it("DPR submission event appears in timeline query immediately after submission (Requirement 7.9)", async () => {
    const today = toDateOnly(new Date());

    const site = await prisma.site.create({
      data: { name: `SSE Site ${uid()}`, location: "Test" },
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: today,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });

    const planMap = new Map([
      [plan.id, { siteId: site.id, siteName: site.name }],
    ]);

    // Before DPR — no DPR events
    const eventsBefore = await queryTimelineEvents([plan.id], planMap);
    expect(eventsBefore.filter((e) => e.type === "DPR_SUBMITTED")).toHaveLength(0);

    // Submit DPR (simulates POST /api/dpr)
    const now = new Date();
    await prisma.$transaction([
      prisma.dailyReport.create({
        data: {
          planId: plan.id,
          masons: 3,
          helpers: 5,
          length: 10.0,
          breadth: 5.0,
          height: 3.0,
          submittedAt: now,
        },
      }),
      prisma.dailyPlan.update({
        where: { id: plan.id },
        data: { status: "COMPLETED", statusChangedAt: now },
      }),
    ]);

    // After DPR — event must appear immediately
    const eventsAfter = await queryTimelineEvents([plan.id], planMap);
    const dprEvents = eventsAfter.filter((e) => e.type === "DPR_SUBMITTED");

    expect(dprEvents).toHaveLength(1);
    expect(dprEvents[0].siteId).toBe(site.id);
    expect(dprEvents[0].siteName).toBe(site.name);
  });

  it("SSE polling with 'since' filter returns only new events (Requirement 8.4)", async () => {
    const today = toDateOnly(new Date());

    const site = await prisma.site.create({
      data: { name: `SSE Site ${uid()}`, location: "Test" },
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: today,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
        resources: {
          create: [
            { name: "JCB", status: "PENDING" },
            { name: "Crane", status: "PENDING" },
          ],
        },
      },
      include: { resources: true },
    });

    const planMap = new Map([
      [plan.id, { siteId: site.id, siteName: site.name }],
    ]);

    // Mark first resource as arrived
    const firstArrivedAt = new Date();
    await prisma.resourceTrack.update({
      where: { id: plan.resources[0].id },
      data: { status: "ARRIVED", arrivedAt: firstArrivedAt },
    });

    // Poll for all events — should see 1 event
    const allEvents = await queryTimelineEvents([plan.id], planMap);
    expect(allEvents.filter((e) => e.type === "RESOURCE_ARRIVED")).toHaveLength(1);

    // Wait a tiny bit to ensure distinct timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Mark second resource as arrived
    const secondArrivedAt = new Date();
    await prisma.resourceTrack.update({
      where: { id: plan.resources[1].id },
      data: { status: "ARRIVED", arrivedAt: secondArrivedAt },
    });

    // Poll with 'since = firstArrivedAt' — should only see the second event
    const newEvents = await queryTimelineEvents([plan.id], planMap, firstArrivedAt);
    const newArrivalEvents = newEvents.filter((e) => e.type === "RESOURCE_ARRIVED");

    expect(newArrivalEvents).toHaveLength(1);
    expect(newArrivalEvents[0].payload.resourceName).toBe("Crane");
  });
});
