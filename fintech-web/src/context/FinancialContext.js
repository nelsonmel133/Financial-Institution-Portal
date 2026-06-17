"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ------------------------------------------------------------------ */
/*  Static reference data                                              */
/* ------------------------------------------------------------------ */

export const CURRENCIES = ["USD", "ZWG", "ZAR"];

export const CURRENCY_META = {
  USD: { symbol: "$", name: "US Dollar", suffix: false },
  ZWG: { symbol: "ZWG", name: "Zimbabwe Gold", suffix: false },
  ZAR: { symbol: "R", name: "South African Rand", suffix: false },
};

// Units of currency per 1 USD. Treated as the "live" coefficients.
const BASE_RATES = {
  USD: 1,
  ZWG: 13.82,
  ZAR: 18.46,
};

export const AML_THRESHOLD_USD = 5000;

export const TENANTS = [
  {
    id: "main-retail",
    name: "Main Retail Hub",
    location: "Harare CBD",
    complianceScore: 98,
  },
  {
    id: "harare-sub",
    name: "Harare Sub-Branch",
    location: "Borrowdale",
    complianceScore: 94,
  },
  {
    id: "bulawayo-branch",
    name: "Bulawayo Branch",
    location: "Bulawayo CBD",
    complianceScore: 91,
  },
];

/* ------------------------------------------------------------------ */
/*  Unified ledger (canonical amounts stored in USD)                   */
/* ------------------------------------------------------------------ */

const LEDGER = {
  "main-retail": [
    {
      id: "MRH-1001",
      date: "2026-06-15",
      time: "08:14",
      description: "POS Settlement \u2013 Card Sales",
      category: "Retail Sales",
      type: "inflow",
      amountUSD: 4820.5,
      originalAmount: 4820.5,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "POS-88231",
    },
    {
      id: "MRH-1002",
      date: "2026-06-15",
      time: "09:02",
      description: "Cash Deposit \u2013 Vault Sweep",
      category: "Cash Deposit",
      type: "inflow",
      amountUSD: 6096.96,
      originalAmount: 84250.0,
      originalCurrency: "ZWG",
      status: "Cleared",
      reference: "VLT-50112",
    },
    {
      id: "MRH-1003",
      date: "2026-06-14",
      time: "13:40",
      description: "Supplier Settlement \u2013 Beverage Distributor",
      category: "Supplier Settlement",
      type: "outflow",
      amountUSD: 3200.0,
      originalAmount: 3200.0,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "SUP-22871",
    },
    {
      id: "MRH-1004",
      date: "2026-06-14",
      time: "10:05",
      description: "ATM Replenishment \u2013 Lobby Unit",
      category: "ATM Replenishment",
      type: "outflow",
      amountUSD: 1993.93,
      originalAmount: 36800.0,
      originalCurrency: "ZAR",
      status: "Cleared",
      reference: "ATM-00417",
    },
    {
      id: "MRH-1005",
      date: "2026-06-13",
      time: "16:00",
      description: "Payroll \u2013 Retail Staff (Bi-Weekly)",
      category: "Payroll",
      type: "outflow",
      amountUSD: 5400.0,
      originalAmount: 5400.0,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "PAY-30056",
    },
    {
      id: "MRH-1006",
      date: "2026-06-13",
      time: "11:22",
      description: "FX Exchange Desk \u2013 Spread Commission",
      category: "FX Exchange Desk",
      type: "inflow",
      amountUSD: 142.5,
      originalAmount: 142.5,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "FXD-11290",
    },
    {
      id: "MRH-1007",
      date: "2026-06-12",
      time: "15:48",
      description: "Cross-Border Remittance \u2013 Supplier (Johannesburg)",
      category: "Cross-Border Remittance",
      type: "outflow",
      amountUSD: 5000.0,
      originalAmount: 92300.0,
      originalCurrency: "ZAR",
      status: "Flagged",
      reference: "XBR-77004",
    },
    {
      id: "MRH-1008",
      date: "2026-06-12",
      time: "09:18",
      description: "Retail Sales \u2013 Bulk Order (Walk-in)",
      category: "Retail Sales",
      type: "inflow",
      amountUSD: 4051.74,
      originalAmount: 56000.0,
      originalCurrency: "ZWG",
      status: "Cleared",
      reference: "POS-88114",
    },
    {
      id: "MRH-1009",
      date: "2026-06-11",
      time: "17:30",
      description: "Rent & Overheads \u2013 Branch Premises",
      category: "Rent & Overheads",
      type: "outflow",
      amountUSD: 1800.0,
      originalAmount: 1800.0,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "OVH-00982",
    },
    {
      id: "MRH-1010",
      date: "2026-06-10",
      time: "08:55",
      description: "Cash Deposit \u2013 Overnight Drop Safe",
      category: "Cash Deposit",
      type: "inflow",
      amountUSD: 3500.0,
      originalAmount: 3500.0,
      originalCurrency: "USD",
      status: "Pending",
      reference: "VLT-50098",
    },
  ],
  "harare-sub": [
    {
      id: "HSB-2001",
      date: "2026-06-15",
      time: "09:30",
      description: "Retail Sales \u2013 Counter Till 2",
      category: "Retail Sales",
      type: "inflow",
      amountUSD: 2150.0,
      originalAmount: 2150.0,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "POS-41207",
    },
    {
      id: "HSB-2002",
      date: "2026-06-15",
      time: "10:05",
      description: "Cash Deposit \u2013 Vault Sweep",
      category: "Cash Deposit",
      type: "inflow",
      amountUSD: 3000.0,
      originalAmount: 41460.0,
      originalCurrency: "ZWG",
      status: "Cleared",
      reference: "VLT-21034",
    },
    {
      id: "HSB-2003",
      date: "2026-06-14",
      time: "14:12",
      description: "Supplier Settlement \u2013 Stationery & Packaging",
      category: "Supplier Settlement",
      type: "outflow",
      amountUSD: 1875.5,
      originalAmount: 1875.5,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "SUP-19045",
    },
    {
      id: "HSB-2004",
      date: "2026-06-13",
      time: "16:00",
      description: "Payroll \u2013 Branch Staff (Bi-Weekly)",
      category: "Payroll",
      type: "outflow",
      amountUSD: 3200.0,
      originalAmount: 3200.0,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "PAY-30057",
    },
    {
      id: "HSB-2005",
      date: "2026-06-13",
      time: "08:40",
      description: "ATM Replenishment \u2013 Entrance Unit",
      category: "ATM Replenishment",
      type: "outflow",
      amountUSD: 1000.0,
      originalAmount: 18460.0,
      originalCurrency: "ZAR",
      status: "Cleared",
      reference: "ATM-00298",
    },
    {
      id: "HSB-2006",
      date: "2026-06-12",
      time: "12:55",
      description: "Cross-Border Remittance \u2013 Equipment Vendor (Durban)",
      category: "Cross-Border Remittance",
      type: "outflow",
      amountUSD: 5400.0,
      originalAmount: 5400.0,
      originalCurrency: "USD",
      status: "Flagged",
      reference: "XBR-77005",
    },
    {
      id: "HSB-2007",
      date: "2026-06-12",
      time: "10:10",
      description: "Retail Sales \u2013 Counter Till 1",
      category: "Retail Sales",
      type: "inflow",
      amountUSD: 2000.0,
      originalAmount: 27640.0,
      originalCurrency: "ZWG",
      status: "Cleared",
      reference: "POS-41163",
    },
    {
      id: "HSB-2008",
      date: "2026-06-11",
      time: "17:45",
      description: "Rent & Overheads \u2013 Borrowdale Unit",
      category: "Rent & Overheads",
      type: "outflow",
      amountUSD: 950.0,
      originalAmount: 950.0,
      originalCurrency: "USD",
      status: "Pending",
      reference: "OVH-00983",
    },
  ],
  "bulawayo-branch": [
    {
      id: "BLW-3001",
      date: "2026-06-15",
      time: "09:00",
      description: "Retail Sales \u2013 Counter Till 1",
      category: "Retail Sales",
      type: "inflow",
      amountUSD: 1680.25,
      originalAmount: 1680.25,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "POS-65520",
    },
    {
      id: "BLW-3002",
      date: "2026-06-15",
      time: "11:20",
      description: "FX Exchange Desk \u2013 Spread Commission",
      category: "FX Exchange Desk",
      type: "inflow",
      amountUSD: 500.0,
      originalAmount: 9230.0,
      originalCurrency: "ZAR",
      status: "Cleared",
      reference: "FXD-08821",
    },
    {
      id: "BLW-3003",
      date: "2026-06-14",
      time: "13:15",
      description: "Supplier Settlement \u2013 Cleaning & Maintenance",
      category: "Supplier Settlement",
      type: "outflow",
      amountUSD: 2100.0,
      originalAmount: 2100.0,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "SUP-14432",
    },
    {
      id: "BLW-3004",
      date: "2026-06-13",
      time: "09:50",
      description: "Cash Deposit \u2013 Vault Sweep",
      category: "Cash Deposit",
      type: "inflow",
      amountUSD: 2800.0,
      originalAmount: 2800.0,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "VLT-33871",
    },
    {
      id: "BLW-3005",
      date: "2026-06-13",
      time: "16:00",
      description: "Payroll \u2013 Branch Staff (Bi-Weekly)",
      category: "Payroll",
      type: "outflow",
      amountUSD: 2950.0,
      originalAmount: 2950.0,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "PAY-30058",
    },
    {
      id: "BLW-3006",
      date: "2026-06-11",
      time: "15:05",
      description: "Cross-Border Remittance \u2013 Equipment Vendor (Gauteng)",
      category: "Cross-Border Remittance",
      type: "outflow",
      amountUSD: 7000.0,
      originalAmount: 96740.0,
      originalCurrency: "ZWG",
      status: "Flagged",
      reference: "XBR-77002",
    },
    {
      id: "BLW-3007",
      date: "2026-06-10",
      time: "08:30",
      description: "ATM Replenishment \u2013 Lobby Unit",
      category: "ATM Replenishment",
      type: "outflow",
      amountUSD: 1500.0,
      originalAmount: 1500.0,
      originalCurrency: "USD",
      status: "Cleared",
      reference: "ATM-00154",
    },
    {
      id: "BLW-3008",
      date: "2026-06-10",
      time: "17:10",
      description: "Retail Sales \u2013 Counter Till 2",
      category: "Retail Sales",
      type: "inflow",
      amountUSD: 1925.75,
      originalAmount: 1925.75,
      originalCurrency: "USD",
      status: "Pending",
      reference: "POS-65498",
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Cash flow trend (last 7 trading days), values stored in USD        */
/* ------------------------------------------------------------------ */

const CASHFLOW_TREND = {
  "main-retail": [
    { date: "2026-06-09", cashIn: 8200, cashOut: 6100, vaultReserves: 142000, drawerBalance: 18500 },
    { date: "2026-06-10", cashIn: 9100, cashOut: 7300, vaultReserves: 143800, drawerBalance: 19200 },
    { date: "2026-06-11", cashIn: 7600, cashOut: 12450, vaultReserves: 139900, drawerBalance: 17850 },
    { date: "2026-06-12", cashIn: 10250, cashOut: 6800, vaultReserves: 144300, drawerBalance: 20500 },
    { date: "2026-06-13", cashIn: 8950, cashOut: 7150, vaultReserves: 146100, drawerBalance: 19900 },
    { date: "2026-06-14", cashIn: 9700, cashOut: 8200, vaultReserves: 147600, drawerBalance: 21300 },
    { date: "2026-06-15", cashIn: 10960, cashOut: 9200, vaultReserves: 148900, drawerBalance: 22400 },
  ],
  "harare-sub": [
    { date: "2026-06-09", cashIn: 4100, cashOut: 3200, vaultReserves: 58000, drawerBalance: 8200 },
    { date: "2026-06-10", cashIn: 4400, cashOut: 3650, vaultReserves: 58750, drawerBalance: 8650 },
    { date: "2026-06-11", cashIn: 3950, cashOut: 6400, vaultReserves: 56300, drawerBalance: 7100 },
    { date: "2026-06-12", cashIn: 5000, cashOut: 3300, vaultReserves: 58000, drawerBalance: 8900 },
    { date: "2026-06-13", cashIn: 4300, cashOut: 4150, vaultReserves: 58900, drawerBalance: 9050 },
    { date: "2026-06-14", cashIn: 4600, cashOut: 3700, vaultReserves: 59600, drawerBalance: 9400 },
    { date: "2026-06-15", cashIn: 5150, cashOut: 3950, vaultReserves: 60800, drawerBalance: 10100 },
  ],
  "bulawayo-branch": [
    { date: "2026-06-09", cashIn: 3100, cashOut: 2400, vaultReserves: 41000, drawerBalance: 6100 },
    { date: "2026-06-10", cashIn: 3300, cashOut: 2700, vaultReserves: 41600, drawerBalance: 6700 },
    { date: "2026-06-11", cashIn: 2950, cashOut: 9100, vaultReserves: 38400, drawerBalance: 5550 },
    { date: "2026-06-12", cashIn: 3450, cashOut: 2500, vaultReserves: 39350, drawerBalance: 6500 },
    { date: "2026-06-13", cashIn: 3700, cashOut: 2950, vaultReserves: 40100, drawerBalance: 7250 },
    { date: "2026-06-14", cashIn: 3200, cashOut: 2650, vaultReserves: 40650, drawerBalance: 7800 },
    { date: "2026-06-15", cashIn: 2180, cashOut: 2100, vaultReserves: 40730, drawerBalance: 7880 },
  ],
};

/* ------------------------------------------------------------------ */
/*  Compliance: AML flags, checklists, audit trail                     */
/* ------------------------------------------------------------------ */

const COMPLIANCE_FLAGS = {
  "main-retail": [
    {
      id: "FLG-7001",
      ledgerRef: "MRH-1007",
      date: "2026-06-12",
      description: "Cross-Border Remittance \u2013 Supplier (Johannesburg)",
      amountUSD: 5000.0,
      originalAmount: 92300.0,
      originalCurrency: "ZAR",
      reason: "Single transaction at AML cash-equivalent threshold",
      riskLevel: "High",
      status: "Under Review",
    },
    {
      id: "FLG-7002",
      ledgerRef: "MRH-1002 / MRH-1010",
      date: "2026-06-15",
      description: "Repeated sub-threshold vault deposits within 48 hours",
      amountUSD: 9596.96,
      originalAmount: null,
      originalCurrency: null,
      reason: "Potential structuring pattern \u2013 cumulative deposits flagged for review",
      riskLevel: "Medium",
      status: "Monitoring",
    },
  ],
  "harare-sub": [
    {
      id: "FLG-7003",
      ledgerRef: "HSB-2006",
      date: "2026-06-12",
      description: "Cross-Border Remittance \u2013 Equipment Vendor (Durban)",
      amountUSD: 5400.0,
      originalAmount: 5400.0,
      originalCurrency: "USD",
      reason: "Single transaction exceeds AML cash-equivalent threshold",
      riskLevel: "High",
      status: "Filed",
    },
  ],
  "bulawayo-branch": [
    {
      id: "FLG-7004",
      ledgerRef: "BLW-3006",
      date: "2026-06-11",
      description: "Cross-Border Remittance \u2013 Equipment Vendor (Gauteng)",
      amountUSD: 7000.0,
      originalAmount: 96740.0,
      originalCurrency: "ZWG",
      reason: "Single transaction significantly exceeds AML cash-equivalent threshold",
      riskLevel: "Critical",
      status: "Escalated",
    },
    {
      id: "FLG-7005",
      ledgerRef: "BLW-3008",
      date: "2026-06-10",
      description: "Retail Sales \u2013 Counter Till 2 (pending settlement)",
      amountUSD: 1925.75,
      originalAmount: 1925.75,
      originalCurrency: "USD",
      reason: "Pending settlement exceeding standard clearing window",
      riskLevel: "Low",
      status: "Monitoring",
    },
  ],
};

const COMPLIANCE_CHECKLIST = {
  "main-retail": [
    { id: "CHK-1", label: "KYC Documentation Refresh", status: "Passed", lastChecked: "2026-06-14" },
    { id: "CHK-2", label: "Cross-Border Declaration Filing", status: "Passed", lastChecked: "2026-06-13" },
    { id: "CHK-3", label: "Cash Threshold Monitoring (CTR)", status: "Passed", lastChecked: "2026-06-15" },
    { id: "CHK-4", label: "Sanctions List Screening", status: "Passed", lastChecked: "2026-06-12" },
    { id: "CHK-5", label: "Internal Audit \u2013 Q2 2026", status: "Pending", lastChecked: "2026-06-10" },
    { id: "CHK-6", label: "Vault Reconciliation \u2013 Daily", status: "Passed", lastChecked: "2026-06-15" },
  ],
  "harare-sub": [
    { id: "CHK-7", label: "KYC Documentation Refresh", status: "Passed", lastChecked: "2026-06-11" },
    { id: "CHK-8", label: "Cross-Border Declaration Filing", status: "Passed", lastChecked: "2026-06-12" },
    { id: "CHK-9", label: "Cash Threshold Monitoring (CTR)", status: "Pending", lastChecked: "2026-06-09" },
    { id: "CHK-10", label: "Sanctions List Screening", status: "Passed", lastChecked: "2026-06-12" },
    { id: "CHK-11", label: "Internal Audit \u2013 Q2 2026", status: "Passed", lastChecked: "2026-06-08" },
    { id: "CHK-12", label: "Vault Reconciliation \u2013 Daily", status: "Passed", lastChecked: "2026-06-15" },
  ],
  "bulawayo-branch": [
    { id: "CHK-13", label: "KYC Documentation Refresh", status: "Passed", lastChecked: "2026-06-10" },
    { id: "CHK-14", label: "Cross-Border Declaration Filing", status: "Failed", lastChecked: "2026-06-11" },
    { id: "CHK-15", label: "Cash Threshold Monitoring (CTR)", status: "Pending", lastChecked: "2026-06-11" },
    { id: "CHK-16", label: "Sanctions List Screening", status: "Pending", lastChecked: "2026-06-09" },
    { id: "CHK-17", label: "Internal Audit \u2013 Q2 2026", status: "Passed", lastChecked: "2026-06-07" },
    { id: "CHK-18", label: "Vault Reconciliation \u2013 Daily", status: "Passed", lastChecked: "2026-06-15" },
  ],
};

const AUDIT_TRAIL = [
  {
    id: "AUD-9001",
    timestamp: "2026-06-15 08:00",
    actor: "System",
    action: "Exchange Rate Sync",
    tenant: "All Tenants",
    details: "Automated FX rate refresh executed for USD / ZWG / ZAR coefficients.",
    hash: "0x7a1f9c...c92e",
  },
  {
    id: "AUD-9002",
    timestamp: "2026-06-15 07:45",
    actor: "T. Moyo \u2013 Compliance Officer",
    action: "CTR Filed",
    tenant: "Harare Sub-Branch",
    details: "Cash Transaction Report filed for reference HSB-2006 ($5,400.00 USD-equivalent).",
    hash: "0x3d88e1...11ab",
  },
  {
    id: "AUD-9003",
    timestamp: "2026-06-14 16:20",
    actor: "R. Chikuni \u2013 Branch Manager",
    action: "Vault Reconciliation",
    tenant: "Main Retail Hub",
    details: "End-of-day vault count reconciled against ledger, variance recorded at $0.00.",
    hash: "0xa1c43f...77f0",
  },
  {
    id: "AUD-9004",
    timestamp: "2026-06-13 11:05",
    actor: "System",
    action: "AML Threshold Flag",
    tenant: "Bulawayo Branch",
    details: "Reference BLW-3006 flagged for exceeding the $5,000.00 USD-equivalent single transaction threshold.",
    hash: "0x55be02...0d3c",
  },
  {
    id: "AUD-9005",
    timestamp: "2026-06-12 14:40",
    actor: "N. Sibanda \u2013 Compliance Officer",
    action: "Sanctions Screening",
    tenant: "All Tenants",
    details: "Batch sanctions list screening completed across all tenant ledgers, 0 matches returned.",
    hash: "0x8e2144...44aa",
  },
  {
    id: "AUD-9006",
    timestamp: "2026-06-11 09:15",
    actor: "Treasury Desk",
    action: "Exchange Rate Override",
    tenant: "All Tenants",
    details: "Manual override applied to the USD / ZAR coefficient ahead of scheduled FX sync.",
    hash: "0x019fbb...bb6c",
  },
  {
    id: "AUD-9007",
    timestamp: "2026-06-10 17:30",
    actor: "T. Moyo \u2013 Compliance Officer",
    action: "Internal Audit Update",
    tenant: "Main Retail Hub",
    details: "Q2 2026 internal audit milestone marked complete pending sign-off.",
    hash: "0xc7d392...920e",
  },
  {
    id: "AUD-9008",
    timestamp: "2026-06-09 08:30",
    actor: "System",
    action: "Tenant Health Check",
    tenant: "All Tenants",
    details: "Automated compliance score recalculation executed for all branch tenants.",
    hash: "0x4419e0...e0a7",
  },
];

/* ------------------------------------------------------------------ */
/*  Context plumbing                                                    */
/* ------------------------------------------------------------------ */

const FinancialContext = createContext(null);

export function FinancialProvider({ children }) {
  const [activeTenantId, setActiveTenantId] = useState(TENANTS[0].id);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [rates, setRates] = useState(BASE_RATES);
  const [rateLocks, setRateLocks] = useState({ USD: true, ZWG: false, ZAR: false });
  const [rateDirections, setRateDirections] = useState({ USD: "flat", ZWG: "flat", ZAR: "flat" });
  const [lastSync, setLastSync] = useState("08:00:00");

  const tickRef = useRef(0);

  // Simulated "live" FX feed: gently nudges unlocked, non-USD rates every few seconds.
  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      setRates((prev) => {
        const next = { ...prev };
        const directions = {};
        CURRENCIES.forEach((code) => {
          if (code === "USD" || rateLocks[code]) {
            directions[code] = "flat";
            return;
          }
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
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
          now.getSeconds()
        ).padStart(2, "0")}`
      );
    }, 6000);

    return () => clearInterval(interval);
  }, [rateLocks]);

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

  // Convert a canonical USD figure into any supported currency using live coefficients.
  const convertFromUSD = useCallback(
    (amountUSD, currency) => {
      const target = currency || baseCurrency;
      return amountUSD * (rates[target] ?? 1);
    },
    [rates, baseCurrency]
  );

  // Convert between any two supported currencies.
  const convert = useCallback(
    (amount, fromCurrency, toCurrency) => {
      const fromRate = rates[fromCurrency] ?? 1;
      const toRate = rates[toCurrency] ?? 1;
      return (amount / fromRate) * toRate;
    },
    [rates]
  );

  // Format a canonical USD figure into a localized monetary string for any currency.
  const formatMoney = useCallback(
    (amountUSD, currencyOverride) => {
      const currency = currencyOverride || baseCurrency;
      const value = convertFromUSD(amountUSD, currency);
      const formatted = value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const meta = CURRENCY_META[currency];
      if (currency === "USD") return `${meta.symbol}${formatted}`;
      return `${meta.symbol} ${formatted}`;
    },
    [baseCurrency, convertFromUSD]
  );

  const activeTenant = useMemo(
    () => TENANTS.find((t) => t.id === activeTenantId) ?? TENANTS[0],
    [activeTenantId]
  );

  const ledger = useMemo(() => LEDGER[activeTenantId] ?? [], [activeTenantId]);
  const allLedger = useMemo(
    () =>
      Object.entries(LEDGER).flatMap(([tenantId, entries]) =>
        entries.map((entry) => ({
          ...entry,
          tenantId,
          tenantName: TENANTS.find((t) => t.id === tenantId)?.name ?? tenantId,
        }))
      ),
    []
  );

  const cashflowTrend = useMemo(() => CASHFLOW_TREND[activeTenantId] ?? [], [activeTenantId]);

  const complianceFlags = useMemo(() => COMPLIANCE_FLAGS[activeTenantId] ?? [], [activeTenantId]);
  const allComplianceFlags = useMemo(
    () =>
      Object.entries(COMPLIANCE_FLAGS).flatMap(([tenantId, flags]) =>
        flags.map((flag) => ({
          ...flag,
          tenantId,
          tenantName: TENANTS.find((t) => t.id === tenantId)?.name ?? tenantId,
        }))
      ),
    []
  );

  const complianceChecklist = useMemo(
    () => COMPLIANCE_CHECKLIST[activeTenantId] ?? [],
    [activeTenantId]
  );

  // KPI roll-ups derived from the 7-day cash flow trend, expressed in USD.
  const kpis = useMemo(() => {
    const totalCashIn = cashflowTrend.reduce((sum, day) => sum + day.cashIn, 0);
    const totalCashOut = cashflowTrend.reduce((sum, day) => sum + day.cashOut, 0);
    const latest = cashflowTrend[cashflowTrend.length - 1];
    return {
      totalRevenueUSD: totalCashIn,
      netOperatingMarginUSD: totalCashIn - totalCashOut,
      totalLiquidityUSD: latest ? latest.vaultReserves + latest.drawerBalance : 0,
    };
  }, [cashflowTrend]);

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

      complianceFlags,
      allComplianceFlags,
      complianceChecklist,
      auditTrail: AUDIT_TRAIL,
      amlThresholdUSD: AML_THRESHOLD_USD,

      kpis,
    }),
    [
      activeTenant,
      activeTenantId,
      baseCurrency,
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
      complianceFlags,
      allComplianceFlags,
      complianceChecklist,
      kpis,
    ]
  );

  return <FinancialContext.Provider value={value}>{children}</FinancialContext.Provider>;
}

export function useFinancial() {
  const ctx = useContext(FinancialContext);
  if (!ctx) {
    throw new Error("useFinancial must be used within a FinancialProvider");
  }
  return ctx;
}
