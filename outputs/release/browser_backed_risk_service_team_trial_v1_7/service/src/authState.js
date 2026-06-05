import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_REFRESH_TTL_MS } from "./originRegistry.js";

const DEFAULT_SERVICE_VERSION = "0.1.0";
const SAFE_ERROR_TYPES = Object.freeze(new Set([
  "auth_required",
  "auth_redirect",
  "auth_flow_not_completed_in_bound_context",
  "auth_state_expired_or_api_session_not_ready",
  "captcha_required",
  "expired",
  "landing_flow_blocked",
  "login_page",
  "manual_login_required",
  "navigation_timeout",
  "network_error",
  "origin_mismatch",
  "origin_refresh_failed",
  "page_load_error",
  "password_required",
  "permission_blocked",
  "platform_not_enabled",
  "qr_required",
  "refresh_failed",
  "state_parse_error",
  "two_factor_required",
  "unknown"
]));
const FORBIDDEN_AUTH_MATERIAL_PATTERN = /cookie|token|session|header|authorization|password|localstorage|raw_browser_storage|secret/i;

export function getProfileDir(env = process.env) {
  const configured = env.BROWSER_BACKED_PROFILE_DIR || env.USER_DATA_DIR;
  return path.resolve(configured || path.join(homeDir(env), ".dennis-browser-backed", "profile"));
}

export function getStateFile(env = process.env) {
  const configured = env.BROWSER_BACKED_STATE_FILE;
  return path.resolve(configured || path.join(homeDir(env), ".dennis-browser-backed", "refresh-session.state.json"));
}

export function loadRefreshState(stateFile = getStateFile()) {
  if (!fs.existsSync(stateFile)) {
    return defaultRefreshState();
  }

  try {
    return sanitizeRefreshState(JSON.parse(fs.readFileSync(stateFile, "utf8")));
  } catch {
    return {
      ...defaultRefreshState(),
      last_error_type: "state_parse_error"
    };
  }
}

export function saveRefreshState(refreshState, stateFile = getStateFile()) {
  const sanitized = sanitizeRefreshState(refreshState);
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  return sanitized;
}

export function profileExists(profileDir = getProfileDir()) {
  try {
    return fs.statSync(profileDir).isDirectory();
  } catch {
    return false;
  }
}

export function computeAuthState({
  env = process.env,
  profileDir = getProfileDir(env),
  stateFile = getStateFile(env),
  origins = [],
  refreshState = null,
  nowMs = Date.now()
} = {}) {
  const exists = profileExists(profileDir);
  const stateFileExists = fs.existsSync(stateFile);
  const state = refreshState ? sanitizeRefreshState(refreshState) : loadRefreshState(stateFile);
  const originStatus = buildOriginStatus(origins, state, nowMs);
  const authState = resolveAuthState({
    profileExists: exists,
    stateFileExists,
    state,
    origins,
    nowMs
  });

  return sanitizeAuthStateOutput({
    profile_dir_configured: Boolean(profileDir),
    profile_exists: exists,
    state_file_configured: Boolean(stateFile),
    last_refresh_at: state.last_refresh_at,
    auth_state: authState,
    auth_state_expired: authState === "expired",
    pending_manual_login: authState === "auth_required" || originStatusHasManualLogin(originStatus),
    next_step: authState === "auth_required" || originStatusHasManualLogin(originStatus) ? "npm run worker:start" : null,
    origin_ready_state_stale: Object.values(originStatus).some((entry) => entry.origin_ready_state_stale === true),
    origin_status: originStatus,
    warmed_origins: state.warmed_origins,
    service_version: state.service_version,
    refresh_count: state.refresh_count,
    last_error_type: state.last_error_type
  });
}

export function updateOriginWarmState(refreshState, origin, warmResult, { now = new Date(), serviceVersion = DEFAULT_SERVICE_VERSION } = {}) {
  const state = sanitizeRefreshState(refreshState);
  const originKey = typeof origin === "string" ? origin : origin?.key || origin?.name;
  if (!originKey || FORBIDDEN_AUTH_MATERIAL_PATTERN.test(originKey)) {
    return state;
  }

  const originValue = normalizeOriginString(origin?.origin || origin?.defaultOrigin || warmResult?.configured_origin || warmResult?.origin);
  const finalOrigin = normalizeOriginString(warmResult?.final_origin || warmResult?.current_origin || warmResult?.final_origin_after_landing);
  const pageReady = Boolean(warmResult?.page_ready);
  const errorType = normalizeErrorType(warmResult?.error_type || warmResult?.last_error_type);
  const sameOriginActual = warmResult?.same_origin_actual === true || Boolean(originValue && finalOrigin && finalOrigin === originValue);
  const readyStatus = warmResult?.status === undefined || ["ready", "simulated"].includes(warmResult?.status);
  const ready = Boolean(pageReady && sameOriginActual && !errorType && readyStatus);
  const optional = isOptionalOrigin(origin);
  const requiredForRefresh = isRequiredForRefresh(origin);
  const requiredForHealth = isRequiredForHealth(origin);
  const failedErrorType = ready ? null : errorType || "refresh_failed";
  const refreshedAt = toIsoString(now);
  const status = ready ? "ready" : statusFromErrorType(failedErrorType, { optional });
  const nextOriginStatus = {
    ...state.origin_status,
    [originKey]: sanitizeOriginStatusEntry({
      origin: originValue,
      final_origin: finalOrigin,
      current_origin: finalOrigin,
      status,
      error_type: failedErrorType,
      refreshed_at: refreshedAt,
      last_refresh_at: refreshedAt,
      last_error_type: failedErrorType,
      optional,
      required_for_refresh: requiredForRefresh,
      required_for_health: requiredForHealth,
      warmed: ready,
      page_ready: pageReady
    })
  };

  const warmedOrigins = ready
    ? [...new Set([...state.warmed_origins, originKey])]
    : state.warmed_origins.filter((item) => item !== originKey);

  return sanitizeRefreshState({
    ...state,
    last_refresh_at: refreshedAt,
    origin_status: nextOriginStatus,
    last_error_type: topLevelErrorType(nextOriginStatus),
    warmed_origins: warmedOrigins,
    service_version: serviceVersion
  });
}

export function shouldRefreshOrigin(origin, refreshState, nowMs = Date.now()) {
  return originFreshness(origin, refreshState, nowMs).origin_ready_state_stale;
}

export function originFreshness(origin, refreshState, nowMs = Date.now()) {
  const state = sanitizeRefreshState(refreshState);
  const originKey = origin?.key || origin?.name;
  const ttlMs = Number.isInteger(origin?.refreshTtlMs) && origin.refreshTtlMs > 0
    ? origin.refreshTtlMs
    : DEFAULT_REFRESH_TTL_MS;
  const status = originKey ? state.origin_status[originKey] : null;
  const stale = {
    origin_ready_state_stale: true,
    origin_freshness_age_ms: null,
    origin_freshness_ttl_ms: ttlMs
  };
  if (!originKey || !status || status.status !== "ready" || status.page_ready !== true) {
    return stale;
  }
  const lastRefreshMs = Date.parse(status.refreshed_at || status.last_refresh_at || state.last_refresh_at || "");
  if (!Number.isFinite(lastRefreshMs)) {
    return stale;
  }

  const ageMs = Math.max(0, nowMs - lastRefreshMs);
  return {
    origin_ready_state_stale: ageMs >= ttlMs,
    origin_freshness_age_ms: ageMs,
    origin_freshness_ttl_ms: ttlMs
  };
}

export function sanitizeAuthStateOutput(value) {
  const state = value && typeof value === "object" ? value : {};
  return {
    profile_dir_configured: Boolean(state.profile_dir_configured),
    profile_exists: Boolean(state.profile_exists),
    state_file_configured: Boolean(state.state_file_configured),
    last_refresh_at: normalizeIsoOrNull(state.last_refresh_at),
    auth_state: normalizeAuthState(state.auth_state),
    auth_state_expired: Boolean(state.auth_state_expired),
    pending_manual_login: Boolean(state.pending_manual_login),
    next_step: safeNextStep(state.next_step),
    origin_ready_state_stale: Boolean(state.origin_ready_state_stale),
    origin_status: sanitizeOriginStatusMap(state.origin_status),
    warmed_origins: sanitizeStringArray(state.warmed_origins),
    service_version: safeString(state.service_version) || DEFAULT_SERVICE_VERSION,
    refresh_count: safeNonNegativeInteger(state.refresh_count),
    last_error_type: normalizeErrorType(state.last_error_type)
  };
}

export function sanitizeRefreshState(value) {
  const state = value && typeof value === "object" ? value : {};
  return {
    last_refresh_at: normalizeIsoOrNull(state.last_refresh_at),
    origin_status: sanitizeOriginStatusMap(state.origin_status),
    last_error_type: normalizeErrorType(state.last_error_type),
    warmed_origins: sanitizeStringArray(state.warmed_origins),
    service_version: safeString(state.service_version) || DEFAULT_SERVICE_VERSION,
    refresh_count: safeNonNegativeInteger(state.refresh_count)
  };
}

export function defaultRefreshState() {
  return {
    last_refresh_at: null,
    origin_status: {},
    last_error_type: null,
    warmed_origins: [],
    service_version: DEFAULT_SERVICE_VERSION,
    refresh_count: 0
  };
}

function resolveAuthState({ profileExists: exists, stateFileExists, state, origins, nowMs }) {
  if (!exists) {
    return "auth_required";
  }
  if (!stateFileExists && !state.last_refresh_at && Object.keys(state.origin_status).length === 0) {
    return "unknown";
  }
  if (state.last_error_type && isAuthRequiredErrorType(state.last_error_type)) {
    return "auth_required";
  }

  const requiredOrigins = origins.filter((origin) => origin?.enabled !== false && isRequiredForHealth(origin));
  if (requiredOrigins.some((origin) => state.origin_status[origin.key || origin.name]?.status === "auth_required")) {
    return "auth_required";
  }
  if (requiredOrigins.some((origin) => shouldRefreshOrigin(origin, state, nowMs))) {
    return hasAnyReadyOrigin(state) ? "expired" : "unknown";
  }
  if (requiredOrigins.length > 0) {
    return "ready";
  }
  return "unknown";
}

function buildOriginStatus(origins, state, nowMs = Date.now()) {
  const originStatus = { ...state.origin_status };
  for (const origin of origins) {
    const originKey = origin?.key || origin?.name;
    if (!originKey || originStatus[originKey] || origin?.enabled === false) {
      continue;
    }
    originStatus[originKey] = {
      origin: normalizeOriginString(origin.origin || origin.defaultOrigin),
      final_origin: null,
      current_origin: null,
      status: "unknown",
      error_type: null,
      refreshed_at: null,
      last_refresh_at: null,
      last_error_type: null,
      optional: isOptionalOrigin(origin),
      required_for_refresh: isRequiredForRefresh(origin),
      required_for_health: isRequiredForHealth(origin),
      warmed: false,
      page_ready: false
    };
  }
  const sanitized = sanitizeOriginStatusMap(originStatus);
  for (const origin of origins) {
    const originKey = origin?.key || origin?.name;
    if (!originKey || origin?.enabled === false || !sanitized[originKey]) {
      continue;
    }
    sanitized[originKey] = sanitizeOriginStatusEntry({
      ...sanitized[originKey],
      ...originFreshness(origin, {
        ...state,
        origin_status: sanitized
      }, nowMs)
    });
  }
  return sanitized;
}

function hasAnyReadyOrigin(state) {
  return Object.values(state.origin_status).some((entry) => entry.status === "ready");
}

function sanitizeOriginStatusMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!safeKey(key)) {
      continue;
    }
    output[key] = sanitizeOriginStatusEntry(entry);
  }
  return output;
}

function sanitizeOriginStatusEntry(value) {
  const entry = value && typeof value === "object" ? value : {};
  const optional = Boolean(entry.optional);
  return {
    origin: normalizeOriginString(entry.origin),
    final_origin: normalizeOriginString(entry.final_origin),
    current_origin: normalizeOriginString(entry.current_origin || entry.final_origin),
    status: normalizeOriginStatus(entry.status),
    error_type: normalizeErrorType(entry.error_type || entry.last_error_type),
    refreshed_at: normalizeIsoOrNull(entry.refreshed_at || entry.last_refresh_at),
    optional,
    required_for_refresh: entry.required_for_refresh === false ? false : !optional,
    required_for_health: entry.required_for_health === false ? false : !optional,
    last_refresh_at: normalizeIsoOrNull(entry.last_refresh_at || entry.refreshed_at),
    last_error_type: normalizeErrorType(entry.last_error_type || entry.error_type),
    warmed: Boolean(entry.warmed),
    page_ready: Boolean(entry.page_ready),
    pending_manual_login: Boolean(entry.pending_manual_login),
    next_step: safeNextStep(entry.next_step),
    origin_ready_state_stale: Boolean(entry.origin_ready_state_stale),
    origin_freshness_age_ms: safeNullableNonNegativeInteger(entry.origin_freshness_age_ms),
    origin_freshness_ttl_ms: safePositiveInteger(entry.origin_freshness_ttl_ms) || DEFAULT_REFRESH_TTL_MS
  };
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => safeString(item)).filter(Boolean).filter((item) => !FORBIDDEN_AUTH_MATERIAL_PATTERN.test(item)))];
}

function normalizeOriginStatus(value) {
  const status = safeString(value);
  if (status === "refresh_failed") {
    return "failed";
  }
  if (["ready", "auth_required", "expired", "failed", "optional_failed", "unknown", "disabled"].includes(status)) {
    return status;
  }
  return "unknown";
}

function normalizeAuthState(value) {
  const status = safeString(value);
  if (["ready", "auth_required", "expired", "unknown"].includes(status)) {
    return status;
  }
  return "unknown";
}

function normalizeErrorType(value) {
  if (typeof value === "string" && FORBIDDEN_AUTH_MATERIAL_PATTERN.test(value)) {
    return "refresh_failed";
  }
  const errorType = safeString(value);
  if (!errorType) {
    return null;
  }
  if (FORBIDDEN_AUTH_MATERIAL_PATTERN.test(errorType)) {
    return "refresh_failed";
  }
  return SAFE_ERROR_TYPES.has(errorType) ? errorType : "refresh_failed";
}

function statusFromErrorType(errorType, { optional = false } = {}) {
  if (optional) {
    return "optional_failed";
  }
  if (isAuthRequiredErrorType(errorType)) {
    return "auth_required";
  }
  if (errorType === "expired") {
    return "expired";
  }
  return "failed";
}

function isAuthRequiredErrorType(errorType) {
  return [
    "auth_required",
    "auth_redirect",
    "auth_flow_not_completed_in_bound_context",
    "captcha_required",
    "landing_flow_blocked",
    "login_page",
    "manual_login_required",
    "password_required",
    "qr_required",
    "two_factor_required"
  ].includes(errorType);
}

function originStatusHasManualLogin(originStatus) {
  return Object.values(originStatus || {}).some((entry) => (
    entry?.status === "auth_required" || isAuthRequiredErrorType(entry?.error_type || entry?.last_error_type)
  ));
}

function topLevelErrorType(originStatus) {
  for (const entry of Object.values(originStatus)) {
    if (entry.required_for_refresh === false || entry.optional === true || entry.status === "ready") {
      continue;
    }
    return entry.error_type || entry.last_error_type || "refresh_failed";
  }
  return null;
}

function isOptionalOrigin(origin) {
  return Boolean(origin?.optional);
}

function isRequiredForRefresh(origin) {
  return origin?.enabled !== false && origin?.requiredForRefresh !== false && !isOptionalOrigin(origin);
}

function isRequiredForHealth(origin) {
  return origin?.enabled !== false && origin?.requiredForHealth !== false && !isOptionalOrigin(origin);
}

function normalizeOriginString(value) {
  const text = safeString(value);
  if (!text) {
    return null;
  }
  try {
    const parsed = new URL(text);
    return parsed.origin === "null" ? null : parsed.origin;
  } catch {
    return null;
  }
}

function normalizeIsoOrNull(value) {
  const text = safeString(value);
  if (!text) {
    return null;
  }
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function toIsoString(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function safeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return FORBIDDEN_AUTH_MATERIAL_PATTERN.test(trimmed) ? "" : trimmed;
}

function safeNextStep(value) {
  const text = safeString(value);
  return text === "npm run worker:start" ? text : null;
}

function safeKey(value) {
  return /^[a-z0-9_:-]{1,128}$/i.test(value) && !FORBIDDEN_AUTH_MATERIAL_PATTERN.test(value);
}

function safeNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function safeNullableNonNegativeInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function safePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function homeDir(env) {
  return env.HOME || os.homedir();
}
