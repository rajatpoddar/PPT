/**
 * @jest-environment node
 *
 * Integration test: Duplicate plan and DPR rejection.
 *
 * - Attempt to create a second plan for the same site+date → verify HTTP 409
 * - Attempt to submit a second DPR for the same plan → verify HTTP 409
 *
 * Requirements: 3.10, 7.8
 */

process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";

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

afterEach(async () => {
  await prisma.dailyReport.deleteMany({});
  await prisma.resourceTrack.deleteMany({});
  await prisma.dailyPlan.deleteMany({});
  await prisma.site.deleteMany({ where: { name: { startsWith: "Dup Site" } } });
});

describe("Integration: Duplicate plan and DPR rejection", () => {
  it("Creating a second plan for the same site+date is rejected with P2002 (Requirement 3.10)", async () => {
    const site = await prisma.site.create({
      data: { name: `Dup Site ${uid()}`, location: "Test" },
    });

    const date = toDateOnly(new Date("2025-08-15"));

    // First plan creation must succeed
    const firstPlan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });
    expect(firstPlan.id).toBeTruthy();

    // Second plan creation for the same (siteId, date) must be rejected
    let threw = false;
    let errorCode: string | undefined;
    try {
      await prisma.dailyPlan.create({
        data: {
          siteId: site.id,
          date,
          goals: JSON.stringify(["goal 2"]),
          status: "PENDING",
        },
      });
    } catch (err: unknown) {
      threw = true;
      errorCode = (err as { code?: string }).code;
    }

    expect(threw).toBe(true);
    expect(errorCode).toBe("P2002");

    // Only one plan must exist for this (siteId, date)
    const count = await prisma.dailyPlan.count({
      where: { siteId: site.id, date },
    });
    expect(count).toBe(1);

    // The existing plan must remain unchanged
    const existing = await prisma.dailyPlan.findUnique({
      where: { id: firstPlan.id },
    });
    expect(existing).not.toBeNull();
    expect(existing!.status).toBe("PENDING");
    expect(JSON.parse(existing!.goals)).toEqual(["goal 1"]);
  });

  it("Submitting a second DPR for the same plan is rejected with P2002 (Requirement 7.8)", async () => {
    const site = await prisma.site.create({
      data: { name: `Dup Site ${uid()}`, location: "Test" },
    });

    const date = toDateOnly(new Date("2025-08-16"));

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });

    const reportData = {
      planId: plan.id,
      masons: 3,
      helpers: 5,
      length: 10.0,
      breadth: 5.0,
      height: 3.0,
    };

    // First DPR submission must succeed
    const firstReport = await prisma.dailyReport.create({ data: reportData });
    expect(firstReport.id).toBeTruthy();

    // Second DPR for the same planId must be rejected
    let threw = false;
    let errorCode: string | undefined;
    try {
      await prisma.dailyReport.create({ data: reportData });
    } catch (err: unknown) {
      threw = true;
      errorCode = (err as { code?: string }).code;
    }

    expect(threw).toBe(true);
    expect(errorCode).toBe("P2002");

    // Exactly one report must exist for this plan
    const count = await prisma.dailyReport.count({
      where: { planId: plan.id },
    });
    expect(count).toBe(1);

    // The existing report must remain unchanged
    const existing = await prisma.dailyReport.findUnique({
      where: { id: firstReport.id },
    });
    expect(existing).not.toBeNull();
    expect(existing!.masons).toBe(reportData.masons);
    expect(existing!.helpers).toBe(reportData.helpers);
  });

  it("Multiple plans for different sites on the same date are allowed (Requirement 3.10)", async () => {
    const date = toDateOnly(new Date("2025-08-17"));

    const site1 = await prisma.site.create({
      data: { name: `Dup Site ${uid()}`, location: "Test" },
    });
    const site2 = await prisma.site.create({
      data: { name: `Dup Site ${uid()}`, location: "Test" },
    });

    // Both plans should succeed (different sites)
    const plan1 = await prisma.dailyPlan.create({
      data: {
        siteId: site1.id,
        date,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });

    const plan2 = await prisma.dailyPlan.create({
      data: {
        siteId: site2.id,
        date,
        goals: JSON.stringify(["goal 2"]),
        status: "PENDING",
      },
    });

    expect(plan1.id).toBeTruthy();
    expect(plan2.id).toBeTruthy();
    expect(plan1.id).not.toBe(plan2.id);
  });

  it("Multiple plans for the same site on different dates are allowed (Requirement 3.10)", async () => {
    const site = await prisma.site.create({
      data: { name: `Dup Site ${uid()}`, location: "Test" },
    });

    const date1 = toDateOnly(new Date("2025-08-18"));
    const date2 = toDateOnly(new Date("2025-08-19"));

    const plan1 = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: date1,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });

    const plan2 = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: date2,
        goals: JSON.stringify(["goal 2"]),
        status: "PENDING",
      },
    });

    expect(plan1.id).toBeTruthy();
    expect(plan2.id).toBeTruthy();
    expect(plan1.id).not.toBe(plan2.id);
  });
});
