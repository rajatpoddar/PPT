"use client";

import { useState } from "react";
import { Truck, Camera, FileText, X, Mic } from "lucide-react";
import type { TimelineEvent as TimelineEventType } from "@/app/api/timeline/route";

export interface TimelineEventProps {
  event: TimelineEventType;
}

/**
 * TimelineEvent card component.
 *
 * Renders a single timeline event with:
 * - Timestamp badge
 * - Event type icon (Lucide)
 * - Site name
 * - For PHOTO_UPLOADED: thumbnail image with click-to-fullsize
 *
 * Requirements: 8.3, 8.5, 8.7
 */
export default function TimelineEvent({ event }: TimelineEventProps) {
  const [fullsizeOpen, setFullsizeOpen] = useState(false);

  const formattedTime = new Date(event.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Event type metadata
  const eventMeta = {
    RESOURCE_ARRIVED: {
      icon: <Truck className="h-4 w-4" aria-hidden="true" />,
      label: "Resource Arrived",
      color: "bg-blue-100 text-blue-700 border-blue-200",
      iconBg: "bg-blue-100 text-blue-600",
    },
    PHOTO_UPLOADED: {
      icon: <Camera className="h-4 w-4" aria-hidden="true" />,
      label: "Photo Uploaded",
      color: "bg-green-100 text-green-700 border-green-200",
      iconBg: "bg-green-100 text-green-600",
    },
    DPR_SUBMITTED: {
      icon: <FileText className="h-4 w-4" aria-hidden="true" />,
      label: "DPR Submitted",
      color: "bg-purple-100 text-purple-700 border-purple-200",
      iconBg: "bg-purple-100 text-purple-600",
    },
  }[event.type];

  return (
    <>
      {/* Event card */}
      <article
        aria-label={`${eventMeta.label} at ${event.siteName} — ${formattedTime}`}
        className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        {/* Event type icon */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${eventMeta.iconBg}`}
          aria-hidden="true"
        >
          {eventMeta.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row: event type label + timestamp badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${eventMeta.color}`}
            >
              {eventMeta.label}
            </span>
            <time
              dateTime={event.timestamp}
              className="text-xs text-gray-400 tabular-nums"
            >
              {formattedTime}
            </time>
          </div>

          {/* Site name */}
          <p className="mt-1 text-sm font-medium text-gray-800 truncate">
            {event.siteName}
          </p>

          {/* Resource name for RESOURCE_ARRIVED */}
          {event.type === "RESOURCE_ARRIVED" && event.payload.resourceName && (
            <p className="mt-0.5 text-xs text-gray-500">
              {event.payload.resourceName}
            </p>
          )}

          {/* Photo thumbnail for PHOTO_UPLOADED — Requirement 8.5 */}
          {event.type === "PHOTO_UPLOADED" && event.payload.thumbnailUrl && (
            <button
              type="button"
              onClick={() => setFullsizeOpen(true)}
              aria-label="View full-size photo"
              className="mt-2 block overflow-hidden rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-opacity duration-100 hover:opacity-90 active:opacity-75"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.payload.thumbnailUrl}
                alt="Site photo thumbnail"
                className="h-20 w-32 object-cover"
                loading="lazy"
              />
            </button>
          )}

          {/* Supervisor voice remark for DPR_SUBMITTED */}
          {event.type === "DPR_SUBMITTED" && event.payload.voiceRemarkUrl && (
            <div className="mt-2">
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-orange-600">
                <Mic className="h-3 w-3" aria-hidden="true" />
                Supervisor Voice Remark
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                src={event.payload.voiceRemarkUrl}
                controls
                aria-label="Supervisor voice remark"
                className="w-full rounded-lg"
                preload="metadata"
              />
            </div>
          )}
        </div>
      </article>

      {/* Full-size image modal — Requirement 8.7 */}
      {fullsizeOpen && event.payload.photoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full-size site photo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setFullsizeOpen(false)}
        >
          <div
            className="relative max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setFullsizeOpen(false)}
              aria-label="Close full-size photo"
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <X className="h-4 w-4 text-gray-700" aria-hidden="true" />
            </button>

            {/* Full-size image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.payload.photoUrl}
              alt="Full-size site photo"
              className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
