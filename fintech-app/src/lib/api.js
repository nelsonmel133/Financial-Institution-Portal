/**
 * src/lib/api.js  (fintech-app / Expo)
 *
 * Typed API client for the fintech_api FastAPI backend.
 * Uses React Native's built-in fetch (no extra dependencies).
 *
 * For local dev with a physical device, set API_BASE_URL to your
 * machine's LAN IP (e.g. http://192.168.1.x:8000).
 * For emulator/simulator, http://localhost:8000 works on iOS;
 * Android emulator needs http://10.0.2.2:8000.
 */

// Expo: use EXPO_PUBLIC_ prefix for build-time env vars (SDK 49+)
// Falls back to localhost for quick development.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

// Fixed dev user — replace with real auth in production
const DEV_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEV_USER_EMAIL = "portal@tendai.co.zw";

// Canonical tenant UUIDs — must match alembic/versions/0002_seed_tenants.py
export const TENANT_IDS = {
  tenant_main: "11111111-1111-1111-1111-111111111111",
  tenant_harare: "22222222-2222-2222-2222-222222222222",
  tenant_bulawayo: "33333333-3333-3333-3333-333333333333",
};

// In-memory token store
const _tokens = {};

// ── Fetch wrapper ─────────────────────────────────────────────────────────

async function _request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { const b = await res.json(); message = b.detail ?? JSON.stringify(b); } catch (_) {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function _authed(tenantSlug, path, options = {}) {
  const uuid = TENANT_IDS[tenantSlug];
  const token = _tokens[uuid];
  if (!token) throw new Error(`No token for ${tenantSlug}. Call ensureToken() first.`);
  return _request(path, {
    ...options,
    headers: { ...(options.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────

export async function ensureToken(tenantSlug) {
  const uuid = TENANT_IDS[tenantSlug];
  if (!uuid) throw new Error(`Unknown tenant: ${tenantSlug}`);
  if (_tokens[uuid]) return _tokens[uuid];
  const data = await _request("/api/v1/auth/token", {
    method: "POST",
    body: JSON.stringify({ tenant_id: uuid, user_id: DEV_USER_ID, email: DEV_USER_EMAIL }),
  });
  _tokens[uuid] = data.access_token;
  return data.access_token;
}

// ── Health ────────────────────────────────────────────────────────────────

export async function healthCheck() {
  return _request("/health");
}

export async function exchangeRates() {
  return _request("/health/rates");
}

// ── Tenants ───────────────────────────────────────────────────────────────

export async function listTenants() {
  return _request("/api/v1/tenants");
}

export async function getTenantDashboard(tenantSlug, windowDays = 7) {
  const uuid = TENANT_IDS[tenantSlug];
  await ensureToken(tenantSlug);
  return _authed(tenantSlug, `/api/v1/tenants/${uuid}/dashboard?window_days=${windowDays}`);
}

// ── Ledger ────────────────────────────────────────────────────────────────

/**
 * @param {string} tenantSlug
 * @param {{ page?: number, pageSize?: number, complianceStatus?: string, currency?: string }} opts
 */
export async function listLedgerEntries(tenantSlug, opts = {}) {
  await ensureToken(tenantSlug);
  const params = new URLSearchParams();
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("page_size", String(opts.pageSize));
  if (opts.complianceStatus) params.set("compliance_status", opts.complianceStatus);
  if (opts.currency) params.set("currency", opts.currency);
  if (opts.requiresReview != null) params.set("requires_review", String(opts.requiresReview));
  const qs = params.toString();
  return _authed(tenantSlug, `/api/v1/ledger${qs ? `?${qs}` : ""}`);
}

export async function createLedgerEntry(tenantSlug, entry) {
  await ensureToken(tenantSlug);
  return _authed(tenantSlug, "/api/v1/ledger", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export async function scanStatement(tenantSlug, rawText, defaultCurrency = "USD") {
  await ensureToken(tenantSlug);
  return _authed(tenantSlug, "/api/v1/ledger/scan", {
    method: "POST",
    body: JSON.stringify({
      raw_text: rawText,
      default_currency: defaultCurrency,
      hint_tenant_timezone: "Africa/Harare",
    }),
  });
}
