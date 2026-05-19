"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, X } from "lucide-react";
import { z } from "zod";

import GoalEditor from "@/components/GoalEditor";
import ResourceLineupBuilder from "@/components/ResourceLineupBuilder";
import VoiceRecorder from "@/components/VoiceRecorder";

// ---------------------------------------------------------------------------
// Client-side form schema
// ---------------------------------------------------------------------------
const clientPlanSchema = z.object({
  siteId: z
    .string({ required_error: "Site is required" })
    .trim()
    .min(1, "Site is required"),
  date: z
    .string({ required_error: "Date is required" })
    .trim()
    .min(1, "Date is required"),
  goals: z
    .array(
      z.string({ required_error: "Goal must be a string" }).trim().min(1, "Goal must not be empty"),
      { required_error: "Goals are required" }
    )
    .min(1, "At least one goal is required"),
  resources: z
    .array(
      z.object({
        name: z.string({ required_error: "Resource name is required" }).trim().min(1, "Resource name must not be empty"),
      }),
      { required_error: "Resources are required" }
    )
    .min(1, "At least one resource is required"),
});

type ClientPlanFormValues = z.infer<typeof clientPlanSchema>;

interface Site {
  id: string;
  name: string;
  location: string;
}

function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex items-center gap-2 text-sm text-gray-500">
      <svg className="h-4 w-4 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </span>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="ml-auto shrink-0 rounded p-0.5 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function ValidationMessage({ message }: { message: string }) {
  return <p role="alert" className="mt-1 text-xs text-red-600">{message}</p>;
}

function NewPlanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSiteId = searchParams.get("siteId") ?? "";

  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, control, formState: { errors } } = useForm<ClientPlanFormValues>({
    resolver: zodResolver(clientPlanSchema),
    defaultValues: {
      siteId: preselectedSiteId,
      date: "",
      goals: [""],
      resources: [{ name: "" }],
    },
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchSites() {
      setSitesLoading(true);
      setSitesError(null);
      try {
        const res = await fetch("/api/sites");
        if (!res.ok) { setSitesError("Failed to load sites. Please refresh the page."); return; }
        const data: Site[] = await res.json();
        if (!cancelled) setSites(data);
      } catch {
        if (!cancelled) setSitesError("Network error loading sites. Please refresh the page.");
      } finally {
        if (!cancelled) setSitesLoading(false);
      }
    }
    fetchSites();
    return () => { cancelled = true; };
  }, []);

  const handleRecordingComplete = useCallback((blob: Blob) => { setVoiceBlob(blob); }, []);

  const onSubmit = async (data: ClientPlanFormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    let voiceNoteUrl: string | undefined;

    if (voiceBlob) {
      try {
        const formData = new FormData();
        // Normalise to audio/webm so the upload API accepts it regardless of codec suffix
        const audioBlob = new Blob([voiceBlob], { type: 'audio/webm' });
        formData.append("file", audioBlob, "voice-note.webm");
        const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          voiceNoteUrl = uploadData.url as string;
        } else {
          console.error("[voice upload] failed:", uploadRes.status, await uploadRes.text());
        }
      } catch (err) { console.error("[voice upload] error:", err); /* continue without voice note */ }
    }

    try {
      const payload = { siteId: data.siteId, date: data.date, goals: data.goals, resources: data.resources, ...(voiceNoteUrl ? { voiceNoteUrl } : {}) };
      const res = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { router.push("/admin/dashboard"); return; }
      if (res.status === 409) { setServerError("A plan for this site and date already exists. Please choose a different date or site."); return; }
      if (res.status === 422) {
        const body = await res.json();
        const firstError = Object.values(body.errors as Record<string, string[]>).flat().at(0) ?? "Validation failed.";
        setServerError(firstError); return;
      }
      if (res.status === 401 || res.status === 403) { setServerError("You are not authorised to create plans."); return; }
      setServerError("An unexpected error occurred. Please try again.");
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Plan</h1>
        <p className="mt-1 text-sm text-gray-500">Set up tomorrow&apos;s goals, resource lineup, and voice instructions for your site.</p>
      </div>

      {serverError && (
        <div className="mb-6">
          <ErrorBanner message={serverError} onDismiss={() => setServerError(null)} />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <section aria-labelledby="section-site-date" className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 id="section-site-date" className="mb-4 text-base font-semibold text-gray-800">Site &amp; Date</h2>
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="siteId" className="mb-1 block text-sm font-medium text-gray-700">Site <span aria-hidden="true" className="text-red-500">*</span></label>
              {sitesLoading ? (
                <div className="flex min-h-[44px] items-center"><LoadingSpinner label="Loading sites…" /></div>
              ) : sitesError ? (
                <p className="text-sm text-red-600">{sitesError}</p>
              ) : (
                <select id="siteId" aria-required="true" aria-invalid={!!errors.siteId} {...register("siteId")}
                  className={["block w-full min-h-[44px] rounded-md border px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500", errors.siteId ? "border-red-400 bg-red-50" : "border-gray-300"].join(" ")}>
                  <option value="">— Select a site —</option>
                  {sites.map((site) => (<option key={site.id} value={site.id}>{site.name}</option>))}
                </select>
              )}
              {errors.siteId && <ValidationMessage message={errors.siteId.message!} />}
            </div>
            <div className="flex-1">
              <label htmlFor="date" className="mb-1 block text-sm font-medium text-gray-700">Date <span aria-hidden="true" className="text-red-500">*</span></label>
              <input id="date" type="date" aria-required="true" aria-invalid={!!errors.date} {...register("date")}
                className={["block w-full min-h-[44px] rounded-md border px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500", errors.date ? "border-red-400 bg-red-50" : "border-gray-300"].join(" ")} />
              {errors.date && <ValidationMessage message={errors.date.message!} />}
            </div>
          </div>
        </section>

        <section aria-labelledby="section-goals" className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 id="section-goals" className="mb-4 text-base font-semibold text-gray-800">Goals</h2>
          <GoalEditor control={control} name="goals" errors={errors} />
        </section>

        <section aria-labelledby="section-resources" className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 id="section-resources" className="mb-4 text-base font-semibold text-gray-800">Resource Lineup</h2>
          <ResourceLineupBuilder control={control} name="resources" errors={errors} />
        </section>

        <section aria-labelledby="section-voice" className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 id="section-voice" className="mb-1 text-base font-semibold text-gray-800">Voice Instruction</h2>
          <p className="mb-4 text-sm text-gray-500">Optional — record a voice note for the Supervisor.</p>
          <VoiceRecorder onRecordingComplete={handleRecordingComplete} label="" disabled={isSubmitting} />
        </section>

        {isSubmitting && <div className="flex justify-center py-2"><LoadingSpinner label="Saving plan…" /></div>}

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button type="submit" disabled={isSubmitting}
            className={["flex w-full items-center justify-center rounded-md px-6 py-3 min-h-[44px] text-sm font-semibold text-white sm:w-auto transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", isSubmitting ? "cursor-not-allowed bg-blue-400" : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"].join(" ")}>
            {isSubmitting ? "Saving…" : "Create Plan"}
          </button>
          <button type="button" onClick={() => router.push("/admin/dashboard")} disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 min-h-[44px] text-sm font-medium text-gray-700 sm:w-auto hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

import { Suspense } from "react";

export default function NewPlanPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><span className="text-sm text-gray-500">Loading…</span></div>}>
      <NewPlanForm />
    </Suspense>
  );
}
