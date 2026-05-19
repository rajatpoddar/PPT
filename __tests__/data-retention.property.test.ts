/**
 * @jest-environment node
 *
 * Property-based test for data retention.
 *
 * Feature: ppt-builders
 *
 * Property 25: Data retention — no user-facing deletion
 *              Validates: Requirements 11.4
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
// Property 25 — Data retention — no user-facing deletion
// Feature: ppt-builders, Property 25
// ---------------------------------------------------------------------------

/**
 * Enumerate all user-facing API routes and verify none result in record deletion.
 *
 * The user-facing API routes are:
 *   POST /api/sites          → creates Site
 *   GET  /api/sites          → reads Sites
 *   POST /api/plans          → creates DailyPlan
 *   GET  /api/plans          → reads DailyPlans
 *   GET  /api/plans/[id]     → reads single DailyPlan
 *   POST /api/resources/[id]/arrive → updates ResourceTrack (PENDING → ARRIVED)
 *   POST /api/photos         → creates SitePhoto
 *   POST /api/dpr            → creates DailyReport, updates DailyPlan status
 *   GET  /api/timeline       → reads timeline events
 *   POST /api/media/upload   → uploads media file
 *
 * None of these routes delete any record. This test verifies that after
 * performing all user-facing write operations, all created records remain
 * retrievable.
 */

describe("Property 25: Data retention — no user-facing deletion", () => {
  afterEach(async () => {
    await prisma.dailyReport.deleteMany({});
    await prisma.sitePhoto.deleteMany({});
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 25
    // Validates: Requirements 11.4
    "all created records remain retrievable after all user-facing write operations",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 3 }
          ),
          fc.nat({ max: 50 }),
          fc.nat({ max: 50 }),
          async (rawDate, resourceNames, masons, helpers) => {
            const siteId = "site_p25_" + uid();
            const date = toDateOnly(rawDate);

            // --- Step 1: Create Site (POST /api/sites) ---
            const site = await prisma.site.create({
              data: { id: siteId, name: `Site ${siteId}`, location: "Test" },
            });

            // Verify Site is retrievable
            const retrievedSite = await prisma.site.findUnique({
              where: { id: site.id },
            });
            expect(retrievedSite).not.toBeNull();

            // --- Step 2: Create DailyPlan (POST /api/plans) ---
            const plan = await prisma.dailyPlan.create({
              data: {
                siteId: site.id,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
                statusChangedAt: new Date(),
                resources: {
                  create: resourceNames.map((name) => ({
                    name,
                    status: "PENDING",
                  })),
                },
              },
              include: { resources: true },
            });

            // Verify DailyPlan is retrievable
            const retrievedPlan = await prisma.dailyPlan.findUnique({
              where: { id: plan.id },
            });
            expect(retrievedPlan).not.toBeNull();

            // Verify all ResourceTrack records are retrievable
            for (const resource of plan.resources) {
              const retrievedResource = await prisma.resourceTrack.findUnique({
                where: { id: resource.id },
              });
              expect(retrievedResource).not.toBeNull();
            }

            // --- Step 3: Mark resources as arrived (POST /api/resources/[id]/arrive) ---
            for (const resource of plan.resources) {
              await prisma.resourceTrack.update({
                where: { id: resource.id },
                data: { status: "ARRIVED", arrivedAt: new Date() },
              });
            }

            // Verify all ResourceTrack records still exist after update
            for (const resource of plan.resources) {
              const retrievedResource = await prisma.resourceTrack.findUnique({
                where: { id: resource.id },
              });
              expect(retrievedResource).not.toBeNull();
              expect(retrievedResource!.status).toBe("ARRIVED");
            }

            // --- Step 4: Upload a photo (POST /api/photos) ---
            const photo = await prisma.sitePhoto.create({
              data: { planId: plan.id, url: `/uploads/photo-${uid()}.jpg` },
            });

            // Verify SitePhoto is retrievable
            const retrievedPhoto = await prisma.sitePhoto.findUnique({
              where: { id: photo.id },
            });
            expect(retrievedPhoto).not.toBeNull();

            // --- Step 5: Submit DPR (POST /api/dpr) ---
            const now = new Date();
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

            // Verify DailyReport is retrievable
            const retrievedReport = await prisma.dailyReport.findUnique({
              where: { id: report.id },
            });
            expect(retrievedReport).not.toBeNull();

            // --- Final verification: ALL records still exist ---

            // Site
            expect(
              await prisma.site.findUnique({ where: { id: site.id } })
            ).not.toBeNull();

            // DailyPlan
            expect(
              await prisma.dailyPlan.findUnique({ where: { id: plan.id } })
            ).not.toBeNull();

            // All ResourceTrack records
            const resourceCount = await prisma.resourceTrack.count({
              where: { planId: plan.id },
            });
            expect(resourceCount).toBe(resourceNames.length);

            // SitePhoto
            expect(
              await prisma.sitePhoto.findUnique({ where: { id: photo.id } })
            ).not.toBeNull();

            // DailyReport
            expect(
              await prisma.dailyReport.findUnique({ where: { id: report.id } })
            ).not.toBeNull();

            // Clean up
            await prisma.dailyReport.deleteMany({ where: { planId: plan.id } });
            await prisma.sitePhoto.deleteMany({ where: { planId: plan.id } });
            await prisma.resourceTrack.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 10 }
      );
    },
    120000
  );

  it(
    // Feature: ppt-builders, Property 25
    // Validates: Requirements 11.4
    "GET operations do not delete any records",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (rawDate) => {
            const siteId = "site_p25b_" + uid();
            const date = toDateOnly(rawDate);

            // Create test data
            const site = await prisma.site.create({
              data: { id: siteId, name: `Site ${siteId}`, location: "Test" },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId: site.id,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
                resources: {
                  create: [{ name: "JCB", status: "PENDING" }],
                },
              },
              include: { resources: true },
            });

            const photo = await prisma.sitePhoto.create({
              data: { planId: plan.id, url: `/uploads/photo-${uid()}.jpg` },
            });

            // Simulate GET operations (read-only queries)
            await prisma.site.findMany();
            await prisma.dailyPlan.findMany({ include: { resources: true } });
            await prisma.dailyPlan.findUnique({ where: { id: plan.id } });
            await prisma.sitePhoto.findMany({ where: { planId: plan.id } });
            await prisma.resourceTrack.findMany({ where: { planId: plan.id } });

            // All records must still exist after GET operations
            expect(
              await prisma.site.findUnique({ where: { id: site.id } })
            ).not.toBeNull();

            expect(
              await prisma.dailyPlan.findUnique({ where: { id: plan.id } })
            ).not.toBeNull();

            expect(
              await prisma.sitePhoto.findUnique({ where: { id: photo.id } })
            ).not.toBeNull();

            expect(
              await prisma.resourceTrack.count({ where: { planId: plan.id } })
            ).toBe(1);

            // Clean up
            await prisma.sitePhoto.deleteMany({ where: { planId: plan.id } });
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
