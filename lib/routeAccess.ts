/**
 * Pure route access control logic extracted from middleware.ts.
 *
 * This module encodes the same role-based routing rules as the Next.js
 * middleware so they can be tested independently of the edge runtime.
 *
 * Feature: ppt-builders
 */

export type AccessResult =
  | 'allow'
  | 'redirect-login'
  | 'redirect-admin-dashboard'
  | 'redirect-supervisor-execution';

/**
 * Determine whether a request should be allowed or redirected based on the
 * authenticated user's role and the requested pathname.
 *
 * @param role     - The role from the JWT token, or `null` for unauthenticated requests.
 * @param pathname - The URL pathname being accessed (e.g. "/admin/dashboard").
 * @returns An `AccessResult` describing what the middleware should do.
 */
export function checkRouteAccess(
  role: string | null,
  pathname: string
): AccessResult {
  const isAdminRoute = pathname.startsWith('/admin');
  const isSupervisorRoute = pathname.startsWith('/supervisor');

  // Unauthenticated user hitting a protected route → redirect to login
  if ((isAdminRoute || isSupervisorRoute) && !role) {
    return 'redirect-login';
  }

  // SUPERVISOR trying to access an admin route → redirect to their dashboard
  if (isAdminRoute && role === 'SUPERVISOR') {
    return 'redirect-supervisor-execution';
  }

  // ADMIN trying to access a supervisor route → redirect to their dashboard
  if (isSupervisorRoute && role === 'ADMIN') {
    return 'redirect-admin-dashboard';
  }

  return 'allow';
}
