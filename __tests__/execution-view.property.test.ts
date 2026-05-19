/**
 * @jest-environment node
 *
 * Property-based tests for execution view plan display.
 *
 * Feature: ppt-builders
 *
 * Property 11: Execution view displays all goals and resources from the plan
 *              Validates: Requirements 4.2, 4.3
 */

process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import * as fc from "fast-check";

function uid(): string { return Math.random().toString(36).slice(2, 10); }
function toDateOnly(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }

const prisma = new PrismaClient();
beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

// Feature: ppt-builders, Property 11
describe("Property 11: Execution view displays all goals and resources from the plan", () => {
  afterEach(async () => {
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 11
    // Validates: Requirements 4.2, 4.3
    "a plan with N goals and M resources returns all N goals and M resources in the execution view query",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0), { minLength: 1, maxLength: 10 }),
          fc.array(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0), { minLength: 1, maxLength: 10 }),
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (goals, resourceNames, rawDate) => {
            const siteId = "site_p11_" + uid();
            const date = toDateOnly(rawDate);

            await prisma.site.create({ data: { id: siteId, name: `Site ${siteId}`, location: "Test Location" } });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId, date,
                goals: JSON.stringify(goals),
                status: "PENDING",
                resources: { create: resourceNames.map((name) => ({ name, status: "PENDING" })) },
              },
            });

            // Simulate the execution view query (mirrors app/(supervisor)/execution/page.tsx)
            const rawPlan = await prisma.dailyPlan.findFirst({
              where: { siteId, date },
              include: { resources: true, site: true },
            });

            expect(rawPlan).not.toBeNull();

            // All N goals must be present
            const savedGoals = JSON.parse(rawPlan!.goals) as string[];
            expect(savedGoals).toHaveLength(goals.length);
            expect(savedGoals).toEqual(goals);

            // All M resources must be present with correct statuses
            expect(rawPlan!.resources).toHaveLength(resourceNames.length);
            const savedResourceNames = rawPlan!.resources.map((r) => r.name).sort();
            const expectedResourceNames = [...resourceNames].sort();
            expect(savedResourceNames).toEqual(expectedResourceNames);

            for (const resource of rawPlan!.resources) {
              expect(resource.status).toBe("PENDING");
            }

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
