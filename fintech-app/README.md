# FRP — Multi-Tenant Financial Reporting Platform

A production-ready React Native (Expo) mobile application for institutional fintech reporting with real-time multi-currency conversion, AML compliance monitoring, and granular retail cash flow management.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo (Managed Workflow ~50) |
| Navigation | React Navigation v6 — Bottom Tabs |
| State | React Context API (`FinancialContext`) |
| Icons | `@expo/vector-icons` (Feather set) |
| Safe Area | `react-native-safe-area-context` |
| Styling | React Native `StyleSheet` (inline theming system) |

---

## Project Structure

```
fintech-app/
├── App.js                              # Root entry — Provider + Navigation shell
├── app.json                            # Expo configuration
├── package.json
└── src/
    ├── context/
    │   └── FinancialContext.js         # Central state engine
    ├── components/
    │   ├── TenantSelector.js           # Multi-tenant switcher (modal sheet)
    │   └── CurrencyConverterHeader.js  # Live currency strip + rate editor
    └── screens/
        ├── DashboardScreen.js          # Metrics + cash flow chart
        ├── ComplianceScreen.js         # AML flags + audit trail + filings
        └── LedgerScreen.js             # Filterable retail ledger
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start Expo dev server
npx expo start

# 3. Scan QR code with Expo Go (iOS/Android) or press:
#    i → iOS Simulator
#    a → Android Emulator
#    w → Web browser
```

---

## Core Features

### 1. Multi-Tenant Isolation
Three pre-configured business entities, each with independent financial state:
- **Main Retail Hub** (Harare CBD) — Compliance Health: 94%
- **Harare Sub-Branch** (Avondale) — Compliance Health: 78%
- **Bulawayo Branch** (City Centre) — Compliance Health: 88%

Switch tenants via the header selector. All dashboard metrics, compliance flags, and ledger entries update instantly.

### 2. Multi-Currency Converter (USD / ZWG / ZAR)
- Interactive conversion strip always visible below the tenant selector
- Tap any currency cell to set it as the **base view currency** — all dashboard values recalculate instantly
- Editable exchange rates via the ⚙ rates modal (sliders icon)
- Default rates: `1 USD = 13.56 ZWG = 18.42 ZAR`

### 3. Compliance & AML Screen
- **Compliance Health Score** gauge per tenant
- Flag severity filter (High / Medium / Low)
- Expandable flag cards with AML CTR threshold logic ($10,000 USD rule)
- Escalate / Resolve actions per flag
- Regulatory submission tracker (CTR, SAR, ZIMRA reports)
- Audit trail log
- PDF export trigger

### 4. Retail Ledger
- Full-text search across description, ref, and category
- Filter by: type (inflow/outflow), original currency, AML-flagged only
- Sort by: newest, oldest, highest amount, lowest amount
- Grouped by date with per-group entry counts
- Expandable rows showing **split currency view**: original transaction currency + converted base currency
- AML flag inline badges with deep-link to compliance detail

---

## Design System

### Color Palette
```
Navy Background    #0B1437   — primary background
Navy Light         #111D4A   — card/surface background
Slate Border       #1E3060   — dividers and borders
Blue Accent        #3B82F6   — interactive / active states
Emerald            #10B981   — inflow / positive / healthy
Amber              #F59E0B   — warnings / pending / medium severity
Crimson            #EF4444   — deficit / high severity / AML
Text Primary       #F1F5F9   — headings and values
Text Secondary     #94A3B8   — labels and metadata
Text Muted         #475569   — fine print and disabled states
```

### Typography Scale
- **Page titles**: 22px, weight 800, tracking -0.3
- **Card values**: 13–18px, weight 700–800
- **Labels/metadata**: 9–12px, weight 500–700, ALL CAPS where categorical
- **Monospace refs**: system monospace for transaction references

---

## Extending the Platform

### Adding a new tenant
In `src/context/FinancialContext.js`, append to the `TENANTS` array, then add matching entries to `COMPLIANCE_FLAGS` and `LEDGER_ENTRIES` keyed by the tenant `id`.

### Connecting live exchange rates
Replace `DEFAULT_RATES` with a `useEffect` that calls an FX API (e.g., Open Exchange Rates, RBZ official feed) and calls `setExchangeRates()` on the context.

### Real transaction data
Replace the `LEDGER_ENTRIES` and `COMPLIANCE_FLAGS` objects with API fetch calls inside `FinancialProvider`. The context shape stays identical — screens consume `ledgerEntries` and `complianceFlags` from `useFinancial()`.

### AML engine
The `convertToBase` function and threshold constants in `ComplianceScreen` can be extracted into a dedicated `src/utils/amlEngine.js` that evaluates each ledger entry against configurable regulatory thresholds per currency jurisdiction.

---

## Compliance Architecture Notes

The platform implements a layered AML monitoring model:

1. **Threshold Detection** — Any single cash transaction ≥ USD $10,000 (or equivalent in ZWG/ZAR at current rates) is automatically flagged as requiring a Currency Transaction Report (CTR).
2. **Pattern Detection** — Multiple transactions structured below the threshold on a single day trigger a Suspicious Activity Report (SAR) flag ("smurfing" pattern).
3. **Regulatory Filings** — Separate tracker for RBZ (Reserve Bank of Zimbabwe) and ZIMRA submissions, with status states: `ready`, `due`, `overdue`, `resolved`.
4. **Audit Trail** — Every flag event, reconciliation, and user action is logged with timestamp and actor.

---

## License
Internal use. Not for public distribution.
