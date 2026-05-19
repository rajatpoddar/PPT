"use client";

import { useEffect, useState } from "react";
import {
  Package, Plus, Pencil, Trash2, Loader2, X, Check, MapPin, ChevronDown, ChevronUp
} from "lucide-react";

interface SiteOption { id: string; name: string }
interface Assignment {
  id: string;
  quantity: number;
  note: string | null;
  site: { id: string; name: string };
}
interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  totalQty: number;
  note: string | null;
  assignedQty: number;
  availableQty: number;
  assignments: Assignment[];
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create item
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", unit: "", totalQty: "", note: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit item
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", unit: "", totalQty: "", note: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete item
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Assign to site
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ siteId: "", quantity: "", note: "" });
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Expand assignments
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
    fetchSites();
  }, []);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error();
      setItems(await res.json());
    } catch {
      setError("Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSites() {
    try {
      const res = await fetch("/api/sites");
      if (res.ok) setSites(await res.json());
    } catch { /* ignore */ }
  }

  async function createItem() {
    if (!newForm.name.trim() || !newForm.unit.trim() || !newForm.totalQty) {
      setCreateError("Name, unit, and quantity are required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newForm.name.trim(),
          unit: newForm.unit.trim(),
          totalQty: parseFloat(newForm.totalQty),
          note: newForm.note || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setCreateError(Object.values(body.errors ?? {}).flat().join(", ") || "Failed.");
        return;
      }
      setItems((prev) => [...prev, body].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreate(false);
      setNewForm({ name: "", unit: "", totalQty: "", note: "" });
    } catch {
      setCreateError("Network error.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setEditForm({ name: item.name, unit: item.unit, totalQty: String(item.totalQty), note: item.note ?? "" });
    setEditError(null);
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          unit: editForm.unit.trim(),
          totalQty: parseFloat(editForm.totalQty),
          note: editForm.note || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setEditError(Object.values(body.errors ?? {}).flat().join(", ") || "Failed.");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === id ? body : i)));
      setEditingId(null);
    } catch {
      setEditError("Network error.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteItem(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
      if (!res.ok) { alert("Failed to delete."); return; }
      setItems((prev) => prev.filter((i) => i.id !== id));
      setConfirmDeleteId(null);
    } catch {
      alert("Network error.");
    } finally {
      setDeletingId(null);
    }
  }

  async function assignToSite(itemId: string) {
    if (!assignForm.siteId || !assignForm.quantity) {
      setAssignError("Site and quantity are required.");
      return;
    }
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch("/api/inventory/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          siteId: assignForm.siteId,
          quantity: parseFloat(assignForm.quantity),
          note: assignForm.note || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setAssignError(body.error || Object.values(body.errors ?? {}).flat().join(", ") || "Failed.");
        return;
      }
      // Refresh items to get updated assignments
      await fetchItems();
      setAssigningItemId(null);
      setAssignForm({ siteId: "", quantity: "", note: "" });
    } catch {
      setAssignError("Network error.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">Manage total stock and site assignments.</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError(null); }}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-3 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4" />Add Item
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="mb-4 text-base font-semibold text-blue-900">Add Inventory Item</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Item Name *</label>
              <input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="e.g. Cement Bags"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Unit *</label>
              <input value={newForm.unit} onChange={(e) => setNewForm({ ...newForm, unit: e.target.value })}
                placeholder="e.g. bags, kg, pieces"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Total Qty *</label>
              <input type="number" min="0" step="any" value={newForm.totalQty} onChange={(e) => setNewForm({ ...newForm, totalQty: e.target.value })}
                placeholder="0"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Note</label>
              <input value={newForm.note} onChange={(e) => setNewForm({ ...newForm, note: e.target.value })}
                placeholder="Optional"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {createError && <p className="mt-2 text-xs text-red-600">{createError}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={createItem} disabled={creating}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save
            </button>
            <button onClick={() => setShowCreate(false)}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50">
              <X className="h-4 w-4" />Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-700">No inventory items</h2>
          <p className="mt-1 text-sm text-gray-500">Add your first inventory item to get started.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <ul role="list" className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                {editingId === item.id ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
                        <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Unit</label>
                        <input value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                          className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Total Qty</label>
                        <input type="number" min="0" step="any" value={editForm.totalQty} onChange={(e) => setEditForm({ ...editForm, totalQty: e.target.value })}
                          className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Note</label>
                        <input value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                          className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    {editError && <p className="text-xs text-red-600">{editError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(item.id)} disabled={editSaving}
                        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <X className="h-4 w-4" />Cancel
                      </button>
                    </div>
                  </div>
                ) : confirmDeleteId === item.id ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-gray-800">Delete <span className="font-bold">{item.name}</span>?</p>
                    <p className="text-xs text-red-600">This will remove the item and all site assignments.</p>
                    <div className="flex gap-2">
                      <button onClick={() => deleteItem(item.id)} disabled={deletingId === item.id}
                        className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2.5 min-h-[44px] text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                        {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Delete
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <X className="h-4 w-4" />Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100">
                          <Package className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                          {item.note && <p className="text-xs text-gray-500">{item.note}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setAssigningItemId(item.id); setAssignForm({ siteId: "", quantity: "", note: "" }); setAssignError(null); }}
                          className="flex items-center gap-1 rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100">
                          <MapPin className="h-3.5 w-3.5" />Assign Site
                        </button>
                        <button onClick={() => startEdit(item)}
                          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-blue-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(item.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Qty summary */}
                    <div className="mt-3 flex flex-wrap gap-3">
                      <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                        <p className="text-lg font-bold text-gray-800">{item.totalQty}</p>
                        <p className="text-xs text-gray-500">Total {item.unit}</p>
                      </div>
                      <div className="rounded-lg bg-orange-50 px-3 py-2 text-center">
                        <p className="text-lg font-bold text-orange-700">{item.assignedQty}</p>
                        <p className="text-xs text-gray-500">Assigned</p>
                      </div>
                      <div className="rounded-lg bg-green-50 px-3 py-2 text-center">
                        <p className="text-lg font-bold text-green-700">{item.availableQty}</p>
                        <p className="text-xs text-gray-500">Available</p>
                      </div>
                    </div>

                    {/* Assign form */}
                    {assigningItemId === item.id && (
                      <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
                        <p className="mb-3 text-xs font-semibold text-teal-800">Assign to Site</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <select value={assignForm.siteId} onChange={(e) => setAssignForm({ ...assignForm, siteId: e.target.value })}
                            className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                            <option value="">Select site</option>
                            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <input type="number" min="0" step="any" value={assignForm.quantity}
                            onChange={(e) => setAssignForm({ ...assignForm, quantity: e.target.value })}
                            placeholder={`Qty (max ${item.availableQty})`}
                            className="min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                          <input value={assignForm.note} onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })}
                            placeholder="Note (optional)"
                            className="min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        </div>
                        {assignError && <p className="mt-1 text-xs text-red-600">{assignError}</p>}
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => assignToSite(item.id)} disabled={assigning}
                            className="flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-2 min-h-[44px] text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                            {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Assign
                          </button>
                          <button onClick={() => setAssigningItemId(null)}
                            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50">
                            <X className="h-4 w-4" />Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Site assignments */}
                    {item.assignments.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-teal-600"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {item.assignments.length} site assignment{item.assignments.length !== 1 ? "s" : ""}
                          {expandedId === item.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {expandedId === item.id && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.assignments.map((a) => (
                              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-200">
                                <MapPin className="h-3 w-3" />
                                {a.site.name}: <strong>{a.quantity} {item.unit}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
