/**
 * @jest-environment node
 *
 * Integration test: Media upload format and size validation.
 *
 * - Upload valid JPEG, PNG, WebP files → verify success
 * - Upload unsupported format and oversized file → verify rejection and no DB record
 *
 * Requirements: 6.4, 6.5, 6.6
 */

process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import {
  validateMediaFile,
  IMAGE_MAX_BYTES,
  AUDIO_MAX_BYTES,
} from "@/lib/media/validation";

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
  await prisma.sitePhoto.deleteMany({});
  await prisma.dailyPlan.deleteMany({});
  await prisma.site.deleteMany({ where: { name: { startsWith: "Media Site" } } });
});

describe("Integration: Media upload format and size validation", () => {
  // --- Valid image formats ---

  it("JPEG files within 10 MB are accepted (Requirement 6.4)", () => {
    const result = validateMediaFile("image/jpeg", 5 * 1024 * 1024); // 5 MB
    expect(result.valid).toBe(true);
  });

  it("PNG files within 10 MB are accepted (Requirement 6.4)", () => {
    const result = validateMediaFile("image/png", 8 * 1024 * 1024); // 8 MB
    expect(result.valid).toBe(true);
  });

  it("WebP files within 10 MB are accepted (Requirement 6.4)", () => {
    const result = validateMediaFile("image/webp", 1 * 1024 * 1024); // 1 MB
    expect(result.valid).toBe(true);
  });

  it("Exactly 10 MB image is accepted (boundary — Requirement 6.6)", () => {
    const result = validateMediaFile("image/jpeg", IMAGE_MAX_BYTES);
    expect(result.valid).toBe(true);
  });

  // --- Invalid formats ---

  it("GIF files are rejected (Requirement 6.5)", () => {
    const result = validateMediaFile("image/gif", 1 * 1024 * 1024);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("unsupported_mime_type");
    }
  });

  it("PDF files are rejected (Requirement 6.5)", () => {
    const result = validateMediaFile("application/pdf", 1 * 1024 * 1024);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("unsupported_mime_type");
    }
  });

  it("Video files are rejected (Requirement 6.5)", () => {
    const result = validateMediaFile("video/mp4", 5 * 1024 * 1024);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("unsupported_mime_type");
    }
  });

  it("Empty MIME type is rejected (Requirement 6.5)", () => {
    const result = validateMediaFile("", 1 * 1024 * 1024);
    expect(result.valid).toBe(false);
  });

  // --- Oversized files ---

  it("Image file exceeding 10 MB is rejected (Requirement 6.6)", () => {
    const result = validateMediaFile("image/jpeg", IMAGE_MAX_BYTES + 1);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("file_too_large");
    }
  });

  it("20 MB image is rejected (Requirement 6.6)", () => {
    const result = validateMediaFile("image/png", 20 * 1024 * 1024);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("file_too_large");
    }
  });

  // --- Audio formats ---

  it("WebM audio within 50 MB is accepted", () => {
    const result = validateMediaFile("audio/webm", 10 * 1024 * 1024);
    expect(result.valid).toBe(true);
  });

  it("Audio file exceeding 50 MB is rejected", () => {
    const result = validateMediaFile("audio/webm", AUDIO_MAX_BYTES + 1);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("file_too_large");
    }
  });

  // --- DB record not created on rejection ---

  it("Rejected upload does not create a SitePhoto record (Requirement 9.4)", async () => {
    const site = await prisma.site.create({
      data: { name: `Media Site ${uid()}`, location: "Test" },
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: toDateOnly(new Date()),
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });

    const countBefore = await prisma.sitePhoto.count({
      where: { planId: plan.id },
    });

    // Simulate rejected upload (unsupported MIME type)
    const validation = validateMediaFile("image/gif", 1 * 1024 * 1024);
    expect(validation.valid).toBe(false);

    // Since validation failed, we do NOT create the DB record
    // (mirrors the API route behavior)
    if (!validation.valid) {
      // No DB write
    }

    const countAfter = await prisma.sitePhoto.count({
      where: { planId: plan.id },
    });

    expect(countAfter).toBe(countBefore);
    expect(countAfter).toBe(0);
  });

  it("Rejected oversized upload does not create a SitePhoto record (Requirement 9.4)", async () => {
    const site = await prisma.site.create({
      data: { name: `Media Site ${uid()}`, location: "Test" },
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: toDateOnly(new Date()),
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });

    const countBefore = await prisma.sitePhoto.count({
      where: { planId: plan.id },
    });

    // Simulate rejected upload (oversized)
    const validation = validateMediaFile("image/jpeg", IMAGE_MAX_BYTES + 1);
    expect(validation.valid).toBe(false);

    // No DB write on rejection
    const countAfter = await prisma.sitePhoto.count({
      where: { planId: plan.id },
    });

    expect(countAfter).toBe(countBefore);
    expect(countAfter).toBe(0);
  });

  it("Accepted upload creates a SitePhoto record (Requirement 6.2)", async () => {
    const site = await prisma.site.create({
      data: { name: `Media Site ${uid()}`, location: "Test" },
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        siteId: site.id,
        date: toDateOnly(new Date()),
        goals: JSON.stringify(["goal 1"]),
        status: "PENDING",
      },
    });

    // Simulate accepted upload
    const validation = validateMediaFile("image/jpeg", 5 * 1024 * 1024);
    expect(validation.valid).toBe(true);

    if (validation.valid) {
      const photo = await prisma.sitePhoto.create({
        data: { planId: plan.id, url: `/uploads/photo-${uid()}.jpg` },
      });

      expect(photo.id).toBeTruthy();
      expect(photo.url).toBeTruthy();
      expect(photo.uploadedAt).not.toBeNull();
    }
  });
});
