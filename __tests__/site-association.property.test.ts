/**
 * @jest-environment node
 *
 * Property-based test for child record site association.
 *
 * Feature: ppt-builders
 *
 * Property 6: All child records are associated with a valid Site
 *             Validates: Requirements 2.2
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
// Property 6 — All child records are associated with a valid Site
// Feature: ppt-builders, Property 6
// ---------------------------------------------------------------------------

describe("Property 6: All child records are associated with a valid Site", () => {
  afterEach(async () => {
    await prisma.dailyReport.deleteMany({});
    await prisma.sitePhoto.deleteMany({});
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 6
    // Validates: Requirements 2.2
    "DailyPlan records reference a valid Site via siteId",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 3 }
          ),
          async (rawDate, goals) => {
            const siteId = "site_p6a_" + uid();
            const date = toDateOnly(rawDate);

            // Create a valid Site
            const site = await prisma.site.create({
              data: { id: siteId, name: `Site ${siteId}`, location: "Test" },
            });

            // Create a DailyPlan linked to the site
            const plan = await prisma.dailyPlan.create({
              data: {
                siteId: site.id,
                date,
                goals: JSON.stringify(goals),
                status: "PENDING",
              },
            });

            // Verify the plan's siteId references an existing Site
            expect(plan.siteId).toBe(site.id);

            const referencedSite = await prisma.site.findUnique({
              where: { id: plan.siteId },
            });
            expect(referencedSite).not.toBeNull();
            expect(referencedSite!.id).toBe(site.id);

            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );

  it(
    // Feature: ppt-builders, Property 6
    // Validates: Requirements 2.2
    "ResourceTrack records reference a valid Site via their parent DailyPlan",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (resourceNames, rawDate) => {
            const siteId = "site_p6b_" + uid();
            const date = toDateOnly(rawDate);

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
                  create: resourceNames.map((name) => ({
                    name,
                    status: "PENDING",
                  })),
                },
              },
              include: { resources: true },
            });

            // Each ResourceTrack must reference a plan that references a valid Site
            for (const resource of plan.resources) {
              expect(resource.planId).toBe(plan.id);

              const parentPlan = await prisma.dailyPlan.findUnique({
                where: { id: resource.planId },
                include: { site: true },
              });

              expect(parentPlan).not.toBeNull();
              expect(parentPlan!.siteId).toBe(site.id);
              expect(parentPlan!.site).not.toBeNull();
              expect(parentPlan!.site.id).toBe(site.id);
            }

            await prisma.resourceTrack.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );

  it(
    // Feature: ppt-builders, Property 6
    // Validates: Requirements 2.2
    "SitePhoto records reference a valid Site via their parent DailyPlan",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 5, maxLength: 50 }).map((s) => `/uploads/${s}.jpg`),
            { minLength: 1, maxLength: 3 }
          ),
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (photoUrls, rawDate) => {
            const siteId = "site_p6c_" + uid();
            const date = toDateOnly(rawDate);

            const site = await prisma.site.create({
              data: { id: siteId, name: `Site ${siteId}`, location: "Test" },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId: site.id,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
              },
            });

            // Create photos
            for (const url of photoUrls) {
              await prisma.sitePhoto.create({
                data: { planId: plan.id, url },
              });
            }

            // Verify each photo's parent plan references a valid Site
            const photos = await prisma.sitePhoto.findMany({
              where: { planId: plan.id },
              include: { plan: { include: { site: true } } },
            });

            expect(photos.length).toBe(photoUrls.length);

            for (const photo of photos) {
              expect(photo.planId).toBe(plan.id);
              expect(photo.plan.siteId).toBe(site.id);
              expect(photo.plan.site.id).toBe(site.id);
            }

            await prisma.sitePhoto.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );

  it(
    // Feature: ppt-builders, Property 6
    // Validates: Requirements 2.2
    "DailyReport records reference a valid Site via their parent DailyPlan",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          fc.nat({ max: 100 }),
          fc.nat({ max: 100 }),
          async (rawDate, masons, helpers) => {
            const siteId = "site_p6d_" + uid();
            const date = toDateOnly(rawDate);

            const site = await prisma.site.create({
              data: { id: siteId, name: `Site ${siteId}`, location: "Test" },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId: site.id,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
              },
            });

            const report = await prisma.dailyReport.create({
              data: {
                planId: plan.id,
                masons,
                helpers,
                length: 10.0,
                breadth: 5.0,
                height: 3.0,
              },
            });

            // Verify the report's parent plan references a valid Site
            const parentPlan = await prisma.dailyPlan.findUnique({
              where: { id: report.planId },
              include: { site: true },
            });

            expect(parentPlan).not.toBeNull();
            expect(parentPlan!.siteId).toBe(site.id);
            expect(parentPlan!.site.id).toBe(site.id);

            await prisma.dailyReport.delete({ where: { id: report.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );

  it(
    // Feature: ppt-builders, Property 6
    // Validates: Requirements 2.2
    "attempting to create a DailyPlan with a non-existent siteId is rejected by the database",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (rawDate) => {
            const nonExistentSiteId = "nonexistent_" + uid();
            const date = toDateOnly(rawDate);

            let threw = false;
            try {
              await prisma.dailyPlan.create({
                data: {
                  siteId: nonExistentSiteId,
                  date,
                  goals: JSON.stringify(["goal 1"]),
                  status: "PENDING",
                },
              });
            } catch {
              threw = true;
            }

            // Must have thrown a foreign key constraint error
            expect(threw).toBe(true);

            // No plan should exist for the non-existent site
            const count = await prisma.dailyPlan.count({
              where: { siteId: nonExistentSiteId },
            });
            expect(count).toBe(0);
          }
        ),
        { numRuns: 10 }
      );
    },
    60000
  );
});
