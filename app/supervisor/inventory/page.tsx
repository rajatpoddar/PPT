"use client";

import { useEffect, useState } from "react";
import { Package, MapPin, Loader2, ChevronDown, ChevronUp } from "lucide-react";

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

export default function SupervisorInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setError("Failed to load inventory."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="mt-1 text-sm text-gray-500">View total stock and site-wise distribution.</p>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-sm text-gray-500">No inventory items available.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <ul role="list" className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
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

                {/* Site assignments */}
                {item.assignments.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-teal-600"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Site-wise distribution
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
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
