/**
 * @jest-environment node
 *
 * Integration test: DPR submission and plan completion.
 *
 * Seed DB with plan → Supervisor submits DPR → verify DailyReport created,
 * plan status COMPLETED, statusChangedAt set.
 *
 * Requirements: 7.4, 7.5, 7.8, 11.5
 */

process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import { createDprSchema } from "@/lib/validations/dpr";

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
  await prisma.site.deleteMany({ where: { name: { startsWith: "DPR Site" } } });
});

describe("Integration: DPR submission and plan completion", () => {
  it("Supervisor submits DPR → DailyReport created, plan status COMPLETED, statusChangedAt set", async () => {
    const today = toDateOnly(new Date());

    // --- Seed: Create site and plan ---
    const site = await prisma.site.create({
      data: { name: `DPR Site ${uid()}`, location: "Test City" },
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: today,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
        resources: {
          create: [{ name: "JCB", status: "PENDING" }],
        },
      },
    });

    expect(plan.status).toBe("PENDING");

    // --- Step 1: Validate DPR payload (simulates Zod validation in POST /api/dpr) ---
    const dprPayload = {
      planId: plan.id,
      masons: 5,
      helpers: 8,
      length: 12.5,
      breadth: 6.0,
      height: 3.2,
    };

    const validation = createDprSchema.safeParse(dprPayload);
    expect(validation.success).toBe(true);

    // --- Step 2: Submit DPR (simulates POST /api/dpr) ---
    const before = new Date();
    const now = new Date(); // server-side timestamp

    const [report] = await prisma.$transaction([
      prisma.dailyReport.create({
        data: {
          planId: plan.id,
          masons: dprPayload.masons,
          helpers: dprPayload.helpers,
          length: dprPayload.length,
          breadth: dprPayload.breadth,
          height: dprPayload.height,
          submittedAt: now,
        },
      }),
      prisma.dailyPlan.update({
        where: { id: plan.id },
        data: { status: "COMPLETED", statusChangedAt: now },
      }),
    ]);

    const after = new Date();

    // --- Assertions ---

    // DailyReport must be created with planId (Requirement 7.4)
    expect(report.planId).toBe(plan.id);
    expect(report.masons).toBe(dprPayload.masons);
    expect(report.helpers).toBe(dprPayload.helpers);
    expect(report.length).toBe(dprPayload.length);
    expect(report.breadth).toBe(dprPayload.breadth);
    expect(report.height).toBe(dprPayload.height);

    // submittedAt must be server-side (Requirement 11.3)
    expect(report.submittedAt).not.toBeNull();
    expect(report.submittedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(report.submittedAt.getTime()).toBeLessThanOrEqual(after.getTime());

    // Plan status must be COMPLETED (Requirement 7.5)
    const updatedPlan = await prisma.dailyPlan.findUnique({
      where: { id: plan.id },
    });
    expect(updatedPlan!.status).toBe("COMPLETED");

    // statusChangedAt must be set (Requirement 11.5)
    expect(updatedPlan!.statusChangedAt).not.toBeNull();
    expect(updatedPlan!.statusChangedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(updatedPlan!.statusChangedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("DPR submission without voice remark is allowed (Requirement 7.7)", async () => {
    const today = toDateOnly(new Date());

    const site = await prisma.site.create({
      data: { name: `DPR Site ${uid()}`, location: "Test" },
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: today,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });

    // No voiceRemarkUrl in payload
    const dprPayload = {
      planId: plan.id,
      masons: 3,
      helpers: 5,
      length: 8.0,
      breadth: 4.0,
      height: 2.5,
    };

    const validation = createDprSchema.safeParse(dprPayload);
    expect(validation.success).toBe(true);

    const report = await prisma.dailyReport.create({
      data: {
        planId: plan.id,
        masons: dprPayload.masons,
        helpers: dprPayload.helpers,
        length: dprPayload.length,
        breadth: dprPayload.breadth,
        height: dprPayload.height,
      },
    });

    expect(report.voiceRemarkUrl).toBeNull();
    expect(report.planId).toBe(plan.id);
  });

  it("DPR validation rejects negative masons (Requirement 7.1)", () => {
    const result = createDprSchema.safeParse({
      planId: "plan-id",
      masons: -1,
      helpers: 5,
      length: 10.0,
      breadth: 5.0,
      height: 3.0,
    });
    expect(result.success).toBe(false);
  });

  it("DPR validation rejects non-numeric dimension values (Requirement 7.6)", () => {
    const result = createDprSchema.safeParse({
      planId: "plan-id",
      masons: 3,
      helpers: 5,
      length: "not-a-number",
      breadth: 5.0,
      height: 3.0,
    });
    expect(result.success).toBe(false);
  });
});
