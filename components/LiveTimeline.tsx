"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import TimelineEventCard from "./TimelineEvent";
import type { TimelineEvent } from "@/app/api/timeline/route";

export interface LiveTimelineProps {
  /** Initial events fetched server-side (optional). */
  initialEvents?: TimelineEvent[];
  /** List of sites for the filter dropdown. */
  sites?: { id: string; name: string }[];
}

const RECONNECT_THRESHOLD_MS = 30_000; // 30 seconds
const POLL_INTERVAL_MS = 5_000; // 5 seconds fallback polling

/**
 * LiveTimeline — Admin's real-time feed of site events.
 *
 * - Opens EventSource('/api/timeline/stream') on mount.
 * - Falls back to polling GET /api/timeline every 5 seconds if EventSource is unavailable.
 * - Shows "Reconnecting…" indicator if SSE connection drops for > 30 seconds.
 * - Includes site filter <select> that filters displayed events client-side.
 *
 * Requirements: 8.1, 8.4, 8.6
 */
export default function LiveTimeline({
  initialEvents = [],
  sites = [],
}: LiveTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [siteFilter, setSiteFilter] = useState<string>("");
  const [isReconnecting, setIsReconnecting] = useState(false);

  const lastEventIdRef = useRef<string>("");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const usingSseRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Prepend new events (deduplicating by id)
  // ---------------------------------------------------------------------------
  function prependEvents(newEvents: TimelineEvent[]) {
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const fresh = newEvents.filter((e) => !existingIds.has(e.id));
      if (fresh.length === 0) return prev;
      // Merge and re-sort descending
      const merged = [...fresh, ...prev];
      merged.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return merged;
    });
  }

  // ---------------------------------------------------------------------------
  // Polling fallback
  // ---------------------------------------------------------------------------
  function startPolling() {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/timeline");
        if (res.ok) {
          const data: TimelineEvent[] = await res.json();
          prependEvents(data);
          setIsReconnecting(false);
        }
      } catch {
        // Network error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  // ---------------------------------------------------------------------------
  // SSE connection
  // ---------------------------------------------------------------------------
  function startSSE() {
    if (typeof window === "undefined" || !window.EventSource) {
      // SSE not available — fall back to polling
      startPolling();
      return;
    }

    usingSseRef.current = true;

    const url = lastEventIdRef.current
      ? `/api/timeline/stream`
      : `/api/timeline/stream`;

    const source = new EventSource(url);
    sourceRef.current = source;

    // Start reconnect timer — if no message received within threshold, show indicator
    function resetReconnectTimer() {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      setIsReconnecting(false);
      reconnectTimerRef.current = setTimeout(() => {
        setIsReconnecting(true);
      }, RECONNECT_THRESHOLD_MS);
    }

    resetReconnectTimer();

    source.addEventListener("timeline", (e: MessageEvent) => {
      resetReconnectTimer();
      try {
        const event: TimelineEvent = JSON.parse(e.data as string);
        lastEventIdRef.current = e.lastEventId || event.id;
        prependEvents([event]);
      } catch {
        // Malformed event — ignore
      }
    });

    source.onopen = () => {
      resetReconnectTimer();
      setIsReconnecting(false);
    };

    source.onerror = () => {
      // EventSource will auto-retry; show reconnecting indicator after threshold
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        setIsReconnecting(true);
      }, RECONNECT_THRESHOLD_MS);
    };
  }

  function stopSSE() {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Mount / unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    startSSE();

    return () => {
      stopSSE();
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Filtered events (client-side site filter)
  // ---------------------------------------------------------------------------
  const filteredEvents = siteFilter
    ? events.filter((e) => e.siteId === siteFilter)
    : events;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-800">
          Live Timeline
        </h2>

        {/* Site filter — Requirement 8.6 */}
        {sites.length > 0 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="timeline-site-filter"
              className="text-xs font-medium text-gray-600 whitespace-nowrap"
            >
              Filter by site:
            </label>
            <select
              id="timeline-site-filter"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Reconnecting indicator — shown when SSE drops for > 30 seconds */}
      {isReconnecting && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-700"
        >
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Reconnecting to live feed…</span>
          <RefreshCw
            className="ml-auto h-4 w-4 animate-spin"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Event list */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
          <p className="text-sm text-gray-500">
            {siteFilter
              ? "No events for the selected site today."
              : "No events yet today. Events will appear here as the Supervisor works on-site."}
          </p>
        </div>
      ) : (
        <ol
          aria-label="Timeline events"
          className="flex flex-col gap-3"
        >
          {filteredEvents.map((event) => (
            <li key={event.id}>
              <TimelineEventCard event={event} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
