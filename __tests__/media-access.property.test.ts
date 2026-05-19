/**
 * @jest-environment node
 *
 * Property-based tests for media access control.
 *
 * Feature: ppt-builders
 *
 * Property 24: Media access control enforces site membership
 *              Validates: Requirements 9.5
 */

// Feature: ppt-builders, Property 24

import * as fc from 'fast-check';
import { checkMediaAccess, MediaAccessResult } from '@/lib/mediaAccess';

const pathSuffix = fc.string({ minLength: 0, maxLength: 40 });
const validToken = fc.string({ minLength: 1, maxLength: 50 });

describe('Property 24: Media access control enforces site membership', () => {
  // Unauthenticated requests to /uploads/* → must deny with 401
  it(
    // Feature: ppt-builders, Property 24
    // Validates: Requirements 9.5
    'unauthenticated requests to /uploads/* are denied with 401',
    () => {
      fc.assert(
        fc.property(pathSuffix, (suffix) => {
          const pathname = '/uploads/' + suffix;
          const result: MediaAccessResult = checkMediaAccess(null, pathname);
          expect(result).toBe('deny-401');
        }),
        { numRuns: 20 }
      );
    }
  );

  // Authenticated requests to /uploads/* → must be allowed
  it(
    // Feature: ppt-builders, Property 24
    // Validates: Requirements 9.5
    'authenticated requests to /uploads/* are allowed',
    () => {
      fc.assert(
        fc.property(validToken, pathSuffix, (token, suffix) => {
          const pathname = '/uploads/' + suffix;
          const result: MediaAccessResult = checkMediaAccess(token, pathname);
          expect(result).toBe('allow');
        }),
        { numRuns: 20 }
      );
    }
  );

  // Non-uploads paths → always allowed regardless of token
  it(
    // Feature: ppt-builders, Property 24
    // Validates: Requirements 9.5
    'non-uploads paths are always allowed regardless of authentication',
    () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(null), validToken),
          fc.constantFrom('/admin/dashboard', '/supervisor/execution', '/login', '/api/plans', '/'),
          (token, pathname) => {
            const result: MediaAccessResult = checkMediaAccess(token, pathname);
            expect(result).toBe('allow');
          }
        ),
        { numRuns: 20 }
      );
    }
  );
});
