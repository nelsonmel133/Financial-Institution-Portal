# Tendai Reporting Platform

A multi-tenant financial reporting console with live USD / ZWG / ZAR conversion, a compliance command center, and retail cash flow analytics.

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000 — it redirects to `/dashboard`.

## Project structure

- `src/app/layout.js` — root shell: fonts, `FinancialProvider`, sidebar + header layout
- `src/context/FinancialContext.js` — tenants, live FX coefficients, unified ledger, cash flow trend, compliance data, and all conversion/formatting helpers
- `src/components/SidebarNavigation.js` — tenant switcher, compliance ring gauges, page nav (desktop sidebar + mobile drawer content)
- `src/components/CurrencyConverterHeader.js` — live FX ticker with lock/override, quick multi-currency calculator, base currency switcher, mobile menu trigger
- `src/app/dashboard/page.js` — KPI metrics, cash flow trend chart, daily breakdown table
- `src/app/compliance/page.js` — AML flags, compliance checklist, audit trail
- `src/app/ledger/page.js` — paginated ledger with original + converted values, filter tabs, search

## Notes

- All mock data (tenants, ledger entries, FX rates, compliance flags, audit trail) lives in `FinancialContext.js` — swap in real API calls there when you're ready to connect a backend.
- The "live" FX feed is simulated client-side (a small interval nudges unlocked rates every few seconds). Lock a currency to enter a manual override.
- Fonts (Plus Jakarta Sans, JetBrains Mono) load from Google Fonts at build time via `next/font/google`, so the build step needs normal internet access.
