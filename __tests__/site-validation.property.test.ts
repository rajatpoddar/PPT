/**
 * @jest-environment node
 *
 * Property-based tests for site name validation.
 *
 * Feature: ppt-builders
 *
 * Property 5: Site name validation rejects empty and whitespace-only inputs
 *             Validates: Requirements 2.4
 */

import * as fc from 'fast-check';
import { createSiteSchema } from '@/lib/validations/site';

// ---------------------------------------------------------------------------
// Property 5 — Site name validation rejects empty and whitespace-only inputs
// Feature: ppt-builders, Property 5
// ---------------------------------------------------------------------------

describe('Property 5: Site name validation rejects empty and whitespace-only inputs', () => {
  // ---------------------------------------------------------------------------
  // 5a — Empty string is rejected
  // ---------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 5
    // Validates: Requirements 2.4
    'rejects an empty string for name',
    () => {
      fc.assert(
        fc.property(
          // Always use an empty string for name; use a valid location so only name is tested.
          fc.constant(''),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (emptyName, validLocation) => {
            const result = createSiteSchema.safeParse({
              name: emptyName,
              location: validLocation,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
              const nameErrors = result.error.issues.filter(
                (issue) => issue.path[0] === 'name'
              );
              expect(nameErrors.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  // ---------------------------------------------------------------------------
  // 5b — Whitespace-only strings are rejected
  // ---------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 5
    // Validates: Requirements 2.4
    'rejects whitespace-only strings for name',
    () => {
      fc.assert(
        fc.property(
          // Generate strings composed entirely of whitespace characters.
          fc
            .string({ minLength: 1 })
            .filter((s) => s.trim() === '' && s.length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (whitespaceOnlyName, validLocation) => {
            const result = createSiteSchema.safeParse({
              name: whitespaceOnlyName,
              location: validLocation,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
              const nameErrors = result.error.issues.filter(
                (issue) => issue.path[0] === 'name'
              );
              expect(nameErrors.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 20 }
      );
    }
  );

  // ---------------------------------------------------------------------------
  // 5c — Valid non-empty, non-whitespace-only names are accepted
  // ---------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 5
    // Validates: Requirements 2.4
    'accepts valid non-empty, non-whitespace-only names',
    () => {
      fc.assert(
        fc.property(
          // Generate strings that have at least one non-whitespace character.
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (validName, validLocation) => {
            const result = createSiteSchema.safeParse({
              name: validName,
              location: validLocation,
            });

            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    }
  );
});
