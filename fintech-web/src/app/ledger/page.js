"use client";

import { useMemo, useState } from "react";
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useFinancial } from "@/context/FinancialContext";

const PAGE_SIZE = 6;

const FILTER_TABS = [
  { id: "all", label: "All Entries" },
  { id: "inflow", label: "Cash-In" },
  { id: "outflow", label: "Cash-Out" },
  { id: "flagged", label: "Flagged" },
  { id: "pending", label: "Pending" },
];

const STATUS_STYLES = {
  Cleared: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
  Flagged: "bg-rose-50 text-rose-700 ring-rose-200",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export default function LedgerPage() {
  const { activeTenant, ledger, formatMoney, currencyMeta, baseCurrency } = useFinancial();
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = ledger;
    if (activeTab === "inflow") rows = rows.filter((r) => r.type === "inflow");
    if (activeTab === "outflow") rows = rows.filter((r) => r.type === "outflow");
    if (activeTab === "flagged") rows = rows.filter((r) => r.status === "Flagged");
    if (activeTab === "pending") rows = rows.filter((r) => r.status === "Pending");

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.reference.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [ledger, activeTab, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleTab(tabId) {
    setActiveTab(tabId);
    setPage(1);
  }

  function handleQuery(value) {
    setQuery(value);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-vault-600">
          {activeTenant.name} \u00b7 {activeTenant.location}
        </p>
        <h1 className="text-2xl font-bold text-navy-900">Retail Ledger</h1>
        <p className="text-sm text-slate-500">
          Unified transaction ledger with original transaction values alongside {baseCurrency} baseline
          conversions.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTab(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-navy-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQuery(e.target.value)}
              placeholder="Search reference, description..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-navy-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-vault-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Date / Time</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3 text-right">Original Value</th>
                <th className="px-5 py-3 text-right">{baseCurrency} Baseline</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((entry, idx) => (
                <tr
                  key={entry.id}
                  className={`border-b border-slate-100 align-top ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                >
                  <td className="px-5 py-3">
                    <p className="font-ledger text-xs font-semibold text-navy-800">{entry.reference}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{entry.id}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-600">
                    <p>{entry.date}</p>
                    <p className="text-slate-400">{entry.time}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    <p className="font-medium text-navy-800">{entry.description}</p>
                    <p className="text-[11px] text-slate-400">{entry.category}</p>
                  </td>
                  <td className="px-5 py-3">
                    {entry.type === "inflow" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <ArrowDownLeft className="h-3.5 w-3.5" /> Cash-In
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                        <ArrowUpRight className="h-3.5 w-3.5" /> Cash-Out
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-ledger text-slate-600">
                    <span className="font-semibold text-navy-800">{currencyMeta[entry.originalCurrency].symbol}</span>{" "}
                    {entry.originalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    <p className="text-[11px] font-sans font-normal text-slate-400">
                      {entry.originalCurrency}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`font-ledger font-semibold ${
                        entry.type === "inflow" ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {entry.type === "outflow" ? "\u2212" : ""}
                      {formatMoney(entry.amountUSD)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={entry.status} />
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">
                    No ledger entries match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Showing {pageRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}\u2013
            {(currentPage - 1) * PAGE_SIZE + pageRows.length} of {filtered.length} entries
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-medium text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
