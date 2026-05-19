import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { MapPin, Plus, ClipboardList } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LiveTimeline from "@/components/LiveTimeline";

/**
 * AdminDashboard page — renders SiteList and LiveTimeline.
 * Desktop: side-by-side CSS grid. Mobile: stacked.
 * Requirements: 2.3, 8.1, 10.2
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // Fetch all sites for the site list and timeline filter
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, location: true },
  });

  // Fetch today's initial timeline events (server-side for fast first paint)
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const plans = await prisma.dailyPlan.findMany({
    where: { date: todayStart },
    select: {
      id: true,
      siteId: true,
      site: { select: { name: true } },
    },
  });

  const planIds = plans.map((p) => p.id);
  const planMap = new Map(plans.map((p) => [p.id, p]));

  type TimelineEventType = {
    id: string;
    type: "RESOURCE_ARRIVED" | "PHOTO_UPLOADED" | "DPR_SUBMITTED";
    siteId: string;
    siteName: string;
    timestamp: string;
    payload: {
      resourceName?: string;
      photoUrl?: string;
      thumbnailUrl?: string;
      voiceRemarkUrl?: string;
    };
  };

  const initialEvents: TimelineEventType[] = [];

  if (planIds.length > 0) {
    const arrivals = await prisma.resourceTrack.findMany({
      where: {
        planId: { in: planIds },
        status: "ARRIVED",
        arrivedAt: { gte: todayStart, lt: todayEnd },
      },
      select: { id: true, planId: true, name: true, arrivedAt: true },
    });

    for (const arrival of arrivals) {
      const plan = planMap.get(arrival.planId);
      if (!plan || !arrival.arrivedAt) continue;
      initialEvents.push({
        id: `resource-${arrival.id}`,
        type: "RESOURCE_ARRIVED",
        siteId: plan.siteId,
        siteName: plan.site.name,
        timestamp: arrival.arrivedAt.toISOString(),
        payload: { resourceName: arrival.name },
      });
    }

    const photos = await prisma.sitePhoto.findMany({
      where: {
        planId: { in: planIds },
        uploadedAt: { gte: todayStart, lt: todayEnd },
      },
      select: { id: true, planId: true, url: true, uploadedAt: true },
    });

    for (const photo of photos) {
      const plan = planMap.get(photo.planId);
      if (!plan) continue;
      initialEvents.push({
        id: `photo-${photo.id}`,
        type: "PHOTO_UPLOADED",
        siteId: plan.siteId,
        siteName: plan.site.name,
        timestamp: photo.uploadedAt.toISOString(),
        payload: { photoUrl: photo.url, thumbnailUrl: photo.url },
      });
    }

    const reports = await prisma.dailyReport.findMany({
      where: {
        planId: { in: planIds },
        submittedAt: { gte: todayStart, lt: todayEnd },
      },
      select: { id: true, planId: true, submittedAt: true, voiceRemarkUrl: true },
    });

    for (const report of reports) {
      const plan = planMap.get(report.planId);
      if (!plan) continue;
      initialEvents.push({
        id: `dpr-${report.id}`,
        type: "DPR_SUBMITTED",
        siteId: plan.siteId,
        siteName: plan.site.name,
        timestamp: report.submittedAt.toISOString(),
        payload: {
          voiceRemarkUrl: report.voiceRemarkUrl ?? undefined,
        },
      });
    }

    // Sort descending
    initialEvents.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor site activity and manage your construction sites.
          </p>
        </div>
        <Link
          href="/admin/sites/new"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Site
        </Link>
      </div>

      {/* Desktop: side-by-side grid. Mobile: stacked. — Requirement 10.2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Site list — Requirement 2.3 */}
        <aside aria-labelledby="sites-heading">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="sites-heading"
                className="text-base font-semibold text-gray-800"
              >
                Sites
              </h2>
              <Link
                href="/admin/sites"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
              >
                View all
              </Link>
            </div>

            {sites.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                <MapPin
                  className="mx-auto mb-2 h-8 w-8 text-gray-300"
                  aria-hidden="true"
                />
                <p className="text-sm text-gray-500">No sites yet.</p>
                <Link
                  href="/admin/sites/new"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Create your first site
                </Link>
              </div>
            ) : (
              <ul role="list" className="flex flex-col gap-3" aria-label="Sites">
                {sites.map((site) => (
                  <li key={site.id}>
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:border-blue-200 hover:bg-blue-50 transition-colors duration-100">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {site.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 truncate">
                          <MapPin
                            className="h-3 w-3 shrink-0"
                            aria-hidden="true"
                          />
                          {site.location}
                        </p>
                      </div>
                      <Link
                        href={`/admin/plans/new?siteId=${site.id}`}
                        aria-label={`Create plan for ${site.name}`}
                        className="shrink-0 flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 min-h-[44px] text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <ClipboardList
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Plan
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Live Timeline — Requirement 8.1 */}
        <section aria-labelledby="timeline-heading">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <LiveTimeline
              initialEvents={initialEvents}
              sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
