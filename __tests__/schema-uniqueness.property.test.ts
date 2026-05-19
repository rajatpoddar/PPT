/**
 * @jest-environment node
 *
 * Property-based tests for database-level schema uniqueness constraints.
 *
 * Feature: ppt-builders
 *
 * Property 9:  One plan per site per date (uniqueness invariant)
 *              Validates: Requirements 3.10
 *
 * Property 19: One DPR per plan (uniqueness invariant)
 *              Validates: Requirements 7.8
 */

// Point the Prisma client at the isolated test database before any imports
process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a JS Date to midnight UTC so it can be used as a "date-only" key. */
function toDateOnly(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

/** Generate a short, URL-safe random suffix to avoid cross-test collisions. */
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Prisma client (test DB)
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Ensure the Prisma client can connect and the schema is up-to-date.
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Property 9 — One plan per site per date (uniqueness invariant)
// Feature: ppt-builders, Property 9
// ---------------------------------------------------------------------------

describe("Property 9: One plan per site per date (uniqueness invariant)", () => {
  // Clean up any DailyPlan / Site rows created during this suite.
  afterEach(async () => {
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 9
    "rejects a second DailyPlan for the same siteId + date",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a non-empty siteId string and an arbitrary date.
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (rawSiteId, rawDate) => {
            // Sanitise inputs so they are safe to use as DB identifiers.
            const siteId = rawSiteId.replace(/[^\w-]/g, "_").slice(0, 20) + "_" + uid();
            const date = toDateOnly(rawDate);

            // Create the Site row that DailyPlan references.
            await prisma.site.create({
              data: {
                id: siteId,
                name: `Site ${siteId}`,
                location: "Test Location",
              },
            });

            const planData = {
              siteId,
              date,
              goals: JSON.stringify(["goal 1"]),
              status: "PENDING",
            };

            // First insert must succeed.
            await prisma.dailyPlan.create({ data: planData });

            // Second insert for the same (siteId, date) must be rejected.
            let threw = false;
            try {
              await prisma.dailyPlan.create({ data: planData });
            } catch (err: unknown) {
              threw = true;
              // Prisma wraps unique-constraint violations in a PrismaClientKnownRequestError
              // with code P2002.
              expect((err as { code?: string }).code).toBe("P2002");
            }

            expect(threw).toBe(true);

            // Verify only one plan exists for this (siteId, date).
            const count = await prisma.dailyPlan.count({
              where: { siteId, date },
            });
            expect(count).toBe(1);

            // Clean up between iterations so the next run starts fresh.
            await prisma.dailyPlan.deleteMany({ where: { siteId } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 19 — One DPR per plan (uniqueness invariant)
// Feature: ppt-builders, Property 19
// ---------------------------------------------------------------------------

describe("Property 19: One DPR per plan (uniqueness invariant)", () => {
  // Clean up between suites.
  afterEach(async () => {
    await prisma.dailyReport.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 19
    "rejects a second DailyReport for the same planId",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // We only need an arbitrary date to create distinct plans.
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (rawDate) => {
            const date = toDateOnly(rawDate);
            const siteId = "site_" + uid();

            // Create the parent Site.
            await prisma.site.create({
              data: {
                id: siteId,
                name: `Site ${siteId}`,
                location: "Test Location",
              },
            });

            // Create the parent DailyPlan.
            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
              },
            });

            const reportData = {
              planId: plan.id,
              masons: 2,
              helpers: 3,
              length: 10.0,
              breadth: 5.0,
              height: 3.0,
            };

            // First DPR insert must succeed.
            await prisma.dailyReport.create({ data: reportData });

            // Second DPR for the same planId must be rejected.
            let threw = false;
            try {
              await prisma.dailyReport.create({ data: reportData });
            } catch (err: unknown) {
              threw = true;
              expect((err as { code?: string }).code).toBe("P2002");
            }

            expect(threw).toBe(true);

            // Verify only one report exists for this plan.
            const count = await prisma.dailyReport.count({
              where: { planId: plan.id },
            });
            expect(count).toBe(1);

            // Clean up between iterations.
            await prisma.dailyReport.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    }
  );
});
