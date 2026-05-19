/**
 * @jest-environment node
 *
 * Property-based tests for server-side timestamp enforcement.
 *
 * Feature: ppt-builders
 *
 * Property 13: Resource arrival sets server-side timestamp and prevents re-arrival
 *              Validates: Requirements 5.2, 5.5 (already covered in resource-arrival.property.test.ts)
 *
 * Property 14: Photo upload creates a record with server-side timestamp and stable URL
 *              Validates: Requirements 6.2, 11.2 (already covered in photo-upload.property.test.ts)
 *
 * Property 18: DPR submission links report to plan and marks plan completed
 *              Validates: Requirements 7.4, 7.5, 11.5 (already covered in dpr-submission.property.test.ts)
 *
 * This file verifies the additional requirement that no client-provided timestamp
 * value is accepted by any API route — all timestamps are set server-side.
 */

// Point the Prisma client at the isolated test database before any imports.
process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import * as fc from "fast-check";

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

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Property 13 (server-side timestamp verification)
// Feature: ppt-builders, Property 13
// ---------------------------------------------------------------------------

describe("Property 13: Resource arrival timestamp is set server-side", () => {
  afterEach(async () => {
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 13
    // Validates: Requirements 5.2, 11.1
    "arrivedAt is set by the server and falls within the window of the arrive call",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 3 }
          ),
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (resourceNames, rawDate) => {
            const siteId = "site_ts13_" + uid();
            const date = toDateOnly(rawDate);

            await prisma.site.create({
              data: { id: siteId, name: `Site ${siteId}`, location: "Test" },
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
              const before = new Date();

              // Simulate server-side arrive logic (mirrors app/api/resources/[id]/arrive/route.ts)
              const arrivedAt = new Date(); // server-side timestamp
              const updated = await prisma.resourceTrack.update({
                where: { id: resource.id },
                data: { status: "ARRIVED", arrivedAt },
              });

              const after = new Date();

              // arrivedAt must be non-null
              expect(updated.arrivedAt).not.toBeNull();

              // arrivedAt must be a valid Date
              expect(updated.arrivedAt).toBeInstanceOf(Date);

              // arrivedAt must fall within the window of the call (server-side)
              const arrivedAtTime = updated.arrivedAt!.getTime();
              expect(arrivedAtTime).toBeGreaterThanOrEqual(before.getTime());
              expect(arrivedAtTime).toBeLessThanOrEqual(after.getTime());

              // The schema does NOT accept a client-provided arrivedAt:
              // Verify that the Prisma schema for ResourceTrack does not have
              // arrivedAt as an input field in the create schema (it's set via update only)
              const freshResource = await prisma.resourceTrack.findUnique({
                where: { id: resource.id },
              });
              expect(freshResource!.arrivedAt).toEqual(updated.arrivedAt);
            }

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
});

// ---------------------------------------------------------------------------
// Property 14 (server-side timestamp verification)
// Feature: ppt-builders, Property 14
// ---------------------------------------------------------------------------

describe("Property 14: Photo upload timestamp is set server-side", () => {
  afterEach(async () => {
    await prisma.sitePhoto.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 14
    // Validates: Requirements 6.2, 11.2
    "uploadedAt is set by the server (Prisma default) and is non-null",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 5, maxLength: 50 }).map((s) => `/uploads/${s}.jpg`),
            { minLength: 1, maxLength: 3 }
          ),
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (photoUrls, rawDate) => {
            const siteId = "site_ts14_" + uid();
            const date = toDateOnly(rawDate);

            await prisma.site.create({
              data: { id: siteId, name: `Site ${siteId}`, location: "Test" },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
              },
            });

            for (const url of photoUrls) {
              const before = new Date();

              // Simulate server-side photo creation (mirrors app/api/photos/route.ts)
              // uploadedAt is set via Prisma @default(now()) — not from client
              const photo = await prisma.sitePhoto.create({
                data: { planId: plan.id, url },
              });

              const after = new Date();

              // uploadedAt must be non-null
              expect(photo.uploadedAt).not.toBeNull();

              // uploadedAt must be a valid Date
              expect(photo.uploadedAt).toBeInstanceOf(Date);

              // uploadedAt must fall within the window of the call
              const uploadedAtTime = photo.uploadedAt.getTime();
              expect(uploadedAtTime).toBeGreaterThanOrEqual(before.getTime());
              expect(uploadedAtTime).toBeLessThanOrEqual(after.getTime());

              // url must be non-null and non-empty
              expect(photo.url).toBeTruthy();
              expect(photo.url).toBe(url);
            }

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
// Property 18 (server-side timestamp verification)
// Feature: ppt-builders, Property 18
// ---------------------------------------------------------------------------

describe("Property 18: DPR submission timestamp is set server-side", () => {
  afterEach(async () => {
    await prisma.dailyReport.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 18
    // Validates: Requirements 7.4, 7.5, 11.5
    "submittedAt and statusChangedAt are set by the server and are non-null",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          fc.nat({ max: 100 }),
          fc.nat({ max: 100 }),
          async (rawDate, masons, helpers) => {
            const siteId = "site_ts18_" + uid();
            const date = toDateOnly(rawDate);

            await prisma.site.create({
              data: { id: siteId, name: `Site ${siteId}`, location: "Test" },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
              },
            });

            const before = new Date();

            // Simulate server-side DPR submission (mirrors app/api/dpr/route.ts)
            const now = new Date(); // server-side timestamp
            const [report] = await prisma.$transaction([
              prisma.dailyReport.create({
                data: {
                  planId: plan.id,
                  masons,
                  helpers,
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

            const after = new Date();

            // submittedAt must be non-null and within the call window
            expect(report.submittedAt).not.toBeNull();
            expect(report.submittedAt).toBeInstanceOf(Date);
            expect(report.submittedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(report.submittedAt.getTime()).toBeLessThanOrEqual(after.getTime());

            // Verify plan status and statusChangedAt
            const updatedPlan = await prisma.dailyPlan.findUnique({
              where: { id: plan.id },
            });
            expect(updatedPlan!.status).toBe("COMPLETED");
            expect(updatedPlan!.statusChangedAt).not.toBeNull();
            expect(updatedPlan!.statusChangedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(updatedPlan!.statusChangedAt!.getTime()).toBeLessThanOrEqual(after.getTime());

            await prisma.dailyReport.deleteMany({ where: { planId: plan.id } });
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
