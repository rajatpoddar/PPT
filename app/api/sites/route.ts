import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { createSiteSchema } from '@/lib/validations/site';

/**
 * GET /api/sites
 * Returns a list of all sites.
 * Requires Admin role.
 */
export const GET = withAuth('ADMIN', async (_req: NextRequest) => {
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(sites, { status: 200 });
});

/**
 * POST /api/sites
 * Creates a new site.
 * Requires Admin role.
 * Body: { name: string, location: string }
 * Returns 201 with the created site on success.
 * Returns 422 with { errors } on validation failure.
 */
export const POST = withAuth('ADMIN', async (req: NextRequest) => {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { errors: { _root: ['Invalid JSON body'] } },
      { status: 422 }
    );
  }

  const result = createSiteSchema.safeParse(body);

  if (!result.success) {
    // Transform Zod errors into { field: string[] } shape
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : '_root';
      if (!errors[field]) {
        errors[field] = [];
      }
      errors[field].push(issue.message);
    }
    return NextResponse.json({ errors }, { status: 422 });
  }

  const { name, location } = result.data;

  const site = await prisma.site.create({
    data: { name, location },
  });

  return NextResponse.json(site, { status: 201 });
});
