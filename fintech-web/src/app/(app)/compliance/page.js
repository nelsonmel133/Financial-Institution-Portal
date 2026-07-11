"use client";

import {
  ShieldAlert,
  ShieldCheck,
  FileWarning,
  CheckCircle2,
  Clock,
  XCircle,
  History,
  AlertTriangle,
} from "lucide-react";
import { useFinancial } from "@/context/FinancialContext";

const RISK_STYLES = {
  Critical: "bg-rose-100 text-rose-700 ring-rose-200",
  High: "bg-rose-50 text-rose-600 ring-rose-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  Low: "bg-slate-100 text-slate-600 ring-slate-200",
};

const FLAG_STATUS_STYLES = {
  Escalated: "bg-rose-100 text-rose-700 ring-rose-200",
  "Under Review": "bg-amber-50 text-amber-700 ring-amber-200",
  Monitoring: "bg-slate-100 text-slate-600 ring-slate-200",
  Filed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function Badge({ label, styles }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}

function ChecklistStatusIcon({ status }) {
  if (status === "Passed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "Pending") return <Clock className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-rose-600" />;
}

function SummaryCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent.bg}`}>
        <Icon className={`h-5 w-5 ${accent.text}`} strokeWidth={2.25} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="font-ledger text-xl font-bold text-navy-900">{value}</p>
      </div>
    </div>
  );
}

export default function CompliancePage() {
  const { activeTenant, complianceFlags, complianceChecklist, auditTrail, formatMoney, amlThresholdUSD } =
    useFinancial();

  const openFlags = complianceFlags.filter((f) => f.status !== "Filed").length;
  const highRiskFlags = complianceFlags.filter(
    (f) => f.riskLevel === "High" || f.riskLevel === "Critical"
  ).length;
  const checklistPassed = complianceChecklist.filter((c) => c.status === "Passed").length;
  const checklistPct = complianceChecklist.length
    ? Math.round((checklistPassed / complianceChecklist.length) * 100)
    : 0;

  const tenantAuditTrail = auditTrail.filter(
    (entry) => entry.tenant === activeTenant.name || entry.tenant === "All Tenants"
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-vault-600">
          {activeTenant.name} \u00b7 {activeTenant.location}
        </p>
        <h1 className="text-2xl font-bold text-navy-900">Compliance Command Center</h1>
        <p className="text-sm text-slate-500">
          Transactional risk, AML thresholds, and regulatory checklist status for this tenant.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <SummaryCard
          icon={ShieldAlert}
          label="Open Risk Flags"
          value={openFlags}
          accent={{ bg: "bg-rose-50", text: "text-rose-600" }}
        />
        <SummaryCard
          icon={FileWarning}
          label="High / Critical Risk"
          value={highRiskFlags}
          accent={{ bg: "bg-amber-50", text: "text-amber-600" }}
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Checklist Completion"
          value={`${checklistPct}%`}
          accent={{ bg: "bg-emerald-50", text: "text-emerald-600" }}
        />
        <SummaryCard
          icon={History}
          label="AML Cash Threshold"
          value={formatMoney(amlThresholdUSD)}
          accent={{ bg: "bg-navy-900/5", text: "text-navy-700" }}
        />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-panel">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-navy-900">
            Transactional Risk &amp; AML Cash Threshold Flags
          </h2>
          <p className="text-xs text-slate-500">
            Cross-border declarations and high-value transactions breaking statutory limits
          </p>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Flag</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Risk</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {complianceFlags.map((flag, idx) => {
                const exceedsThreshold = flag.amountUSD >= amlThresholdUSD;
                return (
                  <tr
                    key={flag.id}
                    className={`border-b border-slate-100 align-top ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                  >
                    <td className="px-5 py-3">
                      <p className="font-ledger text-xs font-semibold text-navy-800">{flag.id}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{flag.ledgerRef}</p>
                      <p className="text-[11px] text-slate-400">{flag.date}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      <p>{flag.description}</p>
                      <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500">
                        {exceedsThreshold && (
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" />
                        )}
                        {flag.reason}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <p className="font-ledger font-semibold text-navy-900">{formatMoney(flag.amountUSD)}</p>
                      {flag.originalCurrency && flag.originalCurrency !== "USD" && (
                        <p className="font-ledger text-[11px] text-slate-400">
                          {flag.originalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                          {flag.originalCurrency} original
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge label={flag.riskLevel} styles={RISK_STYLES[flag.riskLevel]} />
                    </td>
                    <td className="px-5 py-3">
                      <Badge label={flag.status} styles={FLAG_STATUS_STYLES[flag.status]} />
                    </td>
                  </tr>
                );
              })}
              {complianceFlags.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                    No active risk flags for this tenant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-panel">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-navy-900">Banking Compliance Checklist</h2>
            <p className="text-xs text-slate-500">Internal audit and regulatory check status</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {complianceChecklist.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <input
                  type="checkbox"
                  checked={item.status === "Passed"}
                  readOnly
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-800">{item.label}</p>
                  <p className="text-[11px] text-slate-400">Last checked {item.lastChecked}</p>
                </div>
                <ChecklistStatusIcon status={item.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-panel">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-navy-900">Immutable Audit Trail</h2>
            <p className="text-xs text-slate-500">Append-only system &amp; officer action log</p>
          </div>
          <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
            {tenantAuditTrail.map((entry) => (
              <li key={entry.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-navy-800">{entry.action}</p>
                  <p className="whitespace-nowrap text-[11px] text-slate-400">{entry.timestamp}</p>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{entry.details}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400">{entry.actor}</p>
                  <p className="font-ledger text-[11px] text-slate-300">{entry.hash}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
