/**
 * Pure media access control logic extracted from middleware.ts.
 * Testable independently of the Next.js edge runtime.
 *
 * Feature: ppt-builders
 */

export type MediaAccessResult = 'allow' | 'deny-401';

/**
 * Determine whether a request to a media file should be allowed or denied.
 *
 * @param token    - The JWT token string, or `null` for unauthenticated requests.
 * @param pathname - The URL pathname being accessed (e.g. "/uploads/2024/01/file.jpg").
 * @returns        A MediaAccessResult describing what the middleware should do.
 */
export function checkMediaAccess(token: string | null, pathname: string): MediaAccessResult {
  if (!pathname.startsWith('/uploads/')) return 'allow';
  if (!token) return 'deny-401';
  return 'allow';
}
