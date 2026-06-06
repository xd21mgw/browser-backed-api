import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ACTIONS,
  ACTION_ALLOWLIST,
  buildActionBody,
  buildLiveActionResponse
} from "../src/actions.js";
import {
  computeAuthState,
  saveRefreshState,
  shouldRefreshOrigin,
  updateOriginWarmState
} from "../src/authState.js";
import { loadConfig } from "../src/config.js";
import { CORE_ORIGIN_KEYS, DEFAULT_REFRESH_TTL_MS, ORIGIN_REGISTRY } from "../src/originRegistry.js";
import { BrowserBackedApiService } from "../src/service.js";
import { buildRefreshDaemonEvent, parseRefreshIntervalMs } from "../scripts/refresh-daemon.js";
import {
  buildProfileLockBlockedStartOutput,
  buildExposeSummary,
  canClearStaleProfileLock,
  clearDedicatedStaleProfileLock,
  classifyProfileLockState,
  classifyProxyRequest,
  extractUserDataDir,
  needsManualLogin,
  planWorkerStart,
  serviceHealthReady
} from "../scripts/mac-worker.js";

const ACTION_INPUTS = Object.freeze({
  rcp_snapshot: {
    eventType: "USER_REGISTER_NEW",
    source_id: "mock_source_id",
    startTime: "2026-05-29 10:00:00",
    endTime: "2026-05-29 10:30:00",
    pageSize: 10
  },
  weapon_inventory: {
    user_id: "2871834924"
  },
  weapon_device_info: {
    device_id: "1504354E-BE57-727A-A8BD-3A1AEF1D35DF"
  },
  weapon_device_app_list: {
    device_id: "1504354E-BE57-727A-A8BD-3A1AEF1D35DF"
  },
  weapon_device_location_info: {
    device_id: "1504354E-BE57-727A-A8BD-3A1AEF1D35DF",
    user_id: "4559196013"
  },
  weapon_user_klink_status: {
    user_id: "4559196013"
  },
  login_logs_search: {
    user_id: "2871834924",
    from_timestamp: 1780000000000,
    to_timestamp: 1780086400000,
    limit: 10
  },
  track_analysis_summary: {
    user_id: "2871834924",
    appName: "KUAISHOU"
  },
  archives_user_analysis: {
    user_id: "2871834924",
    beginTime: 1780000000000,
    endTime: 1780086400000,
    pageIndex: 1,
    pageSize: 20
  },
  archives_user_profile: {
    user_id: "2871834924"
  },
  archives_photo_search: {
    user_id: "2871834924",
    begin: 1780000000000,
    end: 1780086400000,
    page: 1,
    count: 20
  },
  archives_photo_profile: {
    photo_id: "197323059879"
  },
  archives_photo_meta: {
    photo_id: "197323059879"
  },
  archives_photo_report_aggregate: {
    photo_id: "197323059879"
  },
  archives_photo_user_autonomy: {
    photo_id: "197323059879"
  },
  archives_gallery_photo_list: {
    user_id: "2871834924",
    pageIndex: 1,
    pageSize: 20
  },
  archives_photo_gallery_top: {
    user_id: "2871834924"
  },
  archives_negative_report: {
    user_id: "2871834924"
  },
  archives_negative_uninterested: {
    user_id: "2871834924"
  },
  archives_risk_info: {
    user_id: "2871834924"
  },
  archives_user_label: {
    user_id: "2871834924"
  },
  archives_user_shop_info: {
    user_id: "2871834924"
  },
  archives_punish_status: {
    photo_id: "197323059879"
  },
  archives_review_logs: {
    user_id: "2871834924",
    beginTime: 1780000000000,
    endTime: 1780086400000,
    pageIndex: 1,
    pageSize: 20
  },
  archives_user_analyze_summary: {
    user_id: "2871834924",
    beginTime: 1780000000000,
    endTime: 1780086400000,
    pageIndex: 1,
    pageSize: 20
  },
  archives_live_gallery: {
    user_id: "2871834924",
    page: 1,
    count: 20
  },
  archives_fans_list: {
    user_id: "2871834924",
    pageIndex: 1,
    pageSize: 20
  },
  archives_follow_list: {
    user_id: "2871834924",
    pageIndex: 1,
    pageSize: 20
  },
  archives_collect_photo_list: {
    user_id: "2871834924",
    page: 1,
    count: 20
  },
  archives_collection_list: {
    user_id: "2871834924",
    page: 1,
    size: 20
  },
  archives_comment_search: {
    user_id: "2871834924",
    page: 1,
    count: 20
  },
  archives_livestream_home_info: {
    live_stream_id: "mock_live_stream_1"
  },
  archives_livestream_home_meta: {
    live_stream_id: "mock_live_stream_1"
  },
  archives_livestream_home_log: {
    live_stream_id: "mock_live_stream_1",
    page: 1,
    count: 20
  },
  archives_livestream_comment_statistics: {
    live_stream_id: "mock_live_stream_1"
  },
  archives_livestream_comment_detail: {
    live_stream_id: "mock_live_stream_1",
    page: 1,
    count: 20
  },
  archives_user_report_search: {
    user_id: "2871834924",
    page: 1,
    count: 20
  },
  archives_moment_list: {
    user_id: "2871834924",
    page: 1,
    count: 20
  },
  archives_related_users: {
    user_id: "2871834924",
    relation_type: "same_device_registered"
  },
  archives_private_message_search: {
    user_id: "2871834924",
    direction: "sent",
    page: 1,
    count: 20
  },
  archives_past_four_items: {
    user_id: "2871834924",
    info_type: "profile_description",
    infoType: 3,
    page: 1,
    count: 20
  },
  rcp_event_detail: {
    eventType: "USER_REGISTER_NEW",
    eventId: "mock_event_id",
    queryTime: 1780000000000
  },
  rcp_event_feature_list: {
    eventType: "USER_REGISTER_NEW",
    eventId: "mock_event_id",
    queryTime: 1780000000000,
    featureGroup: ""
  },
  rcp_event_tree_or_decision: {
    eventType: "USER_REGISTER_NEW",
    eventId: "mock_event_id",
    queryTime: 1780000000000,
    region: "china"
  },
  rcp_fast_query_hbase: {
    source_id: "mock_source_id",
    startTime: 1780000000000,
    endTime: 1780086400000,
    limit: 500
  },
  rcp_feature_info_by_keys: {
    eventType: "USER_REGISTER_NEW",
    eventId: "mock_event_id",
    queryTime: 1780000000000,
    featureKeys: ["deviceId", "phoneModel"],
    region: "china"
  },
  rcp_policy_basic_info: {
    policyCode: "mock_policy_code",
    policyTreeCode: "USER_REGISTER_NEW"
  },
  rcp_relation_policy_tree: {
    policyCode: "mock_policy_code"
  },
  rcp_policy_binding_info_list: {
    policyCode: "mock_policy_code",
    policyVersion: 5,
    page: 1,
    size: 20
  },
  rcp_policy_search: {
    policyCode: "mock_policy_code",
    policyTreeCode: "USER_REGISTER_NEW",
    page: 1,
    size: 20
  },
  rcp_policy_blur_search: {
    policyCode: "mock_policy_code",
    policyTreeCode: "USER_REGISTER_NEW",
    page: 1,
    size: 20
  },
  rcp_policy_all_version: {
    policyCode: "mock_policy_code",
    page: 1,
    size: 50
  },
  rcp_pipeline_policy_versions_by_code: {
    policyCode: "mock_policy_code"
  },
  rcp_policy_tree_list: {
    policyTreeCode: "USER_REGISTER_NEW",
    policyCode: "mock_policy_code",
    eventTypeAssociator: "USER_REGISTER_NEW",
    page: 1,
    size: 20
  },
  rcp_policy_tree_node_binding: {
    policyTreeCode: "USER_REGISTER_NEW",
    policyTreeVersion: 887,
    policyTreeNodeCode: "53187346034508",
    policyCode: "mock_policy_code",
    page: 1,
    size: 20
  },
  rcp_policy_tree_policy_codes: {
    policyTreeCode: "USER_REGISTER_NEW",
    policyTreeVersion: 887,
    code: "mock_policy_code",
    page: 1,
    size: 20
  },
  rcp_policy_tree_max_version: {
    policyTreeCode: "USER_REGISTER_NEW",
    treeSnapshot: false
  },
  rcp_event_type_list: {
    keyWord: "USER_REGISTER",
    page: 1,
    size: 20
  },
  rcp_realtime_op_list: {
    eventType: "USER_REGISTER_NEW"
  },
  rcp_event_query_max_duration: {
    eventType: "USER_REGISTER_NEW"
  },
  rcp_event_save_ratios: {
    eventType: "USER_REGISTER_NEW"
  },
  rcp_policy_version_lookup: {
    eventType: "USER_REGISTER_NEW",
    eventId: "mock_event_id",
    policyCode: "mock_policy_code",
    policyVersion: 5,
    queryTime: 1780000000000
  },
  rcp_policy_detail_lookup: {
    policyCode: "mock_policy_code",
    policyVersion: 5
  },
  rcp_policy_release_record_lookup: {
    policyCode: "mock_policy_code",
    page: 1,
    size: 20
  },
  rcp_policy_tree_lookup: {
    policyTreeCode: "USER_REGISTER_NEW",
    policyTreeVersion: 887,
    targetPolicyCode: "mock_policy_code"
  },
  rcp_node_policy_attribution: {
    eventType: "USER_REGISTER_NEW",
    eventId: "mock_event_id",
    policyCode: "mock_policy_code",
    policyVersion: 5,
    queryTime: 1780000000000,
    region: "china"
  },
  rcp_node_bind_policy_attribution: {
    eventType: "USER_REGISTER_NEW",
    eventId: "mock_event_id",
    queryTime: 1780000000000,
    policyTreeCode: "USER_REGISTER_NEW",
    policyTreeVersion: 887,
    policyTreeNodeCode: "53187346034508"
  },
  track_analysis_check_data_ready: {
    device_id: "ANDROID_mock_device_id",
    appName: "KUAISHOU",
    product: "KUAISHOU",
    startTime: 1780000000000,
    endTime: 1780086400000,
    category: ["active"],
    event: [],
    appPlatform: [],
    metric: "pv"
  },
  track_analysis_product_list: {
    appName: "KUAISHOU",
    product: "KUAISHOU",
    currentPage: 1,
    pageSize: 20,
    keyword: "",
    type: 1,
    needFavorite: true
  },
  track_sequence_dimension_list: {
    product: "KUAISHOU"
  },
  track_data_type_list: {
    product: "KUAISHOU"
  },
  track_sequence_get_device_ids: {
    user_id: "2871834924",
    appName: "KUAISHOU"
  },
  track_sequence_get_use_duration: {
    user_id: "2871834924",
    appName: "KUAISHOU"
  },
  track_sequence_profile: {
    user_id: "2871834924",
    appName: "KUAISHOU"
  }
});

const DENNIS_BATCH_CHUNKS = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "test/fixtures/dennis_batch_chunks.json"), "utf8")
);

const OLD_BUSINESS_FIELDS = Object.freeze([
  "normalized_observation",
  "source_card",
  "source_quality",
  "source_quality_matrix",
  "evidence_card_inputs"
]);

const NOISE_ACTIONS = Object.freeze([
  "telemetry",
  "radar_misc_log_collect",
  "log_sdk",
  "js_css_static_assets",
  "h5_fingerprint",
  "mobile_device_info",
  "arbitrary_url_fetch",
  "cookie_token_session_header"
]);

let envCounter = 0;

function createAuthEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `browser-backed-api-poc-${process.pid}-${envCounter++}-`));
  return {
    BROWSER_BACKED_PROFILE_DIR: path.join(root, "profile"),
    BROWSER_BACKED_STATE_FILE: path.join(root, "refresh-session.state.json")
  };
}

function createService(extraEnv = {}) {
  return new BrowserBackedApiService(loadConfig({
    SERVICE_MODE: "mock",
    HOST: "127.0.0.1",
    PORT: "8787",
    ...createAuthEnv(),
    ...extraEnv
  }));
}

function createLiveConfig(extraEnv = {}) {
  return loadConfig({
    SERVICE_MODE: "live",
    HOST: "127.0.0.1",
    PORT: "8787",
    ...createAuthEnv(),
    RCP_ORIGIN: "https://rcp.example.test",
    WEAPON_ORIGIN: "https://weapon.example.test",
    LOGIN_LOGS_ORIGIN: "https://login.example.test",
    ARCHIVES_ORIGIN: "https://archives.example.test",
    TRACK_ANALYSIS_ORIGIN: "https://track.example.test",
    ...extraEnv
  });
}

function markOriginReady(service, config, domainKey) {
  const domain = config.domains[domainKey];
  const readyState = {
    warmed: true,
    page_ready: true,
    status: "ready",
    error_type: null,
    final_origin: domain.origin,
    current_origin: domain.origin,
    same_origin_actual: true
  };
  service.warmState.set(domainKey, readyState);
  service.refreshState = updateOriginWarmState(service.refreshState, domain, readyState);
}

function markAllOriginsReady(service, config) {
  for (const domainKey of Object.keys(config.domains)) {
    markOriginReady(service, config, domainKey);
  }
}

function buildLargeLoginLogsBody(count) {
  return {
    code: 0,
    data: {
      total: count,
      logSearchModels: Array.from({ length: count }, (_, index) => ({
        id: `login_log_${index + 1}`,
        userId: "internal_test_user",
        logType: index % 2 === 0 ? "账号中台登录相关日志" : "业务鉴权日志",
        actionName: index % 2 === 0 ? "账号中台登录相关日志成功" : "业务鉴权日志失败",
        logSource: index % 2 === 0 ? "WEB" : "ANDROID",
        method: index % 2 === 0 ? "/pass/kuaishou/login/sync" : "/pass/kshop/web/login/passToken",
        deviceId: index % 2 === 0 ? "web_internal_test_device" : "ANDROID_internal_test_device",
        ip: `10.0.0.${(index % 200) + 1}`,
        ua: `UA_INTERNAL_TEST_${index + 1}`,
        logContent: {
          params: {
            login_time: 1780000000000 + index * 1000,
            login_type: index % 2 === 0 ? "sync" : "token",
            login_source: index % 2 === 0 ? "web" : "android",
            login_device: index % 2 === 0 ? "web_internal_test_device" : "ANDROID_internal_test_device",
            ip: `10.0.0.${(index % 200) + 1}`,
            ua: `UA_INTERNAL_TEST_${index + 1}`,
            tokenType: "business_event_field",
            loginSessionEvent: "visible_business_event"
          }
        }
      }))
    }
  };
}

function assertNoOldBusinessFields(value) {
  const serialized = JSON.stringify(value);
  for (const field of OLD_BUSINESS_FIELDS) {
    assert.equal(Object.hasOwn(value, field), false, `${field} must not be top-level output`);
    assert.equal(serialized.includes(`"${field}"`), false, `${field} must not appear anywhere in output`);
  }
}

function assertNoCredentialMaterial(value) {
  const serialized = JSON.stringify(value);
  assert.equal(/transport_auth_marker|transport_cookie_marker|transport_session_marker/i.test(serialized), false);
  assert.equal(/"request_headers"\s*:|"headers"\s*:|"set-cookie"\s*:|"authorization"\s*:\s*"(Bearer|Basic)\s/i.test(serialized), false);
}

function readCapabilityIndexActionNames() {
  const yaml = fs.readFileSync(path.join(process.cwd(), "CAPABILITY_INDEX.yaml"), "utf8");
  const beforeAliases = yaml.split(/\ncommand_aliases:\n/u)[0];
  const actions = new Set();
  for (const line of beforeAliases.split(/\r?\n/u)) {
    const match = line.match(/^\s+-\s+([a-z][a-z0-9_]+)\s*$/u);
    if (match) {
      actions.add(match[1]);
    }
  }
  const actionCount = Number(yaml.match(/^action_count:\s*(\d+)\s*$/mu)?.[1]);
  return { actionCount, actions };
}

function assertTransportEnvelope(response, actionName) {
  assert.equal(response.action, actionName);
  assert.equal(response.action_name, actionName);
  assert.equal(response.request_mode, "fixed_action");
  assert.equal(response.response_mode, "passthrough");
  assert.equal(response.platform, ACTIONS[actionName].domainKey);
  assert.equal(typeof response.request_id, "string");
  assert.equal(response.request_id.startsWith("local_"), true);
  assert.equal(typeof response.http_status === "number" || response.http_status === null, true);
  assert.equal(typeof response.body_present, "boolean");
  assert.equal(typeof response.body_truncated, "boolean");
  assert.equal(typeof response.observed_bytes === "number" || response.observed_bytes === null, true);
  assert.equal(["visible", "capped", "json_array_capped", "omitted"].includes(response.raw_body_handling), true);
  assert.ok(response.upstream);
  assert.equal(response.upstream.raw_body_handling, response.raw_body_handling);
  assert.equal(typeof response.upstream.body_omitted, "boolean");
  if (response.body_present && !response.body_truncated && !response.upstream.body_omitted) {
    assert.equal(Object.hasOwn(response.upstream, "body"), true, `${actionName} must expose small upstream body`);
    assert.equal(response.upstream.raw_body_handling, "visible");
    assert.equal(typeof response.upstream.returned_bytes, "number");
  }
  if (response.body_present && response.body_truncated && !response.upstream.body_omitted) {
    assert.equal(
      Object.hasOwn(response.upstream, "body_snippet") || Object.hasOwn(response.upstream, "capped_body"),
      true,
      `${actionName} must expose capped upstream body`
    );
    assert.equal(["capped", "json_array_capped"].includes(response.upstream.raw_body_handling), true);
    assert.equal(response.upstream.response_too_large, true);
  }
  assert.ok(response.meta);
  assert.equal(response.meta.origin, ACTIONS[actionName].domainKey);
  assert.deepEqual(response.safety, {
    credential_material_output: false,
    request_headers_output: false,
    browser_profile_material_output: false,
    transport_auth_material_output: false,
    upstream_business_body_visible: Boolean(response.body_present && !response.upstream.body_omitted)
  });
  assertNoOldBusinessFields(response);
  assertNoCredentialMaterial(response);
}

test("origin registry and fixed action allowlist remain explicit", () => {
  assert.deepEqual(CORE_ORIGIN_KEYS, ["rcp", "weapon", "login_logs", "track_analysis"]);
  for (const key of CORE_ORIGIN_KEYS) {
    const origin = ORIGIN_REGISTRY[key];
    assert.equal(origin.name, key);
    assert.equal(origin.refreshTtlMs, DEFAULT_REFRESH_TTL_MS);
    assert.equal(origin.enabled, true);
  }
  assert.equal(Object.keys(ACTIONS).length, 74);
  assert.deepEqual(Object.keys(ACTIONS), ACTION_ALLOWLIST);
});

test("capability index maps every allowlisted action without inventing actions", () => {
  const { actionCount, actions } = readCapabilityIndexActionNames();
  assert.equal(actionCount, ACTION_ALLOWLIST.length);
  for (const actionName of actions) {
    assert.equal(ACTION_ALLOWLIST.includes(actionName), true, `${actionName} must be allowlisted`);
  }
  for (const actionName of ACTION_ALLOWLIST) {
    assert.equal(actions.has(actionName), true, `${actionName} must be covered by CAPABILITY_INDEX.yaml`);
  }
});

test("actions endpoint exposes passthrough-only contract for every action", () => {
  const response = createService().actions();
  assert.deepEqual(response.actions.map((action) => action.name), ACTION_ALLOWLIST);
  for (const action of response.actions) {
    assert.equal(["context_request", "page_followup"].includes(action.fetch_mode), true, `${action.name} has explicit fetch mode`);
    assert.equal(action.default_response_mode, "passthrough");
    assert.deepEqual(action.response_modes, ["passthrough"]);
    assert.equal(action.input_contract.response_mode, "optional enum passthrough; default passthrough");
    assert.equal(action.response_policy.upstream_business_body_returned, "bounded");
    assert.equal(action.response_policy.upstream_body_suppressed, false);
    assert.equal(action.response_policy.transport_status_only, false);
    assert.equal(action.response_policy.reads_cookie_token_session_header_plaintext, false);
    assertNoOldBusinessFields(action);
  }
});

test("fixed action fetch modes default to context request with page-session exceptions explicit", () => {
  const contextActions = ACTION_ALLOWLIST.filter((actionName) => ACTIONS[actionName].fetchMode === "context_request");
  const pageFollowupActions = ACTION_ALLOWLIST.filter((actionName) => ACTIONS[actionName].fetchMode === "page_followup");
  const unknownActions = ACTION_ALLOWLIST.filter((actionName) => !["context_request", "page_followup"].includes(ACTIONS[actionName].fetchMode));

  assert.deepEqual(pageFollowupActions, ["weapon_inventory", "login_logs_search"]);
  assert.equal(contextActions.length, ACTION_ALLOWLIST.length - 2);
  assert.deepEqual(unknownActions, []);
});

test("live body cap defaults to 5MB and remains env-overridable", () => {
  assert.equal(createLiveConfig().browser.maxLiveBodyBytes, 5 * 1024 * 1024);
  assert.equal(createLiveConfig({ MAX_LIVE_BODY_BYTES: "65536" }).browser.maxLiveBodyBytes, 65536);
});

test("mock actions return pure passthrough envelope with visible upstream body", async () => {
  const service = createService();
  for (const actionName of ACTION_ALLOWLIST) {
    const response = await service.executeAction(actionName, ACTION_INPUTS[actionName]);
    assert.equal(response.ok, true, actionName);
    assertTransportEnvelope(response, actionName);
    assert.equal(response.http_status, 200);
    assert.equal(response.body_present, true);
    assert.equal(response.upstream.status, 200);
    assert.equal(response.upstream.body_present, true);
    assert.equal(Object.hasOwn(response.upstream, "body"), true);
  }
});

test("explicit compat mode is rejected instead of producing legacy output", async () => {
  const service = createService();
  const response = await service.executeAction("login_logs_search", {
    ...ACTION_INPUTS.login_logs_search,
    response_mode: "compat_summary"
  });
  assert.equal(response.ok, false);
  assert.equal(response.error_type, "invalid_parameter");
  assert.equal(response.invalid_params, true);
  assertTransportEnvelope(response, "login_logs_search");
});

test("invalid typed params return parameter_error transport envelope", async () => {
  const response = await createService().executeAction("login_logs_search", {});
  assert.equal(response.ok, false);
  assert.equal(response.error_type, "parameter_error");
  assert.equal(response.invalid_params, true);
  assert.deepEqual(response.parameter_error.required, ["user_id"]);
  assertTransportEnvelope(response, "login_logs_search");
});

test("forbidden input keys are rejected before action execution", async () => {
  const service = createService();
  for (const key of ["url", "path", "header", "cookie", "token", "session", "authorization", "raw_body", "raw_query", "secret"]) {
    await assert.rejects(
      () => service.executeAction("login_logs_search", {
        ...ACTION_INPUTS.login_logs_search,
        [key]: "forbidden"
      }),
      (error) => error.code === "forbidden_action_input" && error.statusCode === 400
    );
  }
});

test("excluded noise actions are not in the allowlist", () => {
  for (const action of NOISE_ACTIONS) {
    assert.equal(Object.hasOwn(ACTIONS, action), false);
    assert.equal(ACTION_ALLOWLIST.includes(action), false);
  }
});

test("fixed request builders keep typed params on fixed paths", () => {
  const loginRequest = buildActionBody(ACTIONS.login_logs_search, ACTION_INPUTS.login_logs_search);
  assert.equal(loginRequest.method, "GET");
  assert.equal(loginRequest.path.startsWith("/rest/unified/log/search?"), true);
  assert.equal(loginRequest.path.includes("2871834924"), true);
  assert.equal(decodeURIComponent(loginRequest.displayPath).includes("[typed_user_id]"), true);
  assert.equal(loginRequest.responseBodyCap.pathLabel, "data.logSearchModels");
  assert.equal(loginRequest.responseBodyCap.maxRecords, 10);
  const defaultLoginInput = { ...ACTION_INPUTS.login_logs_search };
  delete defaultLoginInput.limit;
  const defaultLoginRequest = buildActionBody(ACTIONS.login_logs_search, defaultLoginInput);
  assert.equal(defaultLoginRequest.responseBodyCap.maxRecords, 300);

  const limitedLoginRequest = buildActionBody(ACTIONS.login_logs_search, {
    ...ACTION_INPUTS.login_logs_search,
    limit: 20
  });
  assert.equal(limitedLoginRequest.responseBodyCap.maxRecords, 20);

  const rcpRequest = buildActionBody(ACTIONS.rcp_snapshot, ACTION_INPUTS.rcp_snapshot);
  assert.equal(rcpRequest.method, "POST");
  assert.equal(rcpRequest.path, "/v2/rest/event/eventList");
  assert.equal(rcpRequest.body.eventV2.sourceIds, "mock_source_id");

  const weaponDeviceInfoRequest = buildActionBody(ACTIONS.weapon_device_info, ACTION_INPUTS.weapon_device_info);
  assert.equal(weaponDeviceInfoRequest.method, "GET");
  assert.equal(weaponDeviceInfoRequest.path.startsWith("/apiv2/riskData?"), true);
  assert.equal(weaponDeviceInfoRequest.path.includes("deviceIds=1504354E-BE57-727A-A8BD-3A1AEF1D35DF"), true);
  assert.equal(decodeURIComponent(weaponDeviceInfoRequest.displayPath).includes("[typed_device_id]"), true);

  const weaponDeviceAppListRequest = buildActionBody(ACTIONS.weapon_device_app_list, ACTION_INPUTS.weapon_device_app_list);
  assert.equal(weaponDeviceAppListRequest.method, "GET");
  assert.equal(weaponDeviceAppListRequest.path, "/api/dataReport/getDeviceAppList?deviceId=1504354E-BE57-727A-A8BD-3A1AEF1D35DF");

  const weaponDeviceLocationInfoRequest = buildActionBody(ACTIONS.weapon_device_location_info, ACTION_INPUTS.weapon_device_location_info);
  assert.equal(weaponDeviceLocationInfoRequest.method, "GET");
  assert.equal(weaponDeviceLocationInfoRequest.path.startsWith("/api/dataReport/getLocationInfo?"), true);
  assert.equal(weaponDeviceLocationInfoRequest.path.includes("deviceId=1504354E-BE57-727A-A8BD-3A1AEF1D35DF"), true);
  assert.equal(weaponDeviceLocationInfoRequest.path.includes("userId=4559196013"), true);

  const weaponUserKlinkStatusRequest = buildActionBody(ACTIONS.weapon_user_klink_status, ACTION_INPUTS.weapon_user_klink_status);
  assert.equal(weaponUserKlinkStatusRequest.method, "GET");
  assert.equal(weaponUserKlinkStatusRequest.path, "/api/dataReport/getKlinkStatusByUsers?userId=4559196013");

  const recoveredRequest = buildActionBody(ACTIONS.rcp_node_bind_policy_attribution, ACTION_INPUTS.rcp_node_bind_policy_attribution);
  assert.equal(recoveredRequest.method, "GET");
  assert.equal(recoveredRequest.path.startsWith("/v2/rest/pc/policy/nodeBindPolicyAttribution?"), true);

  const photoProfileRequest = buildActionBody(ACTIONS.archives_photo_profile, ACTION_INPUTS.archives_photo_profile);
  assert.equal(photoProfileRequest.method, "POST");
  assert.equal(photoProfileRequest.path, "/v3/photo/profile");
  assert.deepEqual(photoProfileRequest.body, { photoId: "197323059879" });

  const photoMetaRequest = buildActionBody(ACTIONS.archives_photo_meta, ACTION_INPUTS.archives_photo_meta);
  assert.equal(photoMetaRequest.path, "/v3/photo/meta");
  assert.deepEqual(photoMetaRequest.body, { photoId: "197323059879" });

  const rcpTreeDecisionRequest = buildActionBody(ACTIONS.rcp_event_tree_or_decision, ACTION_INPUTS.rcp_event_tree_or_decision);
  assert.equal(rcpTreeDecisionRequest.method, "GET");
  assert.equal(rcpTreeDecisionRequest.path.startsWith("/v2/rest/event/rcpEventTreeOrDecision?"), true);

  const rcpDetailRequest = buildActionBody(ACTIONS.rcp_event_detail, ACTION_INPUTS.rcp_event_detail);
  assert.equal(rcpDetailRequest.method, "GET");
  assert.equal(rcpDetailRequest.path.startsWith("/v2/rest/event/rcpEventDetail?"), true);
  assert.equal(rcpDetailRequest.requestTimeoutMs, 30000);

  const rcpFeatureRequest = buildActionBody(ACTIONS.rcp_event_feature_list, ACTION_INPUTS.rcp_event_feature_list);
  assert.equal(rcpFeatureRequest.method, "GET");
  assert.equal(rcpFeatureRequest.path.startsWith("/v2/rest/event/rcpEventFeatureList?"), true);
  assert.equal(rcpFeatureRequest.requestTimeoutMs, null);

  const trackProductRequest = buildActionBody(ACTIONS.track_analysis_product_list, ACTION_INPUTS.track_analysis_product_list);
  assert.equal(trackProductRequest.method, "POST");
  assert.equal(trackProductRequest.path.startsWith("/dp/track-analysis/product/list/v2?"), true);
});

test("live response builder exposes small JSON upstream body and reports response size", () => {
  const bodyText = JSON.stringify({ data: { rows: [{ id: 1 }] } });
  const response = buildLiveActionResponse(ACTIONS.archives_user_profile, ACTION_INPUTS.archives_user_profile, {}, {
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText,
    observedBytes: Buffer.byteLength(bodyText),
    bodyTruncated: false
  }, { latencyMs: 12 });
  assert.equal(response.ok, true);
  assert.equal(response.body_present, true);
  assert.equal(response.observed_bytes, Buffer.byteLength(bodyText));
  assert.equal(response.upstream.body_present, true);
  assert.deepEqual(response.upstream.body, { data: { rows: [{ id: 1 }] } });
  assert.equal(response.upstream.returned_bytes, Buffer.byteLength(bodyText));
  assert.equal(response.raw_body_handling, "visible");
  assertTransportEnvelope(response, "archives_user_profile");
});

test("live response builder exposes small text upstream body", () => {
  const bodyText = "plain upstream business response";
  const response = buildLiveActionResponse(ACTIONS.archives_user_profile, ACTION_INPUTS.archives_user_profile, {}, {
    ok: true,
    status: 200,
    contentType: "text/plain",
    bodyText,
    observedBytes: Buffer.byteLength(bodyText),
    bodyTruncated: false
  }, { latencyMs: 10 });
  assert.equal(response.ok, true);
  assert.equal(response.upstream.body, bodyText);
  assert.equal(response.upstream.returned_bytes, Buffer.byteLength(bodyText));
  assert.equal(response.raw_body_handling, "visible");
  assertTransportEnvelope(response, "archives_user_profile");
});

test("context request actions do not use page-context fetch", async () => {
  const config = createLiveConfig();
  const calledActions = [];
  const fakeBrowserClient = {
    actionDiagnostics: (action) => ({
      action_name: action.name,
      expected_origin: config.domains[action.domainKey].origin,
      bound_page_origin: config.domains[action.domainKey].origin,
      origin_warmed: true,
      page_ready: true,
      origin_match: true
    }),
    runAction: async () => {
      throw new Error("page fetch should not be used for context_request actions");
    },
    runActionWithContextRequest: async (action, actionRequest) => {
      calledActions.push(action.name);
      assert.equal(action.fetchMode, "context_request");
      assert.equal(typeof actionRequest.path, "string");
      const bodyText = JSON.stringify({ code: 0, data: { action: action.name } });
      return {
        ok: true,
        status: 200,
        contentType: "application/json;charset=UTF-8",
        bodyText,
        observedBytes: Buffer.byteLength(bodyText),
        bodyTruncated: false
      };
    }
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  markAllOriginsReady(service, config);

  for (const actionName of ACTION_ALLOWLIST.filter((name) => ACTIONS[name].fetchMode === "context_request")) {
    const response = await service.executeAction(actionName, ACTION_INPUTS[actionName]);
    assert.equal(response.ok, true, actionName);
    assert.equal(response.upstream.body.data.action, actionName);
    assertTransportEnvelope(response, actionName);
  }
  assert.deepEqual(calledActions, ACTION_ALLOWLIST.filter((name) => ACTIONS[name].fetchMode === "context_request"));
});

test("rcp_event_detail forwards action-specific request timeout to context request", async () => {
  const config = createLiveConfig();
  let seenTimeoutMs = null;
  const fakeBrowserClient = {
    actionDiagnostics: () => ({
      action_name: "rcp_event_detail",
      expected_origin: config.domains.rcp.origin,
      bound_page_origin: config.domains.rcp.origin,
      origin_warmed: true,
      page_ready: true,
      origin_match: true
    }),
    runAction: async () => {
      throw new Error("page fetch should not be used for rcp_event_detail");
    },
    runActionWithContextRequest: async (action, actionRequest) => {
      assert.equal(action.name, "rcp_event_detail");
      seenTimeoutMs = actionRequest.requestTimeoutMs;
      const bodyText = JSON.stringify({ code: 0, data: { action: action.name } });
      return {
        ok: true,
        status: 200,
        contentType: "application/json;charset=UTF-8",
        bodyText,
        observedBytes: Buffer.byteLength(bodyText),
        bodyTruncated: false
      };
    }
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  markOriginReady(service, config, "rcp");

  const response = await service.executeAction("rcp_event_detail", ACTION_INPUTS.rcp_event_detail);
  assert.equal(seenTimeoutMs, 30000);
  assert.equal(response.ok, true);
  assertTransportEnvelope(response, "rcp_event_detail");
});

test("weapon_inventory uses page follow-up fetch and does not call context request", async () => {
  const config = createLiveConfig();
  let pageFetchCalled = false;
  const bodyText = JSON.stringify({ code: 0, data: { action: "weapon_inventory" } });
  const fakeBrowserClient = {
    actionDiagnostics: () => ({
      action_name: "weapon_inventory",
      expected_origin: config.domains.weapon.origin,
      bound_page_origin: config.domains.weapon.origin,
      origin_warmed: true,
      page_ready: true,
      origin_match: true
    }),
    runAction: async (action, actionRequest) => {
      pageFetchCalled = true;
      assert.equal(action.name, "weapon_inventory");
      assert.equal(action.fetchMode, "page_followup");
      assert.equal(actionRequest.followUp.type, "weapon_graph_risk");
      return {
        ok: true,
        status: 200,
        contentType: "application/json;charset=UTF-8",
        bodyText,
        observedBytes: Buffer.byteLength(bodyText),
        returnedBytes: Buffer.byteLength(bodyText),
        bodyTruncated: false
      };
    },
    runActionWithContextRequest: async () => {
      throw new Error("context request should not be used for weapon_inventory follow-up chain");
    }
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  markOriginReady(service, config, "weapon");

  const response = await service.executeAction("weapon_inventory", ACTION_INPUTS.weapon_inventory);
  assert.equal(pageFetchCalled, true);
  assert.equal(response.ok, true);
  assert.equal(response.upstream.body.data.action, "weapon_inventory");
  assertTransportEnvelope(response, "weapon_inventory");
});

test("login_logs_search page-session API timeout reports api fetch stage", async () => {
  const config = createLiveConfig();
  fs.mkdirSync(config.profileDir, { recursive: true });
  const fakeBrowserClient = {
    prewarmDomain: async (domainKey) => {
      assert.equal(domainKey, "login_logs");
      return {
        key: domainKey,
        status: "ready",
        page_ready: true,
        final_origin: config.domains.login_logs.origin,
        current_origin: config.domains.login_logs.origin,
        same_origin_actual: true,
        error_type: null
      };
    },
    actionDiagnostics: () => ({
      action_name: "login_logs_search",
      expected_origin: config.domains.login_logs.origin,
      bound_page_origin: config.domains.login_logs.origin,
      origin_warmed: true,
      page_ready: true,
      origin_match: true
    }),
    runAction: async () => {
      throw new Error("Request timed out after 30000ms");
    },
    runActionWithContextRequest: async () => {
      throw new Error("context request should not be used for login_logs_search");
    }
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  markAllOriginsReady(service, config);

  const response = await service.executeAction("login_logs_search", ACTION_INPUTS.login_logs_search);
  assert.equal(response.ok, false);
  assert.equal(response.error_type, "navigation_timeout");
  assert.equal(response.timeout, true);
  assert.equal(response.timeout_stage, "api_fetch_timeout");
  assert.equal(response.upstream.timeout_stage, "api_fetch_timeout");
  assertTransportEnvelope(response, "login_logs_search");
});

test("context request action returns API contract mismatch when the fixed API returns HTML shell", async () => {
  const config = createLiveConfig();
  const html = "<!doctype html><html><head><title>Archives</title></head><body>app shell</body></html>";
  let contextRequestCalled = false;
  const fakeBrowserClient = {
    actionDiagnostics: () => ({
      action_name: "archives_user_profile",
      expected_origin: config.domains.archives.origin,
      bound_page_origin: config.domains.archives.origin,
      origin_warmed: true,
      page_ready: true,
      origin_match: true
    }),
    runAction: async () => {
      throw new Error("page fetch should not be used for archives_user_profile");
    },
    runActionWithContextRequest: async (action, actionRequest) => {
      contextRequestCalled = true;
      assert.equal(action.name, "archives_user_profile");
      assert.equal(actionRequest.method, "GET");
      assert.equal(actionRequest.path.startsWith("/archives/user/home/info?"), true);
      return {
        ok: true,
        status: 200,
        contentType: "text/html;charset=UTF-8",
        bodyText: html,
        observedBytes: Buffer.byteLength(html),
        returnedBytes: Buffer.byteLength(html),
        bodyTruncated: false
      };
    }
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  markOriginReady(service, config, "archives");

  const response = await service.executeAction("archives_user_profile", ACTION_INPUTS.archives_user_profile);
  assert.equal(contextRequestCalled, true);
  assert.equal(response.ok, false);
  assert.equal(response.error_type, "unexpected_html_response");
  assert.equal(response.platform_error, "api_contract_mismatch");
  assert.equal(response.upstream.response_body_kind, "html_page");
  assert.equal(response.safety.credential_material_output, false);
  assertTransportEnvelope(response, "archives_user_profile");
});

test("auth freshness guard rewarms stale ready origin before action fetch", async () => {
  const config = createLiveConfig();
  fs.mkdirSync(config.profileDir, { recursive: true });
  let prewarmCalls = 0;
  let pageFetchCalled = false;
  const bodyText = JSON.stringify({ code: 0, data: { logSearchModels: [] } });
  const readyState = {
    warmed: true,
    page_ready: true,
    status: "ready",
    error_type: null,
    final_origin: config.domains.login_logs.origin,
    current_origin: config.domains.login_logs.origin,
    same_origin_actual: true
  };
  const fakeBrowserClient = {
    prewarmDomain: async (domainKey) => {
      prewarmCalls += 1;
      assert.equal(domainKey, "login_logs");
      return {
        key: domainKey,
        status: "ready",
        page_ready: true,
        final_origin: config.domains.login_logs.origin,
        current_origin: config.domains.login_logs.origin,
        same_origin_actual: true,
        error_type: null
      };
    },
    actionDiagnostics: () => ({
      action_name: "login_logs_search",
      expected_origin: config.domains.login_logs.origin,
      bound_page_origin: config.domains.login_logs.origin,
      origin_warmed: true,
      page_ready: true,
      origin_match: true
    }),
    runAction: async () => {
      pageFetchCalled = true;
      return {
        ok: true,
        status: 200,
        contentType: "application/json;charset=UTF-8",
        bodyText,
        observedBytes: Buffer.byteLength(bodyText),
        returnedBytes: Buffer.byteLength(bodyText),
        bodyTruncated: false
      };
    },
    runActionWithContextRequest: async () => {
      throw new Error("context request should not be used for login_logs_search");
    }
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  service.warmState.set("login_logs", readyState);
  service.refreshState = updateOriginWarmState({}, config.domains.login_logs, readyState, {
    now: new Date(Date.now() - DEFAULT_REFRESH_TTL_MS - 1000)
  });

  const response = await service.executeAction("login_logs_search", ACTION_INPUTS.login_logs_search);
  assert.equal(prewarmCalls, 1);
  assert.equal(pageFetchCalled, true);
  assert.equal(response.ok, true);
  assert.equal(response.meta.freshness_rewarm_attempted, true);
  assert.equal(response.meta.freshness_rewarm_status, "ready");
  assert.equal(response.meta.origin_ready_state_stale, false);
  assertTransportEnvelope(response, "login_logs_search");
});

test("login_logs_search rewarms fresh page session before API fetch", async () => {
  const config = createLiveConfig();
  fs.mkdirSync(config.profileDir, { recursive: true });
  let prewarmCalls = 0;
  let pageFetchCalled = false;
  const bodyText = JSON.stringify({ code: 0, data: { logSearchModels: [] } });
  const readyState = {
    warmed: true,
    page_ready: true,
    status: "ready",
    error_type: null,
    final_origin: config.domains.login_logs.origin,
    current_origin: config.domains.login_logs.origin,
    same_origin_actual: true
  };
  const fakeBrowserClient = {
    prewarmDomain: async (domainKey) => {
      prewarmCalls += 1;
      assert.equal(domainKey, "login_logs");
      return {
        key: domainKey,
        status: "ready",
        page_ready: true,
        final_origin: config.domains.login_logs.origin,
        current_origin: config.domains.login_logs.origin,
        same_origin_actual: true,
        error_type: null
      };
    },
    actionDiagnostics: () => ({
      action_name: "login_logs_search",
      expected_origin: config.domains.login_logs.origin,
      bound_page_origin: config.domains.login_logs.origin,
      origin_warmed: true,
      page_ready: true,
      origin_match: true
    }),
    runAction: async () => {
      pageFetchCalled = true;
      return {
        ok: true,
        status: 200,
        contentType: "application/json;charset=UTF-8",
        bodyText,
        observedBytes: Buffer.byteLength(bodyText),
        returnedBytes: Buffer.byteLength(bodyText),
        bodyTruncated: false
      };
    },
    runActionWithContextRequest: async () => {
      throw new Error("context request should not be used for login_logs_search");
    }
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  markAllOriginsReady(service, config);
  service.warmState.set("login_logs", readyState);

  const response = await service.executeAction("login_logs_search", ACTION_INPUTS.login_logs_search);
  assert.equal(prewarmCalls, 1);
  assert.equal(pageFetchCalled, true);
  assert.equal(response.ok, true);
  assert.equal(response.meta.freshness_rewarm_attempted, true);
  assert.equal(response.meta.freshness_rewarm_status, "ready");
  assertTransportEnvelope(response, "login_logs_search");
});

test("login_logs_search retries once after stale HTML page shell", async () => {
  const config = createLiveConfig();
  fs.mkdirSync(config.profileDir, { recursive: true });
  let prewarmCalls = 0;
  let pageFetchCalls = 0;
  const html = "<!doctype html><html><body>workbench shell</body></html>";
  const bodyText = JSON.stringify({ code: 0, data: { logSearchModels: [{ loginTime: "2026-06-01 17:27:27" }] } });
  const readyState = {
    warmed: true,
    page_ready: true,
    status: "ready",
    error_type: null,
    final_origin: config.domains.login_logs.origin,
    current_origin: config.domains.login_logs.origin,
    same_origin_actual: true
  };
  const fakeBrowserClient = {
    prewarmDomain: async (domainKey) => {
      prewarmCalls += 1;
      assert.equal(domainKey, "login_logs");
      return {
        key: domainKey,
        status: "ready",
        page_ready: true,
        final_origin: config.domains.login_logs.origin,
        current_origin: config.domains.login_logs.origin,
        same_origin_actual: true,
        error_type: null
      };
    },
    actionDiagnostics: () => ({
      action_name: "login_logs_search",
      expected_origin: config.domains.login_logs.origin,
      bound_page_origin: config.domains.login_logs.origin,
      origin_warmed: true,
      page_ready: true,
      origin_match: true
    }),
    runAction: async () => {
      pageFetchCalls += 1;
      if (pageFetchCalls === 1) {
        return {
          ok: true,
          status: 200,
          contentType: "text/html;charset=UTF-8",
          bodyText: html,
          observedBytes: Buffer.byteLength(html),
          returnedBytes: Buffer.byteLength(html),
          bodyTruncated: false
        };
      }
      return {
        ok: true,
        status: 200,
        contentType: "application/json;charset=UTF-8",
        bodyText,
        observedBytes: Buffer.byteLength(bodyText),
        returnedBytes: Buffer.byteLength(bodyText),
        bodyTruncated: false
      };
    },
    runActionWithContextRequest: async () => {
      throw new Error("context request should not be used for login_logs_search");
    }
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  markAllOriginsReady(service, config);
  service.warmState.set("login_logs", readyState);

  const response = await service.executeAction("login_logs_search", ACTION_INPUTS.login_logs_search);
  assert.equal(prewarmCalls, 2);
  assert.equal(pageFetchCalls, 2);
  assert.equal(response.ok, true);
  assert.equal(response.meta.page_context_retry_attempted, true);
  assert.equal(response.meta.page_context_retry_reason, "unexpected_html_response");
  assert.equal(response.meta.page_context_retry_status, "ready");
  assert.equal(response.raw_body_handling, "visible");
  assert.equal(response.upstream.body.data.logSearchModels.length, 1);
  assertTransportEnvelope(response, "login_logs_search");
});

test("login_logs_search reports stale page context when retry still returns HTML", async () => {
  const config = createLiveConfig();
  fs.mkdirSync(config.profileDir, { recursive: true });
  let prewarmCalls = 0;
  let pageFetchCalls = 0;
  const html = "<!doctype html><html><body>workbench shell</body></html>";
  const readyState = {
    warmed: true,
    page_ready: true,
    status: "ready",
    error_type: null,
    final_origin: config.domains.login_logs.origin,
    current_origin: config.domains.login_logs.origin,
    same_origin_actual: true
  };
  const fakeBrowserClient = {
    prewarmDomain: async (domainKey) => {
      prewarmCalls += 1;
      assert.equal(domainKey, "login_logs");
      return {
        key: domainKey,
        status: "ready",
        page_ready: true,
        final_origin: config.domains.login_logs.origin,
        current_origin: config.domains.login_logs.origin,
        same_origin_actual: true,
        error_type: null
      };
    },
    actionDiagnostics: () => ({
      action_name: "login_logs_search",
      expected_origin: config.domains.login_logs.origin,
      bound_page_origin: config.domains.login_logs.origin,
      origin_warmed: true,
      page_ready: true,
      origin_match: true
    }),
    runAction: async () => {
      pageFetchCalls += 1;
      return {
        ok: true,
        status: 200,
        contentType: "text/html;charset=UTF-8",
        bodyText: html,
        observedBytes: Buffer.byteLength(html),
        returnedBytes: Buffer.byteLength(html),
        bodyTruncated: false
      };
    },
    runActionWithContextRequest: async () => {
      throw new Error("context request should not be used for login_logs_search");
    }
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  service.warmState.set("login_logs", readyState);
  service.refreshState = updateOriginWarmState({}, config.domains.login_logs, readyState);

  const response = await service.executeAction("login_logs_search", ACTION_INPUTS.login_logs_search);
  assert.equal(prewarmCalls, 2);
  assert.equal(pageFetchCalls, 2);
  assert.equal(response.ok, false);
  assert.equal(response.error_type, "login_logs_page_context_stale");
  assert.equal(response.safe_reason, "html_response_not_business_json");
  assert.equal(response.meta.page_context_retry_attempted, true);
  assert.equal(response.meta.page_context_retry_reason, "unexpected_html_response");
  assert.equal(response.meta.page_context_retry_status, "ready");
  assert.equal(response.upstream.login_logs_page_context_stale, true);
  assert.equal(Object.hasOwn(response.upstream, "body"), false);
  assertTransportEnvelope(response, "login_logs_search");
});

test("auth freshness guard blocks action when rewarm requires manual login", async () => {
  const config = createLiveConfig();
  fs.mkdirSync(config.profileDir, { recursive: true });
  let contextRequestCalled = false;
  const readyState = {
    warmed: true,
    page_ready: true,
    status: "ready",
    error_type: null,
    final_origin: config.domains.login_logs.origin,
    current_origin: config.domains.login_logs.origin,
    same_origin_actual: true
  };
  const fakeBrowserClient = {
    prewarmDomain: async (domainKey) => ({
      key: domainKey,
      status: "auth_required",
      page_ready: false,
      final_origin: config.domains.login_logs.origin,
      current_origin: config.domains.login_logs.origin,
      same_origin_actual: true,
      error_type: "manual_login_required"
    }),
    actionDiagnostics: () => ({
      action_name: "login_logs_search",
      expected_origin: config.domains.login_logs.origin,
      bound_page_origin: config.domains.login_logs.origin,
      origin_warmed: false,
      page_ready: false,
      origin_match: true
    }),
    runActionWithContextRequest: async () => {
      contextRequestCalled = true;
      return {};
    }
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  service.warmState.set("login_logs", readyState);
  service.refreshState = updateOriginWarmState({}, config.domains.login_logs, readyState, {
    now: new Date(Date.now() - DEFAULT_REFRESH_TTL_MS - 1000)
  });

  const response = await service.executeAction("login_logs_search", ACTION_INPUTS.login_logs_search);
  assert.equal(contextRequestCalled, false);
  assert.equal(response.ok, false);
  assert.equal(response.error_type, "manual_login_required");
  assert.equal(response.meta.freshness_rewarm_attempted, true);
  assert.equal(response.meta.freshness_rewarm_status, "manual_login_required");
  assert.equal(response.safe_reason, "origin_ready_state_stale");
  assert.equal(response.next_step, "npm run worker:start");
  assert.equal(response.meta.next_step, "npm run worker:start");
  assertTransportEnvelope(response, "login_logs_search");
});

test("login_logs_search treats HTML page shell as API contract mismatch", () => {
  const html = "<!doctype html><html><head><title>Workbench</title></head><body>app shell</body></html>";
  const response = buildLiveActionResponse(ACTIONS.login_logs_search, ACTION_INPUTS.login_logs_search, {}, {
    ok: true,
    status: 200,
    contentType: "text/html;charset=UTF-8",
    bodyText: html.slice(0, 64),
    observedBytes: Buffer.byteLength(html),
    returnedBytes: 64,
    bodyTruncated: true
  }, { latencyMs: 8 });

  assert.equal(response.ok, false);
  assert.equal(response.error_type, "unexpected_html_response");
  assert.equal(response.platform_error, "api_contract_mismatch");
  assert.equal(response.safe_reason, "html_response_not_business_json");
  assert.equal(response.raw_body_handling, "omitted");
  assert.equal(response.upstream.body_present, true);
  assert.equal(response.upstream.body_omitted, true);
  assert.equal(response.upstream.response_too_large, false);
  assert.equal(response.upstream.api_contract_mismatch, true);
  assert.equal(response.upstream.response_body_kind, "html_page");
  assert.equal(response.upstream.safe_reason, "html_response_not_business_json");
  assert.equal(Object.hasOwn(response.upstream, "body"), false);
  assert.equal(Object.hasOwn(response.upstream, "body_snippet"), false);
  assert.equal(Object.hasOwn(response.upstream, "capped_body"), false);
  assert.equal(response.safety.upstream_business_body_visible, false);
  assertTransportEnvelope(response, "login_logs_search");
});

test("expected JSON action maps stale HTML shell to auth session freshness error", () => {
  const html = "<!doctype html><html><head><title>Workbench</title></head><body>app shell</body></html>";
  const response = buildLiveActionResponse(ACTIONS.login_logs_search, ACTION_INPUTS.login_logs_search, {}, {
    ok: true,
    status: 200,
    contentType: "text/html;charset=UTF-8",
    bodyText: html,
    observedBytes: Buffer.byteLength(html),
    returnedBytes: Buffer.byteLength(html),
    bodyTruncated: false
  }, {
    latencyMs: 8,
    auth_state_expired: true,
    origin_ready_state_stale: true,
    freshness_rewarm_attempted: true,
    freshness_rewarm_status: "origin_refresh_failed"
  });

  assert.equal(response.ok, false);
  assert.equal(response.error_type, "auth_state_expired_or_api_session_not_ready");
  assert.equal(response.platform_error, "api_session_not_ready");
  assert.equal(response.safe_reason, "auth_state_expired_or_api_session_not_ready");
  assert.equal(response.upstream.safe_reason, "auth_state_expired_or_api_session_not_ready");
  assert.equal(response.upstream.body_omitted, true);
  assertTransportEnvelope(response, "login_logs_search");
});

test("JSON fixed action response builder treats HTML page shell as API contract mismatch", () => {
  const html = "<!doctype html><html><head><title>Archives</title></head><body>app shell</body></html>";
  const response = buildLiveActionResponse(ACTIONS.archives_user_profile, ACTION_INPUTS.archives_user_profile, {}, {
    ok: true,
    status: 200,
    contentType: "text/html;charset=UTF-8",
    bodyText: html,
    observedBytes: Buffer.byteLength(html),
    returnedBytes: Buffer.byteLength(html),
    bodyTruncated: false
  }, { latencyMs: 8 });

  assert.equal(response.ok, false);
  assert.equal(response.error_type, "unexpected_html_response");
  assert.equal(response.platform_error, "api_contract_mismatch");
  assert.equal(response.raw_body_handling, "omitted");
  assert.equal(response.upstream.body_present, true);
  assert.equal(response.upstream.body_omitted, true);
  assert.equal(response.upstream.response_body_kind, "html_page");
  assert.equal(Object.hasOwn(response.upstream, "body"), false);
  assertTransportEnvelope(response, "archives_user_profile");
});

test("response too large returns capped passthrough body without summary fallback", () => {
  const response = buildLiveActionResponse(ACTIONS.rcp_event_feature_list, ACTION_INPUTS.rcp_event_feature_list, {}, {
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText: "{\"data\":[",
    observedBytes: 1024 * 1024,
    bodyTruncated: true
  }, { latencyMs: 20 });
  assert.equal(response.ok, false);
  assert.equal(response.error_type, "response_too_large");
  assert.equal(response.body_truncated, true);
  assert.equal(response.upstream.response_too_large, true);
  assert.equal(response.upstream.body_omitted, false);
  assert.equal(response.upstream.body_snippet, "{\"data\":[");
  assert.equal(response.raw_body_handling, "capped");
  assertTransportEnvelope(response, "rcp_event_feature_list");
});

test("login_logs_search large JSON returns structured row-capped passthrough body", () => {
  const input = { ...ACTION_INPUTS.login_logs_search };
  delete input.limit;
  const body = buildLargeLoginLogsBody(334);
  const cappedBody = {
    ...body,
    data: {
      ...body.data,
      logSearchModels: body.data.logSearchModels.slice(0, 300)
    }
  };
  const cappedText = JSON.stringify(cappedBody);
  const response = buildLiveActionResponse(ACTIONS.login_logs_search, input, {}, {
    ok: true,
    status: 200,
    contentType: "application/json;charset=UTF-8",
    bodyText: cappedText,
    bodyTruncated: true,
    observedBytes: Buffer.byteLength(JSON.stringify(body)),
    returnedBytes: Buffer.byteLength(cappedText),
    jsonArrayCap: {
      attempted: true,
      ok: true,
      path: "data.logSearchModels",
      observedRecords: 334,
      returnedRecords: 300,
      missingRecords: 34,
      maxRecords: 300,
      capReason: "record_limit"
    }
  }, { latencyMs: 12 });

  assert.equal(response.ok, false);
  assert.equal(response.error_type, "response_too_large");
  assert.equal(response.raw_body_handling, "json_array_capped");
  assert.equal(response.upstream.raw_body_handling, "json_array_capped");
  assert.equal(response.upstream.capped_json_path, "data.logSearchModels");
  assert.equal(response.upstream.observed_records, 334);
  assert.equal(response.upstream.returned_records, 300);
  assert.equal(response.upstream.missing_records, 34);
  assert.equal(response.upstream.missing_body_reason, "response_too_large");
  assert.equal(response.upstream.cap_reason, "record_limit");
  assert.equal(response.cap_reason, "record_limit");
  assert.equal(response.upstream.capped_body.data.logSearchModels.length, 300);
  assert.equal(response.upstream.capped_body.data.logSearchModels[0].logContent.params.login_time, 1780000000000);
  assert.equal(Object.hasOwn(response.upstream, "body_snippet"), false);
  assertTransportEnvelope(response, "login_logs_search");
});

test("login_logs_search max_records controls structured row cap", () => {
  const input = { ...ACTION_INPUTS.login_logs_search, max_records: 20 };
  const body = buildLargeLoginLogsBody(334);
  const cappedBody = {
    ...body,
    data: {
      ...body.data,
      logSearchModels: body.data.logSearchModels.slice(0, 20)
    }
  };
  const response = buildLiveActionResponse(ACTIONS.login_logs_search, input, {}, {
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText: JSON.stringify(cappedBody),
    bodyTruncated: true,
    observedBytes: Buffer.byteLength(JSON.stringify(body)),
    returnedBytes: Buffer.byteLength(JSON.stringify(cappedBody)),
    jsonArrayCap: {
      attempted: true,
      ok: true,
      path: "data.logSearchModels",
      observedRecords: 334,
      returnedRecords: 20,
      missingRecords: 314,
      maxRecords: 20,
      capReason: "record_limit"
    }
  });
  assert.equal(response.upstream.returned_records, 20);
  assert.equal(response.upstream.missing_records, 314);
  assert.equal(response.upstream.cap_reason, "record_limit");
  assert.equal(response.upstream.capped_body.data.logSearchModels.length, 20);
  assertTransportEnvelope(response, "login_logs_search");
});

test("login_logs_search byte cap reports partial structured row cap", () => {
  const input = { ...ACTION_INPUTS.login_logs_search };
  delete input.limit;
  const body = buildLargeLoginLogsBody(334);
  const cappedBody = {
    ...body,
    data: {
      ...body.data,
      logSearchModels: body.data.logSearchModels.slice(0, 12)
    }
  };
  const response = buildLiveActionResponse(ACTIONS.login_logs_search, input, {}, {
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText: JSON.stringify(cappedBody),
    bodyTruncated: true,
    observedBytes: Buffer.byteLength(JSON.stringify(body)),
    returnedBytes: Buffer.byteLength(JSON.stringify(cappedBody)),
    jsonArrayCap: {
      attempted: true,
      ok: true,
      path: "data.logSearchModels",
      observedRecords: 334,
      returnedRecords: 12,
      missingRecords: 322,
      maxRecords: 300,
      capReason: "byte_limit"
    }
  });
  assert.equal(response.upstream.returned_records, 12);
  assert.equal(response.upstream.missing_records, 322);
  assert.equal(response.upstream.cap_reason, "byte_limit");
  assert.equal(response.upstream.capped_body.data.logSearchModels.length, 12);
  assertTransportEnvelope(response, "login_logs_search");
});

test("login_logs_search invalid max_records is rejected", async () => {
  const response = await createService().executeAction("login_logs_search", {
    ...ACTION_INPUTS.login_logs_search,
    max_records: 301
  });
  assert.equal(response.ok, false);
  assert.equal(response.error_type, "invalid_parameter");
  assert.equal(response.invalid_params, true);
  assertTransportEnvelope(response, "login_logs_search");
});

test("login_logs_search JSON cap parse failure falls back to capped snippet", () => {
  const response = buildLiveActionResponse(ACTIONS.login_logs_search, ACTION_INPUTS.login_logs_search, {}, {
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText: "{\"data\":{\"logSearchModels\":[",
    bodyTruncated: true,
    observedBytes: 999999,
    returnedBytes: 27,
    jsonArrayCap: {
      attempted: true,
      ok: false,
      path: "data.logSearchModels",
      errorType: "json_parse_error"
    }
  });
  assert.equal(response.raw_body_handling, "capped");
  assert.equal(response.upstream.body_snippet, "{\"data\":{\"logSearchModels\":[");
  assert.equal(response.upstream.json_array_cap_error_type, "json_parse_error");
  assertTransportEnvelope(response, "login_logs_search");
});

test("large text response returns body snippet instead of metadata only", () => {
  const bodyText = "large text prefix";
  const response = buildLiveActionResponse(ACTIONS.archives_user_analysis, ACTION_INPUTS.archives_user_analysis, {}, {
    ok: true,
    status: 200,
    contentType: "text/plain",
    bodyText,
    observedBytes: 1024 * 1024,
    bodyTruncated: true
  }, { latencyMs: 18 });
  assert.equal(response.ok, false);
  assert.equal(response.error_type, "response_too_large");
  assert.equal(response.upstream.body_snippet, bodyText);
  assert.equal(response.upstream.body_omitted, false);
  assert.equal(response.upstream.returned_bytes, Buffer.byteLength(bodyText));
  assertTransportEnvelope(response, "archives_user_analysis");
});

test("business token session login auth fields in upstream body remain visible", () => {
  const bodyText = JSON.stringify({
    data: {
      refreshToken: true,
      tokenType: "device_event_type",
      loginSessionEvent: "login_session_event",
      authEvent: "account_auth_event"
    }
  });
  const response = buildLiveActionResponse(ACTIONS.archives_user_profile, ACTION_INPUTS.archives_user_profile, {}, {
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText,
    observedBytes: Buffer.byteLength(bodyText),
    bodyTruncated: false
  }, { latencyMs: 8 });
  assert.equal(response.ok, true);
  assert.deepEqual(response.upstream.body.data, {
    refreshToken: true,
    tokenType: "device_event_type",
    loginSessionEvent: "login_session_event",
    authEvent: "account_auth_event"
  });
  assert.equal(response.safety.credential_material_output, false);
  assertTransportEnvelope(response, "archives_user_profile");
});

test("passthrough response does not expose request or transport auth headers", () => {
  const bodyText = JSON.stringify({ data: { tokenType: "business", login_time: 1780000000000 } });
  const blockedTransportHeaders = Object.fromEntries([
    ["set-cookie", "blocked_test_value"],
    ["authorization", "blocked_test_value"]
  ]);
  const response = buildLiveActionResponse(ACTIONS.login_logs_search, ACTION_INPUTS.login_logs_search, {}, {
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText,
    observedBytes: Buffer.byteLength(bodyText),
    bodyTruncated: false,
    headers: blockedTransportHeaders
  }, { latencyMs: 7 });
  assert.equal(response.ok, true);
  assert.equal(Object.hasOwn(response.upstream, "headers"), false);
  assert.equal(Object.hasOwn(response, "request_headers"), false);
  assert.deepEqual(response.upstream.body, { data: { tokenType: "business", login_time: 1780000000000 } });
  assertNoCredentialMaterial(response);
  assertTransportEnvelope(response, "login_logs_search");
});

test("health and refresh state expose auth readiness metadata only", () => {
  const config = createLiveConfig();
  const service = new BrowserBackedApiService(config, { status: () => ({ browser_initialized: false, context_initialized: false }) });
  const health = service.health();
  assert.equal(health.ok, true);
  assert.equal(health.service_mode, "live");
  assert.equal(health.profile_dir_configured, true);
  assert.equal(health.state_file_configured, true);
  assert.equal(health.action_count, ACTION_ALLOWLIST.length);

  const state = updateOriginWarmState({}, config.domains.rcp, {
    status: "ready",
    page_ready: true,
    final_origin: config.domains.rcp.origin,
    error_type: null
  });
  const saved = saveRefreshState(state, config.stateFile);
  const serialized = JSON.stringify(saved);
  assert.equal(/"cookie"|"token"|"session"|"header"|"authorization"|"password"/i.test(serialized), false);
});

test("health overlays live SSO-bound origin instead of reporting stale ready", () => {
  const config = createLiveConfig();
  fs.mkdirSync(config.profileDir, { recursive: true });
  const fakeBrowserClient = {
    status: () => ({ browser_initialized: true, context_initialized: true }),
    domainState: (domainKey) => domainKey === "login_logs"
      ? {
          current_origin: "https://sso.corp.kuaishou.com",
          current_url: "https://sso.corp.kuaishou.com/login",
          page_ready: false,
          auth_redirect_detected: true
        }
      : null
  };
  const service = new BrowserBackedApiService(config, fakeBrowserClient);
  const readyState = {
    warmed: true,
    page_ready: true,
    status: "ready",
    error_type: null,
    final_origin: config.domains.login_logs.origin,
    current_origin: config.domains.login_logs.origin,
    same_origin_actual: true
  };
  service.warmState.set("login_logs", readyState);
  service.refreshState = updateOriginWarmState({}, config.domains.login_logs, readyState);

  const health = service.health();
  assert.equal(health.auth_state, "auth_required");
  assert.equal(health.pending_manual_login, true);
  assert.equal(health.next_step, "npm run worker:start");
  assert.equal(health.origin_status.login_logs.status, "auth_required");
  assert.equal(health.origin_status.login_logs.page_ready, false);
  assert.equal(health.origin_status.login_logs.current_origin, "https://sso.corp.kuaishou.com");
  assert.equal(health.origin_status.login_logs.origin_ready_state_stale, true);
});

test("auth-state decisions handle missing profile, missing state, and refresh ttl", () => {
  const config = createLiveConfig();
  const authState = computeAuthState({
    profileDir: config.profileDir,
    stateFile: config.stateFile,
    origins: Object.values(config.domains),
    refreshState: {}
  });
  assert.equal(authState.profile_exists, false);
  assert.equal(["auth_required", "unknown"].includes(authState.auth_state), true);
  assert.equal(typeof authState.auth_state_expired, "boolean");
  assert.equal(typeof authState.origin_ready_state_stale, "boolean");

  const stale = {
    origin_status: {
      rcp: {
        status: "ready",
        page_ready: true,
        refreshed_at: new Date(Date.now() - DEFAULT_REFRESH_TTL_MS - 1000).toISOString()
      }
    }
  };
  const fresh = {
    origin_status: {
      rcp: {
        status: "ready",
        page_ready: true,
        refreshed_at: new Date().toISOString()
      }
    }
  };
  assert.equal(shouldRefreshOrigin(config.domains.rcp, stale), true);
  assert.equal(shouldRefreshOrigin(config.domains.rcp, fresh), false);

  const expiredHealth = computeAuthState({
    profileDir: config.profileDir,
    stateFile: config.stateFile,
    origins: [config.domains.rcp],
    refreshState: stale,
    nowMs: Date.now()
  });
  assert.equal(expiredHealth.origin_status.rcp.origin_ready_state_stale, true);
  assert.equal(expiredHealth.origin_status.rcp.origin_freshness_ttl_ms, DEFAULT_REFRESH_TTL_MS);
  assert.equal(Number.isInteger(expiredHealth.origin_status.rcp.origin_freshness_age_ms), true);
});

test("refresh daemon event output does not include credential material", () => {
  const event = buildRefreshDaemonEvent("refresh_result", {
    ok: true,
    auth_state: {
      auth_state: "ready",
      origin_status: {}
    }
  });
  assertNoCredentialMaterial(event);
});

test("worker:start plan reuses ready service without duplicate start", () => {
  assert.deepEqual(planWorkerStart({
    serviceReachable: true,
    authState: "ready"
  }), ["return_ready"]);
});

test("worker service health readiness requires fresh auth and no pending manual login", () => {
  assert.equal(serviceHealthReady({
    ok: true,
    auth_state: "ready",
    auth_state_expired: false,
    origin_ready_state_stale: false,
    pending_manual_login: false
  }), true);
  assert.equal(serviceHealthReady({
    ok: true,
    auth_state: "ready",
    auth_state_expired: false,
    origin_ready_state_stale: true,
    pending_manual_login: false
  }), false);
  assert.equal(serviceHealthReady({
    ok: true,
    auth_state: "ready",
    auth_state_expired: false,
    origin_ready_state_stale: false,
    pending_manual_login: true
  }), false);
});

test("worker:start plan refreshes before starting when service is not running", () => {
  assert.deepEqual(planWorkerStart({
    serviceReachable: false,
    authState: null,
    refreshSummary: { ok: true, auth_state: "ready" }
  }), ["refresh_once", "start_service"]);
});

test("worker:start plan opens profile for manual auth then continues refresh/start", () => {
  const refreshSummary = {
    ok: false,
    auth_state: "auth_required",
    last_error_type: "two_factor_required"
  };
  assert.equal(needsManualLogin(refreshSummary), true);
  assert.deepEqual(planWorkerStart({
    serviceReachable: false,
    authState: "auth_required",
    refreshSummary,
    postOpenRefreshSummary: { ok: true, auth_state: "ready" }
  }), ["refresh_once", "open_profile", "refresh_once_after_open_profile", "start_service"]);
});

test("worker:start plan releases running service profile before manual auth", () => {
  const refreshSummary = {
    ok: false,
    auth_state: "auth_required",
    last_error_type: "two_factor_required"
  };
  assert.deepEqual(planWorkerStart({
    serviceReachable: true,
    authState: "auth_required",
    refreshSummary,
    postOpenRefreshSummary: { ok: true, auth_state: "ready" }
  }), ["refresh_once", "stop_service_for_manual_login", "open_profile", "refresh_once_after_open_profile", "start_service"]);
});

test("worker:start plan blocks on unsafe profile lock before refresh", () => {
  assert.deepEqual(planWorkerStart({
    serviceReachable: false,
    authState: null,
    profileLockStatus: "daily_chrome_profile_in_use"
  }), ["profile_lock_blocked"]);
  assert.deepEqual(planWorkerStart({
    serviceReachable: false,
    authState: null,
    profileLockStatus: "dedicated_profile_live_lock"
  }), ["profile_lock_blocked"]);
  assert.deepEqual(planWorkerStart({
    serviceReachable: false,
    authState: null,
    profileLockStatus: "unknown_lock"
  }), ["profile_lock_blocked"]);
});

test("worker:start plan auto-clears dedicated stale lock before refresh", () => {
  assert.deepEqual(planWorkerStart({
    serviceReachable: false,
    authState: null,
    profileLockStatus: "stale_profile_lock",
    refreshSummary: { ok: true, auth_state: "ready" }
  }), ["clear_stale_profile_lock", "refresh_once", "start_service"]);
});

test("profile lock classifier protects daily Chrome profile", () => {
  const dailyProfile = path.join(os.homedir(), "Library", "Application Support", "Google", "Chrome");
  const result = classifyProfileLockState({
    profileDir: dailyProfile,
    lockFiles: [],
    processRows: [
      { pid: 222, command: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }
    ]
  });
  assert.equal(result.status, "daily_chrome_profile_in_use");
  assert.equal(result.daily_chrome_in_use, true);
  assert.equal(result.auto_kill_allowed, false);
  assert.equal(result.action_allowed, false);
  assertNoCredentialMaterial(result);
});

test("profile lock classifier reports dedicated profile live lock without kill permission", () => {
  const dedicated = path.join(os.homedir(), ".dennis-browser-backed", "profile");
  const result = classifyProfileLockState({
    profileDir: dedicated,
    lockFiles: [{ name: "SingletonLock", path: path.join(dedicated, "SingletonLock"), pid: 333 }],
    processRows: [
      { pid: 333, command: `Chromium --user-data-dir="${dedicated}"` }
    ],
    pidExists: (pid) => pid === 333
  });
  assert.equal(result.status, "dedicated_profile_live_lock");
  assert.equal(result.configured_profile_processes.length, 1);
  assert.equal(result.auto_kill_allowed, false);
  assert.equal(result.auto_delete_lock_allowed, false);
  assertNoCredentialMaterial(result);
});

test("profile lock classifier marks dedicated stale lock as auto-clear eligible", () => {
  const dedicated = path.join(os.homedir(), ".dennis-browser-backed", "profile");
  const result = classifyProfileLockState({
    profileDir: dedicated,
    lockFiles: [{ name: "SingletonLock", path: path.join(dedicated, "SingletonLock"), pid: 444 }],
    processRows: [],
    pidExists: () => false
  });
  assert.equal(result.status, "stale_profile_lock");
  assert.equal(result.clear_stale_lock_allowed, true);
  assert.equal(result.auto_delete_lock_allowed, false);
  assert.equal(result.action_allowed, false);
  assert.equal(canClearStaleProfileLock(result), true);
  assertNoCredentialMaterial(result);
});

test("worker:start stale profile lock blocked output is only used after auto-clear failure", () => {
  const dedicated = path.join(os.homedir(), ".dennis-browser-backed", "profile");
  const lockDiagnosis = classifyProfileLockState({
    profileDir: dedicated,
    lockFiles: [{ name: "SingletonLock", path: path.join(dedicated, "SingletonLock"), pid: 444 }],
    processRows: [],
    pidExists: () => false
  });
  const output = buildProfileLockBlockedStartOutput(lockDiagnosis);
  assert.equal(output.ok, false);
  assert.equal(output.service_ready, false);
  assert.equal(output.blocking_issue, "stale_profile_lock");
  assert.equal(output.lock_type, "stale_profile_lock");
  assert.equal(output.profile_path, dedicated);
  assert.equal(output.pid_exists, false);
  assert.equal(output.dennis_should_continue_live, false);
  assert.equal(output.refresh_attempted, false);
  assert.equal(output.service_started, false);
  assert.equal(output.auto_kill_chrome, false);
  assert.equal(output.auto_delete_lock, false);
  assert.equal(
    output.next_step,
    "Dedicated stale lock auto-clear failed or did not resolve the lock. Run npm run worker:doctor -- --explain-lock before retrying worker:start."
  );
  assertNoCredentialMaterial(output);
});

test("profile lock classifier stops on unknown custom profile lock", () => {
  const custom = path.join(os.tmpdir(), "custom-browser-profile");
  const result = classifyProfileLockState({
    profileDir: custom,
    lockFiles: [{ name: "SingletonLock", path: path.join(custom, "SingletonLock") }],
    processRows: []
  });
  assert.equal(result.status, "unknown_lock");
  assert.equal(result.blocking_issue, "unknown_lock");
  assert.equal(result.action_allowed, false);
  assert.equal(canClearStaleProfileLock(result), false);
  assertNoCredentialMaterial(result);
});

test("clear-stale-lock helper rejects live and daily Chrome profile locks", () => {
  assert.equal(canClearStaleProfileLock({ status: "dedicated_profile_live_lock", clear_stale_lock_allowed: false }), false);
  assert.equal(canClearStaleProfileLock({ status: "daily_chrome_profile_in_use", clear_stale_lock_allowed: false }), false);
  assert.equal(canClearStaleProfileLock({ status: "unknown_lock", clear_stale_lock_allowed: false }), false);
  const rejected = clearDedicatedStaleProfileLock({ status: "daily_chrome_profile_in_use", clear_stale_lock_allowed: false }, os.tmpdir());
  assert.equal(rejected.ok, false);
  assert.equal(rejected.auto_kill_chrome, false);
  assert.equal(rejected.profile_deleted, false);
  assertNoCredentialMaterial(rejected);
});

test("clear-stale-lock helper clears only explicit dedicated stale lock files", () => {
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), "bbrs-stale-lock-"));
  const lockPath = path.join(tempProfile, "SingletonLock");
  fs.writeFileSync(lockPath, "MacBook-Air.local-444");
  const result = clearDedicatedStaleProfileLock({
    status: "stale_profile_lock",
    clear_stale_lock_allowed: true
  }, tempProfile);
  assert.equal(result.ok, true);
  assert.equal(result.stale_lock_cleared, true);
  assert.deepEqual(result.cleared_lock_files, ["SingletonLock"]);
  assert.equal(fs.existsSync(lockPath), false);
  assert.equal(result.auto_kill_chrome, false);
  assert.equal(result.profile_deleted, false);
  assertNoCredentialMaterial(result);
  fs.rmSync(tempProfile, { recursive: true, force: true });
});

test("profile lock parser extracts user-data-dir without exposing raw command paths", () => {
  const userDataDir = path.join(os.homedir(), ".dennis-browser-backed", "profile");
  assert.equal(extractUserDataDir(`Chromium --user-data-dir="${userDataDir}" --flag`), userDataDir);
  assert.equal(extractUserDataDir(`Chromium --user-data-dir ${userDataDir} --flag`), userDataDir);
});

test("worker script does not contain Chrome kill commands and docs carry guardrails", () => {
  const workerContent = fs.readFileSync(path.join(process.cwd(), "scripts/mac-worker.js"), "utf8");
  const forbidden = [
    /killall\s+["']?(Google Chrome|Chrome|Chromium)/i,
    /pkill\s+.*(Google Chrome|Chrome|Chromium)/i,
    /osascript\s+.*quit app ["']?Google Chrome/i
  ];
  for (const pattern of forbidden) {
    assert.equal(pattern.test(workerContent), false, `worker script must not contain ${pattern}`);
  }

  const docFiles = [
    "BROWSER_BACKED_AGENT_SKILL.md",
    "BROWSER_BACKED_SERVICE_COMMANDS.md",
    "MAC_LOCAL_WORKER_GUIDE.md",
    "TROUBLESHOOTING.md",
    "README.md"
  ].filter((file) => fs.existsSync(path.join(process.cwd(), file)));
  assert.ok(docFiles.length > 0, "at least one profile-lock guardrail doc should exist");
  for (const file of docFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(content, /not automatically close or kill|Never run|Do not run/i);
  }
});

test("refresh daemon interval and manual-login event remain bounded", () => {
  assert.equal(parseRefreshIntervalMs({}), DEFAULT_REFRESH_TTL_MS);
  assert.equal(parseRefreshIntervalMs({ REFRESH_INTERVAL_MINUTES: "15" }), 15 * 60 * 1000);
  const event = buildRefreshDaemonEvent("refresh_daemon_tick_completed", {
    ok: false,
    auth_state: "auth_required",
    last_error_type: "manual_login_required"
  });
  assert.equal(event.pending_manual_login, true);
  assert.equal(event.next_step, "Run npm run worker:start when a user is available to complete profile interaction.");
  assertNoCredentialMaterial(event);
});

test("worker:expose proxy only allows service health, action list, and allowlisted actions", () => {
  assert.equal(classifyProxyRequest("GET", "/health").allowed, true);
  assert.equal(classifyProxyRequest("GET", "/actions").allowed, true);
  assert.equal(classifyProxyRequest("POST", "/actions/batch").allowed, true);
  assert.equal(classifyProxyRequest("POST", "/actions/multi_source_plan").allowed, true);
  assert.equal(classifyProxyRequest("GET", "/actions/batch").reason, "method_not_allowed");
  assert.equal(classifyProxyRequest("POST", "/actions/login_logs_search").allowed, true);
  assert.equal(classifyProxyRequest("POST", "/actions/not_real").reason, "action_not_allowlisted");
  assert.equal(classifyProxyRequest("GET", "/actions/login_logs_search").reason, "method_not_allowed");
  assert.equal(classifyProxyRequest("POST", "/proxy?url=https://example.invalid").reason, "path_not_allowed");
});

test("worker:expose summary gives low-approval service_base_url without credential material", () => {
  const summary = buildExposeSummary({
    proxyStatus: "running",
    serviceBaseUrl: "http://10.0.0.2:9787",
    health: { action_count: ACTION_ALLOWLIST.length, auth_state: "ready" },
    actions: { action_count: ACTION_ALLOWLIST.length }
  });
  assert.equal(summary.proxy_status, "running");
  assert.equal(summary.local_service, "http://127.0.0.1:8787");
  assert.equal(summary.service_base_url, "http://10.0.0.2:9787");
  assert.equal(summary.action_count, ACTION_ALLOWLIST.length);
  assert.equal(summary.auth_state, "ready");
  assert.deepEqual(summary.allowed_paths, [
    "/health",
    "/actions",
    "/actions/batch",
    "/actions/multi_source_plan",
    "/actions/<allowlisted_action>"
  ]);
  assertNoCredentialMaterial(summary);
});

test("batch executes independent parallel sources and returns transport matrix", async () => {
  const service = createService();
  const response = await service.executeBatch({
    request_id: "ato_case",
    execution_groups: [
      {
        group_id: "ato_parallel",
        execution: "independent_parallel",
        sources: [
          { source_id: "login_logs", action: "login_logs_search", params: ACTION_INPUTS.login_logs_search },
          { source_id: "archives_profile", action: "archives_user_profile", params: ACTION_INPUTS.archives_user_profile },
          {
            source_id: "track_ready",
            action: "track_analysis_check_data_ready",
            params: ACTION_INPUTS.track_analysis_check_data_ready
          }
        ]
      }
    ]
  });
  assert.equal(response.ok, true);
  assert.equal(response.response_mode, "controlled_batch_passthrough");
  assert.equal(response.batch_status, "completed");
  assert.equal(response.completed_count, 3);
  assert.equal(response.failed_count, 0);
  assert.equal(response.partial_count, 0);
  assert.deepEqual(response.classifications.completed.sort(), ["archives_profile", "login_logs", "track_ready"].sort());
  assert.ok(response.transport_status_matrix.login_logs);
  assert.equal(response.transport_status_matrix.login_logs.body_present, true);
  assert.equal(response.transport_status_matrix.login_logs.raw_body_handling, "visible");
  assert.equal(Object.hasOwn(response.source_results.login_logs.upstream, "body"), true);
  assert.equal(response.source_results.login_logs.upstream.body_omitted, false);
  assert.equal(response.missing_or_failed_sources.length, 0);
  assertNoOldBusinessFields(response);
  assertNoCredentialMaterial(response);
});

test("batch preserves capped upstream body snippets in source results", async () => {
  const bodyText = "{\"large\":true";
  const response = buildLiveActionResponse(ACTIONS.rcp_event_feature_list, ACTION_INPUTS.rcp_event_feature_list, {}, {
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText,
    observedBytes: 2048,
    bodyTruncated: true
  }, { latencyMs: 30 });
  const service = createService();
  service.executeAction = async () => response;
  const batch = await service.executeBatch({
    sources: [
      { source_id: "features", action: "rcp_event_feature_list", params: ACTION_INPUTS.rcp_event_feature_list }
    ]
  });
  assert.equal(batch.batch_status, "partial");
  assert.equal(batch.source_results.features.upstream.body_snippet, bodyText);
  assert.equal(batch.source_results.features.upstream.body_omitted, false);
  assert.equal(batch.source_results.features.raw_body_handling, "capped");
  assert.equal(batch.transport_status_matrix.features.raw_body_handling, "capped");
});

test("batch runs dependency groups serially", async () => {
  const service = createService();
  const response = await service.executeBatch({
    request_id: "rcp_chain",
    execution_groups: [
      {
        group_id: "event_detail",
        execution: "dependency_serial",
        sources: [
          { source_id: "detail", action: "rcp_event_detail", params: ACTION_INPUTS.rcp_event_detail }
        ]
      },
      {
        group_id: "feature_list",
        depends_on: ["event_detail"],
        execution: "dependency_serial",
        sources: [
          { source_id: "features", action: "rcp_event_feature_list", params: ACTION_INPUTS.rcp_event_feature_list }
        ]
      }
    ]
  });
  assert.equal(response.batch_status, "completed");
  assert.equal(response.execution_groups[1].dependency_group_ids[0], "event_detail");
  assert.equal(response.transport_status_matrix.detail.category, "completed");
  assert.equal(response.transport_status_matrix.features.category, "completed");
  assertNoOldBusinessFields(response);
});

test("batch dry run accepts large-response and auth-sensitive serial groups", async () => {
  const response = await createService().executeBatch({
    dry_run: true,
    execution_groups: [
      {
        group_id: "large",
        execution: "large_response_serial",
        sources: [
          { source_id: "features", action: "rcp_event_feature_list", params: ACTION_INPUTS.rcp_event_feature_list }
        ]
      },
      {
        group_id: "auth",
        execution: "auth_sensitive_serial",
        sources: [
          { source_id: "analysis", action: "archives_user_analysis", params: ACTION_INPUTS.archives_user_analysis }
        ]
      }
    ]
  });
  assert.equal(response.batch_status, "planned");
  assert.deepEqual(response.classifications.planned.sort(), ["analysis", "features"].sort());
});

test("batch accepts Dennis real-shaped chunk payloads and returns source-level rows", async () => {
  const service = createService();
  const expectedChunkCounts = [9, 2, 1, 3];
  const responses = [];

  for (const [index, payload] of DENNIS_BATCH_CHUNKS.entries()) {
    const response = await service.executeBatch(payload);
    responses.push(response);

    assert.equal(response.ok, true);
    assert.equal(response.request_id, payload.request_id);
    assert.equal(response.scheduler.source_count, expectedChunkCounts[index]);
    assert.equal(response.batch_payload_shape.source_count, expectedChunkCounts[index]);
    assert.equal(response.batch_payload_shape.group_count, payload.execution_groups.length);
    assert.equal(response.batch_payload_shape.groups[0].sources[0].source_id, payload.execution_groups[0].sources[0].source_id);
    assert.equal(response.batch_payload_shape.groups[0].sources[0].action, payload.execution_groups[0].sources[0].action);
    assert.equal(Object.keys(response.source_results).length, expectedChunkCounts[index]);
    assert.equal(Object.keys(response.transport_status_matrix).length, expectedChunkCounts[index]);
    assert.equal(response.completed_count, expectedChunkCounts[index]);
    assert.equal(response.failed_count, 0);
    assertNoCredentialMaterial(response.batch_payload_shape);
    assertNoCredentialMaterial(response);
  }

  assert.equal(responses.length, 4);
  assert.equal(responses.reduce((count, response) => count + response.scheduler.source_count, 0), 15);
});

test("single source failure does not block completed batch sources", async () => {
  const service = createService();
  const response = await service.executeBatch({
    sources: [
      { source_id: "bad_login", action: "login_logs_search", params: {} },
      { source_id: "profile", action: "archives_user_profile", params: ACTION_INPUTS.archives_user_profile }
    ]
  });
  assert.equal(response.batch_status, "partial");
  assert.equal(response.transport_status_matrix.bad_login.invalid_params, true);
  assert.equal(response.transport_status_matrix.profile.category, "completed");
  assert.equal(response.missing_or_failed_sources[0].source_id, "bad_login");
  assertNoOldBusinessFields(response);
});

test("batch preserves structured capped upstream body", async () => {
  const service = createService();
  const body = buildLargeLoginLogsBody(334);
  const cappedBody = {
    ...body,
    data: {
      ...body.data,
      logSearchModels: body.data.logSearchModels.slice(0, 50)
    }
  };
  const loginResponse = buildLiveActionResponse(ACTIONS.login_logs_search, {
    ...ACTION_INPUTS.login_logs_search,
    max_records: 50
  }, {}, {
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText: JSON.stringify(cappedBody),
    bodyTruncated: true,
    observedBytes: Buffer.byteLength(JSON.stringify(body)),
    returnedBytes: Buffer.byteLength(JSON.stringify(cappedBody)),
    jsonArrayCap: {
      attempted: true,
      ok: true,
      path: "data.logSearchModels",
      observedRecords: 334,
      returnedRecords: 50,
      missingRecords: 284,
      maxRecords: 50
    }
  });
  service.executeAction = async (actionName) => {
    assert.equal(actionName, "login_logs_search");
    return loginResponse;
  };
  const response = await service.executeBatch({
    sources: [
      {
        source_id: "login",
        action: "login_logs_search",
        params: { ...ACTION_INPUTS.login_logs_search, max_records: 50 }
      }
    ]
  });

  assert.equal(response.batch_status, "partial");
  assert.equal(response.source_results.login.upstream.raw_body_handling, "json_array_capped");
  assert.equal(response.source_results.login.upstream.capped_body.data.logSearchModels.length, 50);
  assert.equal(response.source_results.login.upstream.observed_records, 334);
  assert.equal(response.source_results.login.upstream.returned_records, 50);
  assert.equal(response.source_results.login.upstream.missing_records, 284);
  assert.equal(response.transport_status_matrix.login.body_truncated, true);
  assert.equal(response.transport_status_matrix.login.response_too_large, true);
  assertNoOldBusinessFields(response);
});

test("batch source timeout is isolated from other sources", async () => {
  const service = createService();
  const originalExecuteAction = service.executeAction.bind(service);
  service.executeAction = async (actionName, input) => {
    if (actionName === "login_logs_search") {
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    return originalExecuteAction(actionName, input);
  };
  const response = await service.executeBatch({
    default_timeout_ms: 20,
    sources: [
      { source_id: "slow_login", action: "login_logs_search", params: ACTION_INPUTS.login_logs_search },
      { source_id: "profile", action: "archives_user_profile", params: ACTION_INPUTS.archives_user_profile }
    ]
  });
  assert.equal(response.batch_status, "partial");
  assert.equal(response.transport_status_matrix.slow_login.timed_out, true);
  assert.equal(response.transport_status_matrix.profile.category, "completed");
});

test("batch deadline returns source-level timeout rows before caller timeout", async () => {
  const service = createService();
  const response = await service.executeBatch({
    batch_timeout_ms: 1000,
    execution_groups: [
      {
        group_id: "auth_sensitive_serial",
        execution: "auth_sensitive_serial",
        sources: [
          { source_id: "profile", action: "archives_user_profile", params: ACTION_INPUTS.archives_user_profile },
          { source_id: "analysis", action: "archives_user_analysis", params: ACTION_INPUTS.archives_user_analysis }
        ]
      }
    ]
  });

  assert.equal(response.batch_status, "failed");
  assert.equal(response.timeout_count, 2);
  assert.equal(response.failed_count, 2);
  assert.equal(response.transport_status_matrix.profile.timeout_stage, "batch_deadline");
  assert.equal(response.transport_status_matrix.analysis.timeout_stage, "batch_deadline");
  assert.equal(response.missing_or_failed_sources.length, 2);
  assertNoCredentialMaterial(response);
});

test("batch rejects forbidden inputs and legacy response mode per source", async () => {
  const service = createService();
  await assert.rejects(
    () => service.executeBatch({
      sources: [
        {
          source_id: "bad",
          action: "login_logs_search",
          params: { ...ACTION_INPUTS.login_logs_search, url: "https://example.invalid" }
        }
      ]
    }),
    (error) => error.code === "forbidden_action_input"
  );
  await assert.rejects(
    () => service.executeBatch({
      sources: [
        {
          source_id: "unknown",
          action: "not_allowlisted",
          params: {}
        }
      ]
    }),
    (error) => error.code === "unknown_action"
  );

  const response = await service.executeBatch({
    sources: [
      {
        source_id: "legacy",
        action: "login_logs_search",
        params: { ...ACTION_INPUTS.login_logs_search, response_mode: "compat_summary" }
      }
    ]
  });
  assert.equal(response.batch_status, "failed");
  assert.equal(response.transport_status_matrix.legacy.invalid_params, true);
  assert.equal(response.transport_status_matrix.legacy.category, "blocked");
  assertNoOldBusinessFields(response);
});
