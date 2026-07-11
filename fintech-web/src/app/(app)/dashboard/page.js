"use client";

import { TrendingUp, TrendingDown, Wallet, Banknote, Vault, ArrowRight } from "lucide-react";
import { useFinancial } from "@/context/FinancialContext";

function formatDayLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function pctChange(current, previous) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function KpiCard({ icon: Icon, label, valueUSD, deltaPct, accent }) {
  const { formatMoney } = useFinancial();
  const positive = deltaPct >= 0;

  return (
    <div className="flex-1 rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 font-ledger text-2xl font-bold text-navy-900 sm:text-3xl">
            {formatMoney(valueUSD)}
          </p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent.bg}`}>
          <Icon className={`h-5 w-5 ${accent.text}`} strokeWidth={2.25} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {positive ? (
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
        )}
        <span className={`text-xs font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
          {positive ? "+" : ""}
          {deltaPct.toFixed(1)}%
        </span>
        <span className="text-xs text-slate-400">vs. start of 7-day window</span>
      </div>
    </div>
  );
}

function CashFlowChart({ data }) {
  const { convertFromUSD, baseCurrency, currencyMeta } = useFinancial();

  const converted = data.map((day) => ({
    ...day,
    cashIn: convertFromUSD(day.cashIn, baseCurrency),
    cashOut: convertFromUSD(day.cashOut, baseCurrency),
  }));

  const maxValue = Math.max(...converted.flatMap((d) => [d.cashIn, d.cashOut]), 1);
  const chartHeight = 180;
  const barWidth = 14;
  const groupGap = 30;

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <svg
        viewBox={`0 0 ${converted.length * (barWidth * 2 + groupGap) + 20} ${chartHeight + 40}`}
        className="h-56 min-w-[560px] w-full"
        role="img"
        aria-label="Daily cash inflow and outflow trend"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1="0"
            x2="100%"
            y1={chartHeight - chartHeight * fraction + 10}
            y2={chartHeight - chartHeight * fraction + 10}
            stroke="#E2E8F0"
            strokeWidth="1"
            strokeDasharray={fraction === 0 ? "0" : "3 4"}
          />
        ))}

        {converted.map((day, idx) => {
          const groupX = idx * (barWidth * 2 + groupGap) + 16;
          const inHeight = (day.cashIn / maxValue) * chartHeight;
          const outHeight = (day.cashOut / maxValue) * chartHeight;
          return (
            <g key={day.date}>
              <rect
                x={groupX}
                y={chartHeight - inHeight + 10}
                width={barWidth}
                height={inHeight}
                rx="2.5"
                fill="#10B981"
              >
                <title>
                  {formatDayLabel(day.date)} \u2013 Cash-In: {currencyMeta[baseCurrency].symbol}{" "}
                  {day.cashIn.toFixed(2)}
                </title>
              </rect>
              <rect
                x={groupX + barWidth + 4}
                y={chartHeight - outHeight + 10}
                width={barWidth}
                height={outHeight}
                rx="2.5"
                fill="#DC2626"
              >
                <title>
                  {formatDayLabel(day.date)} \u2013 Cash-Out: {currencyMeta[baseCurrency].symbol}{" "}
                  {day.cashOut.toFixed(2)}
                </title>
              </rect>
              <text
                x={groupX + barWidth}
                y={chartHeight + 28}
                textAnchor="middle"
                fontSize="10.5"
                fill="#64748B"
                fontFamily="var(--font-jakarta)"
              >
                {formatDayLabel(day.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const { activeTenant, cashflowTrend, kpis, formatMoney } = useFinancial();

  const firstDay = cashflowTrend[0];
  const lastDay = cashflowTrend[cashflowTrend.length - 1];

  const revenueDelta = pctChange(lastDay?.cashIn, firstDay?.cashIn);
  const marginDelta = pctChange(
    lastDay ? lastDay.cashIn - lastDay.cashOut : 0,
    firstDay ? firstDay.cashIn - firstDay.cashOut : 0
  );
  const liquidityDelta = pctChange(
    lastDay ? lastDay.vaultReserves + lastDay.drawerBalance : 0,
    firstDay ? firstDay.vaultReserves + firstDay.drawerBalance : 0
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-vault-600">
          {activeTenant.name} \u00b7 {activeTenant.location}
        </p>
        <h1 className="text-2xl font-bold text-navy-900">Executive Dashboard</h1>
        <p className="text-sm text-slate-500">
          Consolidated performance across the trailing 7-day trading window.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <KpiCard
          icon={Banknote}
          label="Total Revenue (7d)"
          valueUSD={kpis.totalRevenueUSD}
          deltaPct={revenueDelta}
          accent={{ bg: "bg-emerald-50", text: "text-emerald-600" }}
        />
        <KpiCard
          icon={Wallet}
          label="Net Operating Margin"
          valueUSD={kpis.netOperatingMarginUSD}
          deltaPct={marginDelta}
          accent={{ bg: "bg-vault-50", text: "text-vault-600" }}
        />
        <KpiCard
          icon={Vault}
          label="Total Liquidity"
          valueUSD={kpis.totalLiquidityUSD}
          deltaPct={liquidityDelta}
          accent={{ bg: "bg-navy-900/5", text: "text-navy-700" }}
        />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-navy-900">Cash Flow Trend</h2>
            <p className="text-xs text-slate-500">Daily cash inflow vs. outflow, last 7 trading days</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Cash-In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" /> Cash-Out
            </span>
          </div>
        </div>
        <CashFlowChart data={cashflowTrend} />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-panel">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-navy-900">Retail Cash Flow Analytics</h2>
            <p className="text-xs text-slate-500">
              Daily Cash-In, Cash-Out, Vault Reserves, and Drawer Balance \u2013 {activeTenant.name}
            </p>
          </div>
          <ArrowRight className="hidden h-4 w-4 text-slate-300 sm:block" />
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Cash-In</th>
                <th className="px-5 py-3 text-right">Cash-Out</th>
                <th className="px-5 py-3 text-right">Net</th>
                <th className="px-5 py-3 text-right">Vault Reserves</th>
                <th className="px-5 py-3 text-right">Drawer Balance</th>
              </tr>
            </thead>
            <tbody>
              {cashflowTrend
                .slice()
                .reverse()
                .map((day, idx) => {
                  const net = day.cashIn - day.cashOut;
                  return (
                    <tr
                      key={day.date}
                      className={`border-b border-slate-100 font-ledger ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="px-5 py-3 font-sans font-medium text-navy-800">
                        {formatDayLabel(day.date)}
                      </td>
                      <td className="px-5 py-3 text-right text-emerald-700">{formatMoney(day.cashIn)}</td>
                      <td className="px-5 py-3 text-right text-rose-700">{formatMoney(day.cashOut)}</td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          net >= 0 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {formatMoney(net)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">{formatMoney(day.vaultReserves)}</td>
                      <td className="px-5 py-3 text-right text-slate-700">{formatMoney(day.drawerBalance)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
