"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  ScrollText,
  Building2,
  ChevronsUpDown,
  Check,
  Landmark,
} from "lucide-react";
import { useFinancial } from "@/context/FinancialContext";

const NAV_LINKS = [
  { href: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
  { href: "/compliance", label: "Compliance Command Center", icon: ShieldCheck },
  { href: "/ledger", label: "Retail Ledger", icon: ScrollText },
];

function complianceTone(score) {
  if (score >= 96) return { ring: "#10B981", text: "text-emerald-400" };
  if (score >= 90) return { ring: "#D9BE5A", text: "text-vault-400" };
  return { ring: "#DC2626", text: "text-rose-400" };
}

function ComplianceRing({ score, size = 34 }) {
  const radius = size / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const tone = complianceTone(score);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={tone.ring}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 600ms ease" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white font-ledger"
        fontSize="9.5"
        fontWeight="600"
      >
        {score}
      </text>
    </svg>
  );
}

function TenantSwitcher() {
  const { tenants, activeTenant, setActiveTenantId } = useFinancial();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tone = complianceTone(activeTenant.complianceScore);

  return (
    <div ref={containerRef} className="relative px-3 pb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-navy-850 px-3 py-2.5 text-left transition hover:border-white/20 hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-400"
      >
        <ComplianceRing score={activeTenant.complianceScore} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{activeTenant.name}</p>
          <p className="truncate text-xs text-slate-400">{activeTenant.location}</p>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-3 right-3 top-full z-30 mt-2 overflow-hidden rounded-lg border border-white/10 bg-navy-850 shadow-2xl"
        >
          <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Switch Tenant Branch
          </p>
          <ul className="max-h-72 overflow-y-auto pb-2">
            {tenants.map((tenant) => {
              const isActive = tenant.id === activeTenant.id;
              return (
                <li key={tenant.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveTenantId(tenant.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/5 ${
                      isActive ? "bg-white/[0.06]" : ""
                    }`}
                  >
                    <ComplianceRing score={tenant.complianceScore} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{tenant.name}</p>
                      <p className="truncate text-xs text-slate-400">{tenant.location}</p>
                    </div>
                    {isActive && <Check className="h-4 w-4 shrink-0 text-vault-400" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between rounded-lg bg-navy-850/60 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Compliance Score
        </span>
        <span className={`text-xs font-semibold ${tone.text}`}>
          {activeTenant.complianceScore}%
        </span>
      </div>
    </div>
  );
}

export function SidebarContent({ onNavigate }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-navy-950">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-vault-400/15 ring-1 ring-vault-400/30">
          <Landmark className="h-4.5 w-4.5 text-vault-400" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-white">Tendai Reporting</p>
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Multi-Tenant Console
          </p>
        </div>
      </div>

      <TenantSwitcher />

      <nav className="mt-2 flex-1 space-y-1 px-3">
        <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Platform
        </p>
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-vault-400/10 text-vault-300 ring-1 ring-inset ring-vault-400/25"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon
                className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-vault-400" : "text-slate-500 group-hover:text-slate-300"}`}
                strokeWidth={2}
              />
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-emerald-400" />
          </span>
          <p className="text-xs font-medium text-slate-400">Ledger sync active</p>
        </div>
        <p className="mt-1 text-[11px] text-slate-600">Bank-grade encryption \u00b7 SOC 2 aligned</p>
      </div>
    </div>
  );
}

export default function SidebarNavigation() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 border-r border-white/5 lg:block">
      <SidebarContent />
    </aside>
  );
}
