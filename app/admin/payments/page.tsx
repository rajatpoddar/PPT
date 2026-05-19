"use client";

import { useEffect, useState } from "react";
import { IndianRupee, Plus, Trash2, Loader2, X, Check } from "lucide-react";

interface SiteOption { id: string; name: string }
interface PaymentRecord {
  id: string;
  paymentDate: string;
  workerType: string;
  workerName: string | null;
  amount: number;
  note: string | null;
  site: { id: string; name: string };
  supervisor: { id: string; username: string };
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("");

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ siteId: "", paymentDate: "", workerType: "MASON", workerName: "", amount: "", note: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { fetchSites(); }, []);
  useEffect(() => { fetchPayments(siteFilter); }, [siteFilter]);

  async function fetchSites() {
    try {
      const res = await fetch("/api/sites");
      if (res.ok) setSites(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchPayments(siteId: string) {
    setLoading(true);
    setError(null);
    try {
      const url = siteId ? `/api/payments?siteId=${siteId}` : "/api/payments";
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      setPayments(await res.json());
    } catch {
      setError("Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }

  async function addPayment() {
    if (!form.siteId || !form.paymentDate || !form.amount) {
      setAddError("Site, date, and amount are required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: form.siteId,
          paymentDate: form.paymentDate,
          workerType: form.workerType,
          workerName: form.workerName || undefined,
          amount: parseFloat(form.amount),
          note: form.note || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setAddError(Object.values(body.errors ?? {}).flat().join(", ") || body.error || "Failed.");
        return;
      }
      setPayments((prev) => [body, ...prev]);
      setShowAdd(false);
      setForm({ siteId: "", paymentDate: "", workerType: "MASON", workerName: "", amount: "", note: "" });
    } catch {
      setAddError("Network error.");
    } finally {
      setAdding(false);
    }
  }

  async function deletePayment(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      if (!res.ok) { alert("Failed to delete."); return; }
      setPayments((prev) => prev.filter((p) => p.id !== id));
      setConfirmDeleteId(null);
    } catch {
      alert("Network error.");
    } finally {
      setDeletingId(null);
    }
  }

  const totalMason = payments.filter((p) => p.workerType === "MASON").reduce((s, p) => s + p.amount, 0);
  const totalHelper = payments.filter((p) => p.workerType === "HELPER").reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="mt-1 text-sm text-gray-500">Payment records for masons and helpers.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            onClick={() => { setShowAdd(true); setAddError(null); }}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4" />
            Add Payment
          </button>
        </div>
      </div>

      {/* Summary */}
      {!loading && payments.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
            <p className="text-xl font-bold text-orange-600">₹{totalMason.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-xs text-gray-500">Mason Payments</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
            <p className="text-xl font-bold text-green-600">₹{totalHelper.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-xs text-gray-500">Helper Payments</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
            <p className="text-xl font-bold text-blue-600">₹{(totalMason + totalHelper).toLocaleString("en-IN")}</p>
            <p className="mt-1 text-xs text-gray-500">Total</p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="mb-4 text-base font-semibold text-blue-900">Add Payment Record</h2>
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
              <label className="mb-1 block text-xs font-medium text-gray-700">Payment Date *</label>
              <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Worker Type *</label>
              <select value={form.workerType} onChange={(e) => setForm({ ...form, workerType: e.target.value })}
                className="min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="MASON">Mason</option>
                <option value="HELPER">Helper</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Worker Name</label>
              <input value={form.workerName} onChange={(e) => setForm({ ...form, workerName: e.target.value })}
                placeholder="Optional"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Note</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Optional"
                className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {addError && <p className="mt-2 text-xs text-red-600">{addError}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={addPayment} disabled={adding}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save
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

      {!loading && !error && payments.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <IndianRupee className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-sm text-gray-500">No payment records yet.</p>
        </div>
      )}

      {!loading && payments.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Site</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Worker</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Note</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">By</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(p.paymentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.site.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.workerType === "MASON" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                      {p.workerType === "MASON" ? "Mason" : "Helper"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.workerName ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">₹{p.amount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.note ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.supervisor.username}</td>
                  <td className="px-4 py-3">
                    {confirmDeleteId === p.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deletePayment(p.id)} disabled={deletingId === p.id}
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50">
                          {deletingId === p.id ? "..." : "Yes"}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(p.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
