/**
 * src/lib/api.js
 *
 * Typed API client for the fintech_api FastAPI backend.
 *
 * All public methods return plain JS objects matching the backend's
 * Pydantic response schemas. Errors are thrown as { status, message }
 * objects so callers can handle them uniformly.
 *
 * Auth flow (dev/staging):
 *   1. Call api.getToken(tenantId) → stores JWT in memory.
 *   2. Subsequent calls include the token as Bearer automatically.
 *
 * For production, swap getToken() for your IdP integration and call
 * api.setToken(token) to load the token from your auth flow.
 */

import { auth } from "@/lib/firebase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";


// Fixed user UUID for dev token issuance — replace with real auth in production.
const DEV_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEV_USER_EMAIL = "portal@tendai.co.zw";

// ── Canonical tenant UUIDs — must match alembic/versions/0002_seed_tenants.py ──
export const TENANT_IDS = {
  "main-retail": "11111111-1111-1111-1111-111111111111",
  "harare-sub": "22222222-2222-2222-2222-222222222222",
  "bulawayo-branch": "33333333-3333-3333-3333-333333333333",
};

// In-memory token store keyed by tenant UUID.
const _tokens = {};

// ── Low-level fetch wrapper ─────────────────────────────────────────────────

async function _request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail ?? JSON.stringify(body);
    } catch (_) {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

async function _authedRequest(tenantId, path, options = {}) {
  const token = _tokens[tenantId];
  if (!token) throw new Error(`No token for tenant ${tenantId}. Call api.ensureToken() first.`);
  return _request(path, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

// ── Auth ────────────────────────────────────────────────────────────────────

/**
 * Issues a tenant-scoped backend JWT for the given frontend tenant slug.
 * Idempotent — won't re-fetch if a token is already cached.
 *
 * If a Firebase user is signed in, their ID token is verified server-side
 * via POST /auth/firebase-token — this is the real auth path. If no
 * Firebase user is present (shouldn't happen behind the app's auth guard,
 * but keeps local/dev flexibility), falls back to the dev /auth/token
 * endpoint, which the backend itself disables outside of
 * ENVIRONMENT=development.
 */
async function ensureToken(tenantSlug) {
  const tenantUUID = TENANT_IDS[tenantSlug];
  if (!tenantUUID) throw new Error(`Unknown tenant slug: ${tenantSlug}`);
  if (_tokens[tenantUUID]) return _tokens[tenantUUID];

  const firebaseUser = auth.currentUser;

  const data = firebaseUser
    ? await _request("/api/v1/auth/firebase-token", {
        method: "POST",
        body: JSON.stringify({
          id_token: await firebaseUser.getIdToken(),
          tenant_id: tenantUUID,
        }),
      })
    : await _request("/api/v1/auth/token", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: tenantUUID,
          user_id: DEV_USER_ID,
          email: DEV_USER_EMAIL,
        }),
      });

  _tokens[tenantUUID] = data.access_token;
  return data.access_token;
}

/** Load a pre-existing token (production path). */
function setToken(tenantUUID, token) {
  _tokens[tenantUUID] = token;
}

/** Drops every cached backend JWT — call this on sign-out. */
function clearTokens() {
  for (const key of Object.keys(_tokens)) delete _tokens[key];
}

// ── Tenants ─────────────────────────────────────────────────────────────────

/** Returns all active tenants from the API. */
async function listTenants() {
  return _request("/api/v1/tenants");
}

/**
 * Returns KPI dashboard data for a tenant over the last N days.
 * @param {string} tenantSlug  - frontend slug e.g. "main-retail"
 * @param {number} windowDays  - lookback window (default 7)
 */
async function getTenantDashboard(tenantSlug, windowDays = 7) {
  const tenantUUID = TENANT_IDS[tenantSlug];
  await ensureToken(tenantSlug);
  return _authedRequest(
    tenantUUID,
    `/api/v1/tenants/${tenantUUID}/dashboard?window_days=${windowDays}`
  );
}

// ── Ledger ──────────────────────────────────────────────────────────────────

/**
 * Lists paginated ledger entries for the active tenant.
 * @param {string} tenantSlug
 * @param {Object} opts
 * @param {number}  opts.page            - 1-indexed page number
 * @param {number}  opts.pageSize
 * @param {string}  opts.complianceStatus - filter e.g. "FLAGGED"
 * @param {string}  opts.currency         - filter e.g. "ZWG"
 * @param {boolean} opts.requiresReview
 */
async function listLedgerEntries(tenantSlug, opts = {}) {
  const tenantUUID = TENANT_IDS[tenantSlug];
  await ensureToken(tenantSlug);

  const params = new URLSearchParams();
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("page_size", String(opts.pageSize));
  if (opts.complianceStatus) params.set("compliance_status", opts.complianceStatus);
  if (opts.currency) params.set("currency", opts.currency);
  if (opts.requiresReview != null) params.set("requires_review", String(opts.requiresReview));
  if (opts.ctrRequired != null) params.set("ctr_required", String(opts.ctrRequired));
  if (opts.sarRequired != null) params.set("sar_required", String(opts.sarRequired));

  const qs = params.toString();
  return _authedRequest(tenantUUID, `/api/v1/ledger${qs ? `?${qs}` : ""}`);
}

/**
 * Submits a single structured ledger entry.
 * @param {string} tenantSlug
 * @param {Object} entry  - must match LedgerEntryCreate schema
 */
async function createLedgerEntry(tenantSlug, entry) {
  const tenantUUID = TENANT_IDS[tenantSlug];
  await ensureToken(tenantSlug);
  return _authedRequest(tenantUUID, "/api/v1/ledger", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

/**
 * Submits raw bank statement text for LLM parsing + compliance analysis.
 * @param {string} tenantSlug
 * @param {string} rawText
 * @param {string} defaultCurrency  - "USD" | "ZWG" | "ZAR"
 */
async function scanStatement(tenantSlug, rawText, defaultCurrency = "USD") {
  const tenantUUID = TENANT_IDS[tenantSlug];
  await ensureToken(tenantSlug);
  return _authedRequest(tenantUUID, "/api/v1/ledger/scan", {
    method: "POST",
    body: JSON.stringify({
      raw_text: rawText,
      default_currency: defaultCurrency,
      hint_tenant_timezone: "Africa/Harare",
    }),
  });
}

// ── Health ──────────────────────────────────────────────────────────────────

async function healthCheck() {
  return _request("/health");
}

async function exchangeRates() {
  return _request("/health/rates");
}

// ── Export ──────────────────────────────────────────────────────────────────

const api = {
  ensureToken,
  setToken,
  clearTokens,
  listTenants,
  getTenantDashboard,
  listLedgerEntries,
  createLedgerEntry,
  scanStatement,
  healthCheck,
  exchangeRates,
  TENANT_IDS,
};

export default api;
