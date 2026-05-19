/**
 * @jest-environment node
 *
 * Property-based tests for photo upload.
 *
 * Feature: ppt-builders
 *
 * Property 14: Photo upload creates a record with server-side timestamp and stable URL
 *              Validates: Requirements 6.2, 11.2
 *
 * Property 16: Uploaded photos are displayed in reverse chronological order
 *              Validates: Requirements 6.7
 */

process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import * as fc from "fast-check";

function uid(): string { return Math.random().toString(36).slice(2, 10); }
function toDateOnly(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }

const prisma = new PrismaClient();
beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

// Feature: ppt-builders, Property 14
describe("Property 14: Photo upload creates a record with server-side timestamp and stable URL", () => {
  afterEach(async () => {
    await prisma.sitePhoto.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 14
    // Validates: Requirements 6.2, 11.2
    "creates a SitePhoto record with a non-null url and server-side uploadedAt timestamp",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0).map((s) => `/uploads/${s.replace(/\//g, "_")}`),
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (url, rawDate) => {
            const siteId = "site_p14_" + uid();
            const date = toDateOnly(rawDate);
            await prisma.site.create({ data: { id: siteId, name: `Site ${siteId}`, location: "Test Location" } });
            const plan = await prisma.dailyPlan.create({ data: { siteId, date, goals: JSON.stringify(["goal 1"]), status: "PENDING" } });

            const beforeUpload = new Date();
            const photo = await prisma.sitePhoto.create({ data: { planId: plan.id, url } });
            const afterUpload = new Date();

            expect(photo.url).not.toBeNull();
            expect(photo.url.trim().length).toBeGreaterThan(0);
            expect(photo.url).toBe(url);
            expect(photo.uploadedAt).not.toBeNull();
            expect(photo.uploadedAt).toBeInstanceOf(Date);
            expect(photo.uploadedAt.getTime()).toBeGreaterThanOrEqual(beforeUpload.getTime());
            expect(photo.uploadedAt.getTime()).toBeLessThanOrEqual(afterUpload.getTime());
            expect(photo.planId).toBe(plan.id);

            await prisma.sitePhoto.deleteMany({ where: { planId: plan.id } });
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

// Feature: ppt-builders, Property 16
describe("Property 16: Uploaded photos are displayed in reverse chronological order", () => {
  afterEach(async () => {
    await prisma.sitePhoto.deleteMany({});
    await prisma.dailyPlan.deleteMany({});
    await prisma.site.deleteMany({});
  });

  it(
    // Feature: ppt-builders, Property 16
    // Validates: Requirements 6.7
    "N photos with distinct timestamps are returned ordered most-recent-first",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 10_000_000 }), { minLength: 2, maxLength: 8 }).filter((offsets) => new Set(offsets).size === offsets.length),
          fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
          async (offsets, rawDate) => {
            const siteId = "site_p16_" + uid();
            const date = toDateOnly(rawDate);
            await prisma.site.create({ data: { id: siteId, name: `Site ${siteId}`, location: "Test Location" } });
            const plan = await prisma.dailyPlan.create({ data: { siteId, date, goals: JSON.stringify(["goal 1"]), status: "PENDING" } });

            const baseTime = new Date("2024-01-01T00:00:00.000Z");
            const createdPhotos = [];
            for (let i = 0; i < offsets.length; i++) {
              const uploadedAt = new Date(baseTime.getTime() + offsets[i]);
              const photo = await prisma.sitePhoto.create({ data: { planId: plan.id, url: `/uploads/photo_${i}_${uid()}.jpg`, uploadedAt } });
              createdPhotos.push(photo);
            }

            const queriedPhotos = await prisma.sitePhoto.findMany({ where: { planId: plan.id }, orderBy: { uploadedAt: "desc" } });
            expect(queriedPhotos).toHaveLength(offsets.length);

            for (let i = 0; i < queriedPhotos.length - 1; i++) {
              expect(queriedPhotos[i].uploadedAt.getTime()).toBeGreaterThanOrEqual(queriedPhotos[i + 1].uploadedAt.getTime());
            }

            const maxTimestamp = Math.max(...createdPhotos.map((p) => p.uploadedAt.getTime()));
            expect(queriedPhotos[0].uploadedAt.getTime()).toBe(maxTimestamp);

            await prisma.sitePhoto.deleteMany({ where: { planId: plan.id } });
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
