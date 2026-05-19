"use client";

import { useEffect, useState } from "react";
import {
  UserPlus, Pencil, Trash2, X, Check, Loader2,
  HardHat, MapPin, ChevronDown, ChevronUp, KeyRound
} from "lucide-react";

interface SiteOption {
  id: string;
  name: string;
  location: string;
}

interface SupervisorSiteEntry {
  id: string;
  site: SiteOption;
}

interface Supervisor {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  supervisorSites: SupervisorSiteEntry[];
}

export default function SupervisorsPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newSiteIds, setNewSiteIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSiteIds, setEditSiteIds] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Expand sites
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSupervisors(), fetchSites()]);
  }, []);

  async function fetchSupervisors() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/supervisors");
      if (!res.ok) throw new Error();
      setSupervisors(await res.json());
    } catch {
      setError("Failed to load supervisors.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSites() {
    try {
      const res = await fetch("/api/sites");
      if (!res.ok) return;
      setSites(await res.json());
    } catch { /* ignore */ }
  }

  function toggleSiteSelection(siteId: string, current: string[], setter: (v: string[]) => void) {
    setter(current.includes(siteId) ? current.filter((s) => s !== siteId) : [...current, siteId]);
  }

  async function createSupervisor() {
    if (!newUsername.trim() || !newPassword.trim()) {
      setCreateError("Username and password are required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/supervisors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, siteIds: newSiteIds }),
      });
      const body = await res.json();
      if (!res.ok) {
        const msg = body?.errors?.username?.[0] ?? body?.errors?.password?.[0] ?? body?.error ?? "Failed to create.";
        setCreateError(msg);
        return;
      }
      setSupervisors((prev) => [...prev, body]);
      setShowCreate(false);
      setNewUsername("");
      setNewPassword("");
      setNewSiteIds([]);
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(sup: Supervisor) {
    setEditingId(sup.id);
    setEditUsername(sup.username);
    setEditPassword("");
    setEditSiteIds(sup.supervisorSites.map((s) => s.site.id));
    setEditError(null);
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    setEditError(null);
    try {
      const payload: Record<string, unknown> = { siteIds: editSiteIds };
      if (editUsername.trim()) payload.username = editUsername.trim();
      if (editPassword.trim()) payload.password = editPassword.trim();

      const res = await fetch(`/api/supervisors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        const msg = body?.errors?.username?.[0] ?? body?.error ?? "Failed to save.";
        setEditError(msg);
        return;
      }
      setSupervisors((prev) => prev.map((s) => (s.id === id ? body : s)));
      setEditingId(null);
    } catch {
      setEditError("Network error. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteSupervisor(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/supervisors/${id}`, { method: "DELETE" });
      if (!res.ok) { alert("Failed to delete."); return; }
      setSupervisors((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
    } catch {
      alert("Network error.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supervisors</h1>
          <p className="mt-1 text-sm text-gray-500">Manage supervisor accounts and site assignments.</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError(null); }}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <UserPlus className="h-4 w-4" />
          New Supervisor
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="mb-4 text-base font-semibold text-blue-900">Create New Supervisor</h2>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Username</label>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. supervisor1"
                  className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {sites.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Assign Sites</label>
                <div className="flex flex-wrap gap-2">
                  {sites.map((site) => (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => toggleSiteSelection(site.id, newSiteIds, setNewSiteIds)}
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        newSiteIds.includes(site.id)
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-blue-400",
                      ].join(" ")}
                    >
                      <MapPin className="h-3 w-3" />
                      {site.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {createError && <p className="text-xs text-red-600">{createError}</p>}

            <div className="flex gap-2">
              <button
                onClick={createSupervisor}
                disabled={creating}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Create
              </button>
              <button
                onClick={() => { setShowCreate(false); setCreateError(null); }}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && supervisors.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <HardHat className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-700">No supervisors yet</h2>
          <p className="mt-1 text-sm text-gray-500">Create your first supervisor account.</p>
        </div>
      )}

      {!loading && supervisors.length > 0 && (
        <ul role="list" className="flex flex-col gap-3">
          {supervisors.map((sup) => (
            <li key={sup.id}>
              <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                {editingId === sup.id ? (
                  /* Edit mode */
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Username</label>
                        <input
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          New Password <span className="text-gray-400">(leave blank to keep)</span>
                        </label>
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="New password"
                          className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {sites.length > 0 && (
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-600">Assigned Sites</label>
                        <div className="flex flex-wrap gap-2">
                          {sites.map((site) => (
                            <button
                              key={site.id}
                              type="button"
                              onClick={() => toggleSiteSelection(site.id, editSiteIds, setEditSiteIds)}
                              className={[
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                editSiteIds.includes(site.id)
                                  ? "border-blue-500 bg-blue-600 text-white"
                                  : "border-gray-300 bg-white text-gray-700 hover:border-blue-400",
                              ].join(" ")}
                            >
                              <MapPin className="h-3 w-3" />
                              {site.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {editError && <p className="text-xs text-red-600">{editError}</p>}

                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(sup.id)}
                        disabled={editSaving}
                        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : confirmDeleteId === sup.id ? (
                  /* Confirm delete */
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-gray-800">
                      Delete supervisor <span className="font-bold">{sup.username}</span>?
                    </p>
                    <p className="text-xs text-red-600">This will permanently delete the account.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteSupervisor(sup.id)}
                        disabled={deletingId === sup.id}
                        className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2.5 min-h-[44px] text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingId === sup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
                          <HardHat className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{sup.username}</p>
                          <p className="text-xs text-gray-500">
                            Joined {new Date(sup.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(sup)}
                          aria-label="Edit supervisor"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(sup.id)}
                          aria-label="Delete supervisor"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Sites */}
                    <div className="mt-3">
                      {sup.supervisorSites.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No sites assigned</p>
                      ) : (
                        <div>
                          <button
                            onClick={() => setExpandedId(expandedId === sup.id ? null : sup.id)}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-blue-600"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            {sup.supervisorSites.length} site{sup.supervisorSites.length !== 1 ? "s" : ""} assigned
                            {expandedId === sup.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                          {expandedId === sup.id && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {sup.supervisorSites.map((ss) => (
                                <span
                                  key={ss.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200"
                                >
                                  <MapPin className="h-3 w-3" />
                                  {ss.site.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
