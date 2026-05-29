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
  "user_id",
  "device_id",
  "appName",
  "time_window"
]);

const TRACK_ANALYSIS_LATEST_DATE_PATH = "/dp/platform/app/analytics/v2/sequence/getLastestDateTime";
const TRACK_ANALYSIS_APP_NAMES = Object.freeze(["KUAISHOU", "NEBULA"]);
const TRACK_ANALYSIS_FUNC_TYPE = "USER_PROFILE_QUERY";

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
    description: "Return a compact track-analysis getLastestDateTime shape summary for a fixed track-analysis origin.",
    method: "GET",
    apiPath: TRACK_ANALYSIS_LATEST_DATE_PATH,
    inputContract: {
      user_id: "required string when device_id is absent",
      device_id: "required string when user_id is absent",
      appName: "required enum: KUAISHOU | NEBULA",
      time_window: "optional object; not used by getLastestDateTime"
    },
    validateParams: validateTrackAnalysisInput,
    buildRequest: buildTrackAnalysisLatestDateRequest,
    summarizeLiveResponse: summarizeTrackAnalysisLatestDateResponse,
    mockData: (input) => ({
      sub_interface: "getLastestDateTime",
      entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
      appName: input.appName,
      shape_summary_only: true,
      latest_datetime_present: true,
      uid_did_relation_latest_datetime_present: true,
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
  const parameterError = getActionParameterError(action, safeInput);
  if (parameterError) {
    const error = new Error(parameterError.message);
    error.code = "parameter_error";
    error.parameterError = parameterError;
    throw error;
  }
  if (typeof action.buildRequest === "function") {
    const request = action.buildRequest(safeInput);
    return {
      path: normalizeRelativePath(request.path, `${action.name}.requestPath`),
      method: request.method || action.method,
      body: request.body || {}
    };
  }
  return {
    path: action.apiPath,
    method: action.method,
    body: safeInput
  };
}

export function runMockAction(action, input, config, meta = {}) {
  validateActionInput(input);
  const safeInput = sanitizeInput(input);
  const parameterError = getActionParameterError(action, safeInput);
  if (parameterError) {
    return buildActionParameterErrorResponse(action, config, {
      ...meta,
      parameterError
    });
  }
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
  const safeInput = sanitizeInput(input);
  const parsed = parseJson(fetchResult.bodyText);
  const httpErrorType = classifyHttpStatus(fetchResult.status);
  const parseErrorType = parsed.ok ? null : classifyUnparseableBody(fetchResult.bodyText);
  const actionSummary = parsed.ok && typeof action.summarizeLiveResponse === "function"
    ? action.summarizeLiveResponse(parsed.value, safeInput)
    : {};
  const transportErrorType = httpErrorType || parseErrorType;
  const errorType = transportErrorType || actionSummary.errorType || null;
  const sourceStatus = transportErrorType
    ? sourceStatusFromErrorType(transportErrorType)
    : actionSummary.sourceStatus || (errorType ? sourceStatusFromErrorType(errorType) : "ok");
  const data = {
    http_status: fetchResult.status,
    ok: fetchResult.ok,
    body_truncated: fetchResult.bodyTruncated,
    observed_bytes: fetchResult.observedBytes,
    response_summary: parsed.ok
      ? {
          format: "json",
          shape: summarizeJsonShape(parsed.value),
          ...(actionSummary.summary || {})
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
    lazy_rewarm_attempted: Boolean(meta.lazyRewarmAttempted),
    lazy_rewarm_status: meta.lazyRewarmStatus || "not_attempted",
    page_ready_before_fetch: meta.pageReadyBeforeFetch ?? null,
    bound_page_origin_before_rewarm: meta.boundPageOriginBeforeRewarm || null,
    bound_page_origin_after_rewarm: meta.boundPageOriginAfterRewarm || null,
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
    lazy_rewarm_attempted: Boolean(meta.lazyRewarmAttempted),
    lazy_rewarm_status: meta.lazyRewarmStatus || "not_attempted",
    page_ready_before_fetch: meta.pageReadyBeforeFetch ?? null,
    bound_page_origin_before_rewarm: meta.boundPageOriginBeforeRewarm || null,
    bound_page_origin_after_rewarm: meta.boundPageOriginAfterRewarm || null,
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

export function buildActionParameterErrorResponse(action, config, meta = {}) {
  const errorType = "parameter_error";
  const sourceStatus = "parameter_error";
  const fetchMeta = {
    completed: false,
    ok: false,
    status: null,
    bodyTruncated: false,
    observedBytes: 0
  };

  return {
    action: action.name,
    mode: config.mode,
    status: sourceStatus,
    source_status: sourceStatus,
    error_type: errorType,
    latency_ms: meta.latencyMs ?? null,
    origin_warmed: Boolean(meta.originWarmed),
    sensitive_output: false,
    data: {
      http_status: null,
      ok: false,
      body_truncated: false,
      observed_bytes: 0,
      response_summary: null,
      parameter_error: {
        message: meta.parameterError?.message || "Missing or invalid action parameters",
        required: meta.parameterError?.required || []
      }
    },
    source_card: buildSourceCard({
      action,
      config,
      fetchMeta,
      mock: config.mode === "mock",
      meta: { ...meta, sourceStatus, errorType }
    }),
    source_quality: buildSourceQuality({
      action,
      fetchMeta,
      mock: config.mode === "mock",
      meta: { ...meta, sourceStatus, errorType }
    })
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

export function getActionParameterError(action, input) {
  if (typeof action.validateParams !== "function") {
    return null;
  }
  return action.validateParams(input || {});
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

function classifyUnparseableBody(text) {
  const sample = String(text || "").slice(0, 4096).toLowerCase();
  if (/<html|<!doctype/.test(sample) && /(sso|login|signin|sign-in|passport|auth)/i.test(sample)) {
    return "auth_failed";
  }
  return "parse_error";
}

function validateTrackAnalysisInput(input) {
  const hasUserId = typeof input.user_id === "string" && input.user_id.trim().length > 0;
  const hasDeviceId = typeof input.device_id === "string" && input.device_id.trim().length > 0;
  if (hasUserId === hasDeviceId) {
    return {
      message: "track_analysis_summary requires exactly one of user_id or device_id",
      required: ["user_id xor device_id", "appName"]
    };
  }
  if (typeof input.appName !== "string" || !TRACK_ANALYSIS_APP_NAMES.includes(input.appName)) {
    return {
      message: "track_analysis_summary requires appName to be KUAISHOU or NEBULA",
      required: ["appName=KUAISHOU|NEBULA"]
    };
  }
  return null;
}

function buildTrackAnalysisLatestDateRequest(input) {
  const entityType = Object.hasOwn(input, "device_id") ? "deviceId" : "userId";
  const params = new URLSearchParams({
    product: input.appName,
    type: entityType,
    funcType: TRACK_ANALYSIS_FUNC_TYPE,
    _t: String(Date.now())
  });
  return {
    path: `${TRACK_ANALYSIS_LATEST_DATE_PATH}?${params.toString()}`,
    method: "GET",
    body: {}
  };
}

function summarizeTrackAnalysisLatestDateResponse(value, input) {
  const apiCode = readApiCode(value);
  if (apiCode !== null && ![0, 200].includes(apiCode)) {
    return {
      sourceStatus: apiCode === 603 || apiCode === 604 ? "parameter_error" : "blocked",
      errorType: apiCode === 603 || apiCode === 604 ? "parameter_error" : "platform_error",
      summary: {
        track_analysis: {
          sub_interface: "getLastestDateTime",
          entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
          appName: input.appName,
          api_code: apiCode,
          no_data: false
        }
      }
    };
  }

  const data = value && typeof value === "object" ? value.data : null;
  const noData = isEmptyPayload(data);
  return {
    sourceStatus: noData ? "no_data" : "completed",
    errorType: null,
    summary: {
      track_analysis: {
        sub_interface: "getLastestDateTime",
        entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
        appName: input.appName,
        latest_datetime_present: Boolean(data && typeof data === "object" && Object.hasOwn(data, "lastestDateTime")),
        uid_did_relation_latest_datetime_present: Boolean(
          data && typeof data === "object" && Object.hasOwn(data, "uidDidRelLatestDateTime")
        ),
        no_data: noData,
        no_data_not_risk_exclusion: true
      }
    }
  };
}

function readApiCode(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  for (const key of ["code", "result", "status"]) {
    if (typeof value[key] === "number") {
      return value[key];
    }
  }
  return null;
}

function isEmptyPayload(value) {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
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
