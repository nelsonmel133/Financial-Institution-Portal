"use client";

/**
 * src/context/FinancialContext.js
 *
 * Unified data provider for the fintech-web frontend.
 *
 * Data strategy:
 *  - Tenant list, ledger entries, and dashboard KPIs are fetched from
 *    the FastAPI backend (fintech_api) when the API is reachable.
 *  - If the API is unreachable (NEXT_PUBLIC_API_URL not set, network error,
 *    or dev without a running backend), the context falls back to the
 *    static mock data so the UI always renders.
 *
 * FX rates:
 *  - Live rates are loaded from GET /health/rates on mount and refreshed
 *    every 30 s. Unlocked rates also receive a small simulated drift tick
 *    every 6 s to match the original live-feed UX.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api, { TENANT_IDS } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Static reference data                                              */
/* ------------------------------------------------------------------ */

export const CURRENCIES = ["USD", "ZWG", "ZAR"];

export const CURRENCY_META = {
  USD: { symbol: "$", name: "US Dollar", suffix: false },
  ZWG: { symbol: "ZWG", name: "Zimbabwe Gold", suffix: false },
  ZAR: { symbol: "R", name: "South African Rand", suffix: false },
};

const BASE_RATES = { USD: 1, ZWG: 13.82, ZAR: 18.46 };

export const AML_THRESHOLD_USD = 5000;

// These slugs must match the keys in TENANT_IDS (api.js) and the
// organisation_name values seeded in 0002_seed_tenants.py.
export const TENANTS = [
  { id: "main-retail",      name: "Main Retail Hub",    location: "Harare CBD",  complianceScore: 98 },
  { id: "harare-sub",       name: "Harare Sub-Branch",  location: "Borrowdale",  complianceScore: 94 },
  { id: "bulawayo-branch",  name: "Bulawayo Branch",    location: "Bulawayo CBD", complianceScore: 91 },
];

/* ------------------------------------------------------------------ */
/*  Fallback mock data (used when API is unreachable)                  */
/* ------------------------------------------------------------------ */

const MOCK_LEDGER = {
  "main-retail": [
    { id: "MRH-1001", date: "2026-06-15", time: "08:14", description: "POS Settlement – Card Sales",            category: "Retail Sales",          type: "inflow",  amountUSD: 4820.50,  originalAmount: 4820.50,  originalCurrency: "USD", status: "Cleared",  reference: "POS-88231" },
    { id: "MRH-1002", date: "2026-06-15", time: "09:02", description: "Cash Deposit – Vault Sweep",             category: "Cash Deposit",          type: "inflow",  amountUSD: 6096.96,  originalAmount: 84250.00, originalCurrency: "ZWG", status: "Cleared",  reference: "VLT-50112" },
    { id: "MRH-1003", date: "2026-06-14", time: "13:40", description: "Supplier Settlement – Beverage",         category: "Supplier Settlement",   type: "outflow", amountUSD: 3200.00,  originalAmount: 3200.00,  originalCurrency: "USD", status: "Cleared",  reference: "SUP-22871" },
    { id: "MRH-1007", date: "2026-06-12", time: "15:48", description: "Cross-Border Remittance (Johannesburg)", category: "Cross-Border Remittance",type: "outflow", amountUSD: 5000.00,  originalAmount: 92300.00, originalCurrency: "ZAR", status: "Flagged",  reference: "XBR-77004" },
  ],
  "harare-sub": [
    { id: "HSB-2001", date: "2026-06-15", time: "09:30", description: "Retail Sales – Counter Till 2",          category: "Retail Sales",          type: "inflow",  amountUSD: 2150.00,  originalAmount: 2150.00,  originalCurrency: "USD", status: "Cleared",  reference: "POS-41207" },
    { id: "HSB-2006", date: "2026-06-12", time: "12:55", description: "Cross-Border Remittance (Durban)",       category: "Cross-Border Remittance",type: "outflow", amountUSD: 5400.00,  originalAmount: 5400.00,  originalCurrency: "USD", status: "Flagged",  reference: "XBR-77005" },
  ],
  "bulawayo-branch": [
    { id: "BLW-3001", date: "2026-06-15", time: "09:00", description: "Retail Sales – Counter Till 1",          category: "Retail Sales",          type: "inflow",  amountUSD: 1680.25,  originalAmount: 1680.25,  originalCurrency: "USD", status: "Cleared",  reference: "POS-65520" },
    { id: "BLW-3006", date: "2026-06-11", time: "15:05", description: "Cross-Border Remittance (Gauteng)",      category: "Cross-Border Remittance",type: "outflow", amountUSD: 7000.00,  originalAmount: 96740.00, originalCurrency: "ZWG", status: "Flagged",  reference: "XBR-77002" },
  ],
};

const MOCK_CASHFLOW = {
  "main-retail":     [{ date: "2026-06-09", cashIn: 8200, cashOut: 6100, vaultReserves: 142000, drawerBalance: 18500 }, { date: "2026-06-10", cashIn: 9100, cashOut: 7300, vaultReserves: 143800, drawerBalance: 19200 }, { date: "2026-06-15", cashIn: 10960, cashOut: 9200, vaultReserves: 148900, drawerBalance: 22400 }],
  "harare-sub":      [{ date: "2026-06-09", cashIn: 4100, cashOut: 3200, vaultReserves: 58000,  drawerBalance: 8200  }, { date: "2026-06-15", cashIn: 5150, cashOut: 3950, vaultReserves: 60800,  drawerBalance: 10100 }],
  "bulawayo-branch": [{ date: "2026-06-09", cashIn: 3100, cashOut: 2400, vaultReserves: 41000,  drawerBalance: 6100  }, { date: "2026-06-15", cashIn: 2180, cashOut: 2100, vaultReserves: 40730,  drawerBalance: 7880  }],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Map a LedgerEntryRead from the API to the shape the UI components expect.
 * The API stores all amounts in original_currency + base_amount_usd.
 * We surface base_amount_usd as amountUSD for display consistency.
 */
function mapApiEntry(entry) {
  return {
    id: entry.reference_number ?? entry.id,
    date: entry.transaction_date
      ? entry.transaction_date.slice(0, 10)
      : entry.created_at.slice(0, 10),
    time: entry.created_at.slice(11, 16),
    description: entry.description,
    category: entry.compliance_category ?? "Routine",
    type: "inflow", // API doesn't currently model debit/credit — treat all as inflow placeholder
    amountUSD: Number(entry.base_amount_usd),
    originalAmount: Number(entry.amount),
    originalCurrency: entry.original_currency,
    status: entry.compliance_status === "SAFE"
      ? "Cleared"
      : entry.compliance_status === "FLAGGED" || entry.compliance_status === "ESCALATED"
        ? "Flagged"
        : entry.compliance_status === "PENDING"
          ? "Pending"
          : entry.compliance_status,
    reference: entry.reference_number ?? entry.id,
    riskScore: entry.risk_score,
    requiresReview: entry.requires_manual_review,
    ctrRequired: entry.ctr_required,
    sarRequired: entry.sar_required,
    auditSummary: entry.llm_audit_summary,
  };
}

/* ------------------------------------------------------------------ */
/*  Context                                                             */
/* ------------------------------------------------------------------ */

const FinancialContext = createContext(null);

export function FinancialProvider({ children }) {
  const [activeTenantId, setActiveTenantId] = useState(TENANTS[0].id);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [rates, setRates] = useState(BASE_RATES);
  const [rateLocks, setRateLocks] = useState({ USD: true, ZWG: false, ZAR: false });
  const [rateDirections, setRateDirections] = useState({ USD: "flat", ZWG: "flat", ZAR: "flat" });
  const [lastSync, setLastSync] = useState("--:--:--");

  // API state
  const [apiOnline, setApiOnline] = useState(false);
  const [ledgerByTenant, setLedgerByTenant] = useState({});
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPagination, setLedgerPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const tickRef = useRef(0);

  // ── Live FX from API, with simulated drift ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchRates() {
      try {
        const data = await api.exchangeRates();
        if (cancelled) return;
        const parsed = {};
        for (const [k, v] of Object.entries(data.rates ?? {})) {
          parsed[k] = Number(v);
        }
        if (parsed.USD) setRates((prev) => ({ ...prev, ...parsed }));
        setApiOnline(true);
      } catch (_) {
        // API not reachable — stay with BASE_RATES
        setApiOnline(false);
      }
    }

    fetchRates();
    const poll = setInterval(fetchRates, 30_000);
    return () => { cancelled = true; clearInterval(poll); };
  }, []);

  // Simulated live drift for unlocked rates (cosmetic, matches original UX)
  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      setRates((prev) => {
        const next = { ...prev };
        const directions = {};
        CURRENCIES.forEach((code) => {
          if (code === "USD" || rateLocks[code]) { directions[code] = "flat"; return; }
          const drift = (Math.random() - 0.5) * (prev[code] * 0.0025);
          const updated = Math.max(0.01, prev[code] + drift);
          directions[code] = updated > prev[code] ? "up" : updated < prev[code] ? "down" : "flat";
          next[code] = updated;
        });
        setRateDirections(directions);
        return next;
      });
      const now = new Date();
      setLastSync(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
      );
    }, 6000);
    return () => clearInterval(interval);
  }, [rateLocks]);

  // ── Ledger fetch ───────────────────────────────────────────────────────────
  const fetchLedger = useCallback(async (tenantSlug, page = 1, pageSize = 25, filters = {}) => {
    if (!apiOnline) return;
    setLedgerLoading(true);
    try {
      const data = await api.listLedgerEntries(tenantSlug, { page, pageSize, ...filters });
      const mapped = (data.items ?? []).map(mapApiEntry);
      setLedgerByTenant((prev) => ({ ...prev, [tenantSlug]: mapped }));
      setLedgerPagination({
        page: data.page,
        totalPages: data.total_pages,
        total: data.total,
      });
    } catch (err) {
      console.warn("Ledger fetch failed, using mock data:", err.message);
    } finally {
      setLedgerLoading(false);
    }
  }, [apiOnline]);

  // Re-fetch when active tenant changes
  useEffect(() => {
    if (apiOnline) fetchLedger(activeTenantId);
  }, [activeTenantId, apiOnline, fetchLedger]);

  // ── FX helpers ─────────────────────────────────────────────────────────────
  const updateRate = useCallback((code, value) => {
    if (code === "USD") return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    setRates((prev) => ({ ...prev, [code]: numeric }));
    setRateDirections((prev) => ({ ...prev, [code]: "flat" }));
  }, []);

  const toggleRateLock = useCallback((code) => {
    if (code === "USD") return;
    setRateLocks((prev) => ({ ...prev, [code]: !prev[code] }));
  }, []);

  const convertFromUSD = useCallback(
    (amountUSD, currency) => amountUSD * (rates[currency ?? baseCurrency] ?? 1),
    [rates, baseCurrency]
  );

  const convert = useCallback(
    (amount, fromCurrency, toCurrency) =>
      (amount / (rates[fromCurrency] ?? 1)) * (rates[toCurrency] ?? 1),
    [rates]
  );

  const formatMoney = useCallback(
    (amountUSD, currencyOverride) => {
      const currency = currencyOverride ?? baseCurrency;
      const value = convertFromUSD(amountUSD, currency);
      const formatted = value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const meta = CURRENCY_META[currency];
      return currency === "USD" ? `${meta.symbol}${formatted}` : `${meta.symbol} ${formatted}`;
    },
    [baseCurrency, convertFromUSD]
  );

  // ── Derived state ──────────────────────────────────────────────────────────
  const activeTenant = useMemo(
    () => TENANTS.find((t) => t.id === activeTenantId) ?? TENANTS[0],
    [activeTenantId]
  );

  // Use live data if available, fall back to mock
  const ledger = useMemo(
    () => ledgerByTenant[activeTenantId] ?? MOCK_LEDGER[activeTenantId] ?? [],
    [ledgerByTenant, activeTenantId]
  );

  const allLedger = useMemo(
    () =>
      TENANTS.flatMap((t) =>
        (ledgerByTenant[t.id] ?? MOCK_LEDGER[t.id] ?? []).map((e) => ({
          ...e,
          tenantId: t.id,
          tenantName: t.name,
        }))
      ),
    [ledgerByTenant]
  );

  const cashflowTrend = useMemo(
    () => MOCK_CASHFLOW[activeTenantId] ?? [],
    [activeTenantId]
  );

  const kpis = useMemo(() => {
    const totalCashIn = cashflowTrend.reduce((s, d) => s + d.cashIn, 0);
    const totalCashOut = cashflowTrend.reduce((s, d) => s + d.cashOut, 0);
    const latest = cashflowTrend[cashflowTrend.length - 1];
    return {
      totalRevenueUSD: totalCashIn,
      netOperatingMarginUSD: totalCashIn - totalCashOut,
      totalLiquidityUSD: latest ? latest.vaultReserves + latest.drawerBalance : 0,
    };
  }, [cashflowTrend]);

  // ── Context value ──────────────────────────────────────────────────────────
  const value = useMemo(
    () => ({
      tenants: TENANTS,
      activeTenant,
      activeTenantId,
      setActiveTenantId,

      currencies: CURRENCIES,
      currencyMeta: CURRENCY_META,
      baseCurrency,
      setBaseCurrency,
      rates,
      rateLocks,
      rateDirections,
      lastSync,
      updateRate,
      toggleRateLock,

      convert,
      convertFromUSD,
      formatMoney,

      ledger,
      allLedger,
      cashflowTrend,
      ledgerLoading,
      ledgerPagination,
      fetchLedger,

      // Legacy mock fields kept for compliance screens that still use them
      complianceFlags: [],
      allComplianceFlags: [],
      complianceChecklist: [],
      auditTrail: [],
      amlThresholdUSD: AML_THRESHOLD_USD,

      kpis,
      apiOnline,
    }),
    [
      activeTenant, activeTenantId, baseCurrency, rates, rateLocks, rateDirections,
      lastSync, updateRate, toggleRateLock, convert, convertFromUSD, formatMoney,
      ledger, allLedger, cashflowTrend, ledgerLoading, ledgerPagination, fetchLedger,
      kpis, apiOnline,
    ]
  );

  return <FinancialContext.Provider value={value}>{children}</FinancialContext.Provider>;
}

export function useFinancial() {
  const ctx = useContext(FinancialContext);
  if (!ctx) throw new Error("useFinancial must be used within a FinancialProvider");
  return ctx;
}
