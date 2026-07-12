"use client";

import { useState } from "react";
import {
  FileScan,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import { useFinancial } from "@/context/FinancialContext";
import api from "@/lib/api";

const PLACEHOLDER = `Paste or type a raw statement below, e.g.:

06/15 08:14  POS Settlement - Card Sales           +4,820.50 USD
06/15 09:02  Cash Deposit - Vault Sweep            +84,250.00 ZWG
06/14 13:40  Supplier Settlement - Beverage Co.     -3,200.00 USD
06/12 15:48  Cross-Border Remittance - Johannesburg -92,300.00 ZAR`;

const STATUS_STYLES = {
  Cleared: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
  Flagged: "bg-rose-50 text-rose-700 ring-rose-200",
};

function statusFromCompliance(status) {
  if (status === "SAFE") return "Cleared";
  if (status === "FLAGGED" || status === "ESCALATED") return "Flagged";
  if (status === "PENDING") return "Pending";
  return status;
}

export default function StatementPage() {
  const { activeTenant, currencies, apiOnline, fetchLedger } = useFinancial();

  const [rawText, setRawText] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const charCount = rawText.length;
  const tooShort = rawText.trim().length > 0 && rawText.trim().length < 10;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (rawText.trim().length < 10) {
      setError("Enter a more complete statement \u2014 at least a few lines of transactions.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.scanStatement(activeTenant.id, rawText.trim(), defaultCurrency);
      setResult(data);
      // Pull the newly saved entries into the ledger view for this tenant.
      fetchLedger(activeTenant.id);
    } catch (err) {
      setError(err.message || "Statement scan failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClear() {
    setRawText("");
    setResult(null);
    setError("");
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-vault-600">
          {activeTenant.name} &middot; {activeTenant.location}
        </p>
        <h1 className="text-2xl font-bold text-navy-900">Submit Financial Statement</h1>
        <p className="text-sm text-slate-500">
          Paste a raw bank or till statement instead of a formatted report &mdash; the compliance
          engine parses each transaction, converts it to a USD baseline, and screens it
          automatically.
        </p>
      </div>

      {!apiOnline && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The reporting API looks offline. Statement scanning needs a live connection to
            fintech_api &mdash; you can still draft your statement below and submit once it's back.
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="statement-text" className="text-xs font-semibold text-slate-600">
              Statement text
            </label>
            <div className="flex items-center gap-2">
              <label htmlFor="default-currency" className="text-xs font-medium text-slate-500">
                Default currency
              </label>
              <select
                id="default-currency"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-navy-900 focus:outline-none focus:ring-1 focus:ring-vault-400"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            id="statement-text"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={14}
            className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-ledger text-sm leading-relaxed text-navy-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-vault-400 focus:bg-white focus:ring-1 focus:ring-vault-400"
          />

          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{tooShort ? "A few more lines will help the parser." : "\u00a0"}</span>
            <span>{charCount.toLocaleString("en-US")} / 32,000 characters</span>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileScan className="h-4 w-4" />
              )}
              {submitting ? "Scanning statement\u2026" : "Scan Statement"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={submitting}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        </form>

        {/* Results panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
          <h2 className="text-sm font-semibold text-navy-900">Scan Results</h2>

          {!result && !submitting && (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
              <FileScan className="h-6 w-6 text-slate-300" />
              <p className="text-sm text-slate-400">
                Submit a statement to see parsed transactions and compliance findings here.
              </p>
            </div>
          )}

          {submitting && (
            <div className="mt-6 flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-vault-500" />
              <p className="text-sm text-slate-400">Parsing transactions and running compliance checks\u2026</p>
            </div>
          )}

          {result && (
            <div className="mt-4">
              <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                  <p className="font-ledger text-lg font-bold text-navy-900">{result.parsed_count}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Parsed</p>
                </div>
                <div className="rounded-lg bg-emerald-50 px-2 py-2.5">
                  <p className="font-ledger text-lg font-bold text-emerald-700">{result.saved_count}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Saved</p>
                </div>
                <div className="rounded-lg bg-rose-50 px-2 py-2.5">
                  <p className="font-ledger text-lg font-bold text-rose-700">{result.failed_count}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">Failed</p>
                </div>
              </div>

              {result.saved_count > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {result.saved_count} transaction{result.saved_count === 1 ? "" : "s"} saved to
                    the Retail Ledger for {activeTenant.name}.
                  </span>
                </div>
              )}

              {result.parse_notes && (
                <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                  {result.parse_notes}
                </p>
              )}

              <div className="max-h-[420px] space-y-2 overflow-y-auto scrollbar-thin pr-1">
                {result.entries.map((entry) => {
                  const status = statusFromCompliance(entry.compliance_status);
                  return (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-slate-100 bg-white px-3.5 py-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-navy-800">
                            {entry.description}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 font-ledger text-sm font-bold text-navy-900">
                            <span className="text-vault-600">
                              {Number(entry.amount).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            <span className="text-[11px] font-normal text-slate-400">
                              {entry.original_currency}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            \u2248 ${Number(entry.base_amount_usd).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            baseline
                          </p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${STATUS_STYLES[status] ?? "bg-slate-50 text-slate-600 ring-slate-200"}`}
                        >
                          {status}
                        </span>
                      </div>

                      {(entry.requires_manual_review || entry.ctr_required || entry.sar_required) && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
                          <ShieldAlert className="h-3 w-3 shrink-0" />
                          <span>
                            {[
                              entry.requires_manual_review && "Manual review",
                              entry.ctr_required && "CTR required",
                              entry.sar_required && "SAR required",
                            ]
                              .filter(Boolean)
                              .join(" \u00b7 ")}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
