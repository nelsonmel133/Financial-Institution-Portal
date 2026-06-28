import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  ensureToken,
  exchangeRates as fetchExchangeRates,
  listLedgerEntries,
  getTenantDashboard,
  TENANT_IDS,
} from '../lib/api';

const FinancialContext = createContext(null);

const DEFAULT_RATES = { USD: 1, ZWG: 13.56, ZAR: 18.42 };

export const TENANTS = [
  { id: 'tenant_main',     name: 'Main Retail Hub',    branch: 'Harare CBD',  complianceHealth: 94, status: 'active' },
  { id: 'tenant_harare',   name: 'Harare Sub-Branch',  branch: 'Avondale',    complianceHealth: 78, status: 'active' },
  { id: 'tenant_bulawayo', name: 'Bulawayo Branch',    branch: 'City Centre', complianceHealth: 88, status: 'review' },
];

// Mock fallback metrics (shown while API loads or when offline)
const MOCK_METRICS = {
  tenant_main:     { totalRevenue: 128450, netCashFlow: 14320, pendingAssets: 22100, drawerBalance: 8540,  vaultReserve: 95000, processingRegister: 4200 },
  tenant_harare:   { totalRevenue: 47800,  netCashFlow: -2100, pendingAssets: 8900,  drawerBalance: 3200,  vaultReserve: 38000, processingRegister: 1800 },
  tenant_bulawayo: { totalRevenue: 83200,  netCashFlow: 9450,  pendingAssets: 14600, drawerBalance: 5900,  vaultReserve: 71000, processingRegister: 2800 },
};

const MOCK_LEDGER = {
  tenant_main:     [{ id: 'L001', date: '2026-06-15', description: 'Retail POS Sale', type: 'inflow',  originalCurrency: 'USD', originalAmount: 3240,  category: 'sales',  flagged: false }],
  tenant_harare:   [{ id: 'L011', date: '2026-06-15', description: 'Retail POS Sale', type: 'inflow',  originalCurrency: 'USD', originalAmount: 1840,  category: 'sales',  flagged: false }],
  tenant_bulawayo: [{ id: 'L016', date: '2026-06-15', description: 'Retail POS Sale', type: 'inflow',  originalCurrency: 'USD', originalAmount: 5620,  category: 'sales',  flagged: false }],
};

function mapApiLedger(entry) {
  return {
    id: entry.reference_number ?? entry.id,
    date: (entry.transaction_date ?? entry.created_at ?? '').slice(0, 10),
    description: entry.description,
    type: 'inflow',
    originalCurrency: entry.original_currency,
    originalAmount: Number(entry.amount),
    category: entry.compliance_category ?? 'Routine',
    ref: entry.reference_number,
    flagged: ['FLAGGED', 'ESCALATED', 'BLOCKED'].includes(entry.compliance_status),
    riskScore: entry.risk_score,
    auditSummary: entry.llm_audit_summary,
  };
}

export function FinancialProvider({ children }) {
  const [activeTenantId, setActiveTenantId] = useState('tenant_main');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [exchangeRates, setExchangeRates] = useState(DEFAULT_RATES);
  const [apiOnline, setApiOnline] = useState(false);
  const [ledgerByTenant, setLedgerByTenant] = useState({});
  const [dashboardByTenant, setDashboardByTenant] = useState({});
  const [loading, setLoading] = useState(false);
  const bootstrapped = useRef(false);

  // ── Bootstrap: fetch rates and prime token for first tenant ─────────────
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      try {
        const ratesData = await fetchExchangeRates();
        const parsed = {};
        for (const [k, v] of Object.entries(ratesData.rates ?? {})) parsed[k] = Number(v);
        if (parsed.USD) setExchangeRates((p) => ({ ...p, ...parsed }));
        setApiOnline(true);
      } catch (_) {
        setApiOnline(false);
      }
    })();
  }, []);

  // ── Fetch ledger + dashboard for active tenant when API comes online ────
  useEffect(() => {
    if (!apiOnline) return;

    (async () => {
      setLoading(true);
      try {
        await ensureToken(activeTenantId);

        const [ledgerData, dashData] = await Promise.all([
          listLedgerEntries(activeTenantId, { pageSize: 50 }),
          getTenantDashboard(activeTenantId),
        ]);

        setLedgerByTenant((p) => ({
          ...p,
          [activeTenantId]: (ledgerData.items ?? []).map(mapApiLedger),
        }));

        setDashboardByTenant((p) => ({ ...p, [activeTenantId]: dashData }));
      } catch (err) {
        console.warn('App API fetch failed:', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeTenantId, apiOnline]);

  const activeTenant = TENANTS.find((t) => t.id === activeTenantId);

  const ledgerEntries = ledgerByTenant[activeTenantId] ?? MOCK_LEDGER[activeTenantId] ?? [];

  // Build metrics from dashboard data if available, else fall back to mock
  const dash = dashboardByTenant[activeTenantId];
  const metrics = dash
    ? {
        totalRevenue: Number(dash.total_volume_usd),
        netCashFlow: Number(dash.net_flow_usd),
        pendingAssets: 0,
        drawerBalance: 0,
        vaultReserve: 0,
        processingRegister: 0,
        flaggedCount: dash.flagged_entries,
        ctrCount: dash.ctr_required_count,
        sarCount: dash.sar_required_count,
      }
    : (MOCK_METRICS[activeTenantId] ?? {});

  const convertToBase = useCallback(
    (amount, fromCurrency) =>
      (amount / (exchangeRates[fromCurrency] ?? 1)) * (exchangeRates[baseCurrency] ?? 1),
    [baseCurrency, exchangeRates]
  );

  const formatCurrency = useCallback(
    (amount, currency = baseCurrency) => {
      const symbols = { USD: '$', ZWG: 'ZWG ', ZAR: 'R' };
      const sym = symbols[currency] ?? `${currency} `;
      return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    [baseCurrency]
  );

  const updateExchangeRate = useCallback((currency, newRate) => {
    setExchangeRates((prev) => ({ ...prev, [currency]: parseFloat(newRate) || prev[currency] }));
  }, []);

  const value = {
    tenants: TENANTS,
    activeTenantId,
    setActiveTenantId,
    activeTenant,
    baseCurrency,
    setBaseCurrency,
    exchangeRates,
    updateExchangeRate,
    convertToBase,
    formatCurrency,
    ledgerEntries,
    metrics,
    loading,
    apiOnline,
    // Legacy shape: flat complianceFlags array
    complianceFlags: ledgerEntries.filter((e) => e.flagged),
  };

  return <FinancialContext.Provider value={value}>{children}</FinancialContext.Provider>;
}

export function useFinancial() {
  const ctx = useContext(FinancialContext);
  if (!ctx) throw new Error('useFinancial must be used within FinancialProvider');
  return ctx;
}
