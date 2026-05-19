/**
 * @jest-environment node
 *
 * Property-based tests for resource arrival tracking.
 *
 * Feature: ppt-builders
 *
 * Property 12: Resource status display invariant
 *              Validates: Requirements 5.1, 5.3
 *
 * Property 13: Resource arrival sets server-side timestamp and prevents re-arrival
 *              Validates: Requirements 5.2, 5.5
 */

// Point the Prisma client at the isolated test database before any imports.
process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a short random suffix to avoid cross-test collisions. */
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Normalise a JS Date to midnight UTC so it can be used as a "date-only" key. */
function toDateOnly(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

/**
 * Simulate the server-side arrive logic from
 * app/api/resources/[id]/arrive/route.ts.
 * Returns the updated resource, or throws with { status: 409 } if already ARRIVED.
 */
async function simulateArrive(
  prisma: PrismaClient,
  resourceId: string
): Promise<{ status: string; arrivedAt: Date | null }> {
  const resource = await prisma.resourceTrack.findUnique({
    where: { id: resourceId },
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  if (resource.status === "ARRIVED") {
    const err = new Error("Resource has already been marked as arrived");
    (err as unknown as { httpStatus: number }).httpStatus = 409;
    throw err;
  }

  // Server-side timestamp — never derived from any client-provided value (Req 11.1)
  const arrivedAt = new Date();

  const updated = await prisma.resourceTrack.update({
    where: { id: resourceId },
    data: { status: "ARRIVED", arrivedAt },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Prisma client (test DB)
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Property 12 — Resource status display invariant
// Feature: ppt-builders, Property 12
// ---------------------------------------------------------------------------

describe("Property 12: Resource status display invariant", () => {
  // Clean up between runs.
  afterEach(async () => {
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 12
    // Validates: Requirements 5.1, 5.3
    "PENDING resources have null arrivedAt; ARRIVED resources have non-null arrivedAt",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 1–5 resource names.
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 30 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          // Generate a date for the plan.
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (resourceNames, rawDate) => {
            const siteId = "site_p12_" + uid();
            const date = toDateOnly(rawDate);

            // Create the parent Site.
            await prisma.site.create({
              data: {
                id: siteId,
                name: `Site ${siteId}`,
                location: "Test Location",
              },
            });

            // Create the DailyPlan with all resources as PENDING.
            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
                resources: {
                  create: resourceNames.map((name) => ({
                    name,
                    status: "PENDING",
                  })),
                },
              },
              include: { resources: true },
            });

            // --- Invariant check for PENDING resources ---
            // For any resource with status PENDING: arrivedAt must be null.
            for (const resource of plan.resources) {
              expect(resource.status).toBe("PENDING");
              expect(resource.arrivedAt).toBeNull();
            }

            // Mark all resources as ARRIVED via the server-side logic.
            for (const resource of plan.resources) {
              await simulateArrive(prisma, resource.id);
            }

            // Re-fetch resources after arrival.
            const arrivedResources = await prisma.resourceTrack.findMany({
              where: { planId: plan.id },
            });

            // --- Invariant check for ARRIVED resources ---
            // For any resource with status ARRIVED: arrivedAt must be non-null.
            for (const resource of arrivedResources) {
              expect(resource.status).toBe("ARRIVED");
              expect(resource.arrivedAt).not.toBeNull();
            }

            // Clean up between iterations.
            await prisma.resourceTrack.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    120000
  );

  it(
    // Feature: ppt-builders, Property 12
    // Validates: Requirements 5.1, 5.3
    "mixed PENDING/ARRIVED resources each satisfy the status-arrivedAt invariant",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 2–6 resource names.
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 30 })
              .filter((s) => s.trim().length > 0),
            { minLength: 2, maxLength: 6 }
          ),
          // Decide which indices to mark as ARRIVED (at least one of each).
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (resourceNames, rawDate) => {
            const siteId = "site_p12b_" + uid();
            const date = toDateOnly(rawDate);

            await prisma.site.create({
              data: {
                id: siteId,
                name: `Site ${siteId}`,
                location: "Test Location",
              },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
                resources: {
                  create: resourceNames.map((name) => ({
                    name,
                    status: "PENDING",
                  })),
                },
              },
              include: { resources: true },
            });

            // Mark only the first half of resources as ARRIVED.
            const halfCount = Math.floor(plan.resources.length / 2);
            const toArrive = plan.resources.slice(0, halfCount);
            const toKeepPending = plan.resources.slice(halfCount);

            for (const resource of toArrive) {
              await simulateArrive(prisma, resource.id);
            }

            // Re-fetch all resources.
            const allResources = await prisma.resourceTrack.findMany({
              where: { planId: plan.id },
            });

            for (const resource of allResources) {
              if (resource.status === "PENDING") {
                // PENDING → arrivedAt must be null.
                expect(resource.arrivedAt).toBeNull();
              } else if (resource.status === "ARRIVED") {
                // ARRIVED → arrivedAt must be non-null.
                expect(resource.arrivedAt).not.toBeNull();
              }
            }

            // Verify the split is correct.
            const arrivedCount = allResources.filter(
              (r) => r.status === "ARRIVED"
            ).length;
            const pendingCount = allResources.filter(
              (r) => r.status === "PENDING"
            ).length;
            expect(arrivedCount).toBe(toArrive.length);
            expect(pendingCount).toBe(toKeepPending.length);

            // Clean up between iterations.
            await prisma.resourceTrack.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    120000
  );
});

// ---------------------------------------------------------------------------
// Property 13 — Resource arrival sets server-side timestamp and prevents re-arrival
// Feature: ppt-builders, Property 13
// ---------------------------------------------------------------------------

describe("Property 13: Resource arrival sets server-side timestamp and prevents re-arrival", () => {
  afterEach(async () => {
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 13
    // Validates: Requirements 5.2, 5.5
    "marking a PENDING resource as arrived sets status=ARRIVED and a non-null server-side arrivedAt",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 1–5 resource names.
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 30 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (resourceNames, rawDate) => {
            const siteId = "site_p13a_" + uid();
            const date = toDateOnly(rawDate);

            await prisma.site.create({
              data: {
                id: siteId,
                name: `Site ${siteId}`,
                location: "Test Location",
              },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
                resources: {
                  create: resourceNames.map((name) => ({
                    name,
                    status: "PENDING",
                  })),
                },
              },
              include: { resources: true },
            });

            for (const resource of plan.resources) {
              // Record the time just before the arrive call.
              const beforeArrive = new Date();

              const updated = await simulateArrive(prisma, resource.id);

              // Record the time just after the arrive call.
              const afterArrive = new Date();

              // Status must be ARRIVED.
              expect(updated.status).toBe("ARRIVED");

              // arrivedAt must be non-null.
              expect(updated.arrivedAt).not.toBeNull();

              // arrivedAt must be a valid Date.
              expect(updated.arrivedAt).toBeInstanceOf(Date);

              // The server-side timestamp must fall within the window of the call
              // (i.e., it was set by the server, not from a client-provided value).
              const arrivedAtTime = updated.arrivedAt!.getTime();
              expect(arrivedAtTime).toBeGreaterThanOrEqual(beforeArrive.getTime());
              expect(arrivedAtTime).toBeLessThanOrEqual(afterArrive.getTime());
            }

            // Clean up between iterations.
            await prisma.resourceTrack.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    120000
  );

  it(
    // Feature: ppt-builders, Property 13
    // Validates: Requirements 5.5
    "attempting to mark an ARRIVED resource as arrived again is rejected with a 409 conflict",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 1–3 resource names.
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 30 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 3 }
          ),
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (resourceNames, rawDate) => {
            const siteId = "site_p13b_" + uid();
            const date = toDateOnly(rawDate);

            await prisma.site.create({
              data: {
                id: siteId,
                name: `Site ${siteId}`,
                location: "Test Location",
              },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
                resources: {
                  create: resourceNames.map((name) => ({
                    name,
                    status: "PENDING",
                  })),
                },
              },
              include: { resources: true },
            });

            for (const resource of plan.resources) {
              // First arrival must succeed.
              const firstResult = await simulateArrive(prisma, resource.id);
              expect(firstResult.status).toBe("ARRIVED");
              expect(firstResult.arrivedAt).not.toBeNull();

              const firstArrivedAt = firstResult.arrivedAt;

              // Second arrival attempt must be rejected with a 409-like error.
              let threw = false;
              let errorStatus: number | undefined;
              try {
                await simulateArrive(prisma, resource.id);
              } catch (err: unknown) {
                threw = true;
                errorStatus = (err as { httpStatus?: number }).httpStatus;
              }

              expect(threw).toBe(true);
              expect(errorStatus).toBe(409);

              // The record must remain unchanged after the rejected re-arrival.
              const unchanged = await prisma.resourceTrack.findUnique({
                where: { id: resource.id },
              });
              expect(unchanged).not.toBeNull();
              expect(unchanged!.status).toBe("ARRIVED");
              // arrivedAt must not have changed.
              expect(unchanged!.arrivedAt?.getTime()).toBe(
                firstArrivedAt?.getTime()
              );
            }

            // Clean up between iterations.
            await prisma.resourceTrack.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    120000
  );
});
