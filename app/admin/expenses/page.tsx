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

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ siteId: "", expenseDate: "", category: "MATERIAL", description: "", amount: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { fetchSites(); }, []);
  useEffect(() => { fetchExpenses(siteFilter); }, [siteFilter]);

  async function fetchSites() {
    try {
      const res = await fetch("/api/sites");
      if (res.ok) setSites(await res.json());
    } catch { /* ignore */ }
  }

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
      setAddError("All fields except category are required.");
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
      setForm({ siteId: "", expenseDate: "", category: "MATERIAL", description: "", amount: "" });
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

  const totalByCategory: Record<string, number> = {};
  for (const e of expenses) {
    totalByCategory[e.category] = (totalByCategory[e.category] ?? 0) + e.amount;
  }
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="mt-1 text-sm text-gray-500">Site expense records by category.</p>
        </div>
        <div className="flex gap-2">
          <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
            className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={() => { setShowAdd(true); setAddError(null); }}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <Plus className="h-4 w-4" />Add Expense
          </button>
        </div>
      </div>

      {/* Summary */}
      {!loading && expenses.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
              <p className="text-xl font-bold text-gray-800">₹{(totalByCategory[cat] ?? 0).toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs text-gray-500">{CATEGORY_LABELS[cat]}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="mb-4 text-base font-semibold text-blue-900">Add Expense Record</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Site *</label>
              <select value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                className="min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select site</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Date *</label>
              <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Description *</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What was the expense for?"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {addError && <p className="mt-2 text-xs text-red-600">{addError}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={addExpense} disabled={adding}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save
            </button>
            <button onClick={() => setShowAdd(false)}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50">
              <X className="h-4 w-4" />Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && expenses.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <TrendingUp className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-sm text-gray-500">No expense records yet.</p>
        </div>
      )}

      {!loading && expenses.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Site</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">By</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(e.expenseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{e.site.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {CATEGORY_LABELS[e.category] ?? e.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{e.description}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-700">₹{e.amount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.supervisor.username}</td>
                  <td className="px-4 py-3">
                    {confirmDeleteId === e.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteExpense(e.id)} disabled={deletingId === e.id}
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50">
                          {deletingId === e.id ? "..." : "Yes"}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(e.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-600">TOTAL</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-red-700">₹{grandTotal.toLocaleString("en-IN")}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
