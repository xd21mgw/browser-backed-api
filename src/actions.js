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
  "time_window",
  "sub_interface"
]);

const TRACK_ANALYSIS_LATEST_DATE_PATH = "/dp/platform/app/analytics/v2/sequence/getLastestDateTime";
const TRACK_ANALYSIS_USE_DURATION_PATH = "/dp/platform/app/analytics/v2/sequence/getUseDuration";
const TRACK_ANALYSIS_PROFILE_PATH = "/dp/platform/app/analytics/v2/sequence/profile";
const TRACK_ANALYSIS_DEVICE_IDS_PATH = "/dp/platform/app/analytics/v2/sequence/getDeviceIds";
const TRACK_ANALYSIS_APP_NAMES = Object.freeze(["KUAISHOU", "NEBULA"]);
const TRACK_ANALYSIS_SUB_INTERFACES = Object.freeze(["getLastestDateTime", "getUseDuration", "profile", "getDeviceIds"]);
const TRACK_ANALYSIS_FUNC_TYPE = "USER_PROFILE_QUERY";
const TRACK_ANALYSIS_DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

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
    description: "Return a compact track-analysis shape and activity summary for a fixed track-analysis origin.",
    method: "GET",
    apiPath: TRACK_ANALYSIS_LATEST_DATE_PATH,
    inputContract: {
      user_id: "required string when device_id is absent",
      device_id: "required string when user_id is absent",
      appName: "required enum: KUAISHOU | NEBULA",
      sub_interface: "optional enum: getLastestDateTime | getUseDuration | profile | getDeviceIds; default getLastestDateTime",
      time_window: "optional { startTime, endTime }; profile defaults to the recent 30-day window"
    },
    validateParams: validateTrackAnalysisInput,
    buildRequest: buildTrackAnalysisRequest,
    summarizeLiveResponse: summarizeTrackAnalysisResponse,
    mockData: (input) => ({
      sub_interface: trackAnalysisSubInterface(input),
      entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
      appName: input.appName,
      shape_summary_only: true,
      latest_datetime_present: trackAnalysisSubInterface(input) === "getLastestDateTime",
      uid_did_relation_latest_datetime_present: trackAnalysisSubInterface(input) === "getLastestDateTime",
      activity_summary: mockTrackAnalysisActivitySummary(input),
      profile_summary: mockTrackAnalysisProfileSummary(input),
      device_summary: mockTrackAnalysisDeviceSummary(input),
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
    source_card: buildSourceCard({
      action,
      config,
      fetchMeta,
      mock: true,
      meta: {
        ...meta,
        requestPath: typeof action.buildRequest === "function" ? action.buildRequest(safeInput).path : action.apiPath,
        requestMethod: typeof action.buildRequest === "function" ? action.buildRequest(safeInput).method : action.method
      }
    }),
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
  const subInterface = trackAnalysisSubInterface(input);
  if (hasUserId === hasDeviceId) {
    return {
      message: "track_analysis_summary requires exactly one of user_id or device_id",
      required: ["user_id xor device_id", "appName"]
    };
  }
  if (!TRACK_ANALYSIS_SUB_INTERFACES.includes(subInterface)) {
    return {
      message: "track_analysis_summary sub_interface must be getLastestDateTime, getUseDuration, profile, or getDeviceIds",
      required: ["sub_interface=getLastestDateTime|getUseDuration|profile|getDeviceIds"]
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

function buildTrackAnalysisRequest(input) {
  const subInterface = trackAnalysisSubInterface(input);
  if (subInterface === "getUseDuration") {
    return buildTrackAnalysisUseDurationRequest(input);
  }
  if (subInterface === "profile") {
    return buildTrackAnalysisProfileRequest(input);
  }
  if (subInterface === "getDeviceIds") {
    return buildTrackAnalysisDeviceIdsRequest(input);
  }
  return buildTrackAnalysisLatestDateRequest(input);
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

function buildTrackAnalysisUseDurationRequest(input) {
  const entityKey = Object.hasOwn(input, "device_id") ? "deviceId" : "userId";
  return {
    path: TRACK_ANALYSIS_USE_DURATION_PATH,
    method: "POST",
    body: {
      appName: input.appName,
      funcType: TRACK_ANALYSIS_FUNC_TYPE,
      _t: String(Date.now()),
      [entityKey]: input[entityKey === "deviceId" ? "device_id" : "user_id"]
    }
  };
}

function buildTrackAnalysisProfileRequest(input) {
  const entityKey = Object.hasOwn(input, "device_id") ? "deviceId" : "userId";
  const window = trackAnalysisTimeWindow(input);
  return {
    path: TRACK_ANALYSIS_PROFILE_PATH,
    method: "POST",
    body: {
      appName: input.appName,
      startTime: window.startTime,
      endTime: window.endTime,
      include: 1,
      pageSize: 100,
      funcType: TRACK_ANALYSIS_FUNC_TYPE,
      _t: String(Date.now()),
      [entityKey]: input[entityKey === "deviceId" ? "device_id" : "user_id"]
    }
  };
}

function buildTrackAnalysisDeviceIdsRequest(input) {
  const entityKey = Object.hasOwn(input, "device_id") ? "deviceId" : "userId";
  return {
    path: TRACK_ANALYSIS_DEVICE_IDS_PATH,
    method: "POST",
    body: {
      appName: input.appName,
      funcType: TRACK_ANALYSIS_FUNC_TYPE,
      _t: String(Date.now()),
      [entityKey]: input[entityKey === "deviceId" ? "device_id" : "user_id"]
    }
  };
}

function summarizeTrackAnalysisResponse(value, input) {
  const subInterface = trackAnalysisSubInterface(input);
  if (subInterface === "getUseDuration") {
    return summarizeTrackAnalysisUseDurationResponse(value, input);
  }
  if (subInterface === "profile") {
    return summarizeTrackAnalysisProfileResponse(value, input);
  }
  if (subInterface === "getDeviceIds") {
    return summarizeTrackAnalysisDeviceIdsResponse(value, input);
  }
  return summarizeTrackAnalysisLatestDateResponse(value, input);
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
        output_fields_observed: observedKeys(data).map((key) => `data.${key}`),
        no_data: noData,
        no_data_not_risk_exclusion: true
      }
    }
  };
}

function summarizeTrackAnalysisUseDurationResponse(value, input) {
  const apiCode = readApiCode(value);
  if (apiCode !== null && ![0, 200].includes(apiCode)) {
    return {
      sourceStatus: apiCode === 603 || apiCode === 604 ? "parameter_error" : "blocked",
      errorType: apiCode === 603 || apiCode === 604 ? "parameter_error" : "platform_error",
      summary: {
        track_analysis: {
          sub_interface: "getUseDuration",
          entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
          appName: input.appName,
          api_code: apiCode,
          no_data: false
        }
      }
    };
  }

  const rows = extractUseDurationRows(value);
  const activitySummary = buildActivitySummary(rows);
  const noData = rows.length === 0;
  return {
    sourceStatus: noData ? "no_data" : "completed",
    errorType: null,
    summary: {
      track_analysis: {
        sub_interface: "getUseDuration",
        entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
        appName: input.appName,
        output_fields_observed: rows.length > 0 ? ["data.rows[].date", "data.rows[].duration"] : [],
        no_data: noData,
        no_data_not_risk_exclusion: true,
        activity_summary: activitySummary
      }
    }
  };
}

function summarizeTrackAnalysisProfileResponse(value, input) {
  const apiCode = readApiCode(value);
  if (apiCode !== null && ![0, 200].includes(apiCode)) {
    return {
      sourceStatus: apiCode === 603 || apiCode === 604 ? "parameter_error" : "blocked",
      errorType: apiCode === 603 || apiCode === 604 ? "parameter_error" : "platform_error",
      summary: {
        track_analysis: {
          sub_interface: "profile",
          entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
          appName: input.appName,
          api_code: apiCode,
          no_data: false
        }
      }
    };
  }

  const profileSummary = buildProfileSummary(value);
  const noData = isProfileSummaryEmpty(profileSummary);
  return {
    sourceStatus: noData ? "no_data" : "completed",
    errorType: null,
    summary: {
      track_analysis: {
        sub_interface: "profile",
        entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
        appName: input.appName,
        output_fields_observed: profileSummary.output_fields_observed,
        no_data: noData,
        no_data_not_risk_exclusion: true,
        profile_summary: profileSummary
      }
    }
  };
}

function summarizeTrackAnalysisDeviceIdsResponse(value, input) {
  const apiCode = readApiCode(value);
  if (apiCode !== null && ![0, 200].includes(apiCode)) {
    return {
      sourceStatus: apiCode === 603 || apiCode === 604 ? "parameter_error" : "blocked",
      errorType: apiCode === 603 || apiCode === 604 ? "parameter_error" : "platform_error",
      summary: {
        track_analysis: {
          sub_interface: "getDeviceIds",
          entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
          appName: input.appName,
          api_code: apiCode,
          no_data: false
        }
      }
    };
  }

  const deviceSummary = buildDeviceSummary(value);
  const noData = isDeviceSummaryEmpty(deviceSummary);
  return {
    sourceStatus: noData ? "no_data" : "completed",
    errorType: null,
    summary: {
      track_analysis: {
        sub_interface: "getDeviceIds",
        entity_type: Object.hasOwn(input, "device_id") ? "deviceId" : "userId",
        appName: input.appName,
        output_fields_observed: deviceSummary.output_fields_observed,
        no_data: noData,
        no_data_not_risk_exclusion: true,
        device_summary: deviceSummary
      }
    }
  };
}

function trackAnalysisSubInterface(input) {
  return typeof input.sub_interface === "string" ? input.sub_interface : "getLastestDateTime";
}

function trackAnalysisTimeWindow(input) {
  const rawWindow = input.time_window && typeof input.time_window === "object" ? input.time_window : {};
  const startTime = Number(rawWindow.startTime);
  const endTime = Number(rawWindow.endTime);
  if (
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    startTime > 0 &&
    endTime > startTime
  ) {
    return {
      startTime: Math.trunc(startTime),
      endTime: Math.trunc(endTime)
    };
  }

  const end = Date.now();
  return {
    startTime: end - TRACK_ANALYSIS_DEFAULT_WINDOW_MS,
    endTime: end
  };
}

function extractUseDurationRows(value) {
  const data = value && typeof value === "object" ? value.data : null;
  if (Array.isArray(data?.rows)) {
    return data.rows.filter((row) => row && typeof row === "object");
  }
  if (Array.isArray(data)) {
    return data.filter((row) => row && typeof row === "object");
  }
  return [];
}

function buildActivitySummary(rows) {
  let totalDuration = 0;
  let peakDuration = null;
  let peakDate = null;
  let nonzeroDaysCount = 0;
  const dates = [];

  for (const row of rows) {
    const date = typeof row.date === "string" ? row.date : null;
    const duration = typeof row.duration === "number" ? row.duration : Number(row.duration);
    const safeDuration = Number.isFinite(duration) ? duration : 0;
    totalDuration += safeDuration;
    if (safeDuration > 0) {
      nonzeroDaysCount += 1;
    }
    if (date) {
      dates.push(date);
    }
    if (peakDuration === null || safeDuration > peakDuration) {
      peakDuration = safeDuration;
      peakDate = date;
    }
  }

  dates.sort();
  return {
    rows_count: rows.length,
    total_duration: totalDuration,
    peak_duration: peakDuration ?? 0,
    peak_date: peakDate,
    nonzero_days_count: nonzeroDaysCount,
    date_range_observed: {
      from: dates[0] || null,
      to: dates[dates.length - 1] || null
    }
  };
}

function buildProfileSummary(value) {
  const data = value && typeof value === "object" ? value.data : null;
  const profile = data && typeof data === "object" && !Array.isArray(data) ? data.profile : null;
  const firstLevelProfile = profile && typeof profile === "object" ? profile.firstLevelProfile : null;
  const secondLevelProfile = profile && typeof profile === "object" ? profile.secondLevelProfile : null;
  const deviceIds = profileDeviceIds(data, profile);
  const firstLevelKeys = observedKeys(firstLevelProfile);
  const secondLevelKeys = secondLevelProfileKeys(secondLevelProfile);
  const outputFields = profileOutputFields(data, firstLevelKeys, secondLevelProfile, deviceIds);

  return {
    profile_sections_observed: profileSectionsObserved(data, profile),
    first_level_profile_keys_count: firstLevelKeys.length,
    second_level_profile_keys_count: secondLevelKeys.length,
    register_time_present: containsProfileSignal([...firstLevelKeys, ...secondLevelKeys], /(register|注册)/i),
    fan_distribution_present: containsProfileSignal([...firstLevelKeys, ...secondLevelKeys], /(fan|粉丝|fans?)/i),
    active_days_bucket_present: containsProfileSignal([...firstLevelKeys, ...secondLevelKeys], /(active.*day|active_days|活跃)/i),
    device_ids_count: deviceIds ? deviceIds.length : null,
    output_fields_observed: outputFields
  };
}

function profileSectionsObserved(data, profile) {
  const sections = [];
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (Object.hasOwn(data, "deviceIds")) {
      sections.push("data.deviceIds");
    }
    if (Object.hasOwn(data, "latestDateTime")) {
      sections.push("data.latestDateTime");
    }
    if (Object.hasOwn(data, "profile")) {
      sections.push("data.profile");
    }
  }
  if (profile && typeof profile === "object" && !Array.isArray(profile)) {
    if (Object.hasOwn(profile, "firstLevelProfile")) {
      sections.push("data.profile.firstLevelProfile");
    }
    if (Object.hasOwn(profile, "secondLevelProfile")) {
      sections.push("data.profile.secondLevelProfile");
    }
  }
  return sections;
}

function profileDeviceIds(data, profile) {
  const candidates = [data?.deviceIds, profile?.deviceIds];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return null;
}

function secondLevelProfileKeys(secondLevelProfile) {
  if (Array.isArray(secondLevelProfile)) {
    const labels = secondLevelProfile
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        return typeof item.label === "string" ? item.label : null;
      })
      .filter(Boolean);
    return labels.length > 0 ? [...new Set(labels.map(safeFieldName))] : secondLevelProfile.map((_, index) => `item_${index}`);
  }
  return observedKeys(secondLevelProfile);
}

function profileOutputFields(data, firstLevelKeys, secondLevelProfile, deviceIds) {
  const outputFields = [];
  if (deviceIds) {
    outputFields.push("data.deviceIds");
  }
  for (const key of firstLevelKeys) {
    outputFields.push(`data.profile.firstLevelProfile.${safeFieldName(key)}`);
  }
  if (Array.isArray(secondLevelProfile) && secondLevelProfile.length > 0) {
    outputFields.push("data.profile.secondLevelProfile[].label");
    outputFields.push("data.profile.secondLevelProfile[].value");
  } else {
    for (const key of observedKeys(secondLevelProfile)) {
      outputFields.push(`data.profile.secondLevelProfile.${safeFieldName(key)}`);
    }
  }
  if (data && typeof data === "object" && Object.hasOwn(data, "latestDateTime")) {
    outputFields.push("data.latestDateTime");
  }
  return outputFields.slice(0, 80);
}

function containsProfileSignal(keys, pattern) {
  return keys.some((key) => pattern.test(String(key)));
}

function isProfileSummaryEmpty(summary) {
  return (
    summary.profile_sections_observed.length === 0 ||
    (
      summary.first_level_profile_keys_count === 0 &&
      summary.second_level_profile_keys_count === 0 &&
      !summary.device_ids_count &&
      summary.output_fields_observed.length === 0
    )
  );
}

function buildDeviceSummary(value) {
  const data = value && typeof value === "object" ? value.data : null;
  const { entries, sourcePath } = extractDeviceEntries(data);
  const deviceIds = entries.map(deviceIdFromEntry).filter((item) => item !== null && item !== undefined && String(item).length > 0);
  const uniqueDeviceIds = [...new Set(deviceIds.map((item) => String(item)))];
  const fieldKeys = deviceFieldsObserved(entries);
  const outputFields = deviceOutputFields(sourcePath, entries, fieldKeys);

  return {
    device_ids_count: uniqueDeviceIds.length > 0 ? uniqueDeviceIds.length : entries.length,
    device_id_sample_masked: uniqueDeviceIds.length > 0 ? maskDeviceId(uniqueDeviceIds[0]) : null,
    device_fields_observed: fieldKeys,
    device_model_fields_present: containsProfileSignal(fieldKeys, /(device.*model|model|机型|设备型号)/i),
    last_active_fields_present: containsProfileSignal(fieldKeys, /(last.*active|active.*time|last.*login|latest|recent|活跃|最近|时间|日期)/i),
    output_fields_observed: outputFields
  };
}

function extractDeviceEntries(data) {
  if (Array.isArray(data)) {
    return { entries: data.filter(isDeviceEntry), sourcePath: "data[]" };
  }
  if (!data || typeof data !== "object") {
    return { entries: [], sourcePath: "data" };
  }

  const arrayCandidates = [
    ["data.deviceIds", data.deviceIds],
    ["data.device_ids", data.device_ids],
    ["data.devices", data.devices],
    ["data.deviceList", data.deviceList],
    ["data.device_list", data.device_list],
    ["data.rows", data.rows],
    ["data.records", data.records],
    ["data.list", data.list],
    ["data.data", data.data]
  ];
  for (const [sourcePath, candidate] of arrayCandidates) {
    if (Array.isArray(candidate)) {
      return { entries: candidate.filter(isDeviceEntry), sourcePath };
    }
  }

  if (deviceIdFromEntry(data) !== null || deviceFieldsObserved([data]).length > 0) {
    return { entries: [data], sourcePath: "data" };
  }
  return { entries: [], sourcePath: "data" };
}

function isDeviceEntry(value) {
  return ["string", "number"].includes(typeof value) || Boolean(value && typeof value === "object");
}

function deviceIdFromEntry(entry) {
  if (typeof entry === "string" || typeof entry === "number") {
    return entry;
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  for (const key of Object.keys(entry)) {
    if (/^(deviceId|device_id|did|deviceDid|device_did|deviceNo|device_no)$/i.test(key)) {
      const value = entry[key];
      if (typeof value === "string" || typeof value === "number") {
        return value;
      }
    }
  }
  return null;
}

function deviceFieldsObserved(entries) {
  const keys = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    keys.push(...observedKeys(entry));
  }
  return [...new Set(keys)].slice(0, 50);
}

function deviceOutputFields(sourcePath, entries, fieldKeys) {
  if (entries.length === 0) {
    return [];
  }
  const normalizedBase = sourcePath && sourcePath.endsWith("[]") ? sourcePath : `${sourcePath || "data"}[]`;
  if (fieldKeys.length === 0) {
    return [normalizedBase];
  }
  return fieldKeys.map((key) => `${normalizedBase}.${safeFieldName(key)}`).slice(0, 80);
}

function maskDeviceId(value) {
  const text = String(value);
  return `[masked_device_id:length=${text.length}]`;
}

function isDeviceSummaryEmpty(summary) {
  return summary.device_ids_count === 0 && summary.device_fields_observed.length === 0 && summary.output_fields_observed.length === 0;
}

function observedKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value).slice(0, 50).map(safeFieldName);
}

function safeFieldName(key) {
  if (/(authorization|cookie|token|secret|session|password|credential|csrf|jwt)/i.test(key)) {
    return "[redacted_key]";
  }
  return String(key).slice(0, 128);
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

function mockTrackAnalysisActivitySummary(input) {
  if (trackAnalysisSubInterface(input) !== "getUseDuration") {
    return null;
  }
  return {
    rows_count: 3,
    total_duration: 150,
    peak_duration: 90,
    peak_date: "2026-05-28",
    nonzero_days_count: 2,
    date_range_observed: {
      from: "2026-05-26",
      to: "2026-05-28"
    }
  };
}

function mockTrackAnalysisProfileSummary(input) {
  if (trackAnalysisSubInterface(input) !== "profile") {
    return null;
  }
  return {
    profile_sections_observed: [
      "data.deviceIds",
      "data.profile",
      "data.profile.firstLevelProfile",
      "data.profile.secondLevelProfile"
    ],
    first_level_profile_keys_count: 4,
    second_level_profile_keys_count: 3,
    register_time_present: true,
    fan_distribution_present: true,
    active_days_bucket_present: true,
    device_ids_count: 2,
    output_fields_observed: [
      "data.deviceIds",
      "data.profile.firstLevelProfile.userId",
      "data.profile.secondLevelProfile[].label",
      "data.profile.secondLevelProfile[].value"
    ]
  };
}

function mockTrackAnalysisDeviceSummary(input) {
  if (trackAnalysisSubInterface(input) !== "getDeviceIds") {
    return null;
  }
  return {
    device_ids_count: 2,
    device_id_sample_masked: "[masked_device_id:length=17]",
    device_fields_observed: ["deviceId", "deviceModel", "lastActiveTime"],
    device_model_fields_present: true,
    last_active_fields_present: true,
    output_fields_observed: [
      "data.deviceIds[].deviceId",
      "data.deviceIds[].deviceModel",
      "data.deviceIds[].lastActiveTime"
    ]
  };
}

function fixedMockTime() {
  return "2026-05-29T00:00:00.000Z";
}
