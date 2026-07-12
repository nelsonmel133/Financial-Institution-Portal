"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, RefreshCw, Lock, LockOpen } from "lucide-react";
import { useFinancial } from "@/context/FinancialContext";

const PRESETS = [100, 500, 1000, 5000, 25000];

export default function ConverterPage() {
  const {
    currencies,
    currencyMeta,
    rates,
    rateLocks,
    toggleRateLock,
    convert,
    lastSync,
    apiOnline,
  } = useFinancial();

  const [amount, setAmount] = useState("1000");
  const [fromCurrency, setFromCurrency] = useState("USD");

  const numericAmount = Number(amount);
  const isValidAmount = amount.trim() !== "" && Number.isFinite(numericAmount) && numericAmount >= 0;

  const results = useMemo(() => {
    if (!isValidAmount) return [];
    return currencies
      .filter((c) => c !== fromCurrency)
      .map((c) => ({
        code: c,
        value: convert(numericAmount, fromCurrency, c),
      }));
  }, [currencies, fromCurrency, numericAmount, isValidAmount, convert]);

  function handlePreset(value) {
    setAmount(String(value));
  }

  function handleSwap(targetCurrency) {
    // Re-anchor the input on one of the converted values so the user can
    // pivot the conversion direction without re-typing the amount.
    const target = results.find((r) => r.code === targetCurrency);
    if (target) {
      setAmount(target.value.toFixed(2));
    }
    setFromCurrency(targetCurrency);
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-vault-600">
          Live FX Desk
        </p>
        <h1 className="text-2xl font-bold text-navy-900">Currency Converter</h1>
        <p className="text-sm text-slate-500">
          Enter an amount and see it converted across USD, ZWG, and ZAR in real time.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw className={`h-3 w-3 ${apiOnline ? "text-emerald-500" : "text-slate-300"}`} />
            {apiOnline ? "Live rates" : "Offline \u2013 last known rates"}
          </span>
          <span>Synced {lastSync}</span>
        </div>

        {/* Amount + from-currency input */}
        <div className="mt-4">
          <label htmlFor="converter-amount" className="mb-1.5 block text-xs font-semibold text-slate-600">
            Amount
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                {currencyMeta[fromCurrency].symbol}
              </span>
              <input
                id="converter-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 font-ledger text-lg font-semibold text-navy-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-vault-400 focus:bg-white focus:ring-1 focus:ring-vault-400"
              />
            </div>
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              aria-label="Currency to convert from"
              className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-navy-900 shadow-sm outline-none transition focus:border-vault-400 focus:ring-1 focus:ring-vault-400 sm:w-32"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {!isValidAmount && amount.trim() !== "" && (
            <p className="mt-1.5 text-xs font-medium text-rose-600">
              Enter a valid, non-negative number.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePreset(p)}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                {currencyMeta[fromCurrency].symbol}
                {p.toLocaleString("en-US")}
              </button>
            ))}
          </div>
        </div>

        {/* Converted amounts */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {results.map((r) => {
            const locked = rateLocks[r.code];
            const isUSD = r.code === "USD";
            return (
              <div
                key={r.code}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {currencyMeta[r.code].name}
                  </p>
                  <p className="mt-0.5 truncate font-ledger text-xl font-bold text-navy-900">
                    <span className="text-vault-600">{currencyMeta[r.code].symbol}</span>{" "}
                    {r.value.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    1 {fromCurrency} = {(rates[r.code] / rates[fromCurrency]).toFixed(4)} {r.code}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!isUSD && (
                    <button
                      type="button"
                      onClick={() => toggleRateLock(r.code)}
                      title={locked ? "Manual override active" : "Lock to enter a manual rate"}
                      className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${
                        locked
                          ? "border-vault-400 bg-vault-100 text-vault-700"
                          : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                      }`}
                    >
                      {locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSwap(r.code)}
                    title={`Use ${r.code} as the base amount`}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-vault-400 hover:text-vault-600"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {!isValidAmount && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              Enter an amount above to see the converted values.
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Rates are coefficients per 1.00 USD, refreshed live from the FX desk. Lock a currency to
        override its rate manually &mdash; unlock to resume the live feed.
      </p>
    </div>
  );
}
