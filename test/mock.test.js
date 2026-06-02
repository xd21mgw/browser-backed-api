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
import { buildRefreshDaemonEvent } from "../scripts/refresh-daemon.js";

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
  }
});

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

function assertNoOldBusinessFields(value) {
  const serialized = JSON.stringify(value);
  for (const field of OLD_BUSINESS_FIELDS) {
    assert.equal(Object.hasOwn(value, field), false, `${field} must not be top-level output`);
    assert.equal(serialized.includes(`"${field}"`), false, `${field} must not appear anywhere in output`);
  }
}

function assertNoCredentialMaterial(value) {
  const serialized = JSON.stringify(value);
  assert.equal(/secret-token-value|Bearer secret-auth-value|sid=secret-session-value/i.test(serialized), false);
  assert.equal(/"request_headers"\s*:|"headers"\s*:|"set-cookie"\s*:|"authorization"\s*:\s*"(Bearer|Basic)\s/i.test(serialized), false);
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
  assert.equal(["visible", "capped", "omitted"].includes(response.raw_body_handling), true);
  assert.ok(response.upstream);
  assert.equal(response.upstream.raw_body_handling, response.raw_body_handling);
  assert.equal(response.upstream.body_omitted, response.body_present ? false : true);
  if (response.body_present && !response.body_truncated) {
    assert.equal(Object.hasOwn(response.upstream, "body"), true, `${actionName} must expose small upstream body`);
    assert.equal(response.upstream.raw_body_handling, "visible");
    assert.equal(typeof response.upstream.returned_bytes, "number");
  }
  if (response.body_present && response.body_truncated) {
    assert.equal(
      Object.hasOwn(response.upstream, "body_snippet") || Object.hasOwn(response.upstream, "capped_body"),
      true,
      `${actionName} must expose capped upstream body`
    );
    assert.equal(response.upstream.raw_body_handling, "capped");
    assert.equal(response.upstream.response_too_large, true);
  }
  assert.ok(response.meta);
  assert.equal(response.meta.origin, ACTIONS[actionName].domainKey);
  assert.deepEqual(response.safety, {
    credential_material_output: false,
    request_headers_output: false,
    browser_profile_material_output: false,
    transport_auth_material_output: false,
    upstream_business_body_visible: Boolean(response.body_present)
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
  assert.equal(Object.keys(ACTIONS).length, 19);
  assert.deepEqual(Object.keys(ACTIONS), ACTION_ALLOWLIST);
});

test("actions endpoint exposes passthrough-only contract for every action", () => {
  const response = createService().actions();
  assert.deepEqual(response.actions.map((action) => action.name), ACTION_ALLOWLIST);
  for (const action of response.actions) {
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

  const rcpRequest = buildActionBody(ACTIONS.rcp_snapshot, ACTION_INPUTS.rcp_snapshot);
  assert.equal(rcpRequest.method, "POST");
  assert.equal(rcpRequest.path, "/v2/rest/event/eventList");
  assert.equal(rcpRequest.body.eventV2.sourceIds, "mock_source_id");

  const recoveredRequest = buildActionBody(ACTIONS.rcp_node_bind_policy_attribution, ACTION_INPUTS.rcp_node_bind_policy_attribution);
  assert.equal(recoveredRequest.method, "GET");
  assert.equal(recoveredRequest.path.startsWith("/v2/rest/pc/policy/nodeBindPolicyAttribution?"), true);
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

test("login_logs_search falls back to context request when page fetch fails", async () => {
  const config = createLiveConfig();
  let contextFallbackCalled = false;
  const fakeBrowserClient = {
    actionDiagnostics: () => ({
      action_name: "login_logs_search",
      expected_origin: config.domains.login_logs.origin,
      bound_page_origin: config.domains.login_logs.origin,
      origin_warmed: true,
      page_ready: true,
      origin_match: true
    }),
    runAction: async () => {
      throw new Error("Failed to fetch");
    },
    runActionWithContextRequest: async (action, actionRequest) => {
      contextFallbackCalled = true;
      assert.equal(action.name, "login_logs_search");
      assert.equal(actionRequest.method, "GET");
      assert.equal(actionRequest.path.startsWith("/rest/unified/log/search?"), true);
      const bodyText = JSON.stringify({ code: 0, data: { logSearchModels: [] } });
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
  service.warmState.set("login_logs", {
    warmed: true,
    page_ready: true,
    status: "ready",
    error_type: null,
    final_origin: config.domains.login_logs.origin
  });

  const response = await service.executeAction("login_logs_search", ACTION_INPUTS.login_logs_search);
  assert.equal(contextFallbackCalled, true);
  assert.equal(response.ok, true);
  assert.equal(response.http_status, 200);
  assert.equal(response.upstream.status, 200);
  assert.equal(response.upstream.body_present, true);
  assert.equal(response.upstream.body_omitted, false);
  assert.deepEqual(response.upstream.body, { code: 0, data: { logSearchModels: [] } });
  assert.equal(response.error_type, undefined);
  assertTransportEnvelope(response, "login_logs_search");
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
      refreshToken: "business-refresh-marker",
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
    refreshToken: "business-refresh-marker",
    tokenType: "device_event_type",
    loginSessionEvent: "login_session_event",
    authEvent: "account_auth_event"
  });
  assert.equal(response.safety.credential_material_output, false);
  assertTransportEnvelope(response, "archives_user_profile");
});

test("passthrough response does not expose request or transport auth headers", () => {
  const bodyText = JSON.stringify({ data: { tokenType: "business", login_time: 1780000000000 } });
  const response = buildLiveActionResponse(ACTIONS.login_logs_search, ACTION_INPUTS.login_logs_search, {}, {
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText,
    observedBytes: Buffer.byteLength(bodyText),
    bodyTruncated: false,
    headers: {
      "set-cookie": "sid=secret-session-value",
      authorization: "Bearer secret-auth-value"
    }
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
  assert.equal(health.action_count, 19);

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
