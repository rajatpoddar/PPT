"use client";

import { AlertCircle, X } from "lucide-react";

export interface ErrorBannerProps {
  /** The error message to display. */
  message: string;
  /** Called when the user dismisses the banner. */
  onDismiss?: () => void;
}

/**
 * ErrorBanner — dismissible error message with Lucide AlertCircle icon.
 *
 * Requirements: 10.5, 10.6
 */
export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <AlertCircle
        className="mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="ml-auto shrink-0 rounded p-0.5 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors duration-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
