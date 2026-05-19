import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DPRForm from "./DPRForm";

/**
 * DPR page — Supervisor's end-of-day Daily Progress Report submission.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 10.1, 10.5
 */
export default async function DprPage() {
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
  const todayMidnightUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const plan =
    siteId != null
      ? await prisma.dailyPlan.findFirst({
          where: { siteId, date: todayMidnightUTC },
          include: { report: true },
        })
      : null;

  // ---------------------------------------------------------------------------
  // No plan for today
  // ---------------------------------------------------------------------------
  if (!plan) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Daily Progress Report
          </h1>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-6 py-8 text-center">
          <AlertCircle
            className="mx-auto mb-3 h-10 w-10 text-amber-500"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-amber-800">
            No plan found for today. Please contact your Admin.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // DPR already submitted
  // ---------------------------------------------------------------------------
  if (plan.report) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Daily Progress Report
          </h1>
        </div>
        <div className="rounded-lg border border-green-300 bg-green-50 px-6 py-8 text-center">
          <CheckCircle2
            className="mx-auto mb-3 h-10 w-10 text-green-500"
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold text-green-800">
            DPR Already Submitted
          </h2>
          <p className="mt-2 text-sm text-green-700">
            The Daily Progress Report for today has already been submitted.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-left rounded-lg bg-white p-4 ring-1 ring-green-200">
            <div>
              <p className="text-xs text-gray-500">Masons</p>
              <p className="text-sm font-semibold text-gray-800">
                {plan.report.masons}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Helpers</p>
              <p className="text-sm font-semibold text-gray-800">
                {plan.report.helpers}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Length</p>
              <p className="text-sm font-semibold text-gray-800">
                {plan.report.length} m
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Breadth</p>
              <p className="text-sm font-semibold text-gray-800">
                {plan.report.breadth} m
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Height</p>
              <p className="text-sm font-semibold text-gray-800">
                {plan.report.height} m
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Submitted At</p>
              <p className="text-sm font-semibold text-gray-800">
                {plan.report.submittedAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render the DPR form
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Daily Progress Report
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Submit today&apos;s end-of-day report with manpower counts, work
          dimensions, and an optional voice remark.
        </p>
      </div>

      <DPRForm planId={plan.id} />
    </div>
  );
}
