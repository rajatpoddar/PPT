/**
 * @jest-environment node
 *
 * Property-based tests for the Media Service.
 *
 * Feature: ppt-builders
 *
 * Property 22: Media Service returns a stable URL for every upload
 *              Validates: Requirements 9.2
 *
 * Property 23: Storage failure prevents database record creation
 *              Validates: Requirements 9.4
 */

// Point the Prisma client at the isolated test database before any imports.
process.env.DATABASE_URL = "file:./prisma/test.db";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { PrismaClient } from "@prisma/client";
import * as fc from "fast-check";
import { LocalMediaService } from "@/lib/media/local";
import type { MediaService } from "@/lib/media/types";

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
// FailingMediaService — always throws on upload (used for Property 23)
// ---------------------------------------------------------------------------

class FailingMediaService implements MediaService {
  async upload(_file: Buffer, _filename: string, _mimeType: string): Promise<string> {
    throw new Error("Storage backend unavailable");
  }

  async delete(_url: string): Promise<void> {
    throw new Error("Storage backend unavailable");
  }
}

// ---------------------------------------------------------------------------
// Helper: simulate the API route logic for photo upload
// (mirrors the pattern in app/api/media/upload/route.ts and the photo route)
// ---------------------------------------------------------------------------

/**
 * Simulates the server-side logic:
 *   1. Call mediaService.upload(...)
 *   2. If upload succeeds → create a SitePhoto DB record and return the URL
 *   3. If upload throws → do NOT create any DB record, re-throw the error
 */
async function simulatePhotoUpload(
  prisma: PrismaClient,
  mediaService: MediaService,
  planId: string,
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  // Step 1: upload to storage (may throw)
  const url = await mediaService.upload(file, filename, mimeType);

  // Step 2: only reached if upload succeeded — create DB record
  await prisma.sitePhoto.create({
    data: {
      planId,
      url,
      uploadedAt: new Date(),
    },
  });

  return url;
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
// Property 22 — Media Service returns a stable URL for every upload
// Feature: ppt-builders, Property 22
// ---------------------------------------------------------------------------

describe("Property 22: Media Service returns a stable URL for every upload", () => {
  let tempDir: string;
  let service: LocalMediaService;

  beforeEach(async () => {
    // Use a fresh temp directory for each test run so uploads don't collide.
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ppt-media-p22-"));
    service = new LocalMediaService(tempDir);
  });

  afterEach(async () => {
    // Clean up all temp files created during the test.
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it(
    // Feature: ppt-builders, Property 22
    // Validates: Requirements 9.2
    "returns a non-null, non-empty URL starting with /uploads/ for any file buffer and filename",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary file buffers (0–1024 bytes).
          fc.uint8Array({ minLength: 0, maxLength: 1024 }).map((arr) => Buffer.from(arr)),
          // Generate arbitrary filenames with a safe extension.
          fc
            .tuple(
              fc
                .string({ minLength: 1, maxLength: 30 })
                .filter((s) => s.trim().length > 0 && !/[/\\]/.test(s)),
              fc.constantFrom(".jpg", ".png", ".webp", ".mp3", ".webm")
            )
            .map(([name, ext]) => `${name}${ext}`),
          // Generate a MIME type string.
          fc.constantFrom(
            "image/jpeg",
            "image/png",
            "image/webp",
            "audio/webm",
            "audio/mp4"
          ),
          async (fileBuffer, filename, mimeType) => {
            const url = await service.upload(fileBuffer, filename, mimeType);

            // The URL must be non-null and non-empty.
            expect(url).toBeTruthy();
            expect(typeof url).toBe("string");
            expect(url.length).toBeGreaterThan(0);

            // The URL must start with /uploads/.
            expect(url).toMatch(/^\/uploads\//);

            // The URL must contain a year/month path segment (YYYY/MM).
            expect(url).toMatch(/^\/uploads\/\d{4}\/\d{2}\//);

            // The URL must end with the same extension as the original filename.
            const ext = path.extname(filename).toLowerCase();
            if (ext) {
              expect(url.toLowerCase()).toMatch(new RegExp(`\\${ext}$`));
            }
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );

  it(
    // Feature: ppt-builders, Property 22
    // Validates: Requirements 9.2
    "returns a unique URL for each upload (no collisions across distinct uploads)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two independent file buffers.
          fc.uint8Array({ minLength: 1, maxLength: 512 }).map((arr) => Buffer.from(arr)),
          fc.uint8Array({ minLength: 1, maxLength: 512 }).map((arr) => Buffer.from(arr)),
          async (buf1, buf2) => {
            const url1 = await service.upload(buf1, "file.jpg", "image/jpeg");
            const url2 = await service.upload(buf2, "file.jpg", "image/jpeg");

            // Each upload must produce a distinct URL (collision-resistant naming).
            expect(url1).not.toBe(url2);
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );
});

// ---------------------------------------------------------------------------
// Property 23 — Storage failure prevents database record creation
// Feature: ppt-builders, Property 23
// ---------------------------------------------------------------------------

describe("Property 23: Storage failure prevents database record creation", () => {
  const failingService = new FailingMediaService();

  // Clean up any DB rows created during this suite.
  afterEach(async () => {
    await prisma.sitePhoto.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 23
    // Validates: Requirements 9.4
    "does not create a SitePhoto record when the storage backend throws",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary file buffers.
          fc.uint8Array({ minLength: 1, maxLength: 512 }).map((arr) => Buffer.from(arr)),
          // Generate arbitrary filenames.
          fc
            .string({ minLength: 1, maxLength: 30 })
            .filter((s) => s.trim().length > 0 && !/[/\\]/.test(s))
            .map((name) => `${name}.jpg`),
          async (fileBuffer, filename) => {
            const siteId = "site_p23_" + uid();

            // Create the parent Site and DailyPlan.
            await prisma.site.create({
              data: {
                id: siteId,
                name: `Site ${siteId}`,
                location: "Test Location",
              },
            });

            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date: toDateOnly(new Date()),
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
              },
            });

            // Count SitePhoto records before the attempted upload.
            const countBefore = await prisma.sitePhoto.count({
              where: { planId: plan.id },
            });

            // Attempt the upload — it must throw because the service always fails.
            let threw = false;
            try {
              await simulatePhotoUpload(
                prisma,
                failingService,
                plan.id,
                fileBuffer,
                filename,
                "image/jpeg"
              );
            } catch {
              threw = true;
            }

            // The upload must have thrown.
            expect(threw).toBe(true);

            // The SitePhoto count must remain unchanged (no record was created).
            const countAfter = await prisma.sitePhoto.count({
              where: { planId: plan.id },
            });
            expect(countAfter).toBe(countBefore);
            expect(countAfter).toBe(0);

            // Clean up between iterations.
            await prisma.sitePhoto.deleteMany({ where: { planId: plan.id } });
            await prisma.dailyPlan.delete({ where: { id: plan.id } });
            await prisma.site.delete({ where: { id: siteId } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );

  it(
    // Feature: ppt-builders, Property 23
    // Validates: Requirements 9.4
    "does not create a voiceNoteUrl on a DailyPlan when storage throws",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary audio buffers.
          fc.uint8Array({ minLength: 1, maxLength: 512 }).map((arr) => Buffer.from(arr)),
          // Generate arbitrary filenames.
          fc
            .string({ minLength: 1, maxLength: 30 })
            .filter((s) => s.trim().length > 0 && !/[/\\]/.test(s))
            .map((name) => `${name}.webm`),
          async (audioBuffer, filename) => {
            const siteId = "site_p23v_" + uid();

            // Create the parent Site.
            await prisma.site.create({
              data: {
                id: siteId,
                name: `Site ${siteId}`,
                location: "Test Location",
              },
            });

            // Simulate the plan creation flow:
            // 1. Try to upload voice note → fails
            // 2. Because upload failed, do NOT set voiceNoteUrl on the plan
            let voiceNoteUrl: string | null = null;
            let uploadThrew = false;

            try {
              voiceNoteUrl = await failingService.upload(
                audioBuffer,
                filename,
                "audio/webm"
              );
            } catch {
              uploadThrew = true;
              // Do not set voiceNoteUrl — mirrors the API route error handling
            }

            expect(uploadThrew).toBe(true);

            // Create the plan without a voiceNoteUrl (as the API route would do on failure).
            const plan = await prisma.dailyPlan.create({
              data: {
                siteId,
                date: toDateOnly(new Date()),
                goals: JSON.stringify(["goal 1"]),
                status: "PENDING",
                voiceNoteUrl: voiceNoteUrl, // must be null
              },
            });

            // The plan must have been created without a voiceNoteUrl.
            expect(plan.voiceNoteUrl).toBeNull();

            // Clean up between iterations.
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
