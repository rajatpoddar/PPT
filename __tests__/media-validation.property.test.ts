/**
 * @jest-environment node
 *
 * Property-based tests for photo/audio file format and size validation.
 *
 * Feature: ppt-builders
 *
 * Property 15: Photo file format and size validation
 *              Validates: Requirements 6.4, 6.5, 6.6
 */

// Feature: ppt-builders, Property 15

import * as fc from 'fast-check';
import {
  validateMediaFile,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_AUDIO_TYPES,
  ACCEPTED_MIME_TYPES,
  IMAGE_MAX_BYTES,
  AUDIO_MAX_BYTES,
  ALLOWED_MIME_TYPES,
} from '@/lib/media/validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the size limit for a given accepted MIME type. */
function limitFor(mimeType: string): number {
  return ALLOWED_MIME_TYPES[mimeType];
}

// ---------------------------------------------------------------------------
// Property 15 — Photo file format and size validation
// Feature: ppt-builders, Property 15
// ---------------------------------------------------------------------------

describe('Property 15: Photo file format and size validation', () => {
  // -------------------------------------------------------------------------
  // 15a — Any accepted MIME type with size ≤ limit → accepted
  // Validates: Requirements 6.4, 6.5, 6.6
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 15
    // Validates: Requirements 6.4, 6.5, 6.6
    'accepts any supported MIME type when file size is within the allowed limit',
    () => {
      fc.assert(
        fc.property(
          // Pick any accepted MIME type.
          fc.constantFrom(...ACCEPTED_MIME_TYPES),
          // Generate a size in [0, limit] for that MIME type.
          // We use a flat integer and clamp it after we know the MIME type.
          fc.integer({ min: 0, max: AUDIO_MAX_BYTES }),
          (mimeType, rawSize) => {
            const limit = limitFor(mimeType);
            // Clamp to the actual limit for this MIME type.
            const sizeBytes = rawSize % (limit + 1);

            const result = validateMediaFile(mimeType, sizeBytes);
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 40 }
      );
    }
  );

  // -------------------------------------------------------------------------
  // 15b — Any accepted MIME type with size > limit → rejected (file_too_large)
  // Validates: Requirements 6.6
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 15
    // Validates: Requirements 6.6
    'rejects any supported MIME type when file size exceeds the allowed limit',
    () => {
      fc.assert(
        fc.property(
          // Pick any accepted MIME type.
          fc.constantFrom(...ACCEPTED_MIME_TYPES),
          // Generate a size strictly greater than the limit.
          // We add 1 to the limit and then add an arbitrary non-negative offset.
          fc.integer({ min: 0, max: 100 * 1024 * 1024 }), // up to 100 MB extra
          (mimeType, extraBytes) => {
            const limit = limitFor(mimeType);
            const sizeBytes = limit + 1 + extraBytes;

            const result = validateMediaFile(mimeType, sizeBytes);
            expect(result.valid).toBe(false);
            if (!result.valid) {
              expect(result.reason).toBe('file_too_large');
            }
          }
        ),
        { numRuns: 40 }
      );
    }
  );

  // -------------------------------------------------------------------------
  // 15c — Any non-accepted MIME type → rejected (unsupported_mime_type)
  //        regardless of file size
  // Validates: Requirements 6.4, 6.5
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 15
    // Validates: Requirements 6.4, 6.5
    'rejects any MIME type that is not in the accepted list, regardless of file size',
    () => {
      // A representative set of MIME types that are NOT in the allow-list.
      const rejectedMimeTypes = [
        'image/gif',
        'image/bmp',
        'image/tiff',
        'image/svg+xml',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
        'application/pdf',
        'application/json',
        'text/plain',
        'text/html',
        'application/octet-stream',
        '',
        'not-a-mime-type',
        'image/',
        '/jpeg',
      ] as const;

      fc.assert(
        fc.property(
          // Pick a MIME type that is definitely not accepted.
          fc.constantFrom(...rejectedMimeTypes),
          // Any file size — rejection must be independent of size.
          fc.integer({ min: 0, max: AUDIO_MAX_BYTES + 1 }),
          (mimeType, sizeBytes) => {
            const result = validateMediaFile(mimeType, sizeBytes);
            expect(result.valid).toBe(false);
            if (!result.valid) {
              expect(result.reason).toBe('unsupported_mime_type');
            }
          }
        ),
        { numRuns: 40 }
      );
    }
  );

  // -------------------------------------------------------------------------
  // 15d — Boundary: size exactly at the limit → accepted
  // Validates: Requirements 6.6
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 15
    // Validates: Requirements 6.6
    'accepts a file whose size is exactly at the limit (boundary value)',
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ACCEPTED_MIME_TYPES),
          (mimeType) => {
            const limit = limitFor(mimeType);
            const result = validateMediaFile(mimeType, limit);
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  // -------------------------------------------------------------------------
  // 15e — Boundary: size one byte over the limit → rejected
  // Validates: Requirements 6.6
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 15
    // Validates: Requirements 6.6
    'rejects a file whose size is exactly one byte over the limit (boundary value)',
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ACCEPTED_MIME_TYPES),
          (mimeType) => {
            const limit = limitFor(mimeType);
            const result = validateMediaFile(mimeType, limit + 1);
            expect(result.valid).toBe(false);
            if (!result.valid) {
              expect(result.reason).toBe('file_too_large');
            }
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  // -------------------------------------------------------------------------
  // 15f — Image types have a 10 MB limit; audio types have a 50 MB limit
  // Validates: Requirements 6.4, 6.5, 6.6
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 15
    // Validates: Requirements 6.4, 6.5, 6.6
    'image types are accepted up to 10 MB and audio types up to 50 MB',
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ACCEPTED_IMAGE_TYPES),
          fc.constantFrom(...ACCEPTED_AUDIO_TYPES),
          (imageMime, audioMime) => {
            // An image file at exactly 10 MB → accepted.
            expect(validateMediaFile(imageMime, IMAGE_MAX_BYTES).valid).toBe(true);
            // An image file at 10 MB + 1 byte → rejected.
            expect(validateMediaFile(imageMime, IMAGE_MAX_BYTES + 1).valid).toBe(false);

            // An audio file at exactly 50 MB → accepted.
            expect(validateMediaFile(audioMime, AUDIO_MAX_BYTES).valid).toBe(true);
            // An audio file at 50 MB + 1 byte → rejected.
            expect(validateMediaFile(audioMime, AUDIO_MAX_BYTES + 1).valid).toBe(false);

            // An image file at 50 MB (audio limit) → rejected (exceeds image limit).
            expect(validateMediaFile(imageMime, AUDIO_MAX_BYTES).valid).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    }
  );
});
