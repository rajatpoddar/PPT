"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Plus, Trash2, Loader2, X, Check } from "lucide-react";

interface SiteOption { id: string; name: string }
interface ExpenseRecord {
  id: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  site: { id: string; name: string };
  supervisor: { id: string; username: string };
}

const CATEGORIES = ["MATERIAL", "TRANSPORT", "EQUIPMENT", "OTHER"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  MATERIAL: "Material", TRANSPORT: "Transport", EQUIPMENT: "Equipment", OTHER: "Other",
};

export default function SupervisorExpensesClient({ sites }: { sites: SiteOption[] }) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    siteId: sites.length === 1 ? sites[0].id : "",
    expenseDate: new Date().toISOString().split("T")[0],
    category: "MATERIAL",
    description: "",
    amount: "",
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { fetchExpenses(siteFilter); }, [siteFilter]);

  async function fetchExpenses(siteId: string) {
    setLoading(true);
    setError(null);
    try {
      const url = siteId ? `/api/expenses?siteId=${siteId}` : "/api/expenses";
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      setExpenses(await res.json());
    } catch {
      setError("Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  }

  async function addExpense() {
    if (!form.siteId || !form.expenseDate || !form.description || !form.amount) {
      setAddError("All fields are required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: form.siteId,
          expenseDate: form.expenseDate,
          category: form.category,
          description: form.description,
          amount: parseFloat(form.amount),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setAddError(Object.values(body.errors ?? {}).flat().join(", ") || body.error || "Failed.");
        return;
      }
      setExpenses((prev) => [body, ...prev]);
      setShowAdd(false);
      setForm({
        siteId: sites.length === 1 ? sites[0].id : "",
        expenseDate: new Date().toISOString().split("T")[0],
        category: "MATERIAL",
        description: "",
        amount: "",
      });
    } catch {
      setAddError("Network error.");
    } finally {
      setAdding(false);
    }
  }

  async function deleteExpense(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) { alert("Failed to delete."); return; }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      setConfirmDeleteId(null);
    } catch {
      alert("Network error.");
    } finally {
      setDeletingId(null);
    }
  }

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="mt-1 text-sm text-gray-500">Record site expenses.</p>
        </div>
        <div className="flex gap-2">
          {sites.length > 1 && (
            <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
              className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button onClick={() => { setShowAdd(true); setAddError(null); }}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500">
            <Plus className="h-4 w-4" />Add
          </button>
        </div>
      </div>

      {!loading && expenses.length > 0 && (
        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
          <p className="text-xl font-bold text-red-600">₹{grandTotal.toLocaleString("en-IN")}</p>
          <p className="text-xs text-gray-500">Total Expenses</p>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-5">
          <h2 className="mb-4 text-base font-semibold text-orange-900">Add Expense</h2>
          <div className="flex flex-col gap-3">
            {sites.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Site *</label>
                <select value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                  className="min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="">Select site</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Date *</label>
                <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Category *</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Description *</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What was the expense for?"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            {addError && <p className="text-xs text-red-600">{addError}</p>}
            <div className="flex gap-2">
              <button onClick={addExpense} disabled={adding}
                className="flex items-center gap-1.5 rounded-md bg-orange-500 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save
              </button>
              <button onClick={() => setShowAdd(false)}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50">
                <X className="h-4 w-4" />Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && expenses.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <TrendingUp className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-sm text-gray-500">No expenses recorded yet.</p>
        </div>
      )}

      {!loading && expenses.length > 0 && (
        <ul role="list" className="flex flex-col gap-3">
          {expenses.map((e) => (
            <li key={e.id}>
              <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {CATEGORY_LABELS[e.category] ?? e.category}
                      </span>
                      <span className="text-sm font-bold text-red-700">₹{e.amount.toLocaleString("en-IN")}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-800">{e.description}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(e.expenseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {sites.length > 1 && ` · ${e.site.name}`}
                    </p>
                  </div>
                  <div>
                    {confirmDeleteId === e.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteExpense(e.id)} disabled={deletingId === e.id}
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50">
                          {deletingId === e.id ? "..." : "Yes"}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="rounded border px-2 py-1 text-xs text-gray-600">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(e.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
