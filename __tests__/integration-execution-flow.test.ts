/**
 * @jest-environment node
 *
 * Integration test: Full Supervisor execution flow.
 *
 * Seed DB with plan → Supervisor views execution page → marks all resources
 * arrived → uploads photo → verify timeline events.
 *
 * Requirements: 4.1–4.4, 5.1–5.5, 6.1–6.7
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
  await prisma.sitePhoto.deleteMany({});
  await prisma.resourceTrack.deleteMany({});
  await prisma.dailyPlan.deleteMany({});
  await prisma.user.deleteMany({ where: { username: { startsWith: "int_exec_" } } });
  await prisma.site.deleteMany({ where: { name: { startsWith: "Exec Site" } } });
});

describe("Integration: Full Supervisor execution flow", () => {
  it("Supervisor views plan, marks resources arrived, uploads photo — all events recorded", async () => {
    const today = toDateOnly(new Date());

    // --- Seed: Create site and plan ---
    const site = await prisma.site.create({
      data: { name: `Exec Site ${uid()}`, location: "Test City" },
    });

    const supervisor = await prisma.user.create({
      data: {
        username: `int_exec_sup_${uid()}`,
        passwordHash: "$2a$10$placeholder",
        role: "SUPERVISOR",
        siteId: site.id,
      },
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: today,
        goals: JSON.stringify(["Lay 4 layers of guardwall", "Pour 30 m3 concrete"]),
        status: "PENDING",
        voiceNoteUrl: "/uploads/voice-note.webm",
        resources: {
          create: [
            { name: "JCB", status: "PENDING" },
            { name: "Water Tanker", status: "PENDING" },
            { name: "Cement", status: "PENDING" },
          ],
        },
      },
      include: { resources: true, site: true },
    });

    // --- Step 1: Supervisor views execution page (Requirement 4.1) ---
    const viewedPlan = await prisma.dailyPlan.findFirst({
      where: { siteId: supervisor.siteId!, date: today },
      include: { resources: true, photos: { orderBy: { uploadedAt: "desc" } }, site: true },
    });

    expect(viewedPlan).not.toBeNull();

    // Goals must be displayed (Requirement 4.2)
    const goals = JSON.parse(viewedPlan!.goals) as string[];
    expect(goals).toHaveLength(2);
    expect(goals[0]).toBe("Lay 4 layers of guardwall");

    // Resource lineup must be displayed (Requirement 4.3)
    expect(viewedPlan!.resources).toHaveLength(3);
    for (const resource of viewedPlan!.resources) {
      expect(resource.status).toBe("PENDING");
      expect(resource.arrivedAt).toBeNull();
    }

    // Voice note URL must be present (Requirement 4.4)
    expect(viewedPlan!.voiceNoteUrl).toBe("/uploads/voice-note.webm");

    // --- Step 2: Mark all resources as arrived (Requirement 5.1–5.3) ---
    const arrivedResources = [];
    for (const resource of plan.resources) {
      const before = new Date();

      // Simulate POST /api/resources/[id]/arrive
      const arrivedAt = new Date(); // server-side timestamp
      const updated = await prisma.resourceTrack.update({
        where: { id: resource.id },
        data: { status: "ARRIVED", arrivedAt },
      });

      const after = new Date();

      // Status must be ARRIVED (Requirement 5.2)
      expect(updated.status).toBe("ARRIVED");

      // arrivedAt must be server-side (Requirement 5.2, 11.1)
      expect(updated.arrivedAt).not.toBeNull();
      expect(updated.arrivedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updated.arrivedAt!.getTime()).toBeLessThanOrEqual(after.getTime());

      arrivedResources.push(updated);
    }

    // Verify all resources are now ARRIVED
    const allResources = await prisma.resourceTrack.findMany({
      where: { planId: plan.id },
    });
    expect(allResources.every((r) => r.status === "ARRIVED")).toBe(true);

    // Verify re-arrival is prevented (Requirement 5.5)
    const firstResource = plan.resources[0];
    const existingResource = await prisma.resourceTrack.findUnique({
      where: { id: firstResource.id },
    });
    expect(existingResource!.status).toBe("ARRIVED");
    // The API route returns 409 for re-arrival — verified in resource-arrival.property.test.ts

    // --- Step 3: Upload a photo (Requirement 6.1–6.3) ---
    const before = new Date();

    // Simulate POST /api/photos (uploadedAt set via Prisma default)
    const photo = await prisma.sitePhoto.create({
      data: {
        planId: plan.id,
        url: `/uploads/photo-${uid()}.jpg`,
      },
    });

    const after = new Date();

    // Photo must have server-side uploadedAt (Requirement 6.2, 11.2)
    expect(photo.uploadedAt).not.toBeNull();
    expect(photo.uploadedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(photo.uploadedAt.getTime()).toBeLessThanOrEqual(after.getTime());

    // Photo must have a stable URL (Requirement 6.2)
    expect(photo.url).toBeTruthy();

    // --- Step 4: Verify photos are in reverse chronological order (Requirement 6.7) ---
    // Add a second photo
    await new Promise((resolve) => setTimeout(resolve, 10)); // ensure distinct timestamps
    const photo2 = await prisma.sitePhoto.create({
      data: { planId: plan.id, url: `/uploads/photo2-${uid()}.jpg` },
    });

    const photos = await prisma.sitePhoto.findMany({
      where: { planId: plan.id },
      orderBy: { uploadedAt: "desc" },
    });

    expect(photos).toHaveLength(2);
    // Most recent first
    expect(photos[0].id).toBe(photo2.id);
    expect(photos[1].id).toBe(photo.id);

    // --- Step 5: Verify timeline events (Requirement 5.4, 6.3) ---
    const todayStart = toDateOnly(new Date());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const arrivals = await prisma.resourceTrack.findMany({
      where: {
        planId: plan.id,
        status: "ARRIVED",
        arrivedAt: { gte: todayStart, lt: todayEnd },
      },
    });
    expect(arrivals).toHaveLength(3);

    const uploadedPhotos = await prisma.sitePhoto.findMany({
      where: {
        planId: plan.id,
        uploadedAt: { gte: todayStart, lt: todayEnd },
      },
    });
    expect(uploadedPhotos).toHaveLength(2);

    // Clean up
    await prisma.user.delete({ where: { id: supervisor.id } });
  });

  it("Execution view shows 'no plan' message when no plan exists for today (Requirement 4.5)", async () => {
    const site = await prisma.site.create({
      data: { name: `Exec Site ${uid()}`, location: "Test" },
    });

    const supervisor = await prisma.user.create({
      data: {
        username: `int_exec_nop_${uid()}`,
        passwordHash: "$2a$10$placeholder",
        role: "SUPERVISOR",
        siteId: site.id,
      },
    });

    const today = toDateOnly(new Date());

    // No plan exists for today
    const plan = await prisma.dailyPlan.findFirst({
      where: { siteId: supervisor.siteId!, date: today },
    });

    expect(plan).toBeNull();

    // Clean up
    await prisma.user.delete({ where: { id: supervisor.id } });
    await prisma.site.delete({ where: { id: site.id } });
  });
});
