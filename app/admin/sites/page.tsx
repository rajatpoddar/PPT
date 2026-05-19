"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Plus, ClipboardList, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";

interface Site {
  id: string;
  name: string;
  location: string;
  createdAt: string;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchSites();
  }, []);

  async function fetchSites() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sites");
      if (!res.ok) throw new Error("Failed to load sites");
      setSites(await res.json());
    } catch {
      setError("Failed to load sites. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(site: Site) {
    setEditingId(site.id);
    setEditName(site.name);
    setEditLocation(site.location);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    if (!editName.trim() || !editLocation.trim()) {
      setEditError("Name and location are required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), location: editLocation.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setEditError(body?.errors?.name?.[0] ?? body?.errors?.location?.[0] ?? "Failed to save.");
        return;
      }
      const updated: Site = await res.json();
      setSites((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setEditingId(null);
    } catch {
      setEditError("Network error. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteSite(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete site.");
        return;
      }
      setSites((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your construction sites.</p>
        </div>
        <Link
          href="/admin/sites/new"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Site
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && sites.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-gray-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-gray-700">No sites yet</h2>
          <p className="mt-1 text-sm text-gray-500">Get started by creating your first construction site.</p>
          <Link
            href="/admin/sites/new"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 transition-colors duration-150"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Site
          </Link>
        </div>
      )}

      {!loading && sites.length > 0 && (
        <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Sites list">
          {sites.map((site) => (
            <li key={site.id}>
              <article className="flex h-full flex-col rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200 hover:ring-blue-300 transition-shadow duration-150">
                {editingId === site.id ? (
                  /* ── Edit mode ── */
                  <div className="flex flex-col gap-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Site name"
                      className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="Location"
                      className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {editError && <p className="text-xs text-red-600">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(site.id)}
                        disabled={editSaving}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 min-h-[44px] text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={editSaving}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : confirmDeleteId === site.id ? (
                  /* ── Confirm delete ── */
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-gray-800">Delete <span className="font-bold">{site.name}</span>?</p>
                    <p className="text-xs text-red-600">This will permanently delete the site and all its plans, resources, and photos.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteSite(site.id)}
                        disabled={deletingId === site.id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-2 min-h-[44px] text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingId === site.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                  /* ── View mode ── */
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold text-gray-900 leading-snug">{site.name}</h2>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => startEdit(site)}
                          aria-label={`Edit ${site.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(site.id)}
                          aria-label={`Delete ${site.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                      {site.location}
                    </p>

                    <div className="flex-1" />

                    <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                      <Link
                        href={`/admin/sites/${site.id}`}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-gray-400"
                        aria-label={`View details for ${site.name}`}
                      >
                        View Details
                      </Link>
                      <Link
                        href={`/admin/plans/new?siteId=${site.id}`}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 min-h-[44px] text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`Create a plan for ${site.name}`}
                      >
                        <ClipboardList className="h-4 w-4" aria-hidden="true" />
                        Create Plan
                      </Link>
                    </div>
                  </>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
