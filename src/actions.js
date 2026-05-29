import { normalizeRelativePath } from "./config.js";
import { classifyHttpStatus, sourceStatusFromErrorType } from "./diagnostics.js";
import { buildSourceCard, buildSourceQuality, summarizeJsonShape } from "./quality.js";

export const ACTION_ALLOWLIST = Object.freeze([
  "rcp_snapshot",
  "weapon_inventory",
  "login_logs_search",
  "track_analysis_summary"
]);

const ALLOWED_INPUT_KEYS = Object.freeze([
  "accountId",
  "workspaceId",
  "dateRange",
  "filters",
  "limit",
  "cursor",
  "query",
  "severity",
  "trackId"
]);

const FORBIDDEN_INPUT_KEYS = Object.freeze([
  "url",
  "uri",
  "href",
  "origin",
  "host",
  "hostname",
  "protocol",
  "path",
  "pathname",
  "endpoint",
  "route",
  "headers",
  "header",
  "cookie",
  "cookies",
  "authorization",
  "auth",
  "token",
  "secret",
  "session",
  "sessionid",
  "csrf",
  "jwt"
]);

export const ACTIONS = Object.freeze({
  rcp_snapshot: freezeAction({
    name: "rcp_snapshot",
    domainKey: "rcp",
    description: "Return a compact RCP status snapshot for an allowed account/workspace scope.",
    method: "POST",
    apiPath: "/api/rcp/snapshot",
    inputContract: {
      accountId: "optional string",
      workspaceId: "optional string",
      dateRange: "optional { from, to }",
      filters: "optional object"
    },
    mockData: (input) => ({
      snapshot_id: "mock-rcp-001",
      scope: scopeFromInput(input),
      totals: {
        active_items: 42,
        blocked_items: 3,
        pending_review: 7
      },
      generated_at: fixedMockTime()
    })
  }),
  weapon_inventory: freezeAction({
    name: "weapon_inventory",
    domainKey: "weapon",
    description: "Return a compact Weapon inventory/search summary for an allowed scope.",
    method: "POST",
    apiPath: "/api/weapon/inventory/search",
    inputContract: {
      workspaceId: "optional string",
      query: "optional string",
      filters: "optional object",
      limit: "optional number <= 100"
    },
    mockData: (input) => ({
      query: typeof input.query === "string" ? input.query : null,
      returned_count: 2,
      total_estimate: 18,
      items: [
        { id: "mock-weapon-a", status: "ready", quality: "verified" },
        { id: "mock-weapon-b", status: "review", quality: "partial" }
      ],
      generated_at: fixedMockTime()
    })
  }),
  login_logs_search: freezeAction({
    name: "login_logs_search",
    domainKey: "login_logs",
    description: "Return a bounded login log summary without exposing session or header material.",
    method: "POST",
    apiPath: "/api/login-logs/search",
    inputContract: {
      accountId: "optional string",
      dateRange: "optional { from, to }",
      severity: "optional string",
      limit: "optional number <= 100"
    },
    mockData: (input) => ({
      scope: scopeFromInput(input),
      returned_count: 3,
      events: [
        { event_id: "mock-login-1", outcome: "success", actor_type: "user" },
        { event_id: "mock-login-2", outcome: "mfa_required", actor_type: "user" },
        { event_id: "mock-login-3", outcome: "denied", actor_type: "service" }
      ],
      generated_at: fixedMockTime()
    })
  }),
  track_analysis_summary: freezeAction({
    name: "track_analysis_summary",
    domainKey: "track_analysis",
    description: "Return a compact track-analysis summary for a fixed track-analysis origin.",
    method: "POST",
    apiPath: "/api/track-analysis/summary",
    inputContract: {
      trackId: "optional string",
      dateRange: "optional { from, to }",
      filters: "optional object"
    },
    mockData: (input) => ({
      track_id: typeof input.trackId === "string" ? input.trackId : "mock-track",
      segments: 12,
      anomalies: 2,
      confidence: "mock",
      generated_at: fixedMockTime()
    })
  })
});

assertAllowlistMatchesRegistry();

export function listActions(config) {
  return Object.values(ACTIONS).map((action) => {
    const domain = config.domains[action.domainKey];
    return {
      name: action.name,
      description: action.description,
      domain: domain.label,
      method: action.method,
      input_contract: action.inputContract,
      response_policy: {
        includes_source_card: true,
        includes_source_quality: true,
        raw_response_full_body: false,
        reads_cookie_token_session_header_plaintext: false
      }
    };
  });
}

export function getAction(name) {
  return ACTIONS[name] || null;
}

export function buildActionBody(action, input) {
  validateActionInput(input);
  const safeInput = sanitizeInput(input);
  return {
    path: action.apiPath,
    method: action.method,
    body: safeInput
  };
}

export function runMockAction(action, input, config, meta = {}) {
  validateActionInput(input);
  const safeInput = sanitizeInput(input);
  const data = action.mockData(safeInput);
  const fetchMeta = {
    ok: true,
    status: 200,
    bodyTruncated: false,
    observedBytes: JSON.stringify(data).length
  };

  return {
    action: action.name,
    mode: "mock",
    latency_ms: meta.latencyMs ?? 0,
    origin_warmed: Boolean(meta.originWarmed),
    sensitive_output: false,
    data,
    source_card: buildSourceCard({ action, config, fetchMeta, mock: true, meta }),
    source_quality: buildSourceQuality({ action, fetchMeta, mock: true, meta })
  };
}

export function buildLiveActionResponse(action, input, config, fetchResult, meta = {}) {
  validateActionInput(input);
  const parsed = parseJson(fetchResult.bodyText);
  const httpErrorType = classifyHttpStatus(fetchResult.status);
  const parseErrorType = parsed.ok ? null : "parse_error";
  const errorType = httpErrorType || parseErrorType;
  const sourceStatus = errorType ? sourceStatusFromErrorType(errorType) : "ok";
  const data = {
    http_status: fetchResult.status,
    ok: fetchResult.ok,
    body_truncated: fetchResult.bodyTruncated,
    observed_bytes: fetchResult.observedBytes,
    response_summary: parsed.ok
      ? {
          format: "json",
          shape: summarizeJsonShape(parsed.value)
        }
      : {
          format: "non_json_or_unparseable",
          shape: null
        }
  };

  return {
    action: action.name,
    mode: "live",
    status: sourceStatus,
    source_status: sourceStatus,
    error_type: errorType,
    latency_ms: meta.latencyMs ?? null,
    origin_warmed: Boolean(meta.originWarmed),
    sensitive_output: false,
    action_diagnostics: meta.actionDiagnostics || null,
    data,
    source_card: buildSourceCard({
      action,
      config,
      fetchMeta: fetchResult,
      mock: false,
      meta: { ...meta, sourceStatus, errorType }
    }),
    source_quality: buildSourceQuality({
      action,
      fetchMeta: fetchResult,
      mock: false,
      meta: { ...meta, sourceStatus, errorType }
    })
  };
}

export function buildLiveActionFailureResponse(action, input, config, meta = {}) {
  validateActionInput(input);
  const errorType = meta.errorType || "page_load_error";
  const sourceStatus = meta.sourceStatus || sourceStatusFromErrorType(errorType);
  const fetchMeta = {
    completed: false,
    ok: false,
    status: null,
    bodyTruncated: false,
    observedBytes: 0
  };

  return {
    action: action.name,
    mode: "live",
    status: sourceStatus,
    source_status: sourceStatus,
    error_type: errorType,
    latency_ms: meta.latencyMs ?? null,
    origin_warmed: Boolean(meta.originWarmed),
    sensitive_output: false,
    action_diagnostics: meta.actionDiagnostics || null,
    data: {
      http_status: null,
      ok: false,
      body_truncated: false,
      observed_bytes: 0,
      response_summary: null
    },
    source_card: buildSourceCard({ action, config, fetchMeta, mock: false, meta: { ...meta, sourceStatus, errorType } }),
    source_quality: buildSourceQuality({ action, fetchMeta, mock: false, meta: { ...meta, sourceStatus, errorType } })
  };
}

export function validateActionInput(input) {
  if (!input || typeof input !== "object") {
    return;
  }

  const violation = findForbiddenInput(input);
  if (violation) {
    const error = new Error(`Forbidden action input: ${violation}`);
    error.statusCode = 400;
    error.code = "forbidden_action_input";
    error.publicMessage = "Action input may not include URLs, paths, headers, cookies, tokens, sessions, or secrets";
    throw error;
  }
}

function freezeAction(action) {
  normalizeRelativePath(action.apiPath, `${action.name}.apiPath`);
  return Object.freeze(action);
}

function sanitizeInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const safe = {};
  for (const key of ALLOWED_INPUT_KEYS) {
    if (Object.hasOwn(input, key)) {
      safe[key] = sanitizeValue(input[key]);
    }
  }

  if (typeof safe.limit === "number") {
    safe.limit = Math.min(Math.max(Math.trunc(safe.limit), 1), 100);
  }

  return safe;
}

function findForbiddenInput(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return /\bhttps?:\/\//i.test(value) ? "url_value" : null;
  }
  if (typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    for (const childValue of value) {
      const childViolation = findForbiddenInput(childValue, depth + 1);
      if (childViolation) {
        return childViolation;
      }
    }
    return null;
  }

  for (const [key, childValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, "");
    if (FORBIDDEN_INPUT_KEYS.includes(normalizedKey)) {
      return key;
    }

    const childViolation = findForbiddenInput(childValue, depth + 1);
    if (childViolation) {
      return childViolation;
    }
  }

  return null;
}

function assertAllowlistMatchesRegistry() {
  const registered = Object.keys(ACTIONS).sort();
  const allowed = [...ACTION_ALLOWLIST].sort();
  if (registered.length !== allowed.length || registered.some((name, index) => name !== allowed[index])) {
    throw new Error("ACTION_ALLOWLIST must exactly match the fixed action registry");
  }
}

function sanitizeValue(value, depth = 0) {
  if (depth > 4) {
    return "[max_depth]";
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return value.slice(0, 512);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const safe = {};
    for (const [key, childValue] of Object.entries(value).slice(0, 50)) {
      if (looksSensitive(key)) {
        safe[key] = "[redacted_key]";
      } else {
        safe[key.slice(0, 128)] = sanitizeValue(childValue, depth + 1);
      }
    }
    return safe;
  }
  return String(value).slice(0, 128);
}

function looksSensitive(key) {
  return /(authorization|cookie|token|secret|session|password|credential|csrf|jwt)/i.test(key);
}

function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

function scopeFromInput(input) {
  return {
    account_id: typeof input.accountId === "string" ? input.accountId : "mock-account",
    workspace_id: typeof input.workspaceId === "string" ? input.workspaceId : "mock-workspace"
  };
}

function fixedMockTime() {
  return "2026-05-29T00:00:00.000Z";
}
