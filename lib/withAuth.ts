import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

type RouteHandler = (
  req: NextRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

/**
 * withAuth wraps an API route handler and enforces authentication and
 * role-based authorization before the handler is invoked.
 *
 * Usage:
 *   export const GET = withAuth('ADMIN', async (req) => { ... });
 *   export const POST = withAuth('SUPERVISOR', async (req) => { ... });
 *
 * Pass '*' as the role to allow any authenticated user regardless of role.
 *
 * Returns:
 *   - 401 if the request has no valid session
 *   - 403 if the session role does not match the required role
 *   - Delegates to the wrapped handler otherwise
 */
export function withAuth(requiredRole: string, handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (requiredRole !== '*' && session.user.role !== requiredRole) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return handler(req, context);
  };
}
