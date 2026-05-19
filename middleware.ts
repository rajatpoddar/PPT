import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Role-based route protection middleware.
 *
 * Protected route rules:
 *   - Unauthenticated users → redirect to /login
 *   - SUPERVISOR accessing /admin/* → redirect to /supervisor/execution
 *   - ADMIN accessing /supervisor/* → redirect to /admin/dashboard
 *   - Authenticated user accessing /login → redirect to their role dashboard
 *
 * Media access control:
 *   - Unauthenticated requests to /uploads/* → HTTP 401 JSON response
 *   - Authenticated requests to /uploads/* → allowed (any valid session grants access)
 *
 * Public routes (never intercepted by this middleware):
 *   - /login
 *   - /api/auth/* (NextAuth internal routes)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Read the JWT token — uses NEXTAUTH_SECRET from the environment
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const isAdminRoute = pathname.startsWith('/admin');
  const isSupervisorRoute = pathname.startsWith('/supervisor');
  const isLoginPage = pathname === '/login';
  const isUploadsPath = pathname.startsWith('/uploads/');

  // Media access control: /uploads/* requires an authenticated session
  if (isUploadsPath) {
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized — authentication required to access media files' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Authenticated user hitting /login → send them to their dashboard
  if (isLoginPage && token) {
    const destination =
      token.role === 'ADMIN' ? '/admin/dashboard' : '/supervisor/execution';
    return NextResponse.redirect(new URL(destination, req.url));
  }

  // Unauthenticated user hitting a protected route → redirect to /login
  if ((isAdminRoute || isSupervisorRoute) && !token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // SUPERVISOR trying to access an admin route → redirect to their dashboard
  if (isAdminRoute && token?.role === 'SUPERVISOR') {
    return NextResponse.redirect(new URL('/supervisor/execution', req.url));
  }

  // ADMIN trying to access a supervisor route → redirect to their dashboard
  if (isSupervisorRoute && token?.role === 'ADMIN') {
    return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  }

  return NextResponse.next();
}

/**
 * Matcher config — middleware only runs on routes that need protection.
 * Excludes NextAuth API routes, static assets, and Next.js internals.
 */
export const config = {
  matcher: [
    '/login',
    '/admin/:path*',
    '/supervisor/:path*',
    '/uploads/:path*',
  ],
};
