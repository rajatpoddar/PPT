"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";

interface Resource {
  id: string;
  name: string;
  status: string;
  arrivedAt?: string | null;
}

export interface ResourceChecklistProps {
  resources: Resource[];
  planId: string;
}

function formatArrivalTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

/**
 * ResourceChecklist — card-based list of resources for the Supervisor's Execution View.
 * Requirements: 5.1, 5.2, 5.3, 10.1, 10.3, 10.5
 */
export default function ResourceChecklist({ resources: initialResources }: ResourceChecklistProps) {
  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleMarkArrived(resourceId: string) {
    if (loadingIds.has(resourceId)) return;
    setErrors((prev) => { const next = { ...prev }; delete next[resourceId]; return next; });
    setLoadingIds((prev) => new Set(prev).add(resourceId));

    try {
      const response = await fetch(`/api/resources/${resourceId}/arrive`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setErrors((prev) => ({ ...prev, [resourceId]: body?.error ?? `Request failed with status ${response.status}` }));
        return;
      }
      const updated: Resource = await response.json();
      setResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      setErrors((prev) => ({ ...prev, [resourceId]: "Network error. Please try again." }));
    } finally {
      setLoadingIds((prev) => { const next = new Set(prev); next.delete(resourceId); return next; });
    }
  }

  if (resources.length === 0) {
    return (
      <section aria-label="Resource checklist">
        <p className="text-sm text-gray-500 italic">No resources assigned to this plan.</p>
      </section>
    );
  }

  return (
    <section aria-label="Resource checklist">
      <h2 className="mb-3 text-base font-semibold text-gray-900">Resource Checklist</h2>
      <ul className="flex flex-col gap-3" aria-label="Resources">
        {resources.map((resource) => {
          const isPending = resource.status === "PENDING";
          const isLoading = loadingIds.has(resource.id);
          const errorMsg = errors[resource.id];

          return (
            <li key={resource.id} className={["rounded-2xl border bg-white p-4 shadow-sm transition-colors duration-100", isPending ? "border-gray-200" : "border-green-200 bg-green-50"].join(" ")}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {isPending ? (
                      <Clock className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                    )}
                    <span className="truncate text-sm font-medium text-gray-900">{resource.name}</span>
                  </div>
                  {isPending ? (
                    <span className="text-xs text-amber-600 font-medium">Pending</span>
                  ) : (
                    <span className="text-xs text-green-700 font-medium">
                      Arrived{resource.arrivedAt ? ` · ${formatArrivalTime(resource.arrivedAt)}` : ""}
                    </span>
                  )}
                </div>

                {isPending && (
                  <button
                    type="button"
                    onClick={() => handleMarkArrived(resource.id)}
                    disabled={isLoading}
                    aria-label={`Mark ${resource.name} as arrived`}
                    aria-busy={isLoading}
                    className={["flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-blue-500", isLoading ? "cursor-not-allowed bg-blue-300 text-white" : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"].join(" ")}>
                    {isLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>Marking…</span></>
                    ) : "Mark Arrived"}
                  </button>
                )}
              </div>
              {errorMsg && <p role="alert" className="mt-2 text-xs text-red-600">{errorMsg}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
