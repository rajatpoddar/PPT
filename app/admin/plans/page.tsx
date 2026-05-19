"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList, Plus, MapPin, Calendar, Trash2, Pencil,
  X, Check, Loader2, Volume2, Mic
} from "lucide-react";

interface Resource { id: string; name: string; status: string; }
interface Report { id: string; voiceRemarkUrl?: string | null; }
interface Plan {
  id: string;
  date: string;
  goals: string[];
  status: string;
  voiceNoteUrl?: string | null;
  site: { id: string; name: string };
  resources: Resource[];
  report: Report | null;
}

const DEFAULT_RESOURCES = [
  "JCB", "Water Tanker", "Cement", "Sand", "Cherry Picker",
  "Chips", "Stones", "Boulders", "Poplen", "Tractor", "Camper",
];

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Expand voice remark
  const [expandedVoice, setExpandedVoice] = useState<string | null>(null);

  useEffect(() => { fetchPlans(); }, []);

  async function fetchPlans() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to load plans");
      setPlans(await res.json());
    } catch {
      setError("Failed to load plans. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  async function deletePlan(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/plans/${id}`, { method: "DELETE" });
      if (!res.ok) { alert("Failed to delete plan."); return; }
      setPlans((prev) => prev.filter((p) => p.id !== id));
      setConfirmDeleteId(null);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
          <p className="mt-1 text-sm text-gray-500">All daily plans across your sites.</p>
        </div>
        <Link
          href="/admin/plans/new"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Plan
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && plans.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-gray-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-gray-700">No plans yet</h2>
          <p className="mt-1 text-sm text-gray-500">Create your first daily plan for a site.</p>
          <Link
            href="/admin/plans/new"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 transition-colors duration-150"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Plan
          </Link>
        </div>
      )}

      {!loading && plans.length > 0 && (
        <ul role="list" className="flex flex-col gap-4" aria-label="Plans list">
          {plans.map((plan) => {
            const statusColor =
              plan.status === "COMPLETED"
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-amber-100 text-amber-700 border-amber-200";

            return (
              <li key={plan.id}>
                {confirmDeleteId === plan.id ? (
                  <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-red-300">
                    <p className="text-sm font-medium text-gray-800 mb-1">
                      Delete plan for <span className="font-bold">{plan.site.name}</span> on{" "}
                      {new Date(plan.date).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}?
                    </p>
                    <p className="text-xs text-red-600 mb-3">This will permanently delete the plan, all resources, photos, and the DPR.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deletePlan(plan.id)}
                        disabled={deletingId === plan.id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-2 min-h-[44px] text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <article className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200 hover:ring-blue-200 transition-shadow duration-150">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{plan.site.name}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                          {new Date(plan.date).toLocaleDateString(undefined, {
                            weekday: "short", year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                          {plan.status === "COMPLETED" ? "Completed" : "Pending"}
                        </span>
                        <Link
                          href={`/admin/plans/${plan.id}/edit`}
                          aria-label="Edit plan"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => setConfirmDeleteId(plan.id)}
                          aria-label="Delete plan"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Goals preview */}
                    {plan.goals.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-1">
                        {plan.goals.slice(0, 3).map((goal, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                            {goal}
                          </li>
                        ))}
                        {plan.goals.length > 3 && (
                          <li className="text-xs text-gray-400">+{plan.goals.length - 3} more goal{plan.goals.length - 3 > 1 ? "s" : ""}</li>
                        )}
                      </ul>
                    )}

                    {/* Resources */}
                    {plan.resources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {plan.resources.slice(0, 6).map((r) => (
                          <span
                            key={r.id}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.status === "ARRIVED"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {r.name}
                          </span>
                        ))}
                        {plan.resources.length > 6 && (
                          <span className="text-xs text-gray-400">+{plan.resources.length - 6} more</span>
                        )}
                      </div>
                    )}

                    {/* Admin voice note */}
                    {plan.voiceNoteUrl && (
                      <div className="mt-3">
                        <button
                          onClick={() => setExpandedVoice(expandedVoice === `admin-${plan.id}` ? null : `admin-${plan.id}`)}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          {expandedVoice === `admin-${plan.id}` ? "Hide" : "Play"} Admin Voice Note
                        </button>
                        {expandedVoice === `admin-${plan.id}` && (
                          <audio src={plan.voiceNoteUrl} controls className="mt-2 w-full rounded-lg" aria-label="Admin voice note" />
                        )}
                      </div>
                    )}

                    {/* Supervisor voice remark from DPR */}
                    {plan.report?.voiceRemarkUrl && (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpandedVoice(expandedVoice === `sup-${plan.id}` ? null : `sup-${plan.id}`)}
                          className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700"
                        >
                          <Mic className="h-3.5 w-3.5" />
                          {expandedVoice === `sup-${plan.id}` ? "Hide" : "Play"} Supervisor Voice Remark
                        </button>
                        {expandedVoice === `sup-${plan.id}` && (
                          <audio src={plan.report.voiceRemarkUrl} controls className="mt-2 w-full rounded-lg" aria-label="Supervisor voice remark" />
                        )}
                      </div>
                    )}

                    <p className="mt-3 text-xs text-gray-400">
                      {plan.resources.length} resource{plan.resources.length !== 1 ? "s" : ""} ·{" "}
                      {plan.report ? "DPR submitted" : "DPR pending"}
                    </p>
                  </article>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
