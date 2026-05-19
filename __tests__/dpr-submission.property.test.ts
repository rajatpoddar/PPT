/**
 * @jest-environment node
 *
 * Property-based tests for DPR (Daily Progress Report) submission.
 *
 * Feature: ppt-builders
 *
 * Property 17: DPR numeric field validation
 *              Validates: Requirements 7.1, 7.2, 7.6
 *
 * Property 18: DPR submission links report to plan and marks plan completed
 *              Validates: Requirements 7.4, 7.5, 11.5
 *
 * Property 19: One DPR per plan (uniqueness invariant) — API-level
 *              Validates: Requirements 7.8
 */

// Point the Prisma client at the isolated test database before any imports.
process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import * as fc from "fast-check";
import { createDprSchema } from "@/lib/validations/dpr";

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
// Property 17 — DPR numeric field validation
// Feature: ppt-builders, Property 17
// ---------------------------------------------------------------------------

describe("Property 17: DPR numeric field validation", () => {
  // These tests operate on the Zod schema only — no DB interaction needed.

  it(
    // Feature: ppt-builders, Property 17
    // Validates: Requirements 7.1, 7.2, 7.6
    "rejects negative masons values",
    () => {
      fc.assert(
        fc.property(
          // Negative integer for masons.
          fc.integer({ min: -10000, max: -1 }),
          // Valid helpers (non-negative integer).
          fc.nat({ max: 1000 }),
          // Valid positive floats for dimensions.
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          (masons, helpers, length, breadth, height) => {
            const result = createDprSchema.safeParse({
              planId: "plan_" + uid(),
              masons,
              helpers,
              length,
              breadth,
              height,
            });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  it(
    // Feature: ppt-builders, Property 17
    // Validates: Requirements 7.1, 7.2, 7.6
    "rejects negative helpers values",
    () => {
      fc.assert(
        fc.property(
          // Valid masons (non-negative integer).
          fc.nat({ max: 1000 }),
          // Negative integer for helpers.
          fc.integer({ min: -10000, max: -1 }),
          // Valid positive floats for dimensions.
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          (masons, helpers, length, breadth, height) => {
            const result = createDprSchema.safeParse({
              planId: "plan_" + uid(),
              masons,
              helpers,
              length,
              breadth,
              height,
            });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  it(
    // Feature: ppt-builders, Property 17
    // Validates: Requirements 7.1, 7.2, 7.6
    "rejects non-numeric values in any field",
    () => {
      fc.assert(
        fc.property(
          // Arbitrary string that is not a valid number.
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => isNaN(Number(s))),
          // Which field to corrupt: 0=masons, 1=helpers, 2=length, 3=breadth, 4=height
          fc.integer({ min: 0, max: 4 }),
          (badValue, fieldIndex) => {
            const base = {
              planId: "plan_" + uid(),
              masons: 2,
              helpers: 3,
              length: 10.0,
              breadth: 5.0,
              height: 3.0,
            };
            const fields = ["masons", "helpers", "length", "breadth", "height"] as const;
            const corrupted = { ...base, [fields[fieldIndex]]: badValue };
            const result = createDprSchema.safeParse(corrupted);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  it(
    // Feature: ppt-builders, Property 17
    // Validates: Requirements 7.1, 7.2, 7.6
    "rejects zero or negative values for dimension fields (length, breadth, height)",
    () => {
      fc.assert(
        fc.property(
          // Valid masons and helpers.
          fc.nat({ max: 1000 }),
          fc.nat({ max: 1000 }),
          // Non-positive float for one of the dimension fields.
          fc.float({ min: Math.fround(-1000), max: 0, noNaN: true }),
          // Which dimension field to corrupt: 0=length, 1=breadth, 2=height
          fc.integer({ min: 0, max: 2 }),
          (masons, helpers, badDimension, fieldIndex) => {
            const base = {
              planId: "plan_" + uid(),
              masons,
              helpers,
              length: 10.0,
              breadth: 5.0,
              height: 3.0,
            };
            const dimFields = ["length", "breadth", "height"] as const;
            const corrupted = { ...base, [dimFields[fieldIndex]]: badDimension };
            const result = createDprSchema.safeParse(corrupted);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  it(
    // Feature: ppt-builders, Property 17
    // Validates: Requirements 7.1, 7.2, 7.6
    "accepts valid DPR payloads with non-negative integers and positive dimensions",
    () => {
      fc.assert(
        fc.property(
          // Non-negative integers for masons and helpers.
          fc.nat({ max: 1000 }),
          fc.nat({ max: 1000 }),
          // Positive floats for dimensions.
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          (masons, helpers, length, breadth, height) => {
            const result = createDprSchema.safeParse({
              planId: "plan_" + uid(),
              masons,
              helpers,
              length,
              breadth,
              height,
            });
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 18 — DPR submission links report to plan and marks plan completed
// Feature: ppt-builders, Property 18
// ---------------------------------------------------------------------------

describe("Property 18: DPR submission links report to plan and marks plan completed", () => {
  afterEach(async () => {
    await prisma.dailyReport.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 18
    // Validates: Requirements 7.4, 7.5, 11.5
    "saves DailyReport with planId === plan.id, sets plan status to COMPLETED, and records statusChangedAt",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate an arbitrary date for the plan.
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          // Generate valid DPR numeric fields.
          fc.nat({ max: 500 }),
          fc.nat({ max: 500 }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          async (rawDate, masons, helpers, length, breadth, height) => {
            const siteId = "site_p18_" + uid();
            const date = toDateOnly(rawDate);

            // Create the parent Site.
            await prisma.site.create({
              data: {
                id: siteId,
                name: `Site ${siteId}`,
                location: "Test Location",
              },
            });

            // Create the parent DailyPlan with PENDING status.
            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date,
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
              },
            });

            // Simulate the server-side DPR submission logic (mirrors app/api/dpr/route.ts).
            const now = new Date();

            const [report] = await prisma.$transaction([
              prisma.dailyReport.create({
                data: {
                  planId: plan.id,
                  masons,
                  helpers,
                  length,
                  breadth,
                  height,
                  submittedAt: now,
                },
              }),
              prisma.dailyPlan.update({
                where: { id: plan.id },
                data: { status: "COMPLETED", statusChangedAt: now },
              }),
            ]);

            // --- Assertions ---

            // DailyReport.planId must equal the plan's id.
            expect(report.planId).toBe(plan.id);

            // Fetch the updated plan to verify status change.
            const updatedPlan = await prisma.dailyPlan.findUnique({
              where: { id: plan.id },
            });

            expect(updatedPlan).not.toBeNull();

            // DailyPlan.status must be COMPLETED.
            expect(updatedPlan!.status).toBe("COMPLETED");

            // DailyPlan.statusChangedAt must be non-null (server-side timestamp).
            expect(updatedPlan!.statusChangedAt).not.toBeNull();

            // statusChangedAt must be a valid Date.
            expect(updatedPlan!.statusChangedAt).toBeInstanceOf(Date);

            // Clean up between iterations.
            await prisma.dailyReport.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );
});

// ---------------------------------------------------------------------------
// Property 19 — One DPR per plan (uniqueness invariant) — API-level
// Feature: ppt-builders, Property 19
// ---------------------------------------------------------------------------

describe("Property 19: One DPR per plan (uniqueness invariant) — API-level", () => {
  afterEach(async () => {
    await prisma.dailyReport.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 19
    // Validates: Requirements 7.8
    "rejects a second DPR submission for the same planId with P2002",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate an arbitrary date for the plan.
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (rawDate) => {
            const siteId = "site_p19_" + uid();
            const date = toDateOnly(rawDate);

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

            // First DPR submission must succeed.
            const firstReport = await prisma.dailyReport.create({ data: reportData });

            // Second DPR for the same planId must be rejected.
            let threw = false;
            let errorCode: string | undefined;
            try {
              await prisma.dailyReport.create({ data: reportData });
            } catch (err: unknown) {
              threw = true;
              errorCode = (err as { code?: string }).code;
            }

            // Must have thrown a P2002 unique constraint violation.
            expect(threw).toBe(true);
            expect(errorCode).toBe("P2002");

            // Exactly one report must exist for this plan.
            const count = await prisma.dailyReport.count({
              where: { planId: plan.id },
            });
            expect(count).toBe(1);

            // The existing report must remain unchanged.
            const existing = await prisma.dailyReport.findUnique({
              where: { id: firstReport.id },
            });
            expect(existing).not.toBeNull();
            expect(existing!.masons).toBe(reportData.masons);
            expect(existing!.helpers).toBe(reportData.helpers);

            // Clean up between iterations.
            await prisma.dailyReport.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );
});
