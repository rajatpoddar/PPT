/**
 * @jest-environment node
 *
 * Property-based tests for plan visibility to the Supervisor.
 *
 * Feature: ppt-builders
 *
 * Property 10: Saved plans are immediately visible to the assigned Supervisor
 *              Validates: Requirements 3.9
 */

// Point the Prisma client at the isolated test database before any imports.
process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import * as fc from "fast-check";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const prisma = new PrismaClient();

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

// Feature: ppt-builders, Property 10
describe("Property 10: Saved plans are immediately visible to the assigned Supervisor", () => {
  afterEach(async () => {
    await prisma.resourceTrack.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 10
    // Validates: Requirements 3.9
    "a plan saved for a site+date is immediately returned by the Supervisor execution view query",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0), { minLength: 1, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0), { minLength: 1, maxLength: 5 }),
          async (rawDate, goals, resourceNames) => {
            const siteId = "site_p10_" + uid();
            const date = toDateOnly(rawDate);

            await prisma.site.create({ data: { id: siteId, name: `Site ${siteId}`, location: "Test Location" } });

            const createdPlan = await prisma.dailyPlan.create({
              data: {
                siteId, date,
                goals: JSON.stringify(goals),
                status: "PENDING",
                statusChangedAt: new Date(),
                resources: { create: resourceNames.map((name) => ({ name, status: "PENDING" })) },
              },
            });

            // Supervisor execution view query
            const supervisorViewPlan = await prisma.dailyPlan.findFirst({ where: { siteId, date } });

            expect(supervisorViewPlan).not.toBeNull();
            expect(supervisorViewPlan!.id).toBe(createdPlan.id);
            const savedGoals = JSON.parse(supervisorViewPlan!.goals) as string[];
            expect(savedGoals).toEqual(goals);
            expect(supervisorViewPlan!.status).toBe("PENDING");

            await prisma.resourceTrack.deleteMany({ where: { planId: createdPlan.id } });
            await prisma.dailyPlan.delete({ where: { id: createdPlan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );
});
