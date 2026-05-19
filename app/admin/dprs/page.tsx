"use client";

import { useEffect, useState } from "react";
import { FileText, MapPin, Calendar, Loader2, Mic, ChevronDown, ChevronUp } from "lucide-react";

interface DPRRecord {
  id: string;
  planId: string;
  masons: number;
  helpers: number;
  length: number;
  breadth: number;
  height: number;
  voiceRemarkUrl: string | null;
  submittedAt: string;
  planDate: string;
  site: { id: string; name: string; location: string };
}

interface SiteOption {
  id: string;
  name: string;
}

export default function DPRsPage() {
  const [dprs, setDprs] = useState<DPRRecord[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("");
  const [expandedVoice, setExpandedVoice] = useState<string | null>(null);

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    fetchDPRs(siteFilter);
  }, [siteFilter]);

  async function fetchSites() {
    try {
      const res = await fetch("/api/sites");
      if (res.ok) setSites(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchDPRs(siteId: string) {
    setLoading(true);
    setError(null);
    try {
      const url = siteId ? `/api/dpr/list?siteId=${siteId}` : "/api/dpr/list";
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      setDprs(await res.json());
    } catch {
      setError("Failed to load DPRs.");
    } finally {
      setLoading(false);
    }
  }

  // Aggregate totals
  const totalMasons = dprs.reduce((s, d) => s + d.masons, 0);
  const totalHelpers = dprs.reduce((s, d) => s + d.helpers, 0);
  const totalVolume = dprs.reduce((s, d) => s + d.length * d.breadth * d.height, 0);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Progress Reports</h1>
          <p className="mt-1 text-sm text-gray-500">All DPRs submitted by supervisors.</p>
        </div>
        {/* Site filter */}
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      {!loading && dprs.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
            <p className="text-2xl font-bold text-blue-600">{dprs.length}</p>
            <p className="mt-1 text-xs text-gray-500">Total DPRs</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
            <p className="text-2xl font-bold text-orange-600">{totalMasons}</p>
            <p className="mt-1 text-xs text-gray-500">Mason Mandays</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
            <p className="text-2xl font-bold text-green-600">{totalHelpers}</p>
            <p className="mt-1 text-xs text-gray-500">Helper Mandays</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 text-center">
            <p className="text-2xl font-bold text-purple-600">{totalVolume.toFixed(1)}</p>
            <p className="mt-1 text-xs text-gray-500">Total Volume (m³)</p>
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

      {!loading && !error && dprs.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-700">No DPRs found</h2>
          <p className="mt-1 text-sm text-gray-500">No daily progress reports have been submitted yet.</p>
        </div>
      )}

      {!loading && dprs.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Site</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Masons</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Helpers</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">L×B×H (m)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Volume (m³)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Voice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dprs.map((dpr) => (
                <>
                  <tr key={dpr.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="font-medium text-gray-900">{dpr.site.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {new Date(dpr.planDate).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-700">{dpr.masons}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{dpr.helpers}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {dpr.length}×{dpr.breadth}×{dpr.height}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-purple-700">
                      {(dpr.length * dpr.breadth * dpr.height).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(dpr.submittedAt).toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {dpr.voiceRemarkUrl ? (
                        <button
                          onClick={() => setExpandedVoice(expandedVoice === dpr.id ? null : dpr.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100"
                        >
                          <Mic className="h-3.5 w-3.5" />
                          {expandedVoice === dpr.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                  {expandedVoice === dpr.id && dpr.voiceRemarkUrl && (
                    <tr key={`voice-${dpr.id}`}>
                      <td colSpan={8} className="px-4 pb-3">
                        <audio src={dpr.voiceRemarkUrl} controls className="w-full max-w-sm rounded-lg" />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-600">TOTAL ({dprs.length} reports)</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-orange-700">{totalMasons}</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-green-700">{totalHelpers}</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right text-sm font-bold text-purple-700">{totalVolume.toFixed(2)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
