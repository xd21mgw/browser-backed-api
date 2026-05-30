import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_REFRESH_TTL_MS } from "./originRegistry.js";

const DEFAULT_SERVICE_VERSION = "0.1.0";
const SAFE_ERROR_TYPES = Object.freeze(new Set([
  "auth_required",
  "auth_redirect",
  "expired",
  "landing_flow_blocked",
  "login_page",
  "navigation_timeout",
  "network_error",
  "origin_mismatch",
  "page_load_error",
  "platform_not_enabled",
  "refresh_failed",
  "state_parse_error",
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
  const originStatus = buildOriginStatus(origins, state);
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

  const ready = Boolean(
    warmResult?.warmed === true &&
      warmResult?.page_ready === true &&
      ["ready", "simulated"].includes(warmResult?.status)
  );
  const errorType = ready ? null : normalizeErrorType(warmResult?.error_type || warmResult?.last_error_type || "refresh_failed");
  const lastRefreshAt = toIsoString(now);
  const nextOriginStatus = {
    ...state.origin_status,
    [originKey]: sanitizeOriginStatusEntry({
      status: ready ? "ready" : statusFromErrorType(errorType),
      last_refresh_at: lastRefreshAt,
      last_error_type: errorType,
      warmed: ready,
      page_ready: Boolean(warmResult?.page_ready)
    })
  };

  const warmedOrigins = ready
    ? [...new Set([...state.warmed_origins, originKey])]
    : state.warmed_origins.filter((item) => item !== originKey);

  return sanitizeRefreshState({
    ...state,
    last_refresh_at: lastRefreshAt,
    origin_status: nextOriginStatus,
    last_error_type: errorType || state.last_error_type,
    warmed_origins: warmedOrigins,
    service_version: serviceVersion
  });
}

export function shouldRefreshOrigin(origin, refreshState, nowMs = Date.now()) {
  const state = sanitizeRefreshState(refreshState);
  const originKey = origin?.key || origin?.name;
  const status = originKey ? state.origin_status[originKey] : null;
  if (!originKey || !status) {
    return true;
  }
  if (status.status !== "ready" || status.warmed !== true || status.page_ready !== true) {
    return true;
  }

  const lastRefreshMs = Date.parse(status.last_refresh_at || state.last_refresh_at || "");
  if (!Number.isFinite(lastRefreshMs)) {
    return true;
  }

  const ttlMs = Number.isInteger(origin.refreshTtlMs) && origin.refreshTtlMs > 0
    ? origin.refreshTtlMs
    : DEFAULT_REFRESH_TTL_MS;
  return nowMs - lastRefreshMs >= ttlMs;
}

export function sanitizeAuthStateOutput(value) {
  const state = value && typeof value === "object" ? value : {};
  return {
    profile_dir_configured: Boolean(state.profile_dir_configured),
    profile_exists: Boolean(state.profile_exists),
    state_file_configured: Boolean(state.state_file_configured),
    last_refresh_at: normalizeIsoOrNull(state.last_refresh_at),
    auth_state: normalizeAuthState(state.auth_state),
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
  if (state.last_error_type && ["auth_required", "auth_redirect", "landing_flow_blocked", "login_page"].includes(state.last_error_type)) {
    return "auth_required";
  }

  const enabledOrigins = origins.filter((origin) => origin?.enabled !== false);
  if (enabledOrigins.some((origin) => shouldRefreshOrigin(origin, state, nowMs))) {
    return hasAnyReadyOrigin(state) ? "expired" : "unknown";
  }
  if (enabledOrigins.length > 0) {
    return "ready";
  }
  return "unknown";
}

function buildOriginStatus(origins, state) {
  const originStatus = { ...state.origin_status };
  for (const origin of origins) {
    const originKey = origin?.key || origin?.name;
    if (!originKey || originStatus[originKey] || origin?.enabled === false) {
      continue;
    }
    originStatus[originKey] = {
      status: "unknown",
      last_refresh_at: null,
      last_error_type: null,
      warmed: false,
      page_ready: false
    };
  }
  return sanitizeOriginStatusMap(originStatus);
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
  return {
    status: normalizeOriginStatus(entry.status),
    last_refresh_at: normalizeIsoOrNull(entry.last_refresh_at),
    last_error_type: normalizeErrorType(entry.last_error_type || entry.error_type),
    warmed: Boolean(entry.warmed),
    page_ready: Boolean(entry.page_ready)
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
  if (["ready", "auth_required", "expired", "refresh_failed", "unknown", "disabled"].includes(status)) {
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

function statusFromErrorType(errorType) {
  if (["auth_required", "auth_redirect", "landing_flow_blocked", "login_page"].includes(errorType)) {
    return "auth_required";
  }
  if (errorType === "expired") {
    return "expired";
  }
  return "refresh_failed";
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

function safeKey(value) {
  return /^[a-z0-9_:-]{1,128}$/i.test(value) && !FORBIDDEN_AUTH_MATERIAL_PATTERN.test(value);
}

function safeNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function homeDir(env) {
  return env.HOME || os.homedir();
}
