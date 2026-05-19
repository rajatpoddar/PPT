/**
 * @jest-environment node
 *
 * Integration test: Full Admin plan creation flow.
 *
 * Seed DB → Admin creates site → Admin creates plan with goals, resources,
 * voice note URL → verify plan saved with PENDING status.
 *
 * Requirements: 3.1–3.9
 */

process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import { createPlanSchema } from "@/lib/validations/plan";
import { createSiteSchema } from "@/lib/validations/site";

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
  await prisma.resourceTrack.deleteMany({});
  await prisma.dailyPlan.deleteMany({});
  await prisma.site.deleteMany({});
  await prisma.user.deleteMany({ where: { username: { startsWith: "int_" } } });
});

describe("Integration: Full Admin plan creation flow", () => {
  it("Admin creates a site, then creates a plan with goals, resources, and voice note — plan saved with PENDING status", async () => {
    // --- Step 1: Seed Admin user ---
    const adminUser = await prisma.user.create({
      data: {
        username: `int_admin_${uid()}`,
        passwordHash: "$2a$10$placeholder",
        role: "ADMIN",
      },
    });
    expect(adminUser.role).toBe("ADMIN");

    // --- Step 2: Create a Site (simulates POST /api/sites) ---
    const sitePayload = { name: "Integration Test Site", location: "Test City" };
    const siteValidation = createSiteSchema.safeParse(sitePayload);
    expect(siteValidation.success).toBe(true);

    const site = await prisma.site.create({
      data: {
        name: sitePayload.name,
        location: sitePayload.location,
      },
    });
    expect(site.id).toBeTruthy();
    expect(site.name).toBe(sitePayload.name);

    // --- Step 3: Create a DailyPlan (simulates POST /api/plans) ---
    const tomorrow = toDateOnly(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const planPayload = {
      siteId: site.id,
      date: tomorrow.toISOString().slice(0, 10),
      goals: ["4 layers of guardwall", "30 m3 concrete pouring"],
      resources: [{ name: "JCB" }, { name: "Water Tanker" }],
      voiceNoteUrl: "/uploads/voice-note-test.webm",
    };

    const planValidation = createPlanSchema.safeParse(planPayload);
    expect(planValidation.success).toBe(true);

    const now = new Date();
    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: tomorrow,
        goals: JSON.stringify(planPayload.goals),
        status: "PENDING",
        statusChangedAt: now,
        voiceNoteUrl: planPayload.voiceNoteUrl,
        resources: {
          create: planPayload.resources.map((r) => ({
            name: r.name,
            status: "PENDING",
          })),
        },
      },
      include: { resources: true, site: true },
    });

    // --- Assertions ---

    // Plan must have PENDING status (Requirement 3.6)
    expect(plan.status).toBe("PENDING");

    // statusChangedAt must be set (Requirement 11.5)
    expect(plan.statusChangedAt).not.toBeNull();

    // Goals must be preserved (Requirement 3.2)
    const savedGoals = JSON.parse(plan.goals) as string[];
    expect(savedGoals).toEqual(planPayload.goals);

    // Resources must be created with PENDING status (Requirement 3.3)
    expect(plan.resources).toHaveLength(2);
    for (const resource of plan.resources) {
      expect(resource.status).toBe("PENDING");
      expect(["JCB", "Water Tanker"]).toContain(resource.name);
    }

    // Voice note URL must be persisted (Requirement 3.6)
    expect(plan.voiceNoteUrl).toBe(planPayload.voiceNoteUrl);

    // Plan must be associated with the correct site (Requirement 2.2)
    expect(plan.siteId).toBe(site.id);
    expect(plan.site.name).toBe(sitePayload.name);

    // --- Step 4: Verify plan is visible to Supervisor (Requirement 3.9) ---
    const supervisorUser = await prisma.user.create({
      data: {
        username: `int_sup_${uid()}`,
        passwordHash: "$2a$10$placeholder",
        role: "SUPERVISOR",
        siteId: site.id,
      },
    });

    const visiblePlan = await prisma.dailyPlan.findFirst({
      where: { siteId: supervisorUser.siteId!, date: tomorrow },
      include: { resources: true },
    });

    expect(visiblePlan).not.toBeNull();
    expect(visiblePlan!.id).toBe(plan.id);
    expect(JSON.parse(visiblePlan!.goals)).toEqual(planPayload.goals);

    // Clean up supervisor
    await prisma.user.delete({ where: { id: supervisorUser.id } });
  });

  it("Plan creation rejects missing siteId (Requirement 3.7)", () => {
    const result = createPlanSchema.safeParse({
      date: "2025-01-15",
      goals: ["goal 1"],
      resources: [{ name: "JCB" }],
    });
    expect(result.success).toBe(false);
  });

  it("Plan creation rejects missing date (Requirement 3.7)", () => {
    const result = createPlanSchema.safeParse({
      siteId: "some-site-id",
      goals: ["goal 1"],
      resources: [{ name: "JCB" }],
    });
    expect(result.success).toBe(false);
  });

  it("Duplicate plan for same site+date is rejected (Requirement 3.10)", async () => {
    const site = await prisma.site.create({
      data: { name: `Site ${uid()}`, location: "Test" },
    });

    const date = toDateOnly(new Date("2025-06-15"));

    await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date,
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });

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

    // Only one plan should exist
    const count = await prisma.dailyPlan.count({ where: { siteId: site.id, date } });
    expect(count).toBe(1);
  });
});
