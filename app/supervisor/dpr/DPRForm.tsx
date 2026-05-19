"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { AlertCircle, X, CheckCircle2 } from "lucide-react";
import { z } from "zod";

import VoiceRecorder from "@/components/VoiceRecorder";

// ---------------------------------------------------------------------------
// Client-side form schema
// ---------------------------------------------------------------------------
const clientDprSchema = z.object({
  masons: z
    .string({ required_error: "Masons count is required" })
    .trim()
    .min(1, "Masons count is required")
    .refine((v) => /^\d+$/.test(v), "Masons must be a non-negative integer"),
  helpers: z
    .string({ required_error: "Helpers count is required" })
    .trim()
    .min(1, "Helpers count is required")
    .refine((v) => /^\d+$/.test(v), "Helpers must be a non-negative integer"),
  length: z
    .string({ required_error: "Length is required" })
    .trim()
    .min(1, "Length is required")
    .refine(
      (v) => !isNaN(Number(v)) && Number(v) > 0,
      "Length must be a positive number"
    ),
  breadth: z
    .string({ required_error: "Breadth is required" })
    .trim()
    .min(1, "Breadth is required")
    .refine(
      (v) => !isNaN(Number(v)) && Number(v) > 0,
      "Breadth must be a positive number"
    ),
  height: z
    .string({ required_error: "Height is required" })
    .trim()
    .min(1, "Height is required")
    .refine(
      (v) => !isNaN(Number(v)) && Number(v) > 0,
      "Height must be a positive number"
    ),
});

type ClientDprFormValues = z.infer<typeof clientDprSchema>;

// ---------------------------------------------------------------------------
// Inline shared components (will be replaced by task 10.1 shared components)
// ---------------------------------------------------------------------------

function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-flex items-center gap-2 text-sm text-gray-500"
    >
      <svg
        className="h-4 w-4 animate-spin text-blue-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      {label}
    </span>
  );
}

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="ml-auto shrink-0 rounded p-0.5 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function ValidationMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// DPRForm component props
// ---------------------------------------------------------------------------

export interface DPRFormProps {
  planId: string;
}

// ---------------------------------------------------------------------------
// DPRForm component
// ---------------------------------------------------------------------------

/**
 * DPRForm — client component for submitting the Daily Progress Report.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 10.1, 10.5
 */
export default function DPRForm({ planId }: DPRFormProps) {
  const router = useRouter();

  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientDprFormValues>({
    resolver: zodResolver(clientDprSchema),
    defaultValues: {
      masons: "",
      helpers: "",
      length: "",
      breadth: "",
      height: "",
    },
  });

  const handleRecordingComplete = useCallback((blob: Blob) => {
    setVoiceBlob(blob);
  }, []);

  const onSubmit = async (data: ClientDprFormValues) => {
    setServerError(null);
    setIsSubmitting(true);

    let voiceRemarkUrl: string | undefined;

    // Upload voice remark if recorded (Requirement 7.3, 7.7)
    if (voiceBlob) {
      try {
        const formData = new FormData();
        formData.append("file", voiceBlob, "voice-remark.webm");
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          voiceRemarkUrl = uploadData.url as string;
        }
        // If upload fails, continue without voice remark (Requirement 7.7)
      } catch {
        // Continue without voice remark
      }
    }

    try {
      const payload = {
        planId,
        masons: Number(data.masons),
        helpers: Number(data.helpers),
        length: Number(data.length),
        breadth: Number(data.breadth),
        height: Number(data.height),
        ...(voiceRemarkUrl ? { voiceRemarkUrl } : {}),
      };

      const res = await fetch("/api/dpr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitted(true);
        return;
      }

      if (res.status === 409) {
        setServerError(
          "A Daily Progress Report has already been submitted for today's plan."
        );
        return;
      }

      if (res.status === 422) {
        const body = await res.json();
        const firstError =
          Object.values(body.errors as Record<string, string[]>)
            .flat()
            .at(0) ?? "Validation failed.";
        setServerError(firstError);
        return;
      }

      if (res.status === 401 || res.status === 403) {
        setServerError("You are not authorised to submit a DPR.");
        return;
      }

      setServerError("An unexpected error occurred. Please try again.");
    } catch {
      setServerError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render: success state
  // ---------------------------------------------------------------------------
  if (submitted) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 px-6 py-8 text-center">
        <CheckCircle2
          className="mx-auto mb-3 h-10 w-10 text-green-500"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold text-green-800">
          DPR Submitted Successfully
        </h2>
        <p className="mt-2 text-sm text-green-700">
          Your Daily Progress Report has been recorded. The plan is now marked
          as completed.
        </p>
        <button
          type="button"
          onClick={() => router.push("/supervisor/execution")}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-green-600 px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-100"
        >
          Back to Execution View
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: form
  // ---------------------------------------------------------------------------
  return (
    <>
      {serverError && (
        <div className="mb-6">
          <ErrorBanner
            message={serverError}
            onDismiss={() => setServerError(null)}
          />
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-6"
      >
        {/* Manpower section */}
        <section
          aria-labelledby="section-manpower"
          className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200"
        >
          <h2
            id="section-manpower"
            className="mb-4 text-base font-semibold text-gray-800"
          >
            Manpower
          </h2>
          <div className="flex flex-col gap-5 sm:flex-row">
            {/* Masons */}
            <div className="flex-1">
              <label
                htmlFor="masons"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Masons{" "}
                <span aria-hidden="true" className="text-red-500">
                  *
                </span>
              </label>
              <input
                id="masons"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                aria-required="true"
                aria-invalid={!!errors.masons}
                placeholder="0"
                {...register("masons")}
                className={[
                  "block w-full min-h-[44px] rounded-md border px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.masons
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300",
                ].join(" ")}
              />
              {errors.masons && (
                <ValidationMessage message={errors.masons.message!} />
              )}
            </div>

            {/* Helpers */}
            <div className="flex-1">
              <label
                htmlFor="helpers"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Helpers{" "}
                <span aria-hidden="true" className="text-red-500">
                  *
                </span>
              </label>
              <input
                id="helpers"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                aria-required="true"
                aria-invalid={!!errors.helpers}
                placeholder="0"
                {...register("helpers")}
                className={[
                  "block w-full min-h-[44px] rounded-md border px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.helpers
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300",
                ].join(" ")}
              />
              {errors.helpers && (
                <ValidationMessage message={errors.helpers.message!} />
              )}
            </div>
          </div>
        </section>

        {/* Dimensions section */}
        <section
          aria-labelledby="section-dimensions"
          className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200"
        >
          <h2
            id="section-dimensions"
            className="mb-4 text-base font-semibold text-gray-800"
          >
            Work Dimensions
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {/* Length */}
            <div>
              <label
                htmlFor="length"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Length (m){" "}
                <span aria-hidden="true" className="text-red-500">
                  *
                </span>
              </label>
              <input
                id="length"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                aria-required="true"
                aria-invalid={!!errors.length}
                placeholder="0.00"
                {...register("length")}
                className={[
                  "block w-full min-h-[44px] rounded-md border px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.length
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300",
                ].join(" ")}
              />
              {errors.length && (
                <ValidationMessage message={errors.length.message!} />
              )}
            </div>

            {/* Breadth */}
            <div>
              <label
                htmlFor="breadth"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Breadth (m){" "}
                <span aria-hidden="true" className="text-red-500">
                  *
                </span>
              </label>
              <input
                id="breadth"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                aria-required="true"
                aria-invalid={!!errors.breadth}
                placeholder="0.00"
                {...register("breadth")}
                className={[
                  "block w-full min-h-[44px] rounded-md border px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.breadth
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300",
                ].join(" ")}
              />
              {errors.breadth && (
                <ValidationMessage message={errors.breadth.message!} />
              )}
            </div>

            {/* Height */}
            <div>
              <label
                htmlFor="height"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Height (m){" "}
                <span aria-hidden="true" className="text-red-500">
                  *
                </span>
              </label>
              <input
                id="height"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                aria-required="true"
                aria-invalid={!!errors.height}
                placeholder="0.00"
                {...register("height")}
                className={[
                  "block w-full min-h-[44px] rounded-md border px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.height
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300",
                ].join(" ")}
              />
              {errors.height && (
                <ValidationMessage message={errors.height.message!} />
              )}
            </div>
          </div>
        </section>

        {/* Voice remark section */}
        <section
          aria-labelledby="section-voice"
          className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200"
        >
          <h2
            id="section-voice"
            className="mb-1 text-base font-semibold text-gray-800"
          >
            Voice Remark
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Optional — record a voice remark summarising today&apos;s progress.
          </p>
          {/* VoiceRecorder — Requirement 7.3, 7.7, 10.4 */}
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            label=""
            disabled={isSubmitting}
          />
        </section>

        {/* Loading indicator during submission */}
        {isSubmitting && (
          <div className="flex justify-center py-2">
            <LoadingSpinner label="Submitting DPR…" />
          </div>
        )}

        {/* Action buttons — minimum 44×44 tap targets (Requirement 10.1) */}
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="submit"
            disabled={isSubmitting}
            className={[
              "flex w-full items-center justify-center rounded-md px-6 py-3 min-h-[44px] text-sm font-semibold text-white sm:w-auto transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              isSubmitting
                ? "cursor-not-allowed bg-blue-400"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
            ].join(" ")}
          >
            {isSubmitting ? "Submitting…" : "Submit DPR"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/supervisor/execution")}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 min-h-[44px] text-sm font-medium text-gray-700 sm:w-auto hover:bg-gray-50 active:bg-gray-100 transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
