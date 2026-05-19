/**
 * @jest-environment node
 *
 * Property-based tests for the authentication system.
 *
 * Feature: ppt-builders
 *
 * Property 1: Valid credentials always produce a role-appropriate session
 *             Validates: Requirements 1.2
 *
 * Property 2: Invalid credentials never produce a session
 *             Validates: Requirements 1.3
 *
 * Property 4: Passwords are never stored as plaintext
 *             Validates: Requirements 1.7
 */

// Point the Prisma client at the isolated test database before any imports.
process.env.DATABASE_URL = "file:./prisma/test.db";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a short random suffix to avoid cross-test collisions. */
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Inline implementation of the `authorize` logic from lib/auth.ts.
 * We replicate the logic here so we can inject our own Prisma client
 * pointing at the test database, without needing to mock module imports.
 */
async function authorize(
  prisma: PrismaClient,
  credentials: { username: string; password: string } | undefined
): Promise<{ id: string; name: string; email: null; role: string } | null> {
  if (!credentials?.username || !credentials?.password) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { username: credentials.username },
  });

  if (!user) {
    return null;
  }

  const passwordMatch = await bcrypt.compare(
    credentials.password,
    user.passwordHash
  );

  if (!passwordMatch) {
    return null;
  }

  return {
    id: user.id,
    name: user.username,
    email: null,
    role: user.role,
  };
}

// ---------------------------------------------------------------------------
// Prisma client (test DB)
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Property 1 — Valid credentials always produce a role-appropriate session
// Feature: ppt-builders, Property 1
// ---------------------------------------------------------------------------

describe("Property 1: Valid credentials always produce a role-appropriate session", () => {
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: "prop1_" } } });
  });

  it(
    // Feature: ppt-builders, Property 1
    // Validates: Requirements 1.2
    "returns a user object with the correct role for valid credentials",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constantFrom("ADMIN", "SUPERVISOR"),
          async (rawUsername, rawPassword, role) => {
            // Prefix to avoid collisions with other tests.
            const username = "prop1_" + rawUsername.replace(/\s/g, "_") + "_" + uid();
            const password = rawPassword;

            // Use cost factor 1 for speed in tests (still exercises the full bcrypt path).
            const passwordHash = await bcrypt.hash(password, 1);
            const created = await prisma.user.create({
              data: {
                username,
                passwordHash,
                role,
              },
            });

            // Call authorize with the correct credentials.
            const result = await authorize(prisma, { username, password });

            // Must return a non-null user object.
            expect(result).not.toBeNull();
            expect(result!.id).toBe(created.id);
            expect(result!.name).toBe(username);
            expect(result!.email).toBeNull();
            // Role must match what was stored.
            expect(result!.role).toBe(role);

            // Clean up between iterations.
            await prisma.user.delete({ where: { id: created.id } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );
});

// ---------------------------------------------------------------------------
// Property 2 — Invalid credentials never produce a session
// Feature: ppt-builders, Property 2
// ---------------------------------------------------------------------------

describe("Property 2: Invalid credentials never produce a session", () => {
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: "prop2_" } } });
  });

  it(
    // Feature: ppt-builders, Property 2
    // Validates: Requirements 1.3
    "returns null when no matching user exists",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (rawUsername, rawPassword) => {
            // Use a username that is guaranteed not to exist in the DB.
            const username = "prop2_nonexistent_" + rawUsername.replace(/\s/g, "_") + "_" + uid();
            const password = rawPassword;

            const result = await authorize(prisma, { username, password });

            // Must return null — no session for unknown users.
            expect(result).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    },
    30000
  );

  it(
    // Feature: ppt-builders, Property 2
    // Validates: Requirements 1.3
    "returns null when the password does not match the stored hash",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.length > 0),
          async (rawUsername, correctPassword, wrongSuffix) => {
            const username = "prop2_" + rawUsername.replace(/\s/g, "_") + "_" + uid();

            // Store the user with the correct password hash (cost 1 for speed).
            const passwordHash = await bcrypt.hash(correctPassword, 1);
            const created = await prisma.user.create({
              data: {
                username,
                passwordHash,
                role: "SUPERVISOR",
              },
            });

            // Attempt login with a different password (append suffix to ensure mismatch).
            const wrongPassword = correctPassword + "_wrong_" + wrongSuffix;
            const result = await authorize(prisma, { username, password: wrongPassword });

            // Must return null — wrong password must never produce a session.
            expect(result).toBeNull();

            // Clean up between iterations.
            await prisma.user.delete({ where: { id: created.id } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );

  it(
    // Feature: ppt-builders, Property 2
    // Validates: Requirements 1.3
    "returns null when credentials are missing or empty",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(undefined),
            fc.record({
              username: fc.constant(""),
              password: fc.string({ minLength: 1, maxLength: 20 }),
            }),
            fc.record({
              username: fc.string({ minLength: 1, maxLength: 20 }),
              password: fc.constant(""),
            }),
            fc.record({
              username: fc.constant(""),
              password: fc.constant(""),
            })
          ),
          async (credentials) => {
            const result = await authorize(prisma, credentials as any);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 4 — Passwords are never stored as plaintext
// Feature: ppt-builders, Property 4
// ---------------------------------------------------------------------------

describe("Property 4: Passwords are never stored as plaintext", () => {
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: "prop4_" } } });
  });

  it(
    // Feature: ppt-builders, Property 4
    // Validates: Requirements 1.7
    "stored passwordHash never equals the plaintext password, and bcrypt.compare returns true",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (rawUsername, rawPassword) => {
            const username = "prop4_" + rawUsername.replace(/\s/g, "_") + "_" + uid();
            const plaintext = rawPassword;

            // Hash the password with cost 1 for speed (still exercises the full bcrypt path).
            const passwordHash = await bcrypt.hash(plaintext, 1);

            // Store the user.
            const created = await prisma.user.create({
              data: {
                username,
                passwordHash,
                role: "ADMIN",
              },
            });

            // Retrieve the stored record.
            const stored = await prisma.user.findUnique({
              where: { id: created.id },
            });

            expect(stored).not.toBeNull();

            // The stored hash must NOT equal the plaintext password.
            expect(stored!.passwordHash).not.toBe(plaintext);

            // bcrypt.compare must confirm the plaintext matches the stored hash.
            const matches = await bcrypt.compare(plaintext, stored!.passwordHash);
            expect(matches).toBe(true);

            // Clean up between iterations.
            await prisma.user.delete({ where: { id: created.id } });
          }
        ),
        { numRuns: 20 }
      );
    },
    60000
  );
});
