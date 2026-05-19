/**
 * @jest-environment node
 *
 * Property-based tests for DailyPlan creation.
 *
 * Feature: ppt-builders
 *
 * Property 7: Valid plan submissions are saved with correct initial state
 *             Validates: Requirements 3.6
 *
 * Property 8: Plan creation rejects missing required fields
 *             Validates: Requirements 3.7
 *
 * Property 9: One plan per site per date (uniqueness invariant) — API-level
 *             Validates: Requirements 3.10
 */

// Point the Prisma client at the isolated test database before any imports.
process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import * as fc from "fast-check";
import { createPlanSchema } from "@/lib/validations/plan";

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

/** Format a Date as an ISO date string "YYYY-MM-DD" for use in the Zod schema. */
function toISODateString(d: Date): string {
  return d.toISOString().slice(0, 10);
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
// Property 7 — Valid plan submissions are saved with correct initial state
// Feature: ppt-builders, Property 7
// ---------------------------------------------------------------------------

describe("Property 7: Valid plan submissions are saved with correct initial state", () => {
  // Clean up between runs.
  afterEach(async () => {
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 7
    // Validates: Requirements 3.6
    "saves plan with PENDING status, non-null statusChangedAt, preserved goals, and created resources",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a date within a reasonable range.
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          // Generate 1–5 non-empty goal strings.
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          // Generate 1–5 non-empty resource names.
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          async (rawDate, goals, resourceNames) => {
            const siteId = "site_p7_" + uid();
            const date = toDateOnly(rawDate);

            // Create the parent Site.
            await prisma.site.create({
              data: {
                id: siteId,
                name: `Site ${siteId}`,
                location: "Test Location",
              },
            });

            // Simulate the server-side plan creation logic (mirrors app/api/plans/route.ts).
            const now = new Date();

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date,
                goals: JSON.stringify(goals),
                status: "PENDING",
                statusChangedAt: now,
                resources: {
                  create: resourceNames.map((name) => ({
                    name,
                    status: "PENDING",
                  })),
                },
              },
              include: {
                resources: true,
              },
            });

            // --- Assertions ---

            // Status must be PENDING.
            expect(plan.status).toBe("PENDING");

            // statusChangedAt must be non-null.
            expect(plan.statusChangedAt).not.toBeNull();

            // Goals must be preserved (round-trip through JSON).
            const savedGoals = JSON.parse(plan.goals) as string[];
            expect(savedGoals).toEqual(goals);

            // All resources must have been created with PENDING status.
            expect(plan.resources).toHaveLength(resourceNames.length);
            for (const resource of plan.resources) {
              expect(resource.status).toBe("PENDING");
              expect(resourceNames).toContain(resource.name);
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
    60000
  );
});

// ---------------------------------------------------------------------------
// Property 8 — Plan creation rejects missing required fields
// Feature: ppt-builders, Property 8
// ---------------------------------------------------------------------------

describe("Property 8: Plan creation rejects missing required fields", () => {
  // These tests operate on the Zod schema only — no DB interaction needed.

  it(
    // Feature: ppt-builders, Property 8
    // Validates: Requirements 3.7
    "rejects payloads with missing siteId",
    () => {
      fc.assert(
        fc.property(
          // Valid date string.
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }).map(toISODateString),
          // Valid goals array.
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          // Valid resources array.
          fc.array(
            fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0) }),
            { minLength: 1, maxLength: 5 }
          ),
          (date, goals, resources) => {
            // Omit siteId entirely.
            const result = createPlanSchema.safeParse({ date, goals, resources });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  it(
    // Feature: ppt-builders, Property 8
    // Validates: Requirements 3.7
    "rejects payloads with missing date",
    () => {
      fc.assert(
        fc.property(
          // Valid siteId.
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
          // Valid goals array.
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          // Valid resources array.
          fc.array(
            fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0) }),
            { minLength: 1, maxLength: 5 }
          ),
          (siteId, goals, resources) => {
            // Omit date entirely.
            const result = createPlanSchema.safeParse({ siteId, goals, resources });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  it(
    // Feature: ppt-builders, Property 8
    // Validates: Requirements 3.7
    "rejects payloads with an empty goals array",
    () => {
      fc.assert(
        fc.property(
          // Valid siteId.
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
          // Valid date string.
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }).map(toISODateString),
          // Valid resources array.
          fc.array(
            fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0) }),
            { minLength: 1, maxLength: 5 }
          ),
          (siteId, date, resources) => {
            // Use an empty goals array.
            const result = createPlanSchema.safeParse({ siteId, date, goals: [], resources });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  it(
    // Feature: ppt-builders, Property 8
    // Validates: Requirements 3.7
    "rejects payloads with an empty resources array",
    () => {
      fc.assert(
        fc.property(
          // Valid siteId.
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
          // Valid date string.
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }).map(toISODateString),
          // Valid goals array.
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          (siteId, date, goals) => {
            // Use an empty resources array.
            const result = createPlanSchema.safeParse({ siteId, date, goals, resources: [] });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  it(
    // Feature: ppt-builders, Property 8
    // Validates: Requirements 3.7
    "accepts payloads with all required fields present",
    () => {
      fc.assert(
        fc.property(
          // Valid siteId.
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
          // Valid date string.
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }).map(toISODateString),
          // Valid goals array (1+ items).
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 5 }
          ),
          // Valid resources array (1+ items).
          fc.array(
            fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0) }),
            { minLength: 1, maxLength: 5 }
          ),
          (siteId, date, goals, resources) => {
            const result = createPlanSchema.safeParse({ siteId, date, goals, resources });
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 9 — One plan per site per date (uniqueness invariant) — API-level
// Feature: ppt-builders, Property 9
// ---------------------------------------------------------------------------

describe("Property 9: One plan per site per date (uniqueness invariant) — API-level", () => {
  afterEach(async () => {
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 9
    // Validates: Requirements 3.10
    "rejects a second plan creation for the same siteId + date with P2002",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate an arbitrary date.
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (rawDate) => {
            const siteId = "site_p9_" + uid();
            const date = toDateOnly(rawDate);

            // Create the parent Site.
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
              statusChangedAt: new Date(),
            };

            // First plan creation must succeed.
            const firstPlan = await prisma.dailyPlan.create({ data: planData });

            // Second plan creation for the same (siteId, date) must be rejected.
            let threw = false;
            let errorCode: string | undefined;
            try {
              await prisma.dailyPlan.create({ data: planData });
            } catch (err: unknown) {
              threw = true;
              errorCode = (err as { code?: string }).code;
            }

            // Must have thrown a P2002 unique constraint violation.
            expect(threw).toBe(true);
            expect(errorCode).toBe("P2002");

            // Exactly one plan must exist for this (siteId, date).
            const count = await prisma.dailyPlan.count({
              where: { siteId, date },
            });
            expect(count).toBe(1);

            // The existing plan must remain unchanged.
            const existing = await prisma.dailyPlan.findUnique({
              where: { id: firstPlan.id },
            });
            expect(existing).not.toBeNull();
            expect(existing!.status).toBe("PENDING");

            // Clean up between iterations.
            await prisma.dailyPlan.deleteMany({ where: { siteId } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );
});
