import { normalizeRelativePath } from "./config.js";
import { classifyHttpStatus, sourceStatusFromErrorType } from "./diagnostics.js";
import { buildSourceCard, buildSourceQuality, summarizeJsonShape } from "./quality.js";

export const ACTION_ALLOWLIST = Object.freeze([
  "rcp_snapshot",
  "weapon_inventory",
  "login_logs_search",
  "track_analysis_summary",
  "archives_user_analysis",
  "archives_user_profile",
  "archives_photo_search",
  "archives_related_users",
  "rcp_event_detail",
  "rcp_event_feature_list",
  "rcp_policy_tree_lookup",
  "track_analysis_check_data_ready"
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
  "recallSource",
  "from_timestamp",
  "to_timestamp",
  "product",
  "productName",
  "searchLevel",
  "include_risk_data",
  "max_device_ids",
  "eventType",
  "source_id",
  "sourceIds",
  "startTime",
  "endTime",
  "page",
  "pageIndex",
  "pageSize",
  "begin",
  "end",
  "beginTime",
  "count",
  "matchType",
  "sort",
  "relation_type",
  "inputType",
  "type",
  "haveParamAuth",
  "operation_filters",
  "selected_columns",
  "user_id",
  "device_id",
  "appName",
  "include",
  "category",
  "event",
  "appPlatform",
  "metric",
  "time_window",
  "sub_interface",
  "mode",
  "eventId",
  "queryTime",
  "featureGroup",
  "policyTreeCode",
  "policyTreeVersion",
  "targetPolicyCode",
  "output_scope"
]);

const RCP_EVENT_LIST_PATH = "/v2/rest/event/eventList";
const RCP_DEFAULT_EVENT_TYPE = "USER_REGISTER_NEW";
const RCP_DEFAULT_WINDOW_MS = 30 * 60 * 1000;
const RCP_DEFAULT_PAGE = 1;
const RCP_DEFAULT_PAGE_SIZE = 40;
const RCP_MAX_PAGE_SIZE = 500;
const RCP_DEFAULT_VERSION = "";
const RCP_DEFAULT_STATUS = 2;
const RCP_DEFAULT_SNAPSHOT_VERSION = "";
const RCP_DEFAULT_REAL_TIME_OP = "";
const RCP_DEFAULT_REGION = "china";
const RCP_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const RCP_DEFAULT_TABLE_COLUMNS = Object.freeze([
  "sourceId",
  "eventId",
  "_occurTime",
  "_realTimeOp",
  "_errorCode",
  "deviceId",
  "hitFusePolicyCode",
  "time"
]);
const RCP_COLUMN_COMMENTS = Object.freeze({
  sourceId: "sourceId",
  eventId: "eventId",
  _occurTime: "_occurTime",
  _realTimeOp: "_realTimeOp",
  _errorCode: "_errorCode",
  deviceId: "deviceId",
  hitFusePolicyCode: "hitFusePolicyCode",
  time: "time"
});

const WEAPON_GRAPH_DATA_PATH = "/apiv2/graphData";
const WEAPON_RISK_DATA_PATH = "/apiv2/riskData";
const WEAPON_DEFAULT_PRODUCT = "KUAISHOU";
const WEAPON_DEFAULT_PRODUCT_NAME = "KUAISHOU";
const WEAPON_DEFAULT_SEARCH_LEVEL = 2;
const WEAPON_DEFAULT_INCLUDE_RISK_DATA = true;
const WEAPON_DEFAULT_MAX_DEVICE_IDS = 5;
const WEAPON_MAX_DEVICE_IDS = 20;

const LOGIN_LOGS_SEARCH_PATH = "/rest/unified/log/search";
const LOGIN_LOGS_DEFAULT_RECALL_SOURCE = "2,0,1,3";
const LOGIN_LOGS_DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_LOGS_FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOGIN_LOGS_MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_LOGS_DEFAULT_LIMIT = 20;
const LOGIN_LOGS_MAX_LIMIT = 100;
const DEFAULT_OUTPUT_SCOPE = "internal_risk_review";
const OUTPUT_SCOPES = Object.freeze(["internal_risk_review", "external_share"]);
const FIELD_CLASSIFICATION = Object.freeze({
  credential_secret: Object.freeze([
    "cookie",
    "token",
    "session",
    "header",
    "authorization",
    "password",
    "raw_response_full_body",
    "raw_login_records_full_dump",
    "raw_labelInfo_full_dump",
    "raw_originalLog_full_dump"
  ]),
  pii_strict: Object.freeze(["phone_number", "id_card", "real_name"]),
  risk_entity_identifier: Object.freeze([
    "user_id",
    "uid",
    "device_id",
    "did",
    "ip",
    "eventId",
    "sourceId",
    "hitFusePolicyCode",
    "strategy_code",
    "logSource",
    "method",
    "timestamp"
  ]),
  source_summary_metric: Object.freeze([
    "records_count",
    "event_count",
    "related_device_count",
    "related_user_count",
    "duration",
    "date_range",
    "field_presence"
  ])
});

const TRACK_ANALYSIS_LATEST_DATE_PATH = "/dp/platform/app/analytics/v2/sequence/getLastestDateTime";
const TRACK_ANALYSIS_USE_DURATION_PATH = "/dp/platform/app/analytics/v2/sequence/getUseDuration";
const TRACK_ANALYSIS_PROFILE_PATH = "/dp/platform/app/analytics/v2/sequence/profile";
const TRACK_ANALYSIS_DEVICE_IDS_PATH = "/dp/platform/app/analytics/v2/sequence/getDeviceIds";
const TRACK_ANALYSIS_CHECK_DATA_READY_PATH = "/dp/platform/app/analytics/v2/sequence/checkDataReady";
const TRACK_ANALYSIS_APP_NAMES = Object.freeze(["KUAISHOU", "NEBULA"]);
const TRACK_ANALYSIS_SUB_INTERFACES = Object.freeze(["getLastestDateTime", "getUseDuration", "profile", "getDeviceIds"]);
const TRACK_ANALYSIS_FUNC_TYPE = "USER_PROFILE_QUERY";
const TRACK_ANALYSIS_DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const TRACK_ANALYSIS_DEFAULT_PRODUCT = "KUAISHOU";

const ARCHIVES_USER_ANALYSIS_PATH = "/v3/user/log/coreLogs/fetch";
const ARCHIVES_PHOTO_SEARCH_PATH = "/v4/archives/report/photo/search";
const ARCHIVES_USER_PROFILE_PATH = "/archives/user/home/info";
const ARCHIVES_RELATED_USERS_PATH = "/archives/user/search/device";
const ARCHIVES_MAX_PAGE_SIZE = 100;
const ARCHIVES_USER_ANALYSIS_FILTER_FIELDS = Object.freeze([
  "loginStart",
  "registerBind",
  "resetPass",
  "protectAccount",
  "liveStream",
  "scanCode",
  "logout",
  "frozen"
]);
const ARCHIVES_RELATED_USER_TYPES = Object.freeze({
  same_device_registered: 0,
  same_device_login: 1
});

const RCP_EVENT_DETAIL_PATH = "/v2/rest/event/rcpEventDetail";
const RCP_EVENT_FEATURE_LIST_PATH = "/v2/rest/event/rcpEventFeatureList";
const RCP_POLICY_TREE_LOOKUP_PATH = "/v2/rest/pro/policyTree/queryProPolicyTree";
const RCP_POLICY_TREE_LIST_PATH = "/v2/rest/pro/policyTree/policyTreeList";
const RCP_POLICY_TREE_BINDING_BY_NODE_PATH = "/v2/rest/pro/policyTree/queryBindingByNodeCode";
const RCP_POLICY_TREE_ALL_POLICY_CODE_PATH = "/v2/rest/pro/policyTree/getAllPolicyCodeByPage";
const SAFE_CODE_PATTERN = /^[A-Za-z0-9_:-]{1,128}$/;

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
  "rawquery",
  "rawbody",
  "csrf",
  "jwt"
]);

export const ACTIONS = Object.freeze({
  rcp_snapshot: freezeAction({
    name: "rcp_snapshot",
    domainKey: "rcp",
    description: "Return a compact RCP eventList shape summary for an allowed typed event query.",
    method: "POST",
    apiPath: RCP_EVENT_LIST_PATH,
    inputContract: {
      eventType: "optional string; default USER_REGISTER_NEW",
      source_id: "optional string; maps to eventV2.sourceIds",
      sourceIds: "optional string or string[]; maps to eventV2.sourceIds string",
      device_id: "optional string; maps to eventV2.conditionList",
      startTime: "optional YYYY-MM-DD HH:mm:ss",
      endTime: "optional YYYY-MM-DD HH:mm:ss",
      time_window: "optional { startTime, endTime } in YYYY-MM-DD HH:mm:ss",
      pageIndex: "optional positive integer; default 1",
      page: "optional positive integer alias for pageIndex",
      pageSize: "optional positive integer <= 500; default 40",
      selected_columns: "optional string[]; converted to tableHeaderList object array"
    },
    validateParams: validateRcpSnapshotInput,
    buildRequest: buildRcpSnapshotRequest,
    summarizeLiveResponse: summarizeRcpSnapshotResponse,
    mockData: mockRcpSnapshotData
  }),
  weapon_inventory: freezeAction({
    name: "weapon_inventory",
    domainKey: "weapon",
    description: "Return a compact Weapon graphData and optional riskData shape summary for a typed entity.",
    method: "GET",
    apiPath: WEAPON_GRAPH_DATA_PATH,
    inputContract: {
      user_id: "required string when device_id is absent; graphData USER_ID -> DEVICE_ID",
      device_id: "required string when user_id is absent; graphData DEVICE_ID -> USER_ID",
      product: "optional enum; default KUAISHOU",
      productName: "optional enum; default KUAISHOU",
      searchLevel: "optional positive integer; default 2",
      include_risk_data: "optional boolean; default true",
      max_device_ids: "optional positive integer <= 20; default 5"
    },
    validateParams: validateWeaponInventoryInput,
    buildRequest: buildWeaponInventoryRequest,
    summarizeLiveResponse: summarizeWeaponInventoryResponse,
    mockData: mockWeaponInventoryData
  }),
  login_logs_search: freezeAction({
    name: "login_logs_search",
    domainKey: "login_logs",
    description: "Return a bounded online login log shape summary for a typed user and time window.",
    method: "GET",
    apiPath: LOGIN_LOGS_SEARCH_PATH,
    inputContract: {
      user_id: "required string",
      time_window: "optional { from_timestamp, to_timestamp } epoch ms; default recent 7 days",
      from_timestamp: "optional epoch ms",
      to_timestamp: "optional epoch ms",
      recallSource: "optional string; default 2,0,1,3",
      limit: "optional positive integer <= 100; default 20"
    },
    validateParams: validateLoginLogsInput,
    buildRequest: buildLoginLogsRequest,
    summarizeLiveResponse: summarizeLoginLogsResponse,
    summarizeParseFailureResponse: summarizeLoginLogsParseFailureResponse,
    summarizeFailureResponse: summarizeLoginLogsFailureResponse,
    mockData: mockLoginLogsData
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
  }),
  archives_user_analysis: freezeAction({
    name: "archives_user_analysis",
    domainKey: "archives",
    description: "Return a compact Archives Center user action timeline shape summary for typed user/time params.",
    method: "POST",
    apiPath: ARCHIVES_USER_ANALYSIS_PATH,
    registryStatus: "service_registered",
    inputContract: {
      user_id: "required decimal string",
      beginTime: "required epoch ms",
      endTime: "required epoch ms",
      pageIndex: "optional positive integer; default 1",
      pageSize: "optional positive integer <= 100; default 30"
    },
    validateParams: validateArchivesUserAnalysisInput,
    buildRequest: buildArchivesUserAnalysisRequest,
    summarizeLiveResponse: summarizeFixedShapeActionResponse("archives_user_analysis"),
    mockData: mockArchivesUserAnalysisData
  }),
  archives_user_profile: freezeAction({
    name: "archives_user_profile",
    domainKey: "archives",
    description: "Return a compact Archives Center user profile shape summary for a typed user.",
    method: "GET",
    apiPath: ARCHIVES_USER_PROFILE_PATH,
    registryStatus: "service_registered",
    inputContract: {
      user_id: "required decimal string"
    },
    validateParams: validateArchivesUserProfileInput,
    buildRequest: buildArchivesUserProfileRequest,
    summarizeLiveResponse: summarizeFixedShapeActionResponse("archives_user_profile"),
    mockData: mockArchivesUserProfileData
  }),
  archives_photo_search: freezeAction({
    name: "archives_photo_search",
    domainKey: "archives",
    description: "Return a compact Archives Center photo report/search shape summary for typed user/time params.",
    method: "POST",
    apiPath: ARCHIVES_PHOTO_SEARCH_PATH,
    registryStatus: "service_registered",
    inputContract: {
      user_id: "required decimal string; maps to reportedIds",
      begin: "required epoch ms",
      end: "required epoch ms",
      page: "optional positive integer; default 1",
      count: "optional positive integer <= 100; default 20",
      matchType: "optional enum string 0|1|2; default 0",
      sort: "optional enum string 0|1; default 0"
    },
    validateParams: validateArchivesPhotoSearchInput,
    buildRequest: buildArchivesPhotoSearchRequest,
    summarizeLiveResponse: summarizeFixedShapeActionResponse("archives_photo_search"),
    mockData: mockArchivesPhotoSearchData
  }),
  archives_related_users: freezeAction({
    name: "archives_related_users",
    domainKey: "archives",
    description: "Return a compact Archives Center related-users shape summary for typed same-device relation params.",
    method: "POST",
    apiPath: ARCHIVES_RELATED_USERS_PATH,
    registryStatus: "service_registered",
    inputContract: {
      user_id: "required decimal string; maps to keyword",
      relation_type: "optional enum same_device_registered|same_device_login; default same_device_registered"
    },
    validateParams: validateArchivesRelatedUsersInput,
    buildRequest: buildArchivesRelatedUsersRequest,
    summarizeLiveResponse: summarizeFixedShapeActionResponse("archives_related_users"),
    mockData: mockArchivesRelatedUsersData
  }),
  rcp_event_detail: freezeAction({
    name: "rcp_event_detail",
    domainKey: "rcp",
    description: "Return a compact RCP event detail shape summary for a typed event id and exact query time.",
    method: "GET",
    apiPath: RCP_EVENT_DETAIL_PATH,
    registryStatus: "service_registered",
    inputContract: {
      eventType: "required safe event type string",
      eventId: "required safe event id string",
      queryTime: "required exact event time epoch ms"
    },
    validateParams: validateRcpEventIdentityInput,
    buildRequest: buildRcpEventDetailRequest,
    summarizeLiveResponse: summarizeFixedShapeActionResponse("rcp_event_detail"),
    mockData: mockRcpEventDetailData
  }),
  rcp_event_feature_list: freezeAction({
    name: "rcp_event_feature_list",
    domainKey: "rcp",
    description: "Return a compact RCP feature snapshot shape summary for a typed event id and exact query time.",
    method: "GET",
    apiPath: RCP_EVENT_FEATURE_LIST_PATH,
    registryStatus: "service_registered",
    inputContract: {
      eventType: "required safe event type string",
      eventId: "required safe event id string",
      queryTime: "required exact event time epoch ms",
      featureGroup: "optional empty string only"
    },
    validateParams: validateRcpEventFeatureListInput,
    buildRequest: buildRcpEventFeatureListRequest,
    summarizeLiveResponse: summarizeFixedShapeActionResponse("rcp_event_feature_list"),
    mockData: mockRcpEventFeatureListData
  }),
  rcp_policy_tree_lookup: freezeAction({
    name: "rcp_policy_tree_lookup",
    domainKey: "rcp",
    description: "Return a compact RCP policy-tree asset lookup shape summary; strategy governance only.",
    method: "GET",
    apiPath: RCP_POLICY_TREE_LOOKUP_PATH,
    registryStatus: "service_registered",
    inputContract: {
      policyTreeCode: "required safe policy tree code",
      policyTreeVersion: "required positive integer; maps to treeSnapshot",
      targetPolicyCode: "optional safe policy code; used for source-quality context only"
    },
    validateParams: validateRcpPolicyTreeLookupInput,
    buildRequest: buildRcpPolicyTreeLookupRequest,
    summarizeLiveResponse: summarizeFixedShapeActionResponse("rcp_policy_tree_lookup"),
    mockData: mockRcpPolicyTreeLookupData
  }),
  track_analysis_check_data_ready: freezeAction({
    name: "track_analysis_check_data_ready",
    domainKey: "track_analysis",
    description: "Return a compact Track Analysis readiness shape summary for typed device/time params.",
    method: "POST",
    apiPath: TRACK_ANALYSIS_CHECK_DATA_READY_PATH,
    registryStatus: "service_registered",
    inputContract: {
      device_id: "required string; maps to deviceId",
      appName: "required enum KUAISHOU|NEBULA",
      product: "optional enum KUAISHOU|NEBULA; default KUAISHOU",
      startTime: "required epoch ms",
      endTime: "required epoch ms",
      category: "optional safe string[]",
      event: "optional safe string[]",
      appPlatform: "optional safe string[]",
      metric: "optional safe label; default pv",
      type: "optional fixed enum deviceId"
    },
    validateParams: validateTrackAnalysisCheckDataReadyInput,
    buildRequest: buildTrackAnalysisCheckDataReadyRequest,
    summarizeLiveResponse: summarizeFixedShapeActionResponse("track_analysis_check_data_ready"),
    mockData: mockTrackAnalysisCheckDataReadyData
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
      registry_status: action.registryStatus || "service_registered",
      platform_enabled: domain.enabled !== false,
      default_runtime_routing: false,
      live_verified: false,
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
      ...request,
      path: normalizeRelativePath(request.path, `${action.name}.requestPath`),
      method: request.method || action.method,
      body: request.body || {},
      displayPath: request.displayPath
        ? normalizeRelativePath(request.displayPath, `${action.name}.displayPath`)
        : undefined
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
  const sourceRequest = typeof action.buildRequest === "function"
    ? action.buildRequest(safeInput)
    : { path: action.apiPath, method: action.method };
  const enrichedMeta = {
    ...meta,
    outputScope: outputScope(safeInput)
  };
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
    output_scope: enrichedMeta.outputScope,
    field_classification: fieldClassificationSummary(),
    sensitive_output: false,
    data,
    source_card: buildSourceCard({
      action,
      config,
      fetchMeta,
      mock: true,
      meta: {
        ...enrichedMeta,
        requestPath: sourceRequest.displayPath || sourceRequest.path,
        requestMethod: sourceRequest.method || action.method
      }
    }),
    source_quality: buildSourceQuality({ action, fetchMeta, mock: true, meta: enrichedMeta })
  };
}

export function buildLiveActionResponse(action, input, config, fetchResult, meta = {}) {
  validateActionInput(input);
  const safeInput = sanitizeInput(input);
  const enrichedMeta = {
    ...meta,
    outputScope: outputScope(safeInput)
  };
  const parsed = parseJson(fetchResult.bodyText);
  const httpErrorType = classifyHttpStatus(fetchResult.status);
  const parseErrorType = parsed.ok ? null : classifyUnparseableBody(fetchResult.bodyText);
  const responseFormat = parsed.ok ? "json" : "non_json_or_unparseable";
  const parseErrorDetailSanitized = parsed.ok ? null : parseErrorDetail(fetchResult, parseErrorType);
  const summaryMeta = {
    ...enrichedMeta,
    config,
    fetchResult,
    responseFormat,
    httpErrorType,
    parseErrorType,
    parseErrorDetailSanitized
  };
  const actionSummary = parsed.ok && typeof action.summarizeLiveResponse === "function"
    ? action.summarizeLiveResponse(parsed.value, safeInput, summaryMeta)
    : !parsed.ok && typeof action.summarizeParseFailureResponse === "function"
      ? action.summarizeParseFailureResponse(fetchResult.bodyText, safeInput, summaryMeta)
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
          format: responseFormat,
          shape: summarizeJsonShape(parsed.value),
          ...(actionSummary.summary || {})
        }
      : {
          format: responseFormat,
          shape: null,
          ...(actionSummary.summary || {})
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
    output_scope: enrichedMeta.outputScope,
    field_classification: fieldClassificationSummary(),
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
      meta: { ...enrichedMeta, sourceStatus, errorType }
    }),
    source_quality: buildSourceQuality({
      action,
      fetchMeta: fetchResult,
      mock: false,
      meta: { ...enrichedMeta, sourceStatus, errorType }
    })
  };
}

export function buildLiveActionFailureResponse(action, input, config, meta = {}) {
  validateActionInput(input);
  const safeInput = sanitizeInput(input);
  const enrichedMeta = {
    ...meta,
    outputScope: outputScope(safeInput)
  };
  const errorType = meta.errorType || "page_load_error";
  const sourceStatus = meta.sourceStatus || sourceStatusFromErrorType(errorType);
  const fetchMeta = {
    completed: false,
    ok: false,
    status: null,
    bodyTruncated: false,
    observedBytes: 0
  };
  const actionSummary = typeof action.summarizeFailureResponse === "function"
    ? action.summarizeFailureResponse(safeInput, {
        ...enrichedMeta,
        fetchResult: fetchMeta,
        responseFormat: "not_available",
        sourceStatus,
        errorType
      })
    : null;

  return {
    action: action.name,
    mode: "live",
    status: sourceStatus,
    source_status: sourceStatus,
    error_type: errorType,
    latency_ms: meta.latencyMs ?? null,
    origin_warmed: Boolean(meta.originWarmed),
    output_scope: enrichedMeta.outputScope,
    field_classification: fieldClassificationSummary(),
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
      response_summary: actionSummary?.summary
        ? {
            format: "not_available",
            shape: null,
            ...actionSummary.summary
          }
        : null
    },
    source_card: buildSourceCard({ action, config, fetchMeta, mock: false, meta: { ...enrichedMeta, sourceStatus, errorType } }),
    source_quality: buildSourceQuality({ action, fetchMeta, mock: false, meta: { ...enrichedMeta, sourceStatus, errorType } })
  };
}

export function buildActionParameterErrorResponse(action, config, meta = {}) {
  const errorType = meta.parameterError?.errorType || "parameter_error";
  const sourceStatus = meta.parameterError?.sourceStatus || "parameter_error";
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
    output_scope: meta.outputScope || DEFAULT_OUTPUT_SCOPE,
    field_classification: fieldClassificationSummary(),
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

export function buildActionDisabledByPlatformScopeResponse(action, config, meta = {}) {
  const errorType = "platform_not_enabled";
  const sourceStatus = "blocked";
  const fetchMeta = {
    completed: false,
    ok: false,
    status: null,
    bodyTruncated: false,
    observedBytes: 0
  };
  const enabledPlatforms = Array.isArray(config.enabledPlatforms) ? config.enabledPlatforms : [];

  return {
    action: action.name,
    mode: config.mode,
    status: sourceStatus,
    source_status: sourceStatus,
    error_type: errorType,
    failure_reason: "action_disabled_by_platform_scope",
    latency_ms: meta.latencyMs ?? null,
    origin_warmed: false,
    output_scope: meta.outputScope || DEFAULT_OUTPUT_SCOPE,
    field_classification: fieldClassificationSummary(),
    sensitive_output: false,
    data: {
      http_status: null,
      ok: false,
      body_truncated: false,
      observed_bytes: 0,
      response_summary: null,
      platform_scope: {
        action_platform: action.domainKey,
        enabled_platforms: enabledPlatforms,
        action_disabled_by_platform_scope: true
      }
    },
    source_card: buildSourceCard({
      action,
      config,
      fetchMeta,
      mock: false,
      meta: { ...meta, sourceStatus, errorType }
    }),
    source_quality: buildSourceQuality({
      action,
      fetchMeta,
      mock: false,
      meta: { ...meta, sourceStatus, errorType }
    })
  };
}

export function loginLogsFallbackReason(action, input, fetchResult) {
  if (action?.name !== "login_logs_search" || !usesDefaultLoginLogsWindow(input || {})) {
    return null;
  }
  if (classifyHttpStatus(fetchResult?.status)) {
    return null;
  }
  if (fetchResult?.bodyTruncated) {
    return "response_too_large";
  }
  const parsed = parseJson(fetchResult?.bodyText);
  if (!parsed.ok && classifyUnparseableBody(fetchResult?.bodyText) === "parse_error") {
    return "parse_error";
  }
  return null;
}

export function buildLoginLogsFallbackInput(input) {
  const safeInput = sanitizeInput(input);
  const window = loginLogsTimeWindow(safeInput);
  return {
    ...safeInput,
    from_timestamp: window.to - LOGIN_LOGS_FALLBACK_WINDOW_MS,
    to_timestamp: window.to
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
    error.publicMessage = "Action input may not include URLs, paths, headers, cookies, tokens, sessions, secrets, or raw bodies";
    throw error;
  }
}

export function getActionParameterError(action, input) {
  if (input && Object.hasOwn(input, "output_scope") && !OUTPUT_SCOPES.includes(input.output_scope)) {
    return {
      message: "output_scope must be internal_risk_review or external_share",
      required: ["output_scope=internal_risk_review|external_share"],
      errorType: "invalid_parameter"
    };
  }
  if (typeof action.validateParams !== "function") {
    return null;
  }
  return action.validateParams(input || {});
}

function validateArchivesUserAnalysisInput(input) {
  const userError = validateDecimalUserId("archives_user_analysis", input);
  if (userError) {
    return userError;
  }
  const windowError = validatePositiveTimeRange("archives_user_analysis", input, "beginTime", "endTime");
  if (windowError) {
    return windowError;
  }
  const pageError = validatePageControls("archives_user_analysis", input, ARCHIVES_MAX_PAGE_SIZE, 30);
  if (pageError) {
    return pageError;
  }
  return null;
}

function buildArchivesUserAnalysisRequest(input) {
  const pageIndex = positiveIntegerParam(input, "pageIndex", 1);
  const pageSize = positiveIntegerParam(input, "pageSize", 30);
  const body = {
    userId: input.user_id.trim(),
    beginTime: input.beginTime,
    endTime: input.endTime,
    pageIndex,
    pageSize,
    haveParamAuth: 1
  };
  for (const field of ARCHIVES_USER_ANALYSIS_FILTER_FIELDS) {
    body[field] = 1;
  }
  return {
    path: ARCHIVES_USER_ANALYSIS_PATH,
    displayPath: ARCHIVES_USER_ANALYSIS_PATH,
    method: "POST",
    body
  };
}

function validateArchivesUserProfileInput(input) {
  return validateDecimalUserId("archives_user_profile", input);
}

function buildArchivesUserProfileRequest(input) {
  const params = new URLSearchParams({ userId: input.user_id.trim() });
  const displayParams = new URLSearchParams({ userId: "[typed_user_id]" });
  return {
    path: `${ARCHIVES_USER_PROFILE_PATH}?${params.toString()}`,
    displayPath: `${ARCHIVES_USER_PROFILE_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateArchivesPhotoSearchInput(input) {
  const userError = validateDecimalUserId("archives_photo_search", input);
  if (userError) {
    return userError;
  }
  const windowError = validatePositiveTimeRange("archives_photo_search", input, "begin", "end");
  if (windowError) {
    return windowError;
  }
  const pageError = validatePageControls("archives_photo_search", input, 100, 20, "page", "count");
  if (pageError) {
    return pageError;
  }
  if (Object.hasOwn(input, "matchType") && !["0", "1", "2"].includes(String(input.matchType))) {
    return {
      message: "archives_photo_search matchType must be 0, 1, or 2",
      required: ["matchType=0|1|2"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "sort") && !["0", "1"].includes(String(input.sort))) {
    return {
      message: "archives_photo_search sort must be 0 or 1",
      required: ["sort=0|1"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildArchivesPhotoSearchRequest(input) {
  return {
    path: ARCHIVES_PHOTO_SEARCH_PATH,
    displayPath: ARCHIVES_PHOTO_SEARCH_PATH,
    method: "POST",
    body: {
      reportedIds: input.user_id.trim(),
      matchType: Object.hasOwn(input, "matchType") ? String(input.matchType) : "0",
      sort: Object.hasOwn(input, "sort") ? String(input.sort) : "0",
      begin: input.begin,
      end: input.end,
      page: positiveIntegerParam(input, "page", 1),
      count: positiveIntegerParam(input, "count", 20)
    }
  };
}

function validateArchivesRelatedUsersInput(input) {
  const userError = validateDecimalUserId("archives_related_users", input);
  if (userError) {
    return userError;
  }
  const relationType = archivesRelationType(input);
  if (!Object.hasOwn(ARCHIVES_RELATED_USER_TYPES, relationType)) {
    return {
      message: "archives_related_users relation_type must be same_device_registered or same_device_login",
      required: ["relation_type=same_device_registered|same_device_login"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildArchivesRelatedUsersRequest(input) {
  const relationType = archivesRelationType(input);
  return {
    path: ARCHIVES_RELATED_USERS_PATH,
    displayPath: ARCHIVES_RELATED_USERS_PATH,
    method: "POST",
    body: {
      keyword: input.user_id.trim(),
      inputType: 0,
      type: ARCHIVES_RELATED_USER_TYPES[relationType]
    }
  };
}

function validateRcpEventIdentityInput(input) {
  if (!safeCode(input.eventType)) {
    return {
      message: "rcp_event_detail requires a safe eventType",
      required: ["eventType"],
      errorType: "parameter_error"
    };
  }
  if (!safeCode(input.eventId)) {
    return {
      message: "rcp_event_detail requires a safe eventId",
      required: ["eventId"],
      errorType: "parameter_error"
    };
  }
  if (!validPositiveInteger(input.queryTime)) {
    return {
      message: "rcp_event_detail requires queryTime as a positive epoch millisecond integer",
      required: ["queryTime positive integer"],
      errorType: "parameter_error"
    };
  }
  return null;
}

function buildRcpEventDetailRequest(input) {
  const params = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: input.eventId.trim(),
    queryTime: String(input.queryTime)
  });
  const displayParams = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: "[typed_event_id]",
    queryTime: String(input.queryTime)
  });
  return {
    path: `${RCP_EVENT_DETAIL_PATH}?${params.toString()}`,
    displayPath: `${RCP_EVENT_DETAIL_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpEventFeatureListInput(input) {
  const eventError = validateRcpEventIdentityInput(input);
  if (eventError) {
    return {
      ...eventError,
      message: eventError.message.replace("rcp_event_detail", "rcp_event_feature_list")
    };
  }
  if (Object.hasOwn(input, "featureGroup") && input.featureGroup !== "") {
    return {
      message: "rcp_event_feature_list featureGroup must remain an empty string",
      required: ["featureGroup empty string"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildRcpEventFeatureListRequest(input) {
  const params = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: input.eventId.trim(),
    queryTime: String(input.queryTime),
    featureGroup: ""
  });
  const displayParams = new URLSearchParams({
    eventType: input.eventType.trim(),
    eventId: "[typed_event_id]",
    queryTime: String(input.queryTime),
    featureGroup: ""
  });
  return {
    path: `${RCP_EVENT_FEATURE_LIST_PATH}?${params.toString()}`,
    displayPath: `${RCP_EVENT_FEATURE_LIST_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function validateRcpPolicyTreeLookupInput(input) {
  if (!safeCode(input.policyTreeCode)) {
    return {
      message: "rcp_policy_tree_lookup requires a safe policyTreeCode",
      required: ["policyTreeCode"],
      errorType: "parameter_error"
    };
  }
  if (!validPositiveInteger(input.policyTreeVersion)) {
    return {
      message: "rcp_policy_tree_lookup requires policyTreeVersion as a positive integer",
      required: ["policyTreeVersion positive integer"],
      errorType: "parameter_error"
    };
  }
  if (Object.hasOwn(input, "targetPolicyCode") && input.targetPolicyCode !== null && input.targetPolicyCode !== undefined && !safeCode(input.targetPolicyCode)) {
    return {
      message: "rcp_policy_tree_lookup targetPolicyCode must be a safe policy code when provided",
      required: ["targetPolicyCode safe code"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildRcpPolicyTreeLookupRequest(input) {
  const params = new URLSearchParams({
    policyTreeCode: input.policyTreeCode.trim(),
    treeSnapshot: String(input.policyTreeVersion),
    _t: String(Date.now())
  });
  return {
    path: `${RCP_POLICY_TREE_LOOKUP_PATH}?${params.toString()}`,
    displayPath: `${RCP_POLICY_TREE_LOOKUP_PATH}?${params.toString()}`,
    method: "GET",
    body: {},
    companionPaths: [
      RCP_POLICY_TREE_LIST_PATH,
      RCP_POLICY_TREE_BINDING_BY_NODE_PATH,
      RCP_POLICY_TREE_ALL_POLICY_CODE_PATH
    ],
    targetPolicyCode: isNonEmptyString(input.targetPolicyCode) ? input.targetPolicyCode.trim() : null
  };
}

function validateTrackAnalysisCheckDataReadyInput(input) {
  if (!isNonEmptyString(input.device_id)) {
    return {
      message: "track_analysis_check_data_ready requires device_id",
      required: ["device_id"],
      errorType: "parameter_error"
    };
  }
  if (!TRACK_ANALYSIS_APP_NAMES.includes(input.appName)) {
    return {
      message: "track_analysis_check_data_ready appName must be KUAISHOU or NEBULA",
      required: ["appName=KUAISHOU|NEBULA"],
      errorType: "parameter_error"
    };
  }
  if (Object.hasOwn(input, "product") && !TRACK_ANALYSIS_APP_NAMES.includes(input.product)) {
    return {
      message: "track_analysis_check_data_ready product must be KUAISHOU or NEBULA",
      required: ["product=KUAISHOU|NEBULA"],
      errorType: "invalid_parameter"
    };
  }
  const windowError = validatePositiveTimeRange("track_analysis_check_data_ready", input, "startTime", "endTime");
  if (windowError) {
    return windowError;
  }
  if (Object.hasOwn(input, "include") && ![0, 1].includes(input.include)) {
    return {
      message: "track_analysis_check_data_ready include must be 0 or 1",
      required: ["include=0|1"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "pageSize") && (!validPositiveInteger(input.pageSize) || input.pageSize > 1000)) {
    return {
      message: "track_analysis_check_data_ready pageSize must be a positive integer <= 1000",
      required: ["pageSize positive integer <= 1000"],
      errorType: "invalid_parameter"
    };
  }
  for (const key of ["category", "event", "appPlatform"]) {
    if (Object.hasOwn(input, key) && !validSafeLabelList(input[key])) {
      return {
        message: `track_analysis_check_data_ready ${key} must be a safe string array`,
        required: [`${key} safe string[]`],
        errorType: "invalid_parameter"
      };
    }
  }
  if (Object.hasOwn(input, "metric") && !safeLabel(input.metric)) {
    return {
      message: "track_analysis_check_data_ready metric must be a safe label",
      required: ["metric safe label"],
      errorType: "invalid_parameter"
    };
  }
  if (Object.hasOwn(input, "type") && input.type !== "deviceId") {
    return {
      message: "track_analysis_check_data_ready type must remain deviceId",
      required: ["type=deviceId"],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function buildTrackAnalysisCheckDataReadyRequest(input) {
  return {
    path: TRACK_ANALYSIS_CHECK_DATA_READY_PATH,
    displayPath: TRACK_ANALYSIS_CHECK_DATA_READY_PATH,
    method: "POST",
    body: {
      appName: input.appName,
      startTime: input.startTime,
      endTime: input.endTime,
      include: Object.hasOwn(input, "include") ? input.include : 1,
      pageSize: positiveIntegerParam(input, "pageSize", 100),
      deviceId: input.device_id.trim(),
      batchQueryId: `browser_backed_${Date.now()}`,
      appPlatform: safeLabelList(input.appPlatform, []),
      category: safeLabelList(input.category, ["active"]),
      event: safeLabelList(input.event, []),
      metric: isNonEmptyString(input.metric) ? input.metric.trim() : "pv",
      product: isNonEmptyString(input.product) ? input.product.trim() : TRACK_ANALYSIS_DEFAULT_PRODUCT,
      type: "deviceId",
      funcType: TRACK_ANALYSIS_FUNC_TYPE,
      _t: String(Date.now())
    }
  };
}

function validateDecimalUserId(actionName, input) {
  if (!isNonEmptyString(input.user_id) || !/^\d+$/.test(input.user_id.trim())) {
    return {
      message: `${actionName} requires user_id as a decimal string`,
      required: ["user_id decimal string"],
      errorType: "parameter_error"
    };
  }
  return null;
}

function validatePositiveTimeRange(actionName, input, startKey, endKey) {
  if (!validPositiveInteger(input[startKey]) || !validPositiveInteger(input[endKey])) {
    return {
      message: `${actionName} requires ${startKey} and ${endKey} as positive epoch millisecond integers`,
      required: [`${startKey}/${endKey} positive integer`],
      errorType: "parameter_error"
    };
  }
  if (input[startKey] >= input[endKey]) {
    return {
      message: `${actionName} requires ${endKey} > ${startKey}`,
      required: [`${endKey} > ${startKey}`],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function validatePageControls(actionName, input, maxSize, defaultSize, pageKey = "pageIndex", sizeKey = "pageSize") {
  if (Object.hasOwn(input, pageKey) && !validPositiveInteger(input[pageKey])) {
    return {
      message: `${actionName} ${pageKey} must be a positive integer`,
      required: [`${pageKey} positive integer`],
      errorType: "invalid_parameter"
    };
  }
  const pageSize = Object.hasOwn(input, sizeKey) ? input[sizeKey] : defaultSize;
  if (!validPositiveInteger(pageSize) || pageSize > maxSize) {
    return {
      message: `${actionName} ${sizeKey} must be a positive integer <= ${maxSize}`,
      required: [`${sizeKey} positive integer <= ${maxSize}`],
      errorType: "invalid_parameter"
    };
  }
  return null;
}

function positiveIntegerParam(input, key, defaultValue) {
  return Object.hasOwn(input, key) ? Math.trunc(input[key]) : defaultValue;
}

function archivesRelationType(input) {
  return isNonEmptyString(input.relation_type) ? input.relation_type.trim() : "same_device_registered";
}

function safeCode(value) {
  return isNonEmptyString(value) && SAFE_CODE_PATTERN.test(value.trim());
}

function safeLabel(value) {
  return isNonEmptyString(value) && /^[A-Za-z0-9_.:-]{1,128}$/.test(value.trim());
}

function validSafeLabelList(value) {
  return Array.isArray(value) && value.length <= 50 && value.every(safeLabel);
}

function safeLabelList(value, defaultValue) {
  if (!Array.isArray(value)) {
    return defaultValue;
  }
  return value.filter(safeLabel).map((item) => item.trim()).slice(0, 50);
}

function outputScope(input) {
  return OUTPUT_SCOPES.includes(input?.output_scope) ? input.output_scope : DEFAULT_OUTPUT_SCOPE;
}

function fieldClassificationSummary() {
  return {
    credential_secret: [...FIELD_CLASSIFICATION.credential_secret],
    pii_strict: [...FIELD_CLASSIFICATION.pii_strict],
    risk_entity_identifier: [...FIELD_CLASSIFICATION.risk_entity_identifier],
    source_summary_metric: [...FIELD_CLASSIFICATION.source_summary_metric]
  };
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
  if (!OUTPUT_SCOPES.includes(safe.output_scope)) {
    delete safe.output_scope;
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

function parseErrorDetail(fetchResult, parseErrorType) {
  if (fetchResult?.bodyTruncated) {
    return "response_body_truncated_at_max_live_body_bytes";
  }
  if (parseErrorType === "auth_failed") {
    return "html_auth_or_login_response";
  }
  return "invalid_or_unparseable_json";
}

function validateWeaponInventoryInput(input) {
  const hasUserId = isNonEmptyString(input.user_id);
  const hasDeviceId = isNonEmptyString(input.device_id);
  if (hasUserId === hasDeviceId) {
    return {
      message: "weapon_inventory requires exactly one of user_id or device_id",
      required: ["user_id xor device_id"],
      errorType: "parameter_error"
    };
  }

  if (Object.hasOwn(input, "product") && input.product !== WEAPON_DEFAULT_PRODUCT) {
    return {
      message: "weapon_inventory product must be KUAISHOU",
      required: ["product=KUAISHOU"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "productName") && input.productName !== WEAPON_DEFAULT_PRODUCT_NAME) {
    return {
      message: "weapon_inventory productName must be KUAISHOU",
      required: ["productName=KUAISHOU"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "searchLevel") && !validPositiveInteger(input.searchLevel)) {
    return {
      message: "weapon_inventory searchLevel must be a positive integer",
      required: ["searchLevel positive integer"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "include_risk_data") && typeof input.include_risk_data !== "boolean") {
    return {
      message: "weapon_inventory include_risk_data must be boolean",
      required: ["include_risk_data boolean"],
      errorType: "invalid_parameter"
    };
  }

  if (
    Object.hasOwn(input, "max_device_ids") &&
    (!validPositiveInteger(input.max_device_ids) || input.max_device_ids > WEAPON_MAX_DEVICE_IDS)
  ) {
    return {
      message: `weapon_inventory max_device_ids must be a positive integer <= ${WEAPON_MAX_DEVICE_IDS}`,
      required: [`max_device_ids positive integer <= ${WEAPON_MAX_DEVICE_IDS}`],
      errorType: "invalid_parameter"
    };
  }

  return null;
}

function buildWeaponInventoryRequest(input) {
  const scope = weaponEntityScope(input);
  const product = weaponProduct(input);
  const productName = weaponProductName(input);
  const searchLevel = weaponSearchLevel(input);
  const params = new URLSearchParams({
    product,
    productName,
    groupValue: scope.value,
    groupKey: scope.groupKey,
    dimKey: scope.dimKey,
    searchLevel: String(searchLevel)
  });
  const displayParams = new URLSearchParams({
    product,
    productName,
    groupValue: `[typed_${scope.entityType}]`,
    groupKey: scope.groupKey,
    dimKey: scope.dimKey,
    searchLevel: String(searchLevel)
  });

  return {
    path: `${WEAPON_GRAPH_DATA_PATH}?${params.toString()}`,
    displayPath: `${WEAPON_GRAPH_DATA_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {},
    followUp: {
      type: "weapon_graph_risk",
      riskDataPath: WEAPON_RISK_DATA_PATH,
      product,
      includeRiskData: weaponIncludeRiskData(input),
      maxDeviceIds: weaponMaxDeviceIds(input)
    }
  };
}

function summarizeWeaponInventoryResponse(value, input) {
  const graphValue = value && typeof value === "object" && Object.hasOwn(value, "graphData") ? value.graphData : value;
  const graphErrorType = classifyWeaponGraphError(graphValue);
  if (graphErrorType) {
    return {
      sourceStatus: "blocked",
      errorType: graphErrorType,
      summary: {
        weapon_inventory: {
          ...buildWeaponGraphSummary(graphValue, input),
          riskData_status: "not_executed_graph_failed",
          risk_item_count: 0,
          risk_label_summary: emptyRiskLabelSummary(),
          risk_label_count: 0,
          risk_group_names_observed: [],
          readable_label_sample: [],
          originalLog_key_summary: emptyOriginalLogKeySummary(),
          userLevel_observed: [],
          no_data_not_risk_exclusion: true
        }
      }
    };
  }

  const graphSummary = buildWeaponGraphSummary(graphValue, input);
  const riskSummary = buildWeaponRiskSummary(value, graphSummary, input);
  const graphNoData = graphSummary.pointInfoMap_count === 0 && graphSummary.relationEdgeList_count === 0;
  const riskPartial = riskSummary.riskData_status === "risk_partial_failed";

  return {
    sourceStatus: graphNoData ? "completed_no_data" : "completed",
    errorType: riskPartial ? "risk_partial_failed" : null,
    summary: {
      weapon_inventory: {
        ...graphSummary,
        ...riskSummary,
        no_data_not_risk_exclusion: true
      }
    }
  };
}

function buildWeaponGraphSummary(value, input = {}) {
  const payload = weaponPayload(value);
  const pointInfoMap = payload && isPlainObject(payload.pointInfoMap) ? payload.pointInfoMap : null;
  const relationEdgeList = Array.isArray(payload?.relationEdgeList) ? payload.relationEdgeList : [];
  const deviceIds = collectWeaponDeviceIds(pointInfoMap);
  const userIds = collectWeaponUserIds(pointInfoMap);
  const graphNoData = Object.keys(pointInfoMap || {}).length === 0 && relationEdgeList.length === 0;

  return {
    graph_status: graphNoData ? "completed_no_data" : "completed",
    graph_api_code: readApiCode(value),
    graph_api_msg: sanitizeSummaryText(readApiMessage(value)),
    pointInfoMap_present: Boolean(pointInfoMap),
    pointInfoMap_count: Object.keys(pointInfoMap || {}).length,
    relationEdgeList_present: Array.isArray(payload?.relationEdgeList),
    relationEdgeList_count: relationEdgeList.length,
    related_device_count: deviceIds.length,
    related_user_count: userIds.length,
    related_device_id_sample: deviceIds.length > 0 ? displayRiskEntity("deviceId", deviceIds[0], input) : null,
    related_user_id_sample: userIds.length > 0 ? displayRiskEntity("user_id", userIds[0], input) : null,
    masked_device_id_sample: deviceIds.length > 0 ? maskDeviceId(deviceIds[0]) : null,
    raw_device_ids_for_internal_chaining_count: deviceIds.length,
    graph_no_data: graphNoData,
    no_data: graphNoData,
    no_data_not_risk_exclusion: true
  };
}

function buildWeaponRiskSummary(value, graphSummary, input) {
  const chain = value && typeof value === "object" ? value.weapon_chain || {} : {};
  const riskResults = weaponRiskResults(value);
  if (weaponIncludeRiskData(input) === false) {
    return emptyRiskSummary("not_requested");
  }
  if (graphSummary.raw_device_ids_for_internal_chaining_count === 0) {
    return emptyRiskSummary("not_executed_missing_device_id");
  }
  if (riskResults.length === 0) {
    return emptyRiskSummary(chain.riskData_status || "not_executed_missing_device_id");
  }

  const riskItems = [];
  let riskFailure = false;
  for (const result of riskResults) {
    if (!result || result.ok === false || result.parse_error || result.error_type || result.status >= 400) {
      riskFailure = true;
      continue;
    }
    if (classifyWeaponRiskError(result.body)) {
      riskFailure = true;
      continue;
    }
    riskItems.push(...extractWeaponRiskItems(result.body));
  }

  const labelSummary = buildRiskLabelSummary(riskItems);
  const originalLogSummary = buildOriginalLogKeySummary(riskItems);
  const originalLogEventId = firstOriginalLogField(riskItems, "eventId");
  return {
    riskData_status: riskFailure ? "risk_partial_failed" : riskItems.length > 0 ? "completed" : "no_data",
    risk_item_count: riskItems.length,
    risk_label_summary: labelSummary.summary,
    risk_label_count: labelSummary.count,
    risk_group_names_observed: labelSummary.groupNames,
    readable_label_sample: labelSummary.readableSample,
    originalLog_key_summary: originalLogSummary,
    originalLog_eventId_sample: originalLogEventId ? displayRiskEntity("eventId", originalLogEventId, input) : null,
    userLevel_observed: userLevelsObserved(riskItems),
    no_data_not_risk_exclusion: true
  };
}

function firstOriginalLogField(items, fieldName) {
  for (const item of items) {
    const log = item && typeof item === "object" && !Array.isArray(item) ? item.originalLog : null;
    if (log && typeof log === "object" && !Array.isArray(log) && log[fieldName] !== undefined && log[fieldName] !== null) {
      return String(log[fieldName]);
    }
  }
  return null;
}

function weaponEntityScope(input) {
  if (isNonEmptyString(input.device_id)) {
    return {
      entityType: "device_id",
      value: input.device_id.trim(),
      groupKey: "DEVICE_ID",
      dimKey: "USER_ID"
    };
  }
  return {
    entityType: "user_id",
    value: input.user_id.trim(),
    groupKey: "USER_ID",
    dimKey: "DEVICE_ID"
  };
}

function weaponProduct(input) {
  return isNonEmptyString(input.product) ? input.product.trim() : WEAPON_DEFAULT_PRODUCT;
}

function weaponProductName(input) {
  return isNonEmptyString(input.productName) ? input.productName.trim() : WEAPON_DEFAULT_PRODUCT_NAME;
}

function weaponSearchLevel(input) {
  return Object.hasOwn(input, "searchLevel") ? Math.trunc(input.searchLevel) : WEAPON_DEFAULT_SEARCH_LEVEL;
}

function weaponIncludeRiskData(input) {
  return Object.hasOwn(input, "include_risk_data") ? input.include_risk_data : WEAPON_DEFAULT_INCLUDE_RISK_DATA;
}

function weaponMaxDeviceIds(input) {
  return Object.hasOwn(input, "max_device_ids") ? Math.trunc(input.max_device_ids) : WEAPON_DEFAULT_MAX_DEVICE_IDS;
}

function classifyWeaponGraphError(value) {
  if (!value || typeof value !== "object") {
    return "parse_error";
  }
  const apiCode = readApiCode(value);
  if (apiCode !== null && ![0, 1, 200].includes(apiCode)) {
    return "platform_error";
  }
  if (value.success === false || value.result === false) {
    return "platform_error";
  }
  return null;
}

function classifyWeaponRiskError(value) {
  if (!value || typeof value !== "object") {
    return "parse_error";
  }
  const apiCode = readApiCode(value);
  if (apiCode !== null && ![0, 1, 200].includes(apiCode)) {
    return "platform_error";
  }
  if (value.success === false || value.result === false) {
    return "platform_error";
  }
  return null;
}

function weaponPayload(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (isPlainObject(value.data)) {
    return value.data;
  }
  return value;
}

function weaponRiskResults(value) {
  if (!value || typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value.riskDataResults)) {
    return value.riskDataResults;
  }
  if (Object.hasOwn(value, "riskData")) {
    return [
      {
        ok: true,
        status: 200,
        body: value.riskData
      }
    ];
  }
  return [];
}

function collectWeaponDeviceIds(pointInfoMap) {
  if (!isPlainObject(pointInfoMap)) {
    return [];
  }
  const values = [];
  for (const [key, node] of Object.entries(pointInfoMap)) {
    if (isWeaponDeviceId(key)) {
      values.push(key);
    }
    collectWeaponStrings(node, values, 0);
  }
  return [...new Set(values.filter(isWeaponDeviceId))];
}

function collectWeaponUserIds(pointInfoMap) {
  if (!isPlainObject(pointInfoMap)) {
    return [];
  }
  const values = [];
  for (const [key, node] of Object.entries(pointInfoMap)) {
    if (isProbableUserId(key)) {
      values.push(key);
    }
    const strings = [];
    collectWeaponStrings(node, strings, 0);
    values.push(...strings.filter(isProbableUserId));
  }
  return [...new Set(values)];
}

function collectWeaponStrings(value, output, depth) {
  if (depth > 4 || value === null || value === undefined) {
    return;
  }
  if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) {
      collectWeaponStrings(item, output, depth + 1);
    }
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value).slice(0, 100)) {
      output.push(String(key));
      collectWeaponStrings(child, output, depth + 1);
    }
  }
}

function isWeaponDeviceId(value) {
  return /^(ANDROID|IOS)_[A-Za-z0-9_.:-]+$/.test(String(value || ""));
}

function isProbableUserId(value) {
  return /^\d{5,}$/.test(String(value || ""));
}

function extractWeaponRiskItems(value) {
  const data = value && typeof value === "object" ? value.data : null;
  if (Array.isArray(data)) {
    return data.filter(isPlainObject);
  }
  if (isPlainObject(data)) {
    for (const key of ["list", "rows", "records", "items", "data"]) {
      if (Array.isArray(data[key])) {
        return data[key].filter(isPlainObject);
      }
    }
    return [data];
  }
  if (Array.isArray(value)) {
    return value.filter(isPlainObject);
  }
  return [];
}

function buildRiskLabelSummary(items) {
  const labelInfoValues = items
    .map((item) => item.labelInfo)
    .filter((item) => item !== null && item !== undefined);
  const groupNames = [];
  const readableSample = [];
  let count = 0;

  for (const labelInfo of labelInfoValues) {
    const result = scanLabelInfo(labelInfo, 0);
    count += result.count;
    groupNames.push(...result.groupNames);
    readableSample.push(...result.readableSample);
  }

  const uniqueGroupNames = uniqueSanitized(groupNames).slice(0, 20);
  const uniqueReadableSample = uniqueSanitized(readableSample).slice(0, 5);
  return {
    count,
    groupNames: uniqueGroupNames,
    readableSample: uniqueReadableSample,
    summary: {
      labelInfo_present: labelInfoValues.length > 0,
      labelInfo_items_observed: count,
      group_names_count: uniqueGroupNames.length,
      readable_label_sample_count: uniqueReadableSample.length
    }
  };
}

function scanLabelInfo(value, depth) {
  if (depth > 5 || value === null || value === undefined) {
    return { count: 0, groupNames: [], readableSample: [] };
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return {
      count: 1,
      groupNames: [],
      readableSample: []
    };
  }
  if (Array.isArray(value)) {
    return mergeLabelScans(value.slice(0, 100).map((item) => scanLabelInfo(item, depth + 1)));
  }
  if (!isPlainObject(value)) {
    return { count: 0, groupNames: [], readableSample: [] };
  }

  const groupNames = [];
  const readableSample = [];
  let count = 1;
  for (const [key, child] of Object.entries(value).slice(0, 100)) {
    const isGroupKey = /(group|groupName|category|分类|分组)/i.test(key);
    if (isGroupKey) {
      if (typeof child === "string" || typeof child === "number") {
        groupNames.push(sanitizeSummaryText(child));
      } else {
        groupNames.push(sanitizeSummaryText(key));
      }
    }
    if (!isGroupKey && /(label|labelName|name|title|tag|risk|desc|名称|标签)/i.test(key) && ["string", "number"].includes(typeof child)) {
      readableSample.push(sanitizeSummaryText(child));
    }
    const childScan = scanLabelInfo(child, depth + 1);
    count += childScan.count;
    groupNames.push(...childScan.groupNames);
    readableSample.push(...childScan.readableSample);
  }
  return { count, groupNames, readableSample };
}

function mergeLabelScans(scans) {
  return scans.reduce(
    (merged, scan) => ({
      count: merged.count + scan.count,
      groupNames: [...merged.groupNames, ...scan.groupNames],
      readableSample: [...merged.readableSample, ...scan.readableSample]
    }),
    { count: 0, groupNames: [], readableSample: [] }
  );
}

function buildOriginalLogKeySummary(items) {
  const logs = items.map((item) => item.originalLog).filter(isPlainObject);
  const topLevelKeys = [];
  let nestedKeyCount = 0;
  for (const log of logs) {
    const keys = observedKeys(log);
    topLevelKeys.push(...keys);
    nestedKeyCount += countNestedKeys(log, 1);
  }
  return {
    originalLog_present: logs.length > 0,
    originalLog_items_observed: logs.length,
    top_level_keys_observed: [...new Set(topLevelKeys)].slice(0, 50),
    nested_key_count: nestedKeyCount
  };
}

function countNestedKeys(value, depth) {
  if (depth > 5 || !value || typeof value !== "object") {
    return 0;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).reduce((sum, item) => sum + countNestedKeys(item, depth + 1), 0);
  }
  let count = 0;
  for (const child of Object.values(value).slice(0, 100)) {
    if (child && typeof child === "object") {
      count += Object.keys(child).length;
      count += countNestedKeys(child, depth + 1);
    }
  }
  return count;
}

function userLevelsObserved(items) {
  return uniqueSanitized(
    items
      .map((item) => item.userLevel)
      .filter((item) => item !== null && item !== undefined)
  ).slice(0, 20);
}

function emptyRiskSummary(status) {
  return {
    riskData_status: status,
    risk_item_count: 0,
    risk_label_summary: emptyRiskLabelSummary(),
    risk_label_count: 0,
    risk_group_names_observed: [],
    readable_label_sample: [],
    originalLog_key_summary: emptyOriginalLogKeySummary(),
    userLevel_observed: [],
    no_data_not_risk_exclusion: true
  };
}

function emptyRiskLabelSummary() {
  return {
    labelInfo_present: false,
    labelInfo_items_observed: 0,
    group_names_count: 0,
    readable_label_sample_count: 0
  };
}

function emptyOriginalLogKeySummary() {
  return {
    originalLog_present: false,
    originalLog_items_observed: 0,
    top_level_keys_observed: [],
    nested_key_count: 0
  };
}

function uniqueSanitized(values) {
  return [...new Set(values.map(sanitizeSummaryText).filter(Boolean))];
}

function sanitizeSummaryText(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value)
    .replace(/(authorization|cookie|token|secret|session|password|credential|csrf|jwt|header)\s*[:=]\s*\S+/gi, "$1=[credential_present_redacted]")
    .replace(/\bhttps?:\/\/\S+/gi, "[redacted_url]")
    .replace(/\b\d{17}[\dXx]\b/g, "[id_card_present]")
    .replace(/\b(?:ANDROID|IOS)_[A-Za-z0-9_.:-]+/g, "[masked_device_id]")
    .slice(0, 160);
}

function displayRiskEntity(fieldName, value, input) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (outputScope(input) === "external_share") {
    return maskRiskEntity(fieldName, text);
  }
  return text.slice(0, 160);
}

function displayPiiStrict(fieldName, value, input) {
  const text = firstStringLike(value);
  if (!text) {
    return null;
  }
  if (isPhoneField(fieldName) && isPhoneNumber(text)) {
    return maskPhoneNumber(text, outputScope(input));
  }
  if (isIdCardField(fieldName) && looksLikeIdCard(text)) {
    return {
      id_card_present: true,
      birth_year_present: outputScope(input) === "internal_risk_review" ? idCardBirthYear(text) !== null : undefined
    };
  }
  if (isNameField(fieldName)) {
    return { name_present: true };
  }
  return null;
}

function maskRiskEntity(fieldName, value) {
  const text = String(value);
  if (isIpField(fieldName) || looksLikeIp(text)) {
    return maskIp(text);
  }
  if (isDeviceField(fieldName) || /^(ANDROID|IOS)_/.test(text)) {
    return maskDeviceId(text);
  }
  if (isUserIdField(fieldName)) {
    return `[masked_user_id:length=${text.length}]`;
  }
  return `[masked_identifier:length=${text.length}]`;
}

function maskPhoneNumber(value, scope) {
  const digits = String(value).replace(/\D/g, "");
  if (!isPhoneNumber(digits)) {
    return null;
  }
  return scope === "external_share" ? `${digits.slice(0, 3)}********` : `${digits.slice(0, 7)}****`;
}

function isPhoneNumber(value) {
  return /^1\d{10}$/.test(String(value).replace(/\D/g, ""));
}

function looksLikeIdCard(value) {
  return /^\d{17}[\dXx]$/.test(String(value));
}

function idCardBirthYear(value) {
  const match = String(value).match(/^\d{6}(\d{4})\d{7}[\dXx]$/);
  return match ? match[1] : null;
}

function isPhoneField(fieldName) {
  return /(phone|mobile|手机号|手机|电话号码|phone_number)/i.test(String(fieldName));
}

function isIdCardField(fieldName) {
  return /(id.?card|identity|身份证|证件号|idNo)/i.test(String(fieldName));
}

function isNameField(fieldName) {
  return /(^name$|real.?name|姓名|真实姓名)/i.test(String(fieldName));
}

function isIpField(fieldName) {
  return /(^ip$|ipAddr|ip_address|clientIp|remoteIp|loginIp|登录ip|ip)/i.test(String(fieldName));
}

function isDeviceField(fieldName) {
  return /(deviceId|device_id|did|deviceDid|设备)/i.test(String(fieldName));
}

function isUserIdField(fieldName) {
  return /(^user_id$|^userId$|^uid$|userIds|用户id)/i.test(String(fieldName));
}

function looksLikeIp(value) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(String(value)) || String(value).includes(":");
}

function readApiMessage(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  for (const key of ["message", "msg", "error", "errorMsg", "error_message"]) {
    if (typeof value[key] === "string") {
      return value[key];
    }
  }
  return null;
}

function validateLoginLogsInput(input) {
  if (!isNonEmptyString(input.user_id)) {
    return {
      message: "login_logs_search requires user_id",
      required: ["user_id"],
      errorType: "parameter_error"
    };
  }

  const windowValidation = validateLoginLogsWindow(input);
  if (windowValidation) {
    return windowValidation;
  }

  if (Object.hasOwn(input, "recallSource") && !validRecallSource(input.recallSource)) {
    return {
      message: "login_logs_search recallSource must be comma-separated digits",
      required: ["recallSource comma-separated digits"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "limit") && (!validPositiveInteger(input.limit) || input.limit > LOGIN_LOGS_MAX_LIMIT)) {
    return {
      message: `login_logs_search limit must be a positive integer <= ${LOGIN_LOGS_MAX_LIMIT}`,
      required: [`limit positive integer <= ${LOGIN_LOGS_MAX_LIMIT}`],
      errorType: "invalid_parameter"
    };
  }

  return null;
}

function validateLoginLogsWindow(input) {
  const window = loginLogsTimeWindow(input);
  if (!Number.isSafeInteger(window.from) || !Number.isSafeInteger(window.to)) {
    return {
      message: "login_logs_search timestamps must be epoch milliseconds",
      required: ["from_timestamp/to_timestamp epoch ms"],
      errorType: "invalid_parameter"
    };
  }
  if (window.from <= 0 || window.to <= 0 || window.to <= window.from) {
    return {
      message: "login_logs_search requires to_timestamp > from_timestamp",
      required: ["to_timestamp > from_timestamp"],
      errorType: "invalid_parameter"
    };
  }
  if (window.to - window.from > LOGIN_LOGS_MAX_WINDOW_MS) {
    return {
      message: "login_logs_search time window must not exceed 7 days",
      required: ["time window <= 7 days"],
      errorType: "query_window_too_large",
      sourceStatus: "parameter_error"
    };
  }
  return null;
}

function buildLoginLogsRequest(input) {
  const window = loginLogsTimeWindow(input);
  const recallSource = loginLogsRecallSource(input);
  const params = new URLSearchParams({
    userId: input.user_id.trim(),
    from_timestamp: String(window.from),
    to_timestamp: String(window.to),
    recallSource
  });
  const displayParams = new URLSearchParams({
    userId: "[typed_user_id]",
    from_timestamp: String(window.from),
    to_timestamp: String(window.to),
    recallSource
  });

  return {
    path: `${LOGIN_LOGS_SEARCH_PATH}?${params.toString()}`,
    displayPath: `${LOGIN_LOGS_SEARCH_PATH}?${displayParams.toString()}`,
    method: "GET",
    body: {}
  };
}

function summarizeLoginLogsResponse(value, input, meta = {}) {
  const diagnosticsBase = buildLoginLogsDiagnostics({
    value,
    input,
    fetchResult: meta.fetchResult,
    responseFormat: meta.responseFormat || "json",
    parseErrorDetailSanitized: null
  });
  const diagnostics = withLoginLogsFallbackDiagnostics(diagnosticsBase, meta);
  const apiCode = readApiCode(value);
  if (apiCode !== null && ![0, 1, 200].includes(apiCode)) {
    return {
      sourceStatus: "blocked",
      errorType: "platform_error",
      summary: {
        login_logs: {
          source_status: "blocked",
          api_code: apiCode,
          records_count: 0,
          no_data: false,
          no_data_not_risk_exclusion: true,
          diagnostics
        }
      }
    };
  }

  const detectedRecords = detectLoginLogRecords(value);
  const records = detectedRecords.records.slice(0, loginLogsLimit(input));
  const noData = records.length === 0;
  const summary = buildLoginLogsSummary(records, input, noData, diagnostics);
  return {
    sourceStatus: noData ? "no_data" : "completed",
    errorType: null,
    summary: {
      login_logs: summary
    }
  };
}

function summarizeLoginLogsParseFailureResponse(_bodyText, input, meta = {}) {
  const errorType = meta.httpErrorType || meta.parseErrorType || "parse_error";
  const sourceStatus = sourceStatusFromErrorType(errorType);
  const diagnosticsBase = buildLoginLogsDiagnostics({
    value: null,
    input,
    fetchResult: meta.fetchResult,
    responseFormat: meta.responseFormat || "non_json_or_unparseable",
    parseErrorDetailSanitized: meta.parseErrorDetailSanitized || "invalid_or_unparseable_json"
  });
  return {
    sourceStatus,
    errorType,
    summary: {
      login_logs: {
        source_status: sourceStatus,
        records_count: 0,
        no_data: false,
        no_data_not_risk_exclusion: true,
        diagnostics: withLoginLogsFallbackDiagnostics(diagnosticsBase, meta)
      }
    }
  };
}

function summarizeLoginLogsFailureResponse(input, meta = {}) {
  const diagnosticsBase = buildLoginLogsDiagnostics({
    value: null,
    input,
    fetchResult: meta.fetchResult,
    responseFormat: meta.responseFormat || "not_available",
    parseErrorDetailSanitized: null
  });
  return {
    summary: {
      login_logs: {
        source_status: meta.sourceStatus || sourceStatusFromErrorType(meta.errorType || "page_load_error"),
        records_count: 0,
        no_data: false,
        no_data_not_risk_exclusion: true,
        diagnostics: withLoginLogsFallbackDiagnostics(diagnosticsBase, meta)
      }
    }
  };
}

function loginLogsTimeWindow(input) {
  const rawWindow = input.time_window && typeof input.time_window === "object" && !Array.isArray(input.time_window)
    ? input.time_window
    : {};
  const from = firstNumberValue(input.from_timestamp, rawWindow.from_timestamp, rawWindow.from, rawWindow.startTime);
  const to = firstNumberValue(input.to_timestamp, rawWindow.to_timestamp, rawWindow.to, rawWindow.endTime);
  if (from !== null || to !== null) {
    return {
      from: from ?? NaN,
      to: to ?? NaN
    };
  }

  const now = Date.now();
  return {
    from: now - LOGIN_LOGS_DEFAULT_WINDOW_MS,
    to: now
  };
}

function firstNumberValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const number = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(number)) {
      return Math.trunc(number);
    }
    return NaN;
  }
  return null;
}

function loginLogsRecallSource(input) {
  return isNonEmptyString(input.recallSource) ? input.recallSource.trim() : LOGIN_LOGS_DEFAULT_RECALL_SOURCE;
}

function loginLogsLimit(input) {
  return Object.hasOwn(input, "limit") ? Math.trunc(input.limit) : LOGIN_LOGS_DEFAULT_LIMIT;
}

function usesDefaultLoginLogsWindow(input) {
  if (Object.hasOwn(input, "from_timestamp") || Object.hasOwn(input, "to_timestamp")) {
    return false;
  }
  const rawWindow = input.time_window && typeof input.time_window === "object" && !Array.isArray(input.time_window)
    ? input.time_window
    : null;
  if (!rawWindow) {
    return true;
  }
  return !["from_timestamp", "to_timestamp", "from", "to", "startTime", "endTime"].some((key) => Object.hasOwn(rawWindow, key));
}

function validRecallSource(value) {
  return typeof value === "string" && /^\d+(,\d+)*$/.test(value.trim());
}

function detectLoginLogRecords(value) {
  const data = value && typeof value === "object" ? value.data : value;
  if (Array.isArray(data)) {
    return {
      path: Array.isArray(value?.data) ? "data[]" : "response[]",
      records: data.filter(isPlainObject),
      count: data.length
    };
  }
  if (!isPlainObject(data)) {
    return { path: null, records: [], count: 0 };
  }

  for (const key of ["logSearchModels", "records", "rows", "list", "items", "logs", "result", "data"]) {
    if (Array.isArray(data[key])) {
      return {
        path: `data.${safeFieldName(key)}`,
        records: data[key].filter(isPlainObject),
        count: data[key].length
      };
    }
  }
  if (isPlainObject(data.page) && Array.isArray(data.page.list)) {
    return {
      path: "data.page.list",
      records: data.page.list.filter(isPlainObject),
      count: data.page.list.length
    };
  }
  return { path: null, records: [], count: 0 };
}

function buildLoginLogsSummary(records, input, noData, diagnostics) {
  const window = loginLogsTimeWindow(input);
  const timeValues = records.map(loginRecordTime).filter((value) => value !== null).sort((a, b) => a - b);
  const returnedFields = returnedLoginLogFields(records);
  const firstIp = firstLoginIp(records);
  const firstDeviceId = firstLoginDeviceId(records);
  const firstUserId = firstLoginUserId(records);
  const firstMethod = firstLoginField(records, /(^method$|loginMethod|登录方式)/i);
  const firstLogSource = firstLoginField(records, /(^logSource$|origin|source|channel|platform|app|端|来源)/i);
  const piiSummary = loginPiiStrictSummary(records, input);
  return {
    source_status: noData ? "no_data" : "completed",
    records_count: records.length,
    time_window_observed: {
      from_timestamp: window.from,
      to_timestamp: window.to
    },
    first_login_time_observed: timeValues.length > 0 ? timeValues[0] : null,
    last_login_time_observed: timeValues.length > 0 ? timeValues[timeValues.length - 1] : null,
    login_result_fields_present: fieldsPresent(returnedFields, /(result|status|success|outcome|error|失败|成功|状态)/i),
    device_fields_present: fieldsPresent(returnedFields, /(device|did|设备|model|机型)/i),
    ip_fields_present: fieldsPresent(returnedFields, /(^ip$|ipAddr|ip_address|clientIp|remoteIp|loginIp|登录ip|ip)/i),
    ip_sample: firstIp ? displayRiskEntity("ip", firstIp, input) : null,
    device_id_sample: firstDeviceId ? displayRiskEntity("deviceId", firstDeviceId, input) : null,
    user_id_sample: firstUserId ? displayRiskEntity("user_id", firstUserId, input) : null,
    method_sample: firstMethod ? displayRiskEntity("method", firstMethod, input) : null,
    logSource_sample: firstLogSource ? displayRiskEntity("logSource", firstLogSource, input) : null,
    ip_sample_masked: firstIp ? maskIp(firstIp) : null,
    device_id_sample_masked: firstDeviceId ? maskDeviceId(firstDeviceId) : null,
    phone_number_sample: piiSummary.phone_number_sample,
    id_card_present: piiSummary.id_card_present,
    birth_year_present: piiSummary.birth_year_present,
    name_present: piiSummary.name_present,
    origin_fields_present: fieldsPresent(returnedFields, /(origin|source|channel|platform|app|端|来源)/i),
    returned_fields_observed: returnedFields,
    no_data: noData,
    no_data_not_risk_exclusion: true,
    diagnostics
  };
}

function buildLoginLogsDiagnostics({ value, input, fetchResult, responseFormat, parseErrorDetailSanitized }) {
  const detectedRecords = value === null ? { path: null, records: [], count: 0 } : detectLoginLogRecords(value);
  return {
    upstream_http_status: typeof fetchResult?.status === "number" ? fetchResult.status : null,
    response_format: responseFormat,
    top_level_keys: value && typeof value === "object" && !Array.isArray(value) ? observedKeys(value) : [],
    records_array_path_detected: detectedRecords.path,
    records_count_before_limit: detectedRecords.count,
    summary_limit: loginLogsLimit(input),
    response_too_large: Boolean(fetchResult?.bodyTruncated),
    parse_error_detail_sanitized: parseErrorDetailSanitized
  };
}

function withLoginLogsFallbackDiagnostics(diagnostics, meta) {
  if (!meta?.loginLogsFallbackAttempted) {
    return diagnostics;
  }
  return {
    ...diagnostics,
    fallback_attempted: true,
    fallback_reason: meta.loginLogsFallbackReason || null,
    fallback_window_ms: LOGIN_LOGS_FALLBACK_WINDOW_MS,
    initial_attempt: meta.loginLogsInitialDiagnostics || null
  };
}

function loginRecordTime(record) {
  if (!isPlainObject(record)) {
    return null;
  }
  for (const key of Object.keys(record)) {
    if (/(time|timestamp|loginTime|eventTime|createTime|登录时间|时间)/i.test(key)) {
      const value = record[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
      }
      if (typeof value === "string") {
        const number = Number(value);
        if (Number.isFinite(number)) {
          return Math.trunc(number);
        }
      }
    }
  }
  return null;
}

function returnedLoginLogFields(records) {
  const fields = [];
  for (const record of records.slice(0, LOGIN_LOGS_DEFAULT_LIMIT)) {
    fields.push(...observedKeys(record));
  }
  return [...new Set(fields)].slice(0, 80);
}

function fieldsPresent(fields, pattern) {
  return fields.some((field) => pattern.test(String(field)));
}

function firstLoginIp(records) {
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (/(^ip$|ipAddr|ip_address|clientIp|remoteIp|loginIp|登录ip|ip)/i.test(key)) {
        const sample = firstStringLike(value);
        if (sample) {
          return sample;
        }
      }
    }
  }
  return null;
}

function firstLoginDeviceId(records) {
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (/(deviceId|device_id|did|deviceDid|设备)/i.test(key)) {
        const sample = firstStringLike(value);
        if (sample) {
          return sample;
        }
      }
    }
  }
  return null;
}

function firstLoginUserId(records) {
  return firstLoginField(records, /(^user_id$|^userId$|^uid$|userIds|用户id)/i);
}

function firstLoginField(records, pattern) {
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (pattern.test(key)) {
        const sample = firstStringLike(value);
        if (sample) {
          return sample;
        }
      }
    }
  }
  return null;
}

function loginPiiStrictSummary(records, input) {
  const summary = {
    phone_number_sample: null,
    id_card_present: false,
    birth_year_present: false,
    name_present: false
  };
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      const piiValue = displayPiiStrict(key, value, input);
      if (isPhoneField(key) && piiValue && !summary.phone_number_sample) {
        summary.phone_number_sample = piiValue;
      } else if (isIdCardField(key) && piiValue) {
        summary.id_card_present = true;
        summary.birth_year_present = Boolean(piiValue.birth_year_present);
      } else if (isNameField(key) && piiValue) {
        summary.name_present = true;
      }
    }
  }
  return summary;
}

function firstStringLike(value) {
  if (isNonEmptyString(value) || typeof value === "number") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 20)) {
      const sample = firstStringLike(item);
      if (sample) {
        return sample;
      }
    }
  }
  return null;
}

function maskIp(value) {
  const text = String(value);
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(text)) {
    const parts = text.split(".");
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (text.includes(":")) {
    return "[masked_ipv6]";
  }
  return "[masked_ip]";
}

function validateRcpSnapshotInput(input) {
  const timeValidation = validateRcpTimeInput(input);
  if (timeValidation) {
    return timeValidation;
  }

  if (Object.hasOwn(input, "eventType") && !isNonEmptyString(input.eventType)) {
    return {
      message: "rcp_snapshot eventType must be a non-empty string",
      required: ["eventType string"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "source_id") && !isNonEmptyString(input.source_id)) {
    return {
      message: "rcp_snapshot source_id must be a non-empty string",
      required: ["source_id string"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "sourceIds") && rcpSourceIdsString(input) === null) {
    return {
      message: "rcp_snapshot sourceIds must be a string or string array",
      required: ["sourceIds string|string[]"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "device_id") && !isNonEmptyString(input.device_id)) {
    return {
      message: "rcp_snapshot device_id must be a non-empty string",
      required: ["device_id string"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "selected_columns") && !validRcpSelectedColumns(input.selected_columns)) {
    return {
      message: "rcp_snapshot selected_columns must be an array of column names",
      required: ["selected_columns string[]"],
      errorType: "wrong_request_body_shape"
    };
  }

  if (Object.hasOwn(input, "page") && !validPositiveInteger(input.page)) {
    return {
      message: "rcp_snapshot page must be a positive integer",
      required: ["page positive integer"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "pageIndex") && !validPositiveInteger(input.pageIndex)) {
    return {
      message: "rcp_snapshot pageIndex must be a positive integer",
      required: ["pageIndex positive integer"],
      errorType: "invalid_parameter"
    };
  }

  if (Object.hasOwn(input, "pageSize") && (!validPositiveInteger(input.pageSize) || input.pageSize > RCP_MAX_PAGE_SIZE)) {
    return {
      message: `rcp_snapshot pageSize must be a positive integer <= ${RCP_MAX_PAGE_SIZE}`,
      required: [`pageSize positive integer <= ${RCP_MAX_PAGE_SIZE}`],
      errorType: "invalid_parameter"
    };
  }

  return null;
}

function validateRcpTimeInput(input) {
  const directStart = Object.hasOwn(input, "startTime") ? input.startTime : undefined;
  const directEnd = Object.hasOwn(input, "endTime") ? input.endTime : undefined;
  const rawWindow = input.time_window && typeof input.time_window === "object" && !Array.isArray(input.time_window)
    ? input.time_window
    : {};
  const windowStart = Object.hasOwn(rawWindow, "startTime") ? rawWindow.startTime : undefined;
  const windowEnd = Object.hasOwn(rawWindow, "endTime") ? rawWindow.endTime : undefined;
  const providedStart = directStart ?? windowStart;
  const providedEnd = directEnd ?? windowEnd;

  if ((providedStart === undefined) !== (providedEnd === undefined)) {
    return {
      message: "rcp_snapshot requires startTime and endTime together",
      required: ["startTime and endTime"],
      errorType: "wrong_time_field_format"
    };
  }

  if (providedStart === undefined && providedEnd === undefined) {
    return null;
  }

  if (!validRcpTimeString(providedStart) || !validRcpTimeString(providedEnd)) {
    return {
      message: "rcp_snapshot time fields must use YYYY-MM-DD HH:mm:ss",
      required: ["startTime/endTime format YYYY-MM-DD HH:mm:ss"],
      errorType: "wrong_time_field_format"
    };
  }

  if (providedEnd <= providedStart) {
    return {
      message: "rcp_snapshot endTime must be later than startTime",
      required: ["endTime > startTime"],
      errorType: "invalid_parameter"
    };
  }

  return null;
}

function buildRcpSnapshotRequest(input) {
  const timeWindow = rcpTimeWindow(input);
  const tableHeaderList = rcpTableHeaderList(input.selected_columns);
  const pageIndex = rcpPageIndex(input);
  const pageSize = Object.hasOwn(input, "pageSize") ? Math.trunc(input.pageSize) : RCP_DEFAULT_PAGE_SIZE;
  const conditionList = rcpConditionList(input);
  const body = rcpEventListHarBodyTemplate();

  body.tableHeaderList = tableHeaderList;
  body.startTime = timeWindow.startTime;
  body.endTime = timeWindow.endTime;
  body.currentTime = timeWindow.currentTime;
  body.eventV2.eventType = isNonEmptyString(input.eventType) ? input.eventType.trim() : RCP_DEFAULT_EVENT_TYPE;
  body.eventV2.sourceIds = rcpSourceIdsString(input) || "";
  body.eventV2.conditionList = conditionList;
  body.pageIndex = pageIndex;
  body.pageSize = pageSize;

  return {
    path: RCP_EVENT_LIST_PATH,
    method: "POST",
    body
  };
}

function summarizeRcpSnapshotResponse(value, input = {}) {
  const apiCode = readApiCode(value);
  if (apiCode !== null && ![0, 200].includes(apiCode)) {
    const errorType = classifyRcpApiError(value);
    return {
      sourceStatus: ["wrong_request_body_shape", "wrong_time_field_format", "invalid_parameter"].includes(errorType)
        ? "parameter_error"
        : "blocked",
      errorType,
      summary: {
        rcp_snapshot: {
          api_code: apiCode,
          response_wrapper_paths_present: rcpWrapperPresence(value),
          response_error_category: errorType,
          no_data: false
        }
      }
    };
  }

  const data = value && typeof value === "object" ? value.data : null;
  const eventList = Array.isArray(data?.eventList) ? data.eventList.filter((item) => item && typeof item === "object") : null;
  if (!data || eventList === null) {
    const wrapperErrorType = classifyRcpWrapperError(value);
    if (wrapperErrorType) {
      return {
        sourceStatus: "parameter_error",
        errorType: wrapperErrorType,
        summary: {
          rcp_snapshot: {
            response_wrapper_paths_present: rcpWrapperPresence(value),
            response_error_category: wrapperErrorType,
            no_data: false
          }
        }
      };
    }
    return {
      sourceStatus: "parse_error",
      errorType: "parse_error",
      summary: {
        rcp_snapshot: {
          response_wrapper_paths_present: rcpWrapperPresence(value),
          no_data: false
        }
      }
    };
  }

  const tableHeaderColumns = rcpTableHeaderColumns(data.tableHeaderList);
  const returnedColumns = rcpReturnedColumns(eventList);
  const noData = eventList.length === 0;
  return {
    sourceStatus: noData ? "completed_no_hit_for_small_window" : "completed",
    errorType: null,
    summary: {
      rcp_snapshot: {
        response_wrapper_paths_present: rcpWrapperPresence(value),
        event_count: eventList.length,
        pagination_summary: rcpPaginationSummary(data.pagination),
        table_header_columns: tableHeaderColumns,
        returned_columns_observed: returnedColumns,
        first_event_shape_keys: returnedColumnsFromFirstEvent(eventList),
        dynamic_columns_observed: returnedColumns.filter((column) => !tableHeaderColumns.includes(column)),
        first_event_entity_samples: rcpFirstEventEntitySamples(eventList, input),
        no_data: noData,
        no_data_not_risk_exclusion: true
      }
    }
  };
}

function rcpFirstEventEntitySamples(eventList, input) {
  const first = eventList.find((item) => item && typeof item === "object" && !Array.isArray(item));
  if (!first) {
    return {};
  }
  const fields = ["eventId", "sourceId", "deviceId", "hitFusePolicyCode", "_occurTime"];
  const samples = {};
  for (const field of fields) {
    if (first[field] !== undefined && first[field] !== null) {
      samples[field] = ["_occurTime"].includes(field)
        ? String(first[field]).slice(0, 160)
        : displayRiskEntity(field, first[field], input);
    }
  }
  return samples;
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

  const deviceSummary = buildDeviceSummary(value, input);
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

function buildDeviceSummary(value, input = {}) {
  const data = value && typeof value === "object" ? value.data : null;
  const { entries, sourcePath } = extractDeviceEntries(data);
  const deviceIds = entries.map(deviceIdFromEntry).filter((item) => item !== null && item !== undefined && String(item).length > 0);
  const uniqueDeviceIds = [...new Set(deviceIds.map((item) => String(item)))];
  const fieldKeys = deviceFieldsObserved(entries);
  const outputFields = deviceOutputFields(sourcePath, entries, fieldKeys);

  return {
    device_ids_count: uniqueDeviceIds.length > 0 ? uniqueDeviceIds.length : entries.length,
    device_id_sample: uniqueDeviceIds.length > 0 ? displayRiskEntity("deviceId", uniqueDeviceIds[0], input) : null,
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
  if (/^(ANDROID|IOS)_[A-Za-z0-9_.:-]+$/.test(String(key))) {
    return "[masked_device_id_key]";
  }
  if (/^\d{8,}$/.test(String(key))) {
    return "[masked_numeric_id_key]";
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

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validRcpTimeString(value) {
  if (typeof value !== "string" || !RCP_TIME_PATTERN.test(value)) {
    return false;
  }

  const [datePart, timePart] = value.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second
  );
}

function rcpTimeWindow(input) {
  const rawWindow = input.time_window && typeof input.time_window === "object" && !Array.isArray(input.time_window)
    ? input.time_window
    : {};
  const startTime = Object.hasOwn(input, "startTime") ? input.startTime : rawWindow.startTime;
  const endTime = Object.hasOwn(input, "endTime") ? input.endTime : rawWindow.endTime;

  if (typeof startTime === "string" && typeof endTime === "string") {
    return {
      startTime,
      endTime,
      currentTime: endTime
    };
  }

  const end = new Date();
  const start = new Date(end.getTime() - RCP_DEFAULT_WINDOW_MS);
  return {
    startTime: formatRcpTimestamp(start),
    endTime: formatRcpTimestamp(end),
    currentTime: formatRcpTimestamp(end)
  };
}

function rcpPageIndex(input) {
  if (Object.hasOwn(input, "pageIndex")) {
    return Math.trunc(input.pageIndex);
  }
  if (Object.hasOwn(input, "page")) {
    return Math.trunc(input.page);
  }
  return RCP_DEFAULT_PAGE;
}

function formatRcpTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + " " + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(":");
}

function rcpSourceIdsString(input) {
  if (Object.hasOwn(input, "source_id")) {
    return isNonEmptyString(input.source_id) ? input.source_id.trim() : null;
  }
  if (!Object.hasOwn(input, "sourceIds")) {
    return "";
  }
  if (isNonEmptyString(input.sourceIds)) {
    return input.sourceIds.trim();
  }
  if (Array.isArray(input.sourceIds) && input.sourceIds.length > 0 && input.sourceIds.every(isNonEmptyString)) {
    return input.sourceIds.map((item) => item.trim()).join(",");
  }
  return null;
}

function validRcpSelectedColumns(value) {
  return Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every(validRcpColumnName);
}

function validRcpColumnName(value) {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,128}$/.test(value);
}

function rcpTableHeaderList(selectedColumns) {
  const columns = validRcpSelectedColumns(selectedColumns) ? selectedColumns : RCP_DEFAULT_TABLE_COLUMNS;
  return columns.map((column) => ({
    column_name: column,
    column_comment: RCP_COLUMN_COMMENTS[column] || column
  }));
}

function rcpEventListHarBodyTemplate() {
  return {
    tableHeaderList: rcpTableHeaderList(),
    startTime: "",
    endTime: "",
    currentTime: "",
    eventV2: rcpEventV2HarTemplate(),
    pageIndex: RCP_DEFAULT_PAGE,
    pageSize: RCP_DEFAULT_PAGE_SIZE
  };
}

function rcpEventV2HarTemplate() {
  return {
    eventType: RCP_DEFAULT_EVENT_TYPE,
    hitPolicies: "",
    version: RCP_DEFAULT_VERSION,
    status: RCP_DEFAULT_STATUS,
    snapshotVersion: RCP_DEFAULT_SNAPSHOT_VERSION,
    sourceIds: "",
    realTimeOp: RCP_DEFAULT_REAL_TIME_OP,
    isPolicyTreeExperiment: false,
    conditionList: [],
    grayFeature: "",
    grayQueryStatus: 0,
    region: RCP_DEFAULT_REGION
  };
}

function rcpConditionList(input) {
  if (!isNonEmptyString(input.device_id)) {
    return [];
  }
  const condition = rcpConditionItem({
    key: "deviceId",
    value: input.device_id.trim(),
    id: rcpConditionId(0),
    seq: 0,
    description: ""
  });
  return [
    [condition]
  ];
}

function rcpConditionItem({ key, value, id, seq, description }) {
  return {
    key,
    logic: "term",
    value,
    id,
    seq,
    keyType: "主表",
    description,
    rightDataType: "C"
  };
}

function rcpConditionId(seq) {
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function classifyRcpApiError(value) {
  const text = rcpErrorText(value);
  if (/(time|starttime|endtime|yyyy|date|时间|日期)/i.test(text)) {
    return "wrong_time_field_format";
  }
  if (/(tableheaderlist|conditionlist|eventv2|sourceids|body|shape|字段|参数体|请求体)/i.test(text)) {
    return "wrong_request_body_shape";
  }
  if (/(param|parameter|invalid|illegal|参数|无效|非法)/i.test(text)) {
    return "invalid_parameter";
  }
  if (hasRcpStatusMessageWrapper(value)) {
    return "wrong_request_body_shape";
  }
  return "platform_error";
}

function classifyRcpWrapperError(value) {
  if (!hasRcpStatusMessageWrapper(value)) {
    return null;
  }
  return classifyRcpApiError(value);
}

function hasRcpStatusMessageWrapper(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.hasOwn(value, "status") &&
      Object.hasOwn(value, "message")
  );
}

function rcpErrorText(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  return ["message", "msg", "error", "errorMsg", "error_message"]
    .map((key) => value[key])
    .filter((item) => typeof item === "string")
    .join(" ");
}

function rcpWrapperPresence(value) {
  const data = value && typeof value === "object" ? value.data : null;
  return {
    data_eventList: Array.isArray(data?.eventList),
    data_pagination: Boolean(data?.pagination && typeof data.pagination === "object" && !Array.isArray(data.pagination)),
    data_tableHeaderList: Array.isArray(data?.tableHeaderList)
  };
}

function rcpPaginationSummary(pagination) {
  if (!pagination || typeof pagination !== "object" || Array.isArray(pagination)) {
    return null;
  }
  const keys = ["page", "pageSize", "total", "totalCount", "totalPage", "pages", "hasNext"];
  const summary = {};
  for (const key of keys) {
    if (Object.hasOwn(pagination, key) && ["number", "boolean", "string"].includes(typeof pagination[key])) {
      summary[key] = pagination[key];
    }
  }
  return summary;
}

function rcpTableHeaderColumns(tableHeaderList) {
  if (!Array.isArray(tableHeaderList)) {
    return [];
  }
  return tableHeaderList
    .map((item) => {
      if (typeof item === "string") {
        return safeFieldName(item);
      }
      if (!item || typeof item !== "object") {
        return null;
      }
      const raw = item.column_name || item.columnName || item.name || item.key || item.dataIndex;
      return typeof raw === "string" ? safeFieldName(raw) : null;
    })
    .filter(Boolean)
    .slice(0, 80);
}

function rcpReturnedColumns(eventList) {
  const columns = [];
  for (const item of eventList.slice(0, 20)) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      columns.push(...observedKeys(item));
    }
  }
  return [...new Set(columns)].slice(0, 80);
}

function returnedColumnsFromFirstEvent(eventList) {
  const first = eventList.find((item) => item && typeof item === "object" && !Array.isArray(item));
  return observedKeys(first);
}

function mockRcpSnapshotData(input) {
  const request = buildRcpSnapshotRequest(input);
  return {
    shape_summary_only: true,
    fixed_path: RCP_EVENT_LIST_PATH,
    request_body_shape: {
      tableHeaderList: "object_array",
      startTime: "YYYY-MM-DD HH:mm:ss",
      endTime: "YYYY-MM-DD HH:mm:ss",
      currentTime: "YYYY-MM-DD HH:mm:ss",
      eventV2: {
        eventType: request.body.eventV2.eventType,
        hitPolicies: "string",
        version: "string",
        status: "number",
        snapshotVersion: "string",
        sourceIds: "string",
        realTimeOp: "string",
        isPolicyTreeExperiment: "boolean",
        conditionList: "array_of_condition_groups",
        grayFeature: "string",
        grayQueryStatus: "number",
        region: "string"
      },
      pageIndex: request.body.pageIndex,
      pageSize: request.body.pageSize
    },
    rcp_snapshot: {
      response_wrapper_paths_present: {
        data_eventList: true,
        data_pagination: true,
        data_tableHeaderList: true
      },
      event_count: 1,
      pagination_summary: {
        page: request.body.pageIndex,
        pageSize: request.body.pageSize,
        total: 1
      },
      table_header_columns: request.body.tableHeaderList.map((column) => column.column_name),
      returned_columns_observed: ["sourceId", "eventId", "_occurTime", "deviceId"],
      first_event_shape_keys: ["sourceId", "eventId", "_occurTime", "deviceId"],
      dynamic_columns_observed: [],
      no_data: false,
      no_data_not_risk_exclusion: true
    },
    generated_at: fixedMockTime()
  };
}

function mockWeaponInventoryData(input) {
  const request = buildWeaponInventoryRequest(input);
  const scope = weaponEntityScope(input);
  const deviceId = scope.entityType === "device_id" ? scope.value : "ANDROID_mock_device_id";
  const graphValue = {
    code: 0,
    data: {
      pointInfoMap: scope.entityType === "device_id"
        ? {
            [deviceId]: { nodeType: "device", deviceId },
            "123456789": { nodeType: "user" }
          }
        : {
            [scope.value]: { nodeType: "user" },
            [deviceId]: { nodeType: "device", deviceId }
          },
      relationEdgeList: [
        { from: scope.value, to: deviceId, relation: "mock_relation" }
      ]
    }
  };
  const riskValue = {
    code: 0,
    data: [
      {
        deviceId,
        productName: weaponProductName(input),
        labelInfo: [
          { groupName: "mock_group", labelName: "mock_label" }
        ],
        originalLog: {
          eventId: "mock_event",
          occurTime: "2026-05-29 10:00:00"
        },
        userLevel: "mock_level"
      }
    ]
  };
  const summary = summarizeWeaponInventoryResponse(
    {
      graphData: graphValue,
      riskDataResults: [
        {
          ok: true,
          status: 200,
          body: riskValue
        }
      ],
      weapon_chain: {
        graphData_status: "completed",
        riskData_status: "completed",
        selected_device_count: 1
      }
    },
    input
  ).summary.weapon_inventory;

  return {
    shape_summary_only: true,
    fixed_paths: {
      graphData: WEAPON_GRAPH_DATA_PATH,
      riskData: WEAPON_RISK_DATA_PATH
    },
    graph_request: {
      method: request.method,
      display_path: request.displayPath,
      groupKey: scope.groupKey,
      dimKey: scope.dimKey,
      product: weaponProduct(input),
      productName: weaponProductName(input),
      searchLevel: weaponSearchLevel(input)
    },
    risk_chaining: {
      include_risk_data: weaponIncludeRiskData(input),
      max_device_ids: weaponMaxDeviceIds(input),
      device_ids_exposed_raw: false
    },
    weapon_inventory: summary,
    generated_at: fixedMockTime()
  };
}

function mockLoginLogsData(input) {
  const request = buildLoginLogsRequest(input);
  const mockValue = {
    code: 0,
    data: {
      records: [
        {
          loginTime: loginLogsTimeWindow(input).from + 1000,
          result: "success",
          deviceId: "ANDROID_mock_login_device",
          ip: "10.20.30.40",
          origin: "mock-origin"
        },
        {
          loginTime: loginLogsTimeWindow(input).to - 1000,
          result: "denied",
          deviceId: "IOS_mock_login_device",
          ip: "10.20.30.41",
          origin: "mock-origin"
        }
      ]
    }
  };
  const summary = summarizeLoginLogsResponse(mockValue, input).summary.login_logs;
  return {
    shape_summary_only: true,
    fixed_path: LOGIN_LOGS_SEARCH_PATH,
    request: {
      method: request.method,
      display_path: request.displayPath,
      recallSource: loginLogsRecallSource(input),
      limit: loginLogsLimit(input)
    },
    login_logs: summary,
    generated_at: fixedMockTime()
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

function summarizeFixedShapeActionResponse(sectionName) {
  return (value, input = {}) => {
    const apiCode = readApiCode(value);
    if (apiCode !== null && ![0, 1, 200].includes(apiCode)) {
      const errorType = apiCode === 302 ? "auth_failed" : "platform_error";
      return {
        sourceStatus: sourceStatusFromErrorType(errorType),
        errorType,
        summary: {
          [sectionName]: {
            source_status: sourceStatusFromErrorType(errorType),
            api_code: apiCode,
            top_level_keys: observedKeys(value),
            raw_full_body_suppressed: true,
            no_data: false,
            no_data_not_risk_exclusion: true
          }
        }
      };
    }

    const payload = Object.hasOwn(value || {}, "data") ? value.data : value;
    const arraySummaries = collectArraySummaries(value);
    const noData = isEmptyPayload(payload) || (
      arraySummaries.length > 0 && arraySummaries.every((item) => item.count === 0)
    );
    return {
      sourceStatus: noData ? "no_data" : "completed",
      errorType: null,
      summary: {
        [sectionName]: {
          source_status: noData ? "no_data" : "completed",
          api_code: apiCode,
          top_level_keys: observedKeys(value),
          data_keys: observedKeys(payload),
          array_paths_observed: arraySummaries,
          entity_samples: collectRiskEntitySamples(value, input),
          trace_id_present: hasFieldDeep(value, /^traceId$/i),
          query_id_present: hasFieldDeep(value, /^queryId$/i),
          response_shape_summary_only: true,
          raw_full_body_suppressed: true,
          no_data: noData,
          no_data_not_risk_exclusion: true
        }
      }
    };
  };
}

function collectArraySummaries(value, path = "response", depth = 0, output = []) {
  if (depth > 5 || value === null || value === undefined || output.length >= 20) {
    return output;
  }
  if (Array.isArray(value)) {
    output.push({ path, count: value.length });
    for (const item of value.slice(0, 3)) {
      collectArraySummaries(item, `${path}[]`, depth + 1, output);
    }
    return output;
  }
  if (typeof value !== "object") {
    return output;
  }
  for (const [key, child] of Object.entries(value).slice(0, 50)) {
    collectArraySummaries(child, `${path}.${safeFieldName(key)}`, depth + 1, output);
  }
  return output;
}

function collectRiskEntitySamples(value, input, depth = 0, output = {}) {
  if (depth > 5 || value === null || value === undefined || Object.keys(output).length >= 20) {
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 20)) {
      collectRiskEntitySamples(item, input, depth + 1, output);
    }
    return output;
  }
  if (!isPlainObject(value)) {
    return output;
  }

  for (const [key, child] of Object.entries(value).slice(0, 80)) {
    const normalizedKey = riskEntityFieldName(key);
    if (normalizedKey && output[normalizedKey] === undefined && ["string", "number", "boolean"].includes(typeof child)) {
      output[normalizedKey] = displayRiskEntity(normalizedKey, child, input);
    }
    if (child && typeof child === "object") {
      collectRiskEntitySamples(child, input, depth + 1, output);
    }
  }
  return output;
}

function riskEntityFieldName(key) {
  const text = String(key);
  if (/^(userId|user_id|uid|userIds)$/i.test(text)) {
    return "user_id";
  }
  if (/^(deviceId|device_id|did|deviceDid|dids)$/i.test(text)) {
    return "deviceId";
  }
  if (/^(ip|ipAddr|ip_address|clientIp|remoteIp|loginIp|userIpDesc)$/i.test(text)) {
    return "ip";
  }
  if (/^(eventId|eventType|sourceId|hitFusePolicyCode|policyCode|policyTreeCode|policyTreeVersion|policyTreeNodeCode)$/i.test(text)) {
    return text;
  }
  if (/^(photoId|photo_id|liveId|live_id)$/i.test(text)) {
    return text;
  }
  return null;
}

function hasFieldDeep(value, pattern, depth = 0) {
  if (depth > 5 || value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).some((item) => hasFieldDeep(item, pattern, depth + 1));
  }
  if (!isPlainObject(value)) {
    return false;
  }
  for (const [key, child] of Object.entries(value).slice(0, 80)) {
    if (pattern.test(String(key))) {
      return true;
    }
    if (hasFieldDeep(child, pattern, depth + 1)) {
      return true;
    }
  }
  return false;
}

function mockFixedActionData(sectionName, input, request, responseValue, extra = {}) {
  const summary = summarizeFixedShapeActionResponse(sectionName)(responseValue, input).summary[sectionName];
  return {
    shape_summary_only: true,
    fixed_path: String(request.path || "").split("?")[0],
    request: {
      method: request.method,
      display_path: request.displayPath || request.path,
      body_fields: Object.keys(request.body || {}),
      companion_paths: request.companionPaths || []
    },
    [sectionName]: {
      ...summary,
      ...extra
    },
    generated_at: fixedMockTime()
  };
}

function mockArchivesUserAnalysisData(input) {
  const request = buildArchivesUserAnalysisRequest(input);
  return mockFixedActionData(
    "archives_user_analysis",
    input,
    request,
    {
      code: 0,
      data: {
        dataList: [
          {
            userId: input.user_id,
            deviceId: "ANDROID_mock_archives_device",
            ip: "10.20.30.10",
            eventTime: input.beginTime + 1000,
            operationType: "loginStart",
            result: "SUCCESS"
          }
        ],
        totalCount: 1
      }
    },
    {
      operation_filters: [...ARCHIVES_USER_ANALYSIS_FILTER_FIELDS],
      requestParam_extraParam_suppressed: true
    }
  );
}

function mockArchivesUserProfileData(input) {
  const request = buildArchivesUserProfileRequest(input);
  return mockFixedActionData(
    "archives_user_profile",
    input,
    request,
    {
      code: 0,
      data: {
        userId: input.user_id,
        accountStatus: "shape_only_present",
        labelSummary: { count: 1 },
        riskInfo: { riskInfoPresent: true }
      }
    },
    {
      raw_profile_body_suppressed: true
    }
  );
}

function mockArchivesPhotoSearchData(input) {
  const request = buildArchivesPhotoSearchRequest(input);
  return mockFixedActionData(
    "archives_photo_search",
    input,
    request,
    {
      code: 0,
      data: {
        dataList: [
          {
            userId: input.user_id,
            photoId: "photo_mock_1",
            publishTime: input.begin + 1000,
            status: "shape_only_present"
          }
        ],
        totalCount: 1
      }
    },
    {
      raw_report_text_suppressed: true
    }
  );
}

function mockArchivesRelatedUsersData(input) {
  const request = buildArchivesRelatedUsersRequest(input);
  return mockFixedActionData(
    "archives_related_users",
    input,
    request,
    {
      code: 0,
      data: {
        dataList: [
          {
            userId: "123456789",
            deviceId: "ANDROID_mock_related_device",
            relationType: archivesRelationType(input)
          }
        ],
        totalCount: 1
      }
    },
    {
      raw_related_user_profile_suppressed: true
    }
  );
}

function mockRcpEventDetailData(input) {
  const request = buildRcpEventDetailRequest(input);
  return mockFixedActionData(
    "rcp_event_detail",
    input,
    request,
    {
      code: 0,
      data: {
        eventType: input.eventType,
        eventId: input.eventId,
        sourceId: "mock_source_id",
        deviceId: "ANDROID_mock_rcp_device",
        hitFusePolicyCode: "mock_policy_code",
        _occurTime: input.queryTime,
        realTimeFeedback: "shape_only_present"
      }
    },
    {
      raw_detail_body_suppressed: true,
      strategy_event_not_final_judgement: true
    }
  );
}

function mockRcpEventFeatureListData(input) {
  const request = buildRcpEventFeatureListRequest(input);
  return mockFixedActionData(
    "rcp_event_feature_list",
    input,
    request,
    {
      code: 0,
      data: [
        {
          eventType: input.eventType,
          eventId: input.eventId,
          featureGroup: "",
          featureKey: "shape_only_feature",
          checkResult: true
        }
      ]
    },
    {
      raw_feature_values_suppressed: true,
      strategy_feature_snapshot_not_final_judgement: true
    }
  );
}

function mockRcpPolicyTreeLookupData(input) {
  const request = buildRcpPolicyTreeLookupRequest(input);
  return mockFixedActionData(
    "rcp_policy_tree_lookup",
    input,
    request,
    {
      code: 0,
      data: {
        policyTreeCode: input.policyTreeCode,
        policyTreeVersion: input.policyTreeVersion,
        policyTreeNodeCode: "53187346034508",
        targetPolicyCode: input.targetPolicyCode || null,
        children: []
      }
    },
    {
      policyTreeList_is_coarse_filter: true,
      raw_policy_tree_body_suppressed: true,
      raw_node_binding_list_suppressed: true,
      raw_all_policy_code_list_suppressed: true,
      strategy_governance_only: true
    }
  );
}

function mockTrackAnalysisCheckDataReadyData(input) {
  const request = buildTrackAnalysisCheckDataReadyRequest(input);
  return mockFixedActionData(
    "track_analysis_check_data_ready",
    input,
    request,
    {
      code: 0,
      message: "shape_only_present",
      data: {
        dateStatus: {
          ready: true
        },
        traceId: "mock_trace_id_value_suppressed"
      }
    },
    {
      readiness_not_evidence: true,
      trace_id_value_suppressed: true
    }
  );
}

function fixedMockTime() {
  return "2026-05-29T00:00:00.000Z";
}
