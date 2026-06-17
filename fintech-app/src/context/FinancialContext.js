import React, { createContext, useContext, useState, useCallback } from 'react';

const FinancialContext = createContext(null);

// Exchange rates relative to USD
const DEFAULT_RATES = {
  USD: 1,
  ZWG: 13.56,
  ZAR: 18.42,
};

const TENANTS = [
  {
    id: 'tenant_main',
    name: 'Main Retail Hub',
    branch: 'Harare CBD',
    complianceHealth: 94,
    status: 'active',
    metrics: {
      totalRevenue: 128450.0,
      netCashFlow: 14320.5,
      pendingAssets: 22100.0,
      drawerBalance: 8540.0,
      vaultReserve: 95000.0,
      processingRegister: 4200.0,
    },
    cashFlowTrend: [
      { day: 'Mon', inflow: 18200, outflow: 14100 },
      { day: 'Tue', inflow: 22500, outflow: 16800 },
      { day: 'Wed', inflow: 19800, outflow: 21000 },
      { day: 'Thu', inflow: 25600, outflow: 18400 },
      { day: 'Fri', inflow: 31200, outflow: 22100 },
      { day: 'Sat', inflow: 14500, outflow: 9800 },
      { day: 'Sun', inflow: 8200, outflow: 5600 },
    ],
  },
  {
    id: 'tenant_harare',
    name: 'Harare Sub-Branch',
    branch: 'Avondale',
    complianceHealth: 78,
    status: 'active',
    metrics: {
      totalRevenue: 47800.0,
      netCashFlow: -2100.5,
      pendingAssets: 8900.0,
      drawerBalance: 3200.0,
      vaultReserve: 38000.0,
      processingRegister: 1800.0,
    },
    cashFlowTrend: [
      { day: 'Mon', inflow: 6200, outflow: 7100 },
      { day: 'Tue', inflow: 8100, outflow: 6800 },
      { day: 'Wed', inflow: 7400, outflow: 8900 },
      { day: 'Thu', inflow: 9200, outflow: 7600 },
      { day: 'Fri', inflow: 11000, outflow: 9400 },
      { day: 'Sat', inflow: 4800, outflow: 3200 },
      { day: 'Sun', inflow: 2100, outflow: 1900 },
    ],
  },
  {
    id: 'tenant_bulawayo',
    name: 'Bulawayo Branch',
    branch: 'City Centre',
    complianceHealth: 88,
    status: 'review',
    metrics: {
      totalRevenue: 83200.0,
      netCashFlow: 9450.0,
      pendingAssets: 14600.0,
      drawerBalance: 5900.0,
      vaultReserve: 71000.0,
      processingRegister: 2800.0,
    },
    cashFlowTrend: [
      { day: 'Mon', inflow: 11200, outflow: 9800 },
      { day: 'Tue', inflow: 14800, outflow: 11200 },
      { day: 'Wed', inflow: 12600, outflow: 14100 },
      { day: 'Thu', inflow: 16800, outflow: 12900 },
      { day: 'Fri', inflow: 19400, outflow: 15600 },
      { day: 'Sat', inflow: 9200, outflow: 7400 },
      { day: 'Sun', inflow: 5100, outflow: 3800 },
    ],
  },
];

const COMPLIANCE_FLAGS = {
  tenant_main: [
    {
      id: 'cf_001',
      type: 'AML_THRESHOLD',
      severity: 'high',
      message: 'Cash transaction exceeds $10,000 AML threshold',
      amount: 12500,
      currency: 'USD',
      timestamp: '2025-01-15T09:42:00Z',
      transactionRef: 'TXN-20250115-0042',
      status: 'pending_review',
    },
    {
      id: 'cf_002',
      type: 'SUSPICIOUS_PATTERN',
      severity: 'medium',
      message: 'Structured cash deposits detected — possible smurfing pattern',
      amount: 9800,
      currency: 'USD',
      timestamp: '2025-01-14T14:18:00Z',
      transactionRef: 'TXN-20250114-0118',
      status: 'under_investigation',
    },
    {
      id: 'cf_003',
      type: 'REGULATORY_FILING',
      severity: 'low',
      message: 'Monthly CTR submission due in 3 days',
      amount: null,
      currency: null,
      timestamp: '2025-01-13T08:00:00Z',
      transactionRef: 'REG-CTR-2025-01',
      status: 'due',
    },
  ],
  tenant_harare: [
    {
      id: 'cf_004',
      type: 'AML_THRESHOLD',
      severity: 'high',
      message: 'Foreign currency exchange exceeds reportable limit',
      amount: 11200,
      currency: 'USD',
      timestamp: '2025-01-15T11:05:00Z',
      transactionRef: 'TXN-20250115-0201',
      status: 'escalated',
    },
    {
      id: 'cf_005',
      type: 'VAULT_DISCREPANCY',
      severity: 'high',
      message: 'Vault count mismatch of $340 — recount required',
      amount: 340,
      currency: 'USD',
      timestamp: '2025-01-15T16:30:00Z',
      transactionRef: 'VAULT-20250115',
      status: 'pending_review',
    },
    {
      id: 'cf_006',
      type: 'REGULATORY_FILING',
      severity: 'medium',
      message: 'Quarterly ZIMRA foreign currency report overdue',
      amount: null,
      currency: null,
      timestamp: '2025-01-10T08:00:00Z',
      transactionRef: 'REG-ZIMRA-Q4-2024',
      status: 'overdue',
    },
  ],
  tenant_bulawayo: [
    {
      id: 'cf_007',
      type: 'SUSPICIOUS_PATTERN',
      severity: 'medium',
      message: 'Unusually high ZWG-to-USD conversion volume on single day',
      amount: 680000,
      currency: 'ZWG',
      timestamp: '2025-01-14T10:22:00Z',
      transactionRef: 'TXN-20250114-0340',
      status: 'under_investigation',
    },
    {
      id: 'cf_008',
      type: 'REGULATORY_FILING',
      severity: 'low',
      message: 'Monthly compliance health report ready for submission',
      amount: null,
      currency: null,
      timestamp: '2025-01-15T08:00:00Z',
      transactionRef: 'REG-HEALTH-2025-01',
      status: 'ready',
    },
  ],
};

const LEDGER_ENTRIES = {
  tenant_main: [
    { id: 'L001', date: '2025-01-15', description: 'Retail POS Sale — Batch 44', type: 'inflow', originalCurrency: 'USD', originalAmount: 3240.0, category: 'sales', ref: 'POS-2025-0044', flagged: false },
    { id: 'L002', date: '2025-01-15', description: 'Supplier Payment — FreshProduce Ltd', type: 'outflow', originalCurrency: 'ZWG', originalAmount: 87480.0, category: 'procurement', ref: 'PAY-2025-0088', flagged: false },
    { id: 'L003', date: '2025-01-15', description: 'CASH DEPOSIT — Counter 3', type: 'inflow', originalCurrency: 'USD', originalAmount: 12500.0, category: 'cash', ref: 'TXN-20250115-0042', flagged: true },
    { id: 'L004', date: '2025-01-14', description: 'Forex Exchange — ZAR to USD', type: 'inflow', originalCurrency: 'ZAR', originalAmount: 28600.0, category: 'forex', ref: 'FX-2025-0012', flagged: false },
    { id: 'L005', date: '2025-01-14', description: 'Staff Payroll Disbursement', type: 'outflow', originalCurrency: 'USD', originalAmount: 8200.0, category: 'payroll', ref: 'PAY-HR-2025-01', flagged: false },
    { id: 'L006', date: '2025-01-14', description: 'Retail POS Sale — Batch 43', type: 'inflow', originalCurrency: 'USD', originalAmount: 4180.0, category: 'sales', ref: 'POS-2025-0043', flagged: false },
    { id: 'L007', date: '2025-01-13', description: 'Vault Transfer to HQ', type: 'outflow', originalCurrency: 'USD', originalAmount: 25000.0, category: 'vault', ref: 'VLT-2025-0007', flagged: false },
    { id: 'L008', date: '2025-01-13', description: 'Utilities & Rent', type: 'outflow', originalCurrency: 'USD', originalAmount: 1840.0, category: 'overhead', ref: 'EXP-2025-0021', flagged: false },
    { id: 'L009', date: '2025-01-12', description: 'ecocash Settlements', type: 'inflow', originalCurrency: 'ZWG', originalAmount: 54200.0, category: 'digital', ref: 'ECO-2025-0091', flagged: false },
    { id: 'L010', date: '2025-01-12', description: 'Structured Deposits x4', type: 'inflow', originalCurrency: 'USD', originalAmount: 9800.0, category: 'cash', ref: 'TXN-20250114-0118', flagged: true },
  ],
  tenant_harare: [
    { id: 'L011', date: '2025-01-15', description: 'Retail POS Sale — Batch 12', type: 'inflow', originalCurrency: 'USD', originalAmount: 1840.0, category: 'sales', ref: 'POS-2025-H012', flagged: false },
    { id: 'L012', date: '2025-01-15', description: 'Forex Exchange — USD to ZWG (FLAGGED)', type: 'inflow', originalCurrency: 'USD', originalAmount: 11200.0, category: 'forex', ref: 'TXN-20250115-0201', flagged: true },
    { id: 'L013', date: '2025-01-15', description: 'Supplier Payment — BuildMart', type: 'outflow', originalCurrency: 'ZWG', originalAmount: 42000.0, category: 'procurement', ref: 'PAY-2025-H041', flagged: false },
    { id: 'L014', date: '2025-01-14', description: 'Petty Cash Disbursement', type: 'outflow', originalCurrency: 'USD', originalAmount: 320.0, category: 'cash', ref: 'PCH-2025-H014', flagged: false },
    { id: 'L015', date: '2025-01-14', description: 'Retail POS Sale — Batch 11', type: 'inflow', originalCurrency: 'USD', originalAmount: 2100.0, category: 'sales', ref: 'POS-2025-H011', flagged: false },
  ],
  tenant_bulawayo: [
    { id: 'L016', date: '2025-01-15', description: 'Retail POS Sale — Batch 28', type: 'inflow', originalCurrency: 'USD', originalAmount: 5620.0, category: 'sales', ref: 'POS-2025-B028', flagged: false },
    { id: 'L017', date: '2025-01-15', description: 'Supplier Payment — AgriCo', type: 'outflow', originalCurrency: 'ZWG', originalAmount: 108000.0, category: 'procurement', ref: 'PAY-2025-B082', flagged: false },
    { id: 'L018', date: '2025-01-14', description: 'ZWG Mass Conversion — FLAGGED', type: 'inflow', originalCurrency: 'ZWG', originalAmount: 680000.0, category: 'forex', ref: 'TXN-20250114-0340', flagged: true },
    { id: 'L019', date: '2025-01-14', description: 'Staff Payroll Disbursement', type: 'outflow', originalCurrency: 'USD', originalAmount: 6800.0, category: 'payroll', ref: 'PAY-HR-2025-B01', flagged: false },
    { id: 'L020', date: '2025-01-13', description: 'ecocash Settlements', type: 'inflow', originalCurrency: 'ZWG', originalAmount: 91400.0, category: 'digital', ref: 'ECO-2025-B041', flagged: false },
  ],
};

export function FinancialProvider({ children }) {
  const [activeTenantId, setActiveTenantId] = useState('tenant_main');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [exchangeRates, setExchangeRates] = useState(DEFAULT_RATES);

  const activeTenant = TENANTS.find((t) => t.id === activeTenantId);
  const complianceFlags = COMPLIANCE_FLAGS[activeTenantId] || [];
  const ledgerEntries = LEDGER_ENTRIES[activeTenantId] || [];

  const convertToBase = useCallback(
    (amount, fromCurrency) => {
      const amountInUSD = amount / exchangeRates[fromCurrency];
      return amountInUSD * exchangeRates[baseCurrency];
    },
    [baseCurrency, exchangeRates]
  );

  const formatCurrency = useCallback(
    (amount, currency = baseCurrency) => {
      const symbols = { USD: '$', ZWG: 'ZWG ', ZAR: 'R' };
      const symbol = symbols[currency] || currency + ' ';
      return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    complianceFlags,
    ledgerEntries,
    allLedgerEntries: LEDGER_ENTRIES,
  };

  return <FinancialContext.Provider value={value}>{children}</FinancialContext.Provider>;
}

export function useFinancial() {
  const ctx = useContext(FinancialContext);
  if (!ctx) throw new Error('useFinancial must be used within FinancialProvider');
  return ctx;
}
