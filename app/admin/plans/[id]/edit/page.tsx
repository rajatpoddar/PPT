"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AlertCircle, X, Loader2, Plus, Trash2 } from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";

const DEFAULT_RESOURCES = [
  "JCB", "Water Tanker", "Cement", "Sand", "Cherry Picker",
  "Chips", "Stones", "Boulders", "Poplen", "Tractor", "Camper",
];

interface Plan {
  id: string;
  date: string;
  goals: string[];
  voiceNoteUrl?: string | null;
  site: { name: string };
  resources: { id: string; name: string; status: string }[];
}

export default function EditPlanPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [goals, setGoals] = useState<string[]>([""]);
  const [resources, setResources] = useState<string[]>([""]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [keepExistingVoice, setKeepExistingVoice] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/plans/${planId}`);
        if (!res.ok) { setLoadError("Plan not found."); return; }
        const data: Plan = await res.json();
        setPlan(data);
        setGoals(data.goals.length > 0 ? data.goals : [""]);
        setResources(data.resources.map((r) => r.name));
      } catch {
        setLoadError("Failed to load plan.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [planId]);

  const handleRecordingComplete = useCallback((blob: Blob) => {
    setVoiceBlob(blob);
    setKeepExistingVoice(false);
  }, []);

  function addGoal() { setGoals((g) => [...g, ""]); }
  function removeGoal(i: number) { setGoals((g) => g.filter((_, idx) => idx !== i)); }
  function updateGoal(i: number, val: string) { setGoals((g) => g.map((v, idx) => idx === i ? val : v)); }

  function addResource(name = "") { setResources((r) => [...r, name]); }
  function removeResource(i: number) { setResources((r) => r.filter((_, idx) => idx !== i)); }
  function updateResource(i: number, val: string) { setResources((r) => r.map((v, idx) => idx === i ? val : v)); }
  function toggleDefaultResource(name: string) {
    if (resources.includes(name)) {
      setResources((r) => r.filter((v) => v !== name));
    } else {
      setResources((r) => [...r.filter((v) => v !== ""), name]);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const cleanGoals = goals.map((g) => g.trim()).filter(Boolean);
    const cleanResources = resources.map((r) => r.trim()).filter(Boolean);

    if (cleanGoals.length === 0) { setServerError("At least one goal is required."); return; }
    if (cleanResources.length === 0) { setServerError("At least one resource is required."); return; }

    setIsSubmitting(true);

    let voiceNoteUrl: string | null | undefined = undefined;

    if (voiceBlob) {
      try {
        const formData = new FormData();
        const audioBlob = new Blob([voiceBlob], { type: 'audio/webm' });
        formData.append("file", audioBlob, "voice-note.webm");
        const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          voiceNoteUrl = uploadData.url as string;
        } else {
          console.error("[voice upload] failed:", uploadRes.status, await uploadRes.text());
        }
      } catch (err) { console.error("[voice upload] error:", err); /* continue without new voice note */ }
    } else if (!keepExistingVoice) {
      voiceNoteUrl = null; // explicitly clear
    }

    try {
      const payload: Record<string, unknown> = {
        goals: cleanGoals,
        resources: cleanResources.map((name) => ({ name })),
      };
      if (voiceNoteUrl !== undefined) payload.voiceNoteUrl = voiceNoteUrl;

      const res = await fetch(`/api/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) { router.push("/admin/plans"); return; }

      if (res.status === 422) {
        const body = await res.json();
        const firstError = Object.values(body.errors as Record<string, string[]>).flat().at(0) ?? "Validation failed.";
        setServerError(firstError); return;
      }
      setServerError("An unexpected error occurred. Please try again.");
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (loadError || !plan) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {loadError ?? "Plan not found."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Plan</h1>
        <p className="mt-1 text-sm text-gray-500">
          {plan.site.name} — {new Date(plan.date).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
        </p>
      </div>

      {serverError && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{serverError}</span>
          <button onClick={() => setServerError(null)} className="ml-auto shrink-0 rounded p-0.5 hover:bg-red-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {/* Goals */}
        <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-base font-semibold text-gray-800">Goals</h2>
          <div className="flex flex-col gap-2">
            {goals.map((goal, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={goal}
                  onChange={(e) => updateGoal(i, e.target.value)}
                  placeholder={`Goal ${i + 1}`}
                  className="min-h-[44px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeGoal(i)}
                  disabled={goals.length <= 1}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addGoal}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-md border-2 border-dashed border-blue-300 px-4 py-2 text-sm font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" />
              Add Goal
            </button>
          </div>
        </section>

        {/* Resources */}
        <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-2 text-base font-semibold text-gray-800">Resource Lineup</h2>
          <p className="mb-3 text-xs text-gray-500">Tap a default resource to add/remove it, or type a custom one below.</p>

          {/* Default resource chips */}
          <div className="mb-4 flex flex-wrap gap-2">
            {DEFAULT_RESOURCES.map((name) => {
              const active = resources.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleDefaultResource(name)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            {resources.map((res, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={res}
                  onChange={(e) => updateResource(i, e.target.value)}
                  placeholder={`Resource ${i + 1}`}
                  className="min-h-[44px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeResource(i)}
                  disabled={resources.length <= 1}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addResource()}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-md border-2 border-dashed border-blue-300 px-4 py-2 text-sm font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" />
              Add Custom Resource
            </button>
          </div>
        </section>

        {/* Voice Note */}
        <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-1 text-base font-semibold text-gray-800">Voice Instruction</h2>
          <p className="mb-4 text-sm text-gray-500">Optional — record a new voice note or keep the existing one.</p>

          {plan.voiceNoteUrl && keepExistingVoice && (
            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="mb-2 text-xs font-medium text-gray-600">Current voice note:</p>
              <audio src={plan.voiceNoteUrl} controls className="w-full rounded-lg" aria-label="Current voice note" />
              <button
                type="button"
                onClick={() => setKeepExistingVoice(false)}
                className="mt-2 text-xs text-red-500 hover:text-red-700"
              >
                Remove existing voice note
              </button>
            </div>
          )}

          {(!plan.voiceNoteUrl || !keepExistingVoice) && (
            <VoiceRecorder
              onRecordingComplete={handleRecordingComplete}
              label=""
              disabled={isSubmitting}
            />
          )}
        </section>

        {isSubmitting && (
          <div className="flex justify-center py-2">
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              Saving changes…
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-md px-6 py-3 min-h-[44px] text-sm font-semibold text-white sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isSubmitting ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/plans")}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 min-h-[44px] text-sm font-medium text-gray-700 sm:w-auto hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
