/**
 * Property-based tests for role-based route access control.
 *
 * Feature: ppt-builders
 *
 * Property 3: Role-based route access control
 *             Validates: Requirements 1.4, 1.5
 *
 * For any authenticated user with role R, attempting to access a route
 * restricted to role R′ (where R ≠ R′) should result in a redirect.
 * For any unauthenticated request to any protected route, the response
 * should be a redirect to /login.
 */

// Feature: ppt-builders, Property 3

import * as fc from 'fast-check';
import { checkRouteAccess, AccessResult } from '@/lib/routeAccess';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a path suffix that, when prepended with "/admin/" or
 * "/supervisor/", produces a valid protected pathname.
 * We allow any string (including empty) to cover both bare prefix paths
 * like "/admin" and deep paths like "/admin/dashboard/settings".
 */
const pathSuffix = fc.string({ minLength: 0, maxLength: 40 });

// ---------------------------------------------------------------------------
// Property 3 — Role-based route access control
// Feature: ppt-builders, Property 3
// ---------------------------------------------------------------------------

describe('Property 3: Role-based route access control', () => {
  // -------------------------------------------------------------------------
  // Unauthenticated access to /admin/* → must redirect to login
  // Validates: Requirements 1.5
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 3
    // Validates: Requirements 1.5
    'unauthenticated requests to /admin/* always redirect to login',
    () => {
      fc.assert(
        fc.property(pathSuffix, (suffix) => {
          const pathname = '/admin/' + suffix;
          const result: AccessResult = checkRouteAccess(null, pathname);
          expect(result).toBe('redirect-login');
        }),
        { numRuns: 20 }
      );
    }
  );

  // -------------------------------------------------------------------------
  // Unauthenticated access to /supervisor/* → must redirect to login
  // Validates: Requirements 1.5
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 3
    // Validates: Requirements 1.5
    'unauthenticated requests to /supervisor/* always redirect to login',
    () => {
      fc.assert(
        fc.property(pathSuffix, (suffix) => {
          const pathname = '/supervisor/' + suffix;
          const result: AccessResult = checkRouteAccess(null, pathname);
          expect(result).toBe('redirect-login');
        }),
        { numRuns: 20 }
      );
    }
  );

  // -------------------------------------------------------------------------
  // SUPERVISOR accessing /admin/* → must redirect to supervisor dashboard
  // Validates: Requirements 1.4
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 3
    // Validates: Requirements 1.4
    'SUPERVISOR accessing /admin/* is redirected to supervisor execution',
    () => {
      fc.assert(
        fc.property(pathSuffix, (suffix) => {
          const pathname = '/admin/' + suffix;
          const result: AccessResult = checkRouteAccess('SUPERVISOR', pathname);
          expect(result).toBe('redirect-supervisor-execution');
        }),
        { numRuns: 20 }
      );
    }
  );

  // -------------------------------------------------------------------------
  // ADMIN accessing /supervisor/* → must redirect to admin dashboard
  // Validates: Requirements 1.4
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 3
    // Validates: Requirements 1.4
    'ADMIN accessing /supervisor/* is redirected to admin dashboard',
    () => {
      fc.assert(
        fc.property(pathSuffix, (suffix) => {
          const pathname = '/supervisor/' + suffix;
          const result: AccessResult = checkRouteAccess('ADMIN', pathname);
          expect(result).toBe('redirect-admin-dashboard');
        }),
        { numRuns: 20 }
      );
    }
  );

  // -------------------------------------------------------------------------
  // ADMIN accessing /admin/* → must be allowed
  // Validates: Requirements 1.4
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 3
    // Validates: Requirements 1.4
    'ADMIN accessing /admin/* is always allowed',
    () => {
      fc.assert(
        fc.property(pathSuffix, (suffix) => {
          const pathname = '/admin/' + suffix;
          const result: AccessResult = checkRouteAccess('ADMIN', pathname);
          expect(result).toBe('allow');
        }),
        { numRuns: 20 }
      );
    }
  );

  // -------------------------------------------------------------------------
  // SUPERVISOR accessing /supervisor/* → must be allowed
  // Validates: Requirements 1.4
  // -------------------------------------------------------------------------
  it(
    // Feature: ppt-builders, Property 3
    // Validates: Requirements 1.4
    'SUPERVISOR accessing /supervisor/* is always allowed',
    () => {
      fc.assert(
        fc.property(pathSuffix, (suffix) => {
          const pathname = '/supervisor/' + suffix;
          const result: AccessResult = checkRouteAccess('SUPERVISOR', pathname);
          expect(result).toBe('allow');
        }),
        { numRuns: 20 }
      );
    }
  );
});
