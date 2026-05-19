import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MorningBriefingCard from "@/components/MorningBriefingCard";
import ResourceChecklist from "@/components/ResourceChecklist";
import PhotoUploader from "@/components/PhotoUploader";

/**
 * ExecutionView page — Supervisor's morning briefing and real-time check-in view.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 10.2, 10.3
 */
export default async function ExecutionPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { siteId: true },
  });

  const siteId = dbUser?.siteId ?? null;

  const now = new Date();
  const todayMidnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const rawPlan = siteId != null
    ? await prisma.dailyPlan.findFirst({
        where: { siteId, date: todayMidnightUTC },
        include: { resources: true, photos: { orderBy: { uploadedAt: "desc" } }, site: true },
      })
    : null;

  let goals: string[] = [];
  if (rawPlan?.goals) {
    try {
      const parsed = JSON.parse(rawPlan.goals);
      goals = Array.isArray(parsed) ? parsed : [];
    } catch { goals = []; }
  }

  const plan = rawPlan ? {
    goals,
    voiceNoteUrl: rawPlan.voiceNoteUrl ?? null,
    date: rawPlan.date.toISOString(),
    site: { name: rawPlan.site.name },
  } : null;

  const resources = rawPlan ? rawPlan.resources.map((r) => ({
    id: r.id, name: r.name, status: r.status,
    arrivedAt: r.arrivedAt ? r.arrivedAt.toISOString() : null,
  })) : [];

  const photos = rawPlan ? rawPlan.photos.map((p) => ({
    id: p.id, url: p.url, uploadedAt: p.uploadedAt.toISOString(),
  })) : [];

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
      <MorningBriefingCard plan={plan} />
      {rawPlan && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <ResourceChecklist resources={resources} planId={rawPlan.id} />
        </section>
      )}
      {rawPlan && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <PhotoUploader planId={rawPlan.id} initialPhotos={photos} />
        </section>
      )}
    </main>
  );
}
