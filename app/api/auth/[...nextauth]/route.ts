import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

// Export both GET and POST so NextAuth can handle all its endpoints
// (sign-in, sign-out, session, CSRF token, etc.)
export { handler as GET, handler as POST };
