import { DefaultSession, DefaultJWT } from 'next-auth';

// Extend the built-in Session type to include role and id
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession['user'];
  }

  // Extend the User type returned by the Credentials provider authorize()
  interface User {
    id: string;
    role: string;
  }
}

// Extend the JWT type to carry role and id through the token
declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
  }
}
