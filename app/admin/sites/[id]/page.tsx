"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, MapPin, HardHat, Package, Loader2,
  IndianRupee, TrendingUp, Users, Layers, Calendar
} from "lucide-react";

interface SiteStats {
  site: { id: string; name: string; location: string; createdAt: string };
  mandays: { totalMasonDays: number; totalHelperDays: number; totalDPRs: number };
  workVolume: { totalVolume: number };
  payments: {
    totalMasonPayment: number;
    totalHelperPayment: number;
    totalPayment: number;
    records: PaymentRecord[];
  };
  expenses: {
    totalExpenses: number;
    byCategory: Record<string, number>;
    records: ExpenseRecord[];
  };
  supervisors: { id: string; username: string }[];
  inventory: InventoryAssignment[];
  recentDPRs: DPRSummary[];
}

interface PaymentRecord {
  id: string;
  paymentDate: string;
  workerType: string;
  workerName: string | null;
  amount: number;
  note: string | null;
  supervisor: { username: string };
}

interface ExpenseRecord {
  id: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  supervisor: { username: string };
}

interface InventoryAssignment {
  id: string;
  quantity: number;
  item: { id: string; name: string; unit: string };
}

interface DPRSummary {
  id: string;
  planDate: string;
  masons: number;
  helpers: number;
  length: number;
  breadth: number;
  height: number;
  volume: number;
  submittedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  MATERIAL: "Material",
  TRANSPORT: "Transport",
  EQUIPMENT: "Equipment",
  OTHER: "Other",
};

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;

  const [stats, setStats] = useState<SiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "dprs" | "payments" | "expenses" | "inventory">("overview");

  useEffect(() => {
    fetchStats();
  }, [siteId]);

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/stats`);
      if (!res.ok) throw new Error();
      setStats(await res.json());
    } catch {
      setError("Failed to load site details.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? "Site not found."}
      </div>
    );
  }

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "dprs", label: `DPRs (${stats.mandays.totalDPRs})` },
    { key: "payments", label: "Payments" },
    { key: "expenses", label: "Expenses" },
    { key: "inventory", label: "Inventory" },
  ] as const;

  return (
    <div>
      {/* Back + header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{stats.site.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
              <MapPin className="h-4 w-4" />
              {stats.site.location}
            </p>
          </div>
          {stats.supervisors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0">
              {stats.supervisors.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 ring-1 ring-orange-200">
                  <HardHat className="h-3 w-3" />
                  {s.username}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Mandays */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-700">Mandays</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Mason Mandays</span>
                <span className="text-sm font-bold text-orange-700">{stats.mandays.totalMasonDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Helper Mandays</span>
                <span className="text-sm font-bold text-green-700">{stats.mandays.totalHelperDays}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm text-gray-500">Total DPRs</span>
                <span className="text-sm font-bold text-gray-800">{stats.mandays.totalDPRs}</span>
              </div>
            </div>
          </div>

          {/* Work Volume */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-5 w-5 text-purple-500" />
              <h3 className="text-sm font-semibold text-gray-700">Work Volume</h3>
            </div>
            <p className="text-3xl font-bold text-purple-700">{stats.workVolume.totalVolume.toFixed(2)}</p>
            <p className="text-sm text-gray-500 mt-1">cubic meters (m³)</p>
          </div>

          {/* Payments */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <IndianRupee className="h-5 w-5 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-700">Payments</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Mason Payments</span>
                <span className="text-sm font-bold text-orange-700">₹{stats.payments.totalMasonPayment.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Helper Payments</span>
                <span className="text-sm font-bold text-green-700">₹{stats.payments.totalHelperPayment.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-sm font-bold text-blue-700">₹{stats.payments.totalPayment.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-red-500" />
              <h3 className="text-sm font-semibold text-gray-700">Expenses</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(stats.expenses.byCategory).map(([cat, amt]) => (
                <div key={cat} className="flex justify-between">
                  <span className="text-sm text-gray-500">{CATEGORY_LABELS[cat] ?? cat}</span>
                  <span className="text-sm font-semibold text-gray-800">₹{amt.toLocaleString("en-IN")}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-sm font-bold text-red-700">₹{stats.expenses.totalExpenses.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Inventory */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-teal-500" />
              <h3 className="text-sm font-semibold text-gray-700">Inventory at Site</h3>
            </div>
            {stats.inventory.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No inventory assigned</p>
            ) : (
              <div className="space-y-1.5">
                {stats.inventory.map((inv) => (
                  <div key={inv.id} className="flex justify-between">
                    <span className="text-sm text-gray-600">{inv.item.name}</span>
                    <span className="text-sm font-semibold text-teal-700">{inv.quantity} {inv.item.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DPRs tab */}
      {activeTab === "dprs" && (
        <div>
          {stats.recentDPRs.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No DPRs submitted for this site yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Masons</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Helpers</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">L×B×H (m)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Volume (m³)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.recentDPRs.map((dpr) => (
                    <tr key={dpr.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {new Date(dpr.planDate).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-700">{dpr.masons}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{dpr.helpers}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{dpr.length}×{dpr.breadth}×{dpr.height}</td>
                      <td className="px-4 py-3 text-right font-semibold text-purple-700">{dpr.volume.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payments tab */}
      {activeTab === "payments" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-4">
              <span className="text-sm text-gray-600">Mason: <strong className="text-orange-700">₹{stats.payments.totalMasonPayment.toLocaleString("en-IN")}</strong></span>
              <span className="text-sm text-gray-600">Helper: <strong className="text-green-700">₹{stats.payments.totalHelperPayment.toLocaleString("en-IN")}</strong></span>
              <span className="text-sm text-gray-600">Total: <strong className="text-blue-700">₹{stats.payments.totalPayment.toLocaleString("en-IN")}</strong></span>
            </div>
          </div>
          {stats.payments.records.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No payments recorded for this site.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Worker</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Note</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.payments.records.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(p.paymentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.workerType === "MASON" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                          {p.workerType === "MASON" ? "Mason" : "Helper"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.workerName ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700">₹{p.amount.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.note ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.supervisor.username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Expenses tab */}
      {activeTab === "expenses" && (
        <div>
          <div className="mb-4">
            <span className="text-sm text-gray-600">Total Expenses: <strong className="text-red-700">₹{stats.expenses.totalExpenses.toLocaleString("en-IN")}</strong></span>
          </div>
          {stats.expenses.records.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No expenses recorded for this site.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.expenses.records.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(e.expenseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {CATEGORY_LABELS[e.category] ?? e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{e.description}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-700">₹{e.amount.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.supervisor.username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inventory tab */}
      {activeTab === "inventory" && (
        <div>
          {stats.inventory.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="text-sm text-gray-500">No inventory assigned to this site.</p>
              <Link href="/admin/inventory" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                Manage Inventory →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.inventory.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{inv.item.name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-teal-700">{inv.quantity}</td>
                      <td className="px-4 py-3 text-gray-500">{inv.item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
