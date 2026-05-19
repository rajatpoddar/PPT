/**
 * @jest-environment node
 *
 * Property-based tests for Live Timeline ordering and filtering.
 *
 * Feature: ppt-builders
 *
 * Property 20: Timeline events are displayed in reverse chronological order with required fields
 *              Validates: Requirements 8.1, 8.3, 8.5
 *
 * Property 21: Timeline site filter shows only matching events
 *              Validates: Requirements 8.6
 */

// Point the Prisma client at the isolated test database before any imports.
process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import * as fc from "fast-check";
import type { TimelineEvent } from "@/app/api/timeline/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toDateOnly(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

/**
 * Simulate the timeline query logic from app/api/timeline/route.ts.
 * Returns events sorted by timestamp descending.
 */
async function fetchTimelineEvents(
  prisma: PrismaClient,
  planIds: string[],
  planMap: Map<string, { siteId: string; siteName: string }>,
  siteIdFilter?: string
): Promise<TimelineEvent[]> {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const filteredPlanIds = siteIdFilter
    ? planIds.filter((id) => planMap.get(id)?.siteId === siteIdFilter)
    : planIds;

  if (filteredPlanIds.length === 0) return [];

  const events: TimelineEvent[] = [];

  // Resource arrivals
  const arrivals = await prisma.resourceTrack.findMany({
    where: {
      planId: { in: filteredPlanIds },
      status: "ARRIVED",
      arrivedAt: { gte: todayStart, lt: todayEnd },
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

  // Photo uploads
  const photos = await prisma.sitePhoto.findMany({
    where: {
      planId: { in: filteredPlanIds },
      uploadedAt: { gte: todayStart, lt: todayEnd },
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

  // DPR submissions
  const reports = await prisma.dailyReport.findMany({
    where: {
      planId: { in: filteredPlanIds },
      submittedAt: { gte: todayStart, lt: todayEnd },
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

  // Sort descending (most recent first) — Requirement 8.1
  events.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return events;
}

// ---------------------------------------------------------------------------
// Prisma client (test DB)
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Property 20 — Timeline events are displayed in reverse chronological order
//               with required fields
// Feature: ppt-builders, Property 20
// ---------------------------------------------------------------------------

describe("Property 20: Timeline events are displayed in reverse chronological order with required fields", () => {
  afterEach(async () => {
    await prisma.dailyReport.deleteMany({});
    await prisma.sitePhoto.deleteMany({});
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 20
    // Validates: Requirements 8.1, 8.3, 8.5
    "events with distinct timestamps are returned in reverse chronological order",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 2–5 distinct timestamps within today (UTC)
          fc.uniqueArray(
            fc.integer({ min: 0, max: 23 * 60 + 59 }).map((minuteOfDay) => {
              const now = new Date();
              const base = new Date(
                Date.UTC(
                  now.getUTCFullYear(),
                  now.getUTCMonth(),
                  now.getUTCDate()
                )
              );
              base.setUTCMinutes(minuteOfDay);
              return base;
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (timestamps) => {
            const siteId = "site_p20_" + uid();
            const today = toDateOnly(new Date());

            await prisma.site.create({
              data: { id: siteId, name: `Site ${siteId}`, location: "Test" },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date: today,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
              },
            });

            const planMap = new Map([
              [plan.id, { siteId, siteName: `Site ${siteId}` }],
            ]);

            // Create one resource arrival per timestamp
            for (const ts of timestamps) {
              const resource = await prisma.resourceTrack.create({
                data: {
                  planId: plan.id,
                  name: `Resource-${uid()}`,
                  status: "ARRIVED",
                  arrivedAt: ts,
                },
              });
              expect(resource.id).toBeTruthy();
            }

            const events = await fetchTimelineEvents(
              prisma,
              [plan.id],
              planMap
            );

            // Must have at least as many events as timestamps
            expect(events.length).toBeGreaterThanOrEqual(timestamps.length);

            // Events must be in reverse chronological order
            for (let i = 0; i < events.length - 1; i++) {
              const current = new Date(events[i].timestamp).getTime();
              const next = new Date(events[i + 1].timestamp).getTime();
              expect(current).toBeGreaterThanOrEqual(next);
            }

            // Each event must have required fields: id, type, siteId, siteName, timestamp
            for (const event of events) {
              expect(event.id).toBeTruthy();
              expect(["RESOURCE_ARRIVED", "PHOTO_UPLOADED", "DPR_SUBMITTED"]).toContain(
                event.type
              );
              expect(event.siteId).toBeTruthy();
              expect(event.siteName).toBeTruthy();
              expect(event.timestamp).toBeTruthy();
              expect(new Date(event.timestamp).toISOString()).toBe(
                event.timestamp
              );
            }

            // PHOTO_UPLOADED events must have thumbnailUrl in payload
            const photoEvents = events.filter(
              (e) => e.type === "PHOTO_UPLOADED"
            );
            for (const photoEvent of photoEvents) {
              expect(photoEvent.payload.thumbnailUrl).toBeTruthy();
            }

            // Clean up
            await prisma.resourceTrack.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 10 }
      );
    },
    60000
  );

  it(
    // Feature: ppt-builders, Property 20
    // Validates: Requirements 8.3, 8.5
    "PHOTO_UPLOADED events include thumbnailUrl in payload",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 1–4 photo URLs
          fc.array(
            fc.string({ minLength: 5, maxLength: 50 }).map((s) => `/uploads/${s}.jpg`),
            { minLength: 1, maxLength: 4 }
          ),
          async (photoUrls) => {
            const siteId = "site_p20b_" + uid();
            const today = toDateOnly(new Date());

            await prisma.site.create({
              data: { id: siteId, name: `Site ${siteId}`, location: "Test" },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date: today,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
              },
            });

            const planMap = new Map([
              [plan.id, { siteId, siteName: `Site ${siteId}` }],
            ]);

            // Create photos with distinct timestamps
            for (let i = 0; i < photoUrls.length; i++) {
              const ts = new Date(Date.now() - i * 1000);
              await prisma.sitePhoto.create({
                data: { planId: plan.id, url: photoUrls[i], uploadedAt: ts },
              });
            }

            const events = await fetchTimelineEvents(
              prisma,
              [plan.id],
              planMap
            );

            const photoEvents = events.filter(
              (e) => e.type === "PHOTO_UPLOADED"
            );

            // All photo events must have thumbnailUrl
            expect(photoEvents.length).toBe(photoUrls.length);
            for (const photoEvent of photoEvents) {
              expect(photoEvent.payload.thumbnailUrl).toBeTruthy();
              expect(photoEvent.payload.photoUrl).toBeTruthy();
            }

            // Clean up
            await prisma.sitePhoto.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 10 }
      );
    },
    60000
  );
});

// ---------------------------------------------------------------------------
// Property 21 — Timeline site filter shows only matching events
// Feature: ppt-builders, Property 21
// ---------------------------------------------------------------------------

describe("Property 21: Timeline site filter shows only matching events", () => {
  afterEach(async () => {
    await prisma.dailyReport.deleteMany({});
    await prisma.sitePhoto.deleteMany({});
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 21
    // Validates: Requirements 8.6
    "filtering by siteId returns only events from that site",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 2–4 site IDs
          fc.integer({ min: 2, max: 4 }),
          async (numSites) => {
            const today = toDateOnly(new Date());
            const siteIds: string[] = [];
            const planIds: string[] = [];
            const planMap = new Map<
              string,
              { siteId: string; siteName: string }
            >();

            // Create sites and plans
            for (let i = 0; i < numSites; i++) {
              const siteId = "site_p21_" + uid();
              siteIds.push(siteId);

              await prisma.site.create({
                data: {
                  id: siteId,
                  name: `Site ${siteId}`,
                  location: "Test",
                },
              });

              const plan = await prisma.dailyPlan.create({
                data: {
                  siteId,
                  date: today,
                  goals: JSON.stringify(["goal 1"]),
                  status: "PENDING",
                },
              });

              planIds.push(plan.id);
              planMap.set(plan.id, {
                siteId,
                siteName: `Site ${siteId}`,
              });

              // Create one resource arrival per site
              await prisma.resourceTrack.create({
                data: {
                  planId: plan.id,
                  name: `Resource-${uid()}`,
                  status: "ARRIVED",
                  arrivedAt: new Date(),
                },
              });
            }

            // For each site, filter and verify only that site's events appear
            for (const targetSiteId of siteIds) {
              const filteredEvents = await fetchTimelineEvents(
                prisma,
                planIds,
                planMap,
                targetSiteId
              );

              // Every event must belong to the target site
              for (const event of filteredEvents) {
                expect(event.siteId).toBe(targetSiteId);
              }

              // Events from other sites must NOT appear
              const otherSiteIds = siteIds.filter((id) => id !== targetSiteId);
              for (const event of filteredEvents) {
                expect(otherSiteIds).not.toContain(event.siteId);
              }
            }

            // Clean up
            for (const planId of planIds) {
              await prisma.resourceTrack.deleteMany({ where: { planId } });
              await prisma.dailyPlan.delete({ where: { id: planId } });
            }
            for (const siteId of siteIds) {
              await prisma.site.delete({ where: { id: siteId } });
            }
          }
        ),
        { numRuns: 10 }
      );
    },
    60000
  );

  it(
    // Feature: ppt-builders, Property 21
    // Validates: Requirements 8.6
    "no filter returns events from all sites",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 3 }),
          async (numSites) => {
            const today = toDateOnly(new Date());
            const siteIds: string[] = [];
            const planIds: string[] = [];
            const planMap = new Map<
              string,
              { siteId: string; siteName: string }
            >();

            for (let i = 0; i < numSites; i++) {
              const siteId = "site_p21b_" + uid();
              siteIds.push(siteId);

              await prisma.site.create({
                data: {
                  id: siteId,
                  name: `Site ${siteId}`,
                  location: "Test",
                },
              });

              const plan = await prisma.dailyPlan.create({
                data: {
                  siteId,
                  date: today,
                  goals: JSON.stringify(["goal 1"]),
                  status: "PENDING",
                },
              });

              planIds.push(plan.id);
              planMap.set(plan.id, {
                siteId,
                siteName: `Site ${siteId}`,
              });

              await prisma.resourceTrack.create({
                data: {
                  planId: plan.id,
                  name: `Resource-${uid()}`,
                  status: "ARRIVED",
                  arrivedAt: new Date(),
                },
              });
            }

            // No filter — should return events from all sites
            const allEvents = await fetchTimelineEvents(
              prisma,
              planIds,
              planMap
            );

            const returnedSiteIds = new Set(allEvents.map((e) => e.siteId));

            // All sites must be represented
            for (const siteId of siteIds) {
              expect(returnedSiteIds.has(siteId)).toBe(true);
            }

            // Clean up
            for (const planId of planIds) {
              await prisma.resourceTrack.deleteMany({ where: { planId } });
              await prisma.dailyPlan.delete({ where: { id: planId } });
            }
            for (const siteId of siteIds) {
              await prisma.site.delete({ where: { id: siteId } });
            }
          }
        ),
        { numRuns: 10 }
      );
    },
    60000
  );
});
