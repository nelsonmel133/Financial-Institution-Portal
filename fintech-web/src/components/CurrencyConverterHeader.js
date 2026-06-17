"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  LockOpen,
  Menu,
  X,
  Calculator,
  RefreshCw,
} from "lucide-react";
import { useFinancial } from "@/context/FinancialContext";
import { SidebarContent } from "@/components/SidebarNavigation";

function DirectionIcon({ direction }) {
  if (direction === "up") return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />;
  if (direction === "down") return <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />;
  return <span className="h-3.5 w-3.5" />;
}

function RateCard({ code }) {
  const { currencyMeta, rates, rateLocks, rateDirections, updateRate, toggleRateLock, baseCurrency, setBaseCurrency } =
    useFinancial();
  const [draft, setDraft] = useState(rates[code].toFixed(2));
  const isBase = baseCurrency === code;
  const isUSD = code === "USD";
  const locked = rateLocks[code];

  useEffect(() => {
    if (!locked) setDraft(rates[code].toFixed(2));
  }, [rates, code, locked]);

  return (
    <button
      type="button"
      onClick={() => setBaseCurrency(code)}
      className={`flex min-w-[148px] flex-1 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
        isBase
          ? "border-vault-400 bg-vault-50 ring-1 ring-vault-400/40"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
      title={`Set ${code} as the base display currency`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tracking-wide text-navy-900">{code}</span>
          <span className="truncate text-[11px] text-slate-500">{currencyMeta[code].name}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          {isUSD || !locked ? (
            <span
              key={rates[code]}
              className={`font-ledger text-sm font-semibold text-navy-900 ${
                rateDirections[code] === "up"
                  ? "animate-flicker-up"
                  : rateDirections[code] === "down"
                  ? "animate-flicker-down"
                  : ""
              }`}
            >
              {rates[code].toFixed(4)}
            </span>
          ) : (
            <input
              type="number"
              step="0.0001"
              value={draft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => updateRate(code, draft)}
              className="w-20 rounded border border-vault-400/60 bg-white px-1.5 py-0.5 font-ledger text-sm font-semibold text-navy-900 focus:outline-none focus:ring-1 focus:ring-vault-400"
            />
          )}
          <DirectionIcon direction={isUSD ? "flat" : rateDirections[code]} />
        </div>
      </div>

      {!isUSD && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            toggleRateLock(code);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              toggleRateLock(code);
            }
          }}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
            locked
              ? "border-vault-400 bg-vault-100 text-vault-700"
              : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
          }`}
          title={locked ? `Manual override active \u2013 click to resume live feed` : "Lock to enter a manual rate"}
        >
          {locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
        </span>
      )}
    </button>
  );
}

function QuickConvert() {
  const { currencies, currencyMeta, convert } = useFinancial();
  const [amount, setAmount] = useState("1000");
  const [fromCurrency, setFromCurrency] = useState("USD");

  const numericAmount = Number(amount) || 0;

  return (
    <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <Calculator className="h-4 w-4 shrink-0 text-slate-400" />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 min-w-0 bg-transparent font-ledger text-sm font-semibold text-navy-900 focus:outline-none"
        aria-label="Amount to convert"
      />
      <select
        value={fromCurrency}
        onChange={(e) => setFromCurrency(e.target.value)}
        className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs font-semibold text-navy-800 focus:outline-none focus:ring-1 focus:ring-vault-400"
        aria-label="Convert from currency"
      >
        {currencies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <span className="text-slate-300">\u2192</span>
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 overflow-hidden">
        {currencies
          .filter((c) => c !== fromCurrency)
          .map((c) => (
            <span key={c} className="whitespace-nowrap font-ledger text-sm text-navy-700">
              <span className="font-semibold">{currencyMeta[c].symbol}</span>{" "}
              {convert(numericAmount, fromCurrency, c).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              <span className="ml-1 text-[11px] text-slate-400">{c}</span>
            </span>
          ))}
      </div>
    </div>
  );
}

export default function CurrencyConverterHeader() {
  const { currencies, baseCurrency, setBaseCurrency, lastSync } = useFinancial();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <RefreshCw className="h-3 w-3 text-emerald-500" />
            <span>Live FX Desk</span>
          </div>
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            Synced {lastSync} \u00b7 coefficients per 1.00 USD
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:inline">
              Base Display Currency
            </span>
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
              {currencies.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBaseCurrency(c)}
                  className={`rounded-[5px] px-2.5 py-1 text-xs font-bold transition ${
                    baseCurrency === c
                      ? "bg-navy-900 text-white shadow-sm"
                      : "text-slate-500 hover:text-navy-800"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 px-4 py-3 lg:flex-row lg:items-stretch lg:gap-3 lg:px-6">
          <div className="flex flex-1 flex-wrap gap-2 lg:flex-nowrap">
            {currencies.map((code) => (
              <RateCard key={code} code={code} />
            ))}
          </div>
          <QuickConvert />
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-950/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-[280px] shadow-2xl">
            <div className="flex h-full flex-col">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
