import assert from "node:assert/strict";
import test from "node:test";
import { ACTIONS, ACTION_ALLOWLIST, buildActionBody, buildLiveActionResponse } from "../src/actions.js";
import { BrowserBackedClient } from "../src/browser.js";
import { loadConfig } from "../src/config.js";
import { BrowserBackedApiService } from "../src/service.js";

function createService() {
  const config = loadConfig({
    SERVICE_MODE: "mock",
    HOST: "127.0.0.1",
    PORT: "8787"
  });
  return new BrowserBackedApiService(config);
}

function createLiveConfig() {
  return loadConfig({
    SERVICE_MODE: "live",
    HOST: "127.0.0.1",
    PORT: "8787",
    RCP_ORIGIN: "https://rcp.example.test",
    WEAPON_ORIGIN: "https://weapon.example.test",
    LOGIN_LOGS_ORIGIN: "https://user-center-workbench.example.test",
    TRACK_ANALYSIS_ORIGIN: "https://track-analysis.example.test"
  });
}

test("health exposes Dennis runtime readiness fields", () => {
  const service = createService();
  const health = service.health();

  assert.equal(health.ok, true);
  assert.equal(health.service_mode, "mock");
  assert.equal(health.browser_initialized, false);
  assert.equal(health.context_initialized, false);
  assert.equal(typeof health.uptime_ms, "number");
  assert.equal(health.warmed_origins.length, 4);
  assert.ok(health.warmed_origins.every((origin) => origin.status === "not_warmed"));
});

test("actions endpoint exposes the fixed allowlist only", () => {
  const service = createService();
  const actions = service.actions().actions.map((action) => action.name);

  assert.deepEqual(actions, ACTION_ALLOWLIST);
  assert.deepEqual(actions, [
    "rcp_snapshot",
    "weapon_inventory",
    "login_logs_search",
    "track_analysis_summary"
  ]);
});

test("prewarm reports per-origin status, latency, and error type", async () => {
  const service = createService();
  const prewarm = await service.prewarm();

  assert.equal(prewarm.service_mode, "mock");
  assert.equal(prewarm.results.length, 4);

  for (const result of prewarm.results) {
    assert.equal(result.status, "simulated");
    assert.equal(result.warmed, true);
    assert.equal(typeof result.latency_ms, "number");
    assert.equal(result.same_origin_expected, true);
    assert.equal(result.same_origin_actual, true);
    assert.equal(result.navigation_status, "simulated");
    assert.equal(result.error_type, null);
    assert.equal(result.error_message_sanitized, null);
  }
});

test("each action returns source card, source quality, latency, warm state, and sensitivity flag", async () => {
  const service = createService();
  await service.prewarm();

  for (const actionName of ACTION_ALLOWLIST) {
    const response = await service.executeAction(actionName, {
      accountId: "demo",
      workspaceId: "workspace",
      user_id: "track-user",
      appName: "KUAISHOU",
      query: "sample",
      limit: 10
    });

    assert.equal(response.action, actionName);
    assert.equal(response.mode, "mock");
    assert.equal(typeof response.latency_ms, "number");
    assert.equal(response.origin_warmed, true);
    assert.equal(response.sensitive_output, false);
    assert.ok(response.source_card);
    assert.ok(response.source_quality);
    assert.equal(response.source_card.body_policy.raw_response_full_body_returned, false);
    assert.equal(response.source_card.body_policy.cookie_token_session_header_plaintext_read, false);
    assert.equal(response.source_quality.checks.some((check) => check.name === "fixed_action_registry" && check.passed), true);
  }
});

test("arbitrary URL input is forbidden", async () => {
  const service = createService();

  await assert.rejects(
    () => service.executeAction("rcp_snapshot", { url: "https://example.com/api" }),
    (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
  );
});

test("raw header and cookie inputs are forbidden", async () => {
  const service = createService();

  await assert.rejects(
    () => service.executeAction("rcp_snapshot", { headers: { authorization: "Bearer x" } }),
    (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
  );

  await assert.rejects(
    () => service.executeAction("rcp_snapshot", { cookie: "sid=x" }),
    (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
  );
});

test("prewarm auth redirect waits for automatic return to the configured origin", async () => {
  const config = createLiveConfig();
  const client = new BrowserBackedClient(config);
  const page = new FakeLandingPage({
    gotoUrl: "https://sso.corp.kuaishou.com/login?ticket=redacted-by-test",
    waitOutcomes: ["return"]
  });
  client.start = async () => {};
  client.context = { newPage: async () => page };

  const result = await client.prewarmDomain("rcp");

  assert.equal(result.configured_origin, "https://rcp.example.test");
  assert.equal(result.initial_url, "https://rcp.example.test/");
  assert.equal(result.final_origin, "https://rcp.example.test");
  assert.equal(result.same_origin_expected, true);
  assert.equal(result.same_origin_actual, true);
  assert.equal(result.navigation_status, 200);
  assert.equal(result.error_type, null);
  assert.equal(result.status, "ready");
  assert.equal(result.page_ready, true);
  assert.equal(result.auth_redirect_detected, true);
  assert.equal(result.landing_flow_attempted, true);
  assert.equal(result.allowed_clicks_executed, 0);
  assert.equal(result.landing_flow_status, "auto_returned");
});

test("prewarm auth redirect can use one allowlisted next click before becoming ready", async () => {
  const config = createLiveConfig();
  const client = new BrowserBackedClient(config);
  const page = new FakeLandingPage({
    gotoUrl: "https://sso.corp.kuaishou.com/login",
    waitOutcomes: ["timeout", "return"],
    controls: {
      Continue: { safe: true }
    }
  });
  client.start = async () => {};
  client.context = { newPage: async () => page };

  const result = await client.prewarmDomain("weapon");

  assert.equal(result.status, "ready");
  assert.equal(result.page_ready, true);
  assert.equal(result.final_origin_after_landing, "https://weapon.example.test");
  assert.equal(result.landing_flow_attempted, true);
  assert.equal(result.allowed_clicks_executed, 1);
  assert.equal(result.landing_flow_status, "allowed_click_returned");
  assert.deepEqual(page.clickedLabels, ["Continue"]);
});

test("prewarm auth redirect blocks after the maximum allowlisted clicks", async () => {
  const config = createLiveConfig();
  const client = new BrowserBackedClient(config);
  const page = new FakeLandingPage({
    gotoUrl: "https://sso.corp.kuaishou.com/login",
    waitOutcomes: ["timeout", "timeout", "timeout"],
    controls: {
      Next: { safe: true }
    }
  });
  client.start = async () => {};
  client.context = { newPage: async () => page };

  const result = await client.prewarmDomain("login_logs");

  assert.equal(result.status, "auth_failed");
  assert.equal(result.page_ready, false);
  assert.equal(result.error_type, "landing_flow_blocked");
  assert.equal(result.final_origin_after_landing, "https://sso.corp.kuaishou.com");
  assert.equal(result.allowed_clicks_executed, 2);
  assert.equal(result.landing_flow_status, "max_clicks_exceeded");
});

test("prewarm auth redirect does not click dangerous submit controls", async () => {
  const config = createLiveConfig();
  const client = new BrowserBackedClient(config);
  const page = new FakeLandingPage({
    gotoUrl: "https://sso.corp.kuaishou.com/login",
    waitOutcomes: ["timeout"],
    controls: {
      Next: { safe: false },
      Delete: { safe: true }
    }
  });
  client.start = async () => {};
  client.context = { newPage: async () => page };

  const result = await client.prewarmDomain("rcp");

  assert.equal(result.status, "auth_failed");
  assert.equal(result.error_type, "landing_flow_blocked");
  assert.equal(result.allowed_clicks_executed, 0);
  assert.deepEqual(page.clickedLabels, []);
});

test("action origin mismatch returns source metadata instead of throwing a bare service error", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      rcp: prewarmResult(config, "rcp", {
        finalOrigin: "https://sso.example.test",
        errorType: "auth_redirect"
      })
    },
    diagnostics: {
      rcp: {
        bound_page_origin: "https://sso.example.test",
        origin_match: false
      }
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("rcp_snapshot", { accountId: "demo" });

  assert.equal(response.action, "rcp_snapshot");
  assert.equal(response.status, "auth_failed");
  assert.equal(response.source_status, "auth_failed");
  assert.equal(response.error_type, "auth_redirect");
  assert.equal(typeof response.latency_ms, "number");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.equal(response.action_diagnostics.action_name, "rcp_snapshot");
  assert.equal(response.action_diagnostics.expected_origin, "https://rcp.example.test");
  assert.equal(response.action_diagnostics.bound_page_origin, "https://sso.example.test");
  assert.equal(response.action_diagnostics.origin_match, false);
});

test("action execution uses the warmed page for the matching fixed origin", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      weapon: prewarmResult(config, "weapon")
    },
    diagnostics: {
      weapon: {
        bound_page_origin: "https://weapon.example.test",
        origin_match: true,
        page_ready: true
      }
    },
    fetchResults: {
      weapon_inventory: {
        completed: true,
        ok: true,
        status: 200,
        bodyText: JSON.stringify({
          graphData: {
            code: 0,
            data: {
              pointInfoMap: {
                "demo-user": { nodeType: "user" },
                ANDROID_shape_only_device: { nodeType: "device", deviceId: "ANDROID_shape_only_device" }
              },
              relationEdgeList: [{ from: "demo-user", to: "ANDROID_shape_only_device" }]
            }
          },
          riskDataResults: []
        }),
        bodyTruncated: false,
        observedBytes: 220
      }
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("weapon_inventory", { user_id: "demo-user" });

  assert.deepEqual(fakeClient.prewarmCalls, ["weapon"]);
  assert.equal(fakeClient.runCalls.length, 1);
  assert.equal(fakeClient.runCalls[0].domainKey, "weapon");
  assert.equal(fakeClient.runCalls[0].actionName, "weapon_inventory");
  assert.equal(fakeClient.runCalls[0].path.startsWith("/apiv2/graphData?"), true);
  assert.equal(response.status, "completed");
  assert.equal(response.source_card.action_diagnostics.expected_origin, "https://weapon.example.test");
});

test("action detects SSO drift and attempts one lazy rewarm", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      track_analysis: prewarmResult(config, "track_analysis")
    },
    diagnostics: {
      track_analysis: [
        {
          bound_page_origin: "https://sso.corp.kuaishou.com",
          origin_match: false,
          page_ready: false
        },
        {
          bound_page_origin: "https://track-analysis.example.test",
          origin_match: true,
          page_ready: true
        }
      ]
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);
  service.warmState.set("track_analysis", warmStateReady(config, "track_analysis"));

  const response = await service.executeAction("track_analysis_summary", { user_id: "demo", appName: "KUAISHOU" });

  assert.deepEqual(fakeClient.prewarmCalls, ["track_analysis"]);
  assert.equal(response.lazy_rewarm_attempted, true);
  assert.equal(response.lazy_rewarm_status, "ready");
  assert.equal(response.bound_page_origin_before_rewarm, "https://sso.corp.kuaishou.com");
  assert.equal(response.bound_page_origin_after_rewarm, "https://track-analysis.example.test");
});

test("lazy rewarm success allows the action fetch to continue", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      weapon: prewarmResult(config, "weapon")
    },
    diagnostics: {
      weapon: [
        {
          bound_page_origin: "https://sso.corp.kuaishou.com",
          origin_match: false,
          page_ready: false
        },
        {
          bound_page_origin: "https://weapon.example.test",
          origin_match: true,
          page_ready: true
        }
      ]
    },
    fetchResults: {
      weapon_inventory: {
        completed: true,
        ok: true,
        status: 200,
        bodyText: JSON.stringify({
          graphData: {
            code: 0,
            data: {
              pointInfoMap: {
                "demo-user": { nodeType: "user" },
                ANDROID_shape_only_device: { nodeType: "device", deviceId: "ANDROID_shape_only_device" }
              },
              relationEdgeList: [{ from: "demo-user", to: "ANDROID_shape_only_device" }]
            }
          },
          riskDataResults: []
        }),
        bodyTruncated: false,
        observedBytes: 220
      }
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);
  service.warmState.set("weapon", warmStateReady(config, "weapon"));

  const response = await service.executeAction("weapon_inventory", { user_id: "demo-user" });

  assert.equal(fakeClient.runCalls.length, 1);
  assert.equal(response.status, "completed");
  assert.equal(response.source_status, "completed");
  assert.equal(response.lazy_rewarm_attempted, true);
  assert.equal(response.lazy_rewarm_status, "ready");
  assert.equal(response.page_ready_before_fetch, true);
});

test("lazy rewarm failure still returns source card, quality, and sensitivity flag", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      rcp: prewarmResult(config, "rcp", {
        finalOrigin: "https://sso.corp.kuaishou.com",
        errorType: "landing_flow_blocked",
        status: "auth_failed",
        pageReady: false
      })
    },
    diagnostics: {
      rcp: [
        {
          bound_page_origin: "https://sso.corp.kuaishou.com",
          origin_match: false,
          page_ready: false
        },
        {
          bound_page_origin: "https://sso.corp.kuaishou.com",
          origin_match: false,
          page_ready: false
        }
      ]
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);
  service.warmState.set("rcp", warmStateReady(config, "rcp"));

  const response = await service.executeAction("rcp_snapshot", { accountId: "demo" });

  assert.equal(fakeClient.runCalls.length, 0);
  assert.equal(response.status, "auth_failed");
  assert.equal(response.error_type, "landing_flow_blocked");
  assert.equal(response.lazy_rewarm_attempted, true);
  assert.equal(response.lazy_rewarm_status, "landing_flow_blocked");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
});

test("forbidden action input terms still return 400", async () => {
  const service = createService();
  for (const key of ["url", "path", "header", "cookie", "token", "session", "secret", "raw_body"]) {
    await assert.rejects(
      () => service.executeAction("rcp_snapshot", { [key]: "blocked" }),
      (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
    );
  }
});

test("login_logs_search missing user_id returns parameter_error without platform fetch", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config);
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("login_logs_search", {});

  assert.equal(response.status, "parameter_error");
  assert.equal(response.source_status, "parameter_error");
  assert.equal(response.error_type, "parameter_error");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.deepEqual(fakeClient.runCalls, []);
});

test("login_logs_search builds default seven day online query", () => {
  const request = buildActionBody(ACTIONS.login_logs_search, {
    user_id: "444946196"
  });
  const parsed = new URL(request.path, "https://user-center-workbench.example.test");

  assert.equal(request.method, "GET");
  assert.equal(request.body && Object.keys(request.body).length, 0);
  assert.equal(parsed.pathname, "/rest/unified/log/search");
  assert.equal(parsed.searchParams.get("userId"), "444946196");
  assert.equal(parsed.searchParams.get("recallSource"), "2,0,1,3");
  assert.equal(Number(parsed.searchParams.get("to_timestamp")) - Number(parsed.searchParams.get("from_timestamp")), 7 * 24 * 60 * 60 * 1000);
  assert.equal(request.displayPath.includes("444946196"), false);
  assert.equal(request.displayPath.includes("[typed_user_id]"), false);
});

test("login_logs_search builds explicit timestamp query and recallSource", () => {
  const request = buildActionBody(ACTIONS.login_logs_search, {
    user_id: "444946196",
    from_timestamp: 1780000000000,
    to_timestamp: 1780086400000,
    recallSource: "1,3",
    limit: 10
  });
  const parsed = new URL(request.path, "https://user-center-workbench.example.test");

  assert.equal(parsed.pathname, "/rest/unified/log/search");
  assert.equal(parsed.searchParams.get("userId"), "444946196");
  assert.equal(parsed.searchParams.get("from_timestamp"), "1780000000000");
  assert.equal(parsed.searchParams.get("to_timestamp"), "1780086400000");
  assert.equal(parsed.searchParams.get("recallSource"), "1,3");
  assert.equal(parsed.searchParams.has("limit"), false);
});

test("login_logs_search rejects windows larger than seven days", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config);
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("login_logs_search", {
    user_id: "444946196",
    from_timestamp: 1780000000000,
    to_timestamp: 1780691200001
  });

  assert.equal(response.status, "parameter_error");
  assert.equal(response.source_status, "parameter_error");
  assert.equal(response.error_type, "query_window_too_large");
  assert.deepEqual(fakeClient.runCalls, []);
});

test("login_logs_search successful records return completed summary without raw records", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.login_logs_search,
    {
      user_id: "444946196",
      from_timestamp: 1780000000000,
      to_timestamp: 1780086400000
    },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        code: 0,
        data: {
          records: [
            {
              loginTime: 1780000001000,
              loginResult: "SUCCESS_RAW_VALUE",
              deviceId: "ANDROID_raw_login_device",
              ip: "10.20.30.40",
              origin: "APP_RAW_VALUE",
              rawRecordValue: "raw-login-record-secret"
            },
            {
              loginTime: 1780000002000,
              loginResult: "DENY_RAW_VALUE",
              deviceId: "IOS_raw_login_device",
              clientIp: "10.20.30.41",
              source: "WEB_RAW_VALUE"
            }
          ]
        }
      }),
      bodyTruncated: false,
      observedBytes: 420
    },
    {
      latencyMs: 18,
      originWarmed: true,
      requestPath: "/rest/unified/log/search?userId=%5Btyped_user_id%5D&from_timestamp=1780000000000&to_timestamp=1780086400000&recallSource=2%2C0%2C1%2C3",
      requestMethod: "GET"
    }
  );

  assert.equal(response.status, "completed");
  assert.equal(response.source_status, "completed");
  assert.equal(response.error_type, null);
  assert.equal(response.source_card.path.includes("444946196"), false);
  const summary = response.data.response_summary.login_logs;
  assert.equal(summary.source_status, "completed");
  assert.equal(summary.records_count, 2);
  assert.deepEqual(summary.time_window_observed, {
    from_timestamp: 1780000000000,
    to_timestamp: 1780086400000
  });
  assert.equal(summary.first_login_time_observed, 1780000001000);
  assert.equal(summary.last_login_time_observed, 1780000002000);
  assert.equal(summary.login_result_fields_present, true);
  assert.equal(summary.device_fields_present, true);
  assert.equal(summary.ip_fields_present, true);
  assert.equal(summary.origin_fields_present, true);
  assert.equal(summary.ip_sample_masked, "10.20.*.*");
  assert.equal(summary.device_id_sample_masked, "[masked_device_id:length=24]");
  assert.ok(summary.returned_fields_observed.includes("loginTime"));
  assert.equal(summary.no_data_not_risk_exclusion, true);
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("SUCCESS_RAW_VALUE"), false);
  assert.equal(serialized.includes("DENY_RAW_VALUE"), false);
  assert.equal(serialized.includes("ANDROID_raw_login_device"), false);
  assert.equal(serialized.includes("10.20.30.40"), false);
  assert.equal(serialized.includes("raw-login-record-secret"), false);
});

test("login_logs_search empty records returns no_data without risk exclusion", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.login_logs_search,
    {
      user_id: "444946196",
      from_timestamp: 1780000000000,
      to_timestamp: 1780086400000
    },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({ code: 0, data: { records: [] } }),
      bodyTruncated: false,
      observedBytes: 36
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(response.status, "no_data");
  assert.equal(response.source_status, "no_data");
  assert.equal(response.error_type, null);
  assert.equal(response.data.response_summary.login_logs.records_count, 0);
  assert.equal(response.data.response_summary.login_logs.no_data, true);
  assert.equal(response.source_quality.no_data_not_risk_exclusion, true);
});

test("login_logs_search HTML login page is classified as auth_failed", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.login_logs_search,
    { user_id: "444946196" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: "<html><title>SSO Login</title><body>login logs auth required</body></html>",
      bodyTruncated: false,
      observedBytes: 76
    },
    { latencyMs: 12, originWarmed: true }
  );

  assert.equal(response.status, "auth_failed");
  assert.equal(response.source_status, "auth_failed");
  assert.equal(response.error_type, "auth_failed");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.equal(JSON.stringify(response).includes("login logs auth required"), false);
});

test("login_logs_search platform and network errors stay standardized", async () => {
  const config = createLiveConfig();
  const platformResponse = buildLiveActionResponse(
    ACTIONS.login_logs_search,
    { user_id: "444946196" },
    config,
    {
      completed: true,
      ok: false,
      status: 500,
      bodyText: JSON.stringify({ code: 500, message: "login logs failed" }),
      bodyTruncated: false,
      observedBytes: 44
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(platformResponse.status, "blocked");
  assert.equal(platformResponse.error_type, "platform_error");
  assert.ok(platformResponse.source_card);
  assert.ok(platformResponse.source_quality);
  assert.equal(JSON.stringify(platformResponse).includes("login logs failed"), false);

  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      login_logs: prewarmResult(config, "login_logs")
    },
    runErrors: {
      login_logs_search: new Error("Failed to fetch")
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);
  service.warmState.set("login_logs", warmStateReady(config, "login_logs"));
  const networkResponse = await service.executeAction("login_logs_search", { user_id: "444946196" });

  assert.equal(networkResponse.status, "blocked");
  assert.equal(networkResponse.error_type, "network_error");
  assert.equal(networkResponse.sensitive_output, false);
  assert.ok(networkResponse.source_card);
  assert.ok(networkResponse.source_quality);
});

test("login_logs_search forbidden inputs are rejected", async () => {
  const service = createService();
  for (const key of ["url", "path", "header", "cookie", "token", "session", "secret", "raw_query"]) {
    await assert.rejects(
      () => service.executeAction("login_logs_search", { user_id: "444946196", [key]: "blocked" }),
      (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
    );
  }
});

test("weapon_inventory missing typed params returns parameter_error without platform fetch", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config);
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("weapon_inventory", {});

  assert.equal(response.status, "parameter_error");
  assert.equal(response.source_status, "parameter_error");
  assert.equal(response.error_type, "parameter_error");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.deepEqual(fakeClient.runCalls, []);
});

test("weapon_inventory user_id builds graphData USER_ID to DEVICE_ID query", () => {
  const request = buildActionBody(ACTIONS.weapon_inventory, {
    user_id: "444946196"
  });

  assert.equal(request.method, "GET");
  assert.equal(request.body && Object.keys(request.body).length, 0);
  assert.equal(request.path.startsWith("/apiv2/graphData?"), true);
  assert.equal(request.path.includes("product=KUAISHOU"), true);
  assert.equal(request.path.includes("productName=KUAISHOU"), true);
  assert.equal(request.path.includes("groupValue=444946196"), true);
  assert.equal(request.path.includes("groupKey=USER_ID"), true);
  assert.equal(request.path.includes("dimKey=DEVICE_ID"), true);
  assert.equal(request.path.includes("searchLevel=2"), true);
  assert.equal(request.displayPath.includes("444946196"), false);
  assert.equal(request.followUp.type, "weapon_graph_risk");
  assert.equal(request.followUp.riskDataPath, "/apiv2/riskData");
  assert.equal(request.followUp.includeRiskData, true);
  assert.equal(request.followUp.maxDeviceIds, 5);
});

test("weapon_inventory device_id builds graphData DEVICE_ID to USER_ID query", () => {
  const request = buildActionBody(ACTIONS.weapon_inventory, {
    device_id: "ANDROID_full_prefix_device"
  });

  assert.equal(request.method, "GET");
  assert.equal(request.path.startsWith("/apiv2/graphData?"), true);
  assert.equal(request.path.includes("groupValue=ANDROID_full_prefix_device"), true);
  assert.equal(request.path.includes("groupKey=DEVICE_ID"), true);
  assert.equal(request.path.includes("dimKey=USER_ID"), true);
  assert.equal(request.displayPath.includes("ANDROID_full_prefix_device"), false);
});

test("weapon_inventory empty graphData returns completed_no_data without risk exclusion", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.weapon_inventory,
    { user_id: "444946196" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        graphData: {
          code: 0,
          data: {
            pointInfoMap: {},
            relationEdgeList: []
          }
        },
        riskDataResults: [],
        weapon_chain: {
          riskData_status: "not_executed_missing_device_id"
        }
      }),
      bodyTruncated: false,
      observedBytes: 120
    },
    {
      latencyMs: 10,
      originWarmed: true,
      requestPath: "/apiv2/graphData?product=KUAISHOU&productName=KUAISHOU&groupValue=%5Btyped_user_id%5D&groupKey=USER_ID&dimKey=DEVICE_ID&searchLevel=2",
      requestMethod: "GET"
    }
  );

  assert.equal(response.status, "completed_no_data");
  assert.equal(response.source_status, "completed_no_data");
  assert.equal(response.error_type, null);
  const summary = response.data.response_summary.weapon_inventory;
  assert.equal(summary.graph_status, "completed_no_data");
  assert.equal(summary.pointInfoMap_count, 0);
  assert.equal(summary.relationEdgeList_count, 0);
  assert.equal(summary.riskData_status, "not_executed_missing_device_id");
  assert.equal(summary.no_data_not_risk_exclusion, true);
  assert.equal(response.source_quality.no_data_not_risk_exclusion, true);
});

test("weapon_inventory graphData device IDs drive riskData summary", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.weapon_inventory,
    { user_id: "444946196" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify(weaponCombinedResponse({
        pointInfoMap: {
          "444946196": { nodeType: "user" },
          ANDROID_raw_device_1: { nodeType: "device", deviceId: "ANDROID_raw_device_1" },
          IOS_raw_device_2: { nodeType: "device", deviceId: "IOS_raw_device_2" }
        },
        relationEdgeList: [{ from: "444946196", to: "ANDROID_raw_device_1" }]
      })),
      bodyTruncated: false,
      observedBytes: 520
    },
    {
      latencyMs: 20,
      originWarmed: true,
      requestPath: "/apiv2/graphData?product=KUAISHOU&productName=KUAISHOU&groupValue=%5Btyped_user_id%5D&groupKey=USER_ID&dimKey=DEVICE_ID&searchLevel=2",
      requestMethod: "GET"
    }
  );

  assert.equal(response.status, "completed");
  assert.equal(response.source_status, "completed");
  assert.equal(response.error_type, null);
  const summary = response.data.response_summary.weapon_inventory;
  assert.equal(summary.graph_status, "completed");
  assert.equal(summary.pointInfoMap_present, true);
  assert.equal(summary.pointInfoMap_count, 3);
  assert.equal(summary.relationEdgeList_present, true);
  assert.equal(summary.relationEdgeList_count, 1);
  assert.equal(summary.related_device_count, 2);
  assert.equal(summary.related_user_count, 1);
  assert.equal(summary.masked_device_id_sample, "[masked_device_id:length=20]");
  assert.equal(summary.raw_device_ids_for_internal_chaining_count, 2);
  assert.equal(summary.riskData_status, "completed");
  assert.equal(summary.risk_item_count, 1);
  assert.equal(summary.risk_label_count > 0, true);
  assert.deepEqual(summary.userLevel_observed, ["L3"]);
});

test("weapon_inventory graphData numeric keys are not treated as device IDs", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.weapon_inventory,
    { user_id: "444946196" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        graphData: {
          code: 0,
          data: {
            pointInfoMap: {
              "444946196": { nodeType: "user" },
              "123456789": { nodeType: "user" }
            },
            relationEdgeList: [{ from: "444946196", to: "123456789" }]
          }
        },
        riskDataResults: [],
        weapon_chain: {
          riskData_status: "not_executed_missing_device_id"
        }
      }),
      bodyTruncated: false,
      observedBytes: 240
    },
    { latencyMs: 12, originWarmed: true, requestPath: "/apiv2/graphData", requestMethod: "GET" }
  );

  const summary = response.data.response_summary.weapon_inventory;
  assert.equal(response.status, "completed");
  assert.equal(summary.related_device_count, 0);
  assert.equal(summary.related_user_count, 2);
  assert.equal(summary.masked_device_id_sample, null);
  assert.equal(summary.riskData_status, "not_executed_missing_device_id");
});

test("weapon_inventory riskData list parses labelInfo originalLog and userLevel without raw values", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.weapon_inventory,
    { device_id: "ANDROID_raw_device_1" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify(weaponCombinedResponse({
        pointInfoMap: {
          ANDROID_raw_device_1: { nodeType: "device", deviceId: "ANDROID_raw_device_1" }
        },
        relationEdgeList: [{ from: "ANDROID_raw_device_1", to: "444946196" }],
        riskDataResults: [
          {
            ok: true,
            status: 200,
            body: {
              code: 0,
              data: [
                {
                  deviceId: "ANDROID_raw_device_1",
                  productName: "KUAISHOU",
                  labelInfo: [
                    {
                      groupName: "risk_group",
                      labelName: "readable_risk_label",
                      secretValue: "raw-label-secret-value"
                    }
                  ],
                  originalLog: {
                    eventId: "raw-event-id",
                    nested: {
                      rawKey: "raw-original-log-value"
                    }
                  },
                  userLevel: "L5"
                }
              ]
            }
          }
        ]
      })),
      bodyTruncated: false,
      observedBytes: 520
    },
    {
      latencyMs: 20,
      originWarmed: true,
      requestPath: "/apiv2/graphData?product=KUAISHOU&productName=KUAISHOU&groupValue=%5Btyped_device_id%5D&groupKey=DEVICE_ID&dimKey=USER_ID&searchLevel=2",
      requestMethod: "GET"
    }
  );

  assert.equal(response.status, "completed");
  const summary = response.data.response_summary.weapon_inventory;
  assert.equal(summary.riskData_status, "completed");
  assert.equal(summary.risk_item_count, 1);
  assert.equal(summary.risk_label_summary.labelInfo_present, true);
  assert.equal(summary.risk_label_count > 0, true);
  assert.deepEqual(summary.risk_group_names_observed, ["risk_group"]);
  assert.deepEqual(summary.readable_label_sample, ["readable_risk_label"]);
  assert.deepEqual(summary.originalLog_key_summary.top_level_keys_observed, ["eventId", "nested"]);
  assert.equal(summary.originalLog_key_summary.originalLog_present, true);
  assert.deepEqual(summary.userLevel_observed, ["L5"]);
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("ANDROID_raw_device_1"), false);
  assert.equal(serialized.includes("raw-event-id"), false);
  assert.equal(serialized.includes("raw-original-log-value"), false);
  assert.equal(serialized.includes("raw-label-secret-value"), false);
});

test("weapon_inventory riskData failure leaves graph completed with partial risk status", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.weapon_inventory,
    { user_id: "444946196" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        graphData: {
          code: 0,
          data: {
            pointInfoMap: {
              "444946196": { nodeType: "user" },
              ANDROID_raw_device_1: { nodeType: "device", deviceId: "ANDROID_raw_device_1" }
            },
            relationEdgeList: [{ from: "444946196", to: "ANDROID_raw_device_1" }]
          }
        },
        riskDataResults: [
          {
            ok: false,
            status: 500,
            body: { code: 500, msg: "risk failed" }
          }
        ],
        weapon_chain: {
          riskData_status: "risk_partial_failed",
          selected_device_count: 1
        }
      }),
      bodyTruncated: false,
      observedBytes: 320
    },
    { latencyMs: 22, originWarmed: true, requestPath: "/apiv2/graphData", requestMethod: "GET" }
  );

  assert.equal(response.status, "completed");
  assert.equal(response.source_status, "completed");
  assert.equal(response.error_type, "risk_partial_failed");
  const summary = response.data.response_summary.weapon_inventory;
  assert.equal(summary.graph_status, "completed");
  assert.equal(summary.riskData_status, "risk_partial_failed");
  assert.equal(summary.risk_item_count, 0);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
});

test("weapon_inventory forbidden inputs are rejected and raw response body is not output", async () => {
  const service = createService();
  for (const key of ["url", "path", "header", "cookie", "token", "session", "secret", "raw_body"]) {
    await assert.rejects(
      () => service.executeAction("weapon_inventory", { user_id: "444946196", [key]: "blocked" }),
      (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
    );
  }

  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.weapon_inventory,
    { user_id: "444946196" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify(weaponCombinedResponse({
        pointInfoMap: {
          "444946196": { nodeType: "user" },
          ANDROID_raw_device_secret: { nodeType: "device", deviceId: "ANDROID_raw_device_secret" }
        },
        relationEdgeList: [{ from: "444946196", to: "ANDROID_raw_device_secret" }]
      })),
      bodyTruncated: false,
      observedBytes: 420
    },
    {
      latencyMs: 15,
      originWarmed: true,
      requestPath: "/apiv2/graphData?product=KUAISHOU&productName=KUAISHOU&groupValue=%5Btyped_user_id%5D&groupKey=USER_ID&dimKey=DEVICE_ID&searchLevel=2",
      requestMethod: "GET"
    }
  );

  const serialized = JSON.stringify(response);
  assert.equal(response.source_card.body_policy.raw_response_full_body_returned, false);
  assert.equal(response.sensitive_output, false);
  assert.equal(serialized.includes("ANDROID_raw_device_secret"), false);
  assert.equal(serialized.includes("raw-risk-debug-value"), false);
});

test("rcp_snapshot builds fixed eventList body from typed params", () => {
  const request = buildActionBody(ACTIONS.rcp_snapshot, {
    eventType: "REGISTER",
    source_id: "source-demo",
    device_id: "device-demo",
    startTime: "2026-05-29 10:00:00",
    endTime: "2026-05-29 10:30:00",
    page: 2,
    pageSize: 100,
    selected_columns: ["sourceId", "eventId", "_occurTime", "deviceId"]
  });

  assert.equal(request.method, "POST");
  assert.equal(request.path, "/v2/rest/event/eventList");
  assert.deepEqual(request.body.tableHeaderList, [
    { column_name: "sourceId", column_comment: "sourceId" },
    { column_name: "eventId", column_comment: "eventId" },
    { column_name: "_occurTime", column_comment: "_occurTime" },
    { column_name: "deviceId", column_comment: "deviceId" }
  ]);
  assert.equal(request.body.startTime, "2026-05-29 10:00:00");
  assert.equal(request.body.endTime, "2026-05-29 10:30:00");
  assert.equal(request.body.currentTime, "2026-05-29 10:30:00");
  assert.deepEqual(Object.keys(request.body.eventV2), [
    "eventType",
    "hitPolicies",
    "version",
    "status",
    "snapshotVersion",
    "sourceIds",
    "realTimeOp",
    "isPolicyTreeExperiment",
    "conditionList",
    "grayFeature",
    "grayQueryStatus",
    "region"
  ]);
  assert.equal(request.body.eventV2.eventType, "REGISTER");
  assert.equal(request.body.eventV2.hitPolicies, "");
  assert.equal(request.body.eventV2.version, "");
  assert.equal(request.body.eventV2.status, 2);
  assert.equal(request.body.eventV2.snapshotVersion, "");
  assert.equal(request.body.eventV2.sourceIds, "source-demo");
  assert.equal(request.body.eventV2.realTimeOp, "");
  assert.equal(request.body.eventV2.isPolicyTreeExperiment, false);
  assert.equal(request.body.eventV2.grayFeature, "");
  assert.equal(request.body.eventV2.grayQueryStatus, 0);
  assert.equal(request.body.eventV2.region, "china");
  assert.equal(Object.hasOwn(request.body, "conditionList"), false);
  assert.deepEqual(request.body.eventV2.conditionList, [
    [
      {
        key: "deviceId",
        logic: "term",
        value: "device-demo",
        id: "00000000-0000-4000-8000-000000000000",
        seq: 0,
        keyType: "主表",
        description: "",
        rightDataType: "C"
      }
    ]
  ]);
  assert.equal(Object.hasOwn(request.body, "pagination"), false);
  assert.equal(request.body.pageIndex, 2);
  assert.equal(request.body.pageSize, 100);
});

test("rcp_snapshot uses HAR-like body template with typed overrides", () => {
  const request = buildActionBody(ACTIONS.rcp_snapshot, {
    sourceIds: ["source-a", "source-b"],
    page: 1,
    pageSize: 200
  });

  assert.deepEqual(Object.keys(request.body), [
    "tableHeaderList",
    "startTime",
    "endTime",
    "currentTime",
    "eventV2",
    "pageIndex",
    "pageSize"
  ]);
  assert.equal(typeof request.body.startTime, "string");
  assert.equal(typeof request.body.endTime, "string");
  assert.equal(typeof request.body.currentTime, "string");
  assert.equal(request.body.eventV2.eventType, "USER_REGISTER_NEW");
  assert.equal(request.body.eventV2.sourceIds, "source-a,source-b");
  assert.equal(Array.isArray(request.body.eventV2.sourceIds), false);
  assert.equal(typeof request.body.eventV2.hitPolicies, "string");
  assert.equal(typeof request.body.eventV2.grayFeature, "string");
  assert.equal(request.body.eventV2.grayQueryStatus, 0);
  assert.equal(request.body.eventV2.status, 2);
  assert.deepEqual(request.body.eventV2.conditionList, []);
  assert.equal(Object.hasOwn(request.body, "conditionList"), false);
  assert.equal(Object.hasOwn(request.body, "pagination"), false);
  assert.equal(request.body.pageIndex, 1);
  assert.equal(request.body.pageSize, 200);
  assert.ok(request.body.tableHeaderList.every((column) => {
    return typeof column.column_name === "string" && typeof column.column_comment === "string";
  }));
  assert.equal(JSON.stringify(request.body).includes("\"field\""), false);
  assert.equal(JSON.stringify(request.body).includes("\"operator\""), false);
});

test("rcp_snapshot selected_columns only changes tableHeaderList", () => {
  const defaultRequest = buildActionBody(ACTIONS.rcp_snapshot, {});
  const selectedRequest = buildActionBody(ACTIONS.rcp_snapshot, {
    selected_columns: ["sourceId", "eventId"]
  });

  assert.deepEqual(selectedRequest.body.tableHeaderList, [
    { column_name: "sourceId", column_comment: "sourceId" },
    { column_name: "eventId", column_comment: "eventId" }
  ]);
  assert.deepEqual(selectedRequest.body.eventV2, defaultRequest.body.eventV2);
  assert.equal(selectedRequest.body.pageIndex, defaultRequest.body.pageIndex);
  assert.equal(selectedRequest.body.pageSize, defaultRequest.body.pageSize);
  assert.equal(selectedRequest.body.startTime.length, 19);
  assert.equal(selectedRequest.body.endTime.length, 19);
});

test("rcp_snapshot status message wrapper is classified as request body shape error", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.rcp_snapshot,
    {},
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        status: 500,
        message: "request rejected",
        host: "shape-only-host",
        port: 0,
        timestamp: "2026-05-29 10:01:00",
        traceId: "shape-only-trace",
        traceSampled: false
      }),
      bodyTruncated: false,
      observedBytes: 160
    },
    {
      latencyMs: 12,
      originWarmed: true,
      requestPath: "/v2/rest/event/eventList",
      requestMethod: "POST"
    }
  );

  assert.equal(response.status, "parameter_error");
  assert.equal(response.source_status, "parameter_error");
  assert.equal(response.error_type, "wrong_request_body_shape");
  assert.deepEqual(response.data.response_summary.rcp_snapshot.response_wrapper_paths_present, {
    data_eventList: false,
    data_pagination: false,
    data_tableHeaderList: false
  });
  assert.equal(response.data.response_summary.rcp_snapshot.response_error_category, "wrong_request_body_shape");
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("request rejected"), false);
  assert.equal(serialized.includes("shape-only-host"), false);
  assert.equal(serialized.includes("shape-only-trace"), false);
});

test("rcp_snapshot epoch time input returns wrong_time_field_format without platform fetch", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config);
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("rcp_snapshot", {
    startTime: 1780000000000,
    endTime: 1780001800000
  });

  assert.equal(response.status, "parameter_error");
  assert.equal(response.source_status, "parameter_error");
  assert.equal(response.error_type, "wrong_time_field_format");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.deepEqual(fakeClient.runCalls, []);
});

test("rcp_snapshot successful eventList JSON returns completed shape summary", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.rcp_snapshot,
    {
      eventType: "REGISTER",
      source_id: "source-demo",
      startTime: "2026-05-29 10:00:00",
      endTime: "2026-05-29 10:30:00"
    },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        code: 0,
        data: {
          eventList: [
            {
              sourceId: "raw-source-id",
              eventId: "raw-event-id",
              _occurTime: "2026-05-29 10:01:00",
              deviceId: "raw-device-id",
              dynamicScore: "raw-dynamic-value"
            }
          ],
          pagination: {
            page: 1,
            pageSize: 200,
            total: 1
          },
          tableHeaderList: [
            { column_name: "sourceId", column_comment: "sourceId" },
            { column_name: "eventId", column_comment: "eventId" },
            { column_name: "_occurTime", column_comment: "_occurTime" },
            { column_name: "deviceId", column_comment: "deviceId" }
          ]
        }
      }),
      bodyTruncated: false,
      observedBytes: 480
    },
    {
      latencyMs: 18,
      originWarmed: true,
      requestPath: "/v2/rest/event/eventList",
      requestMethod: "POST"
    }
  );

  assert.equal(response.status, "completed");
  assert.equal(response.source_status, "completed");
  assert.equal(response.error_type, null);
  assert.equal(response.source_card.path, "/v2/rest/event/eventList");
  assert.equal(response.source_card.method, "POST");
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  const summary = response.data.response_summary.rcp_snapshot;
  assert.deepEqual(summary.response_wrapper_paths_present, {
    data_eventList: true,
    data_pagination: true,
    data_tableHeaderList: true
  });
  assert.equal(summary.event_count, 1);
  assert.deepEqual(summary.pagination_summary, {
    page: 1,
    pageSize: 200,
    total: 1
  });
  assert.deepEqual(summary.table_header_columns, ["sourceId", "eventId", "_occurTime", "deviceId"]);
  assert.deepEqual(summary.first_event_shape_keys, ["sourceId", "eventId", "_occurTime", "deviceId", "dynamicScore"]);
  assert.ok(summary.dynamic_columns_observed.includes("dynamicScore"));
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("raw-source-id"), false);
  assert.equal(serialized.includes("raw-event-id"), false);
  assert.equal(serialized.includes("raw-device-id"), false);
  assert.equal(serialized.includes("raw-dynamic-value"), false);
});

test("rcp_snapshot empty eventList returns source no-hit without risk exclusion", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.rcp_snapshot,
    { startTime: "2026-05-29 10:00:00", endTime: "2026-05-29 10:30:00" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        code: 0,
        data: {
          eventList: [],
          pagination: { page: 1, pageSize: 200, total: 0 },
          tableHeaderList: [{ column_name: "sourceId", column_comment: "sourceId" }]
        }
      }),
      bodyTruncated: false,
      observedBytes: 180
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(response.status, "completed_no_hit_for_small_window");
  assert.equal(response.source_status, "completed_no_hit_for_small_window");
  assert.equal(response.error_type, null);
  assert.equal(response.data.response_summary.rcp_snapshot.event_count, 0);
  assert.equal(response.data.response_summary.rcp_snapshot.no_data, true);
  assert.equal(response.source_quality.no_data_not_risk_exclusion, true);
});

test("rcp_snapshot HTML login page is classified as auth_failed", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.rcp_snapshot,
    {},
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: "<html><title>SSO Login</title><body>rcp login required</body></html>",
      bodyTruncated: false,
      observedBytes: 71
    },
    { latencyMs: 12, originWarmed: true }
  );

  assert.equal(response.status, "auth_failed");
  assert.equal(response.source_status, "auth_failed");
  assert.equal(response.error_type, "auth_failed");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.equal(JSON.stringify(response).includes("rcp login required"), false);
});

test("rcp_snapshot platform and network errors stay standardized", async () => {
  const config = createLiveConfig();
  const platformResponse = buildLiveActionResponse(
    ACTIONS.rcp_snapshot,
    {},
    config,
    {
      completed: true,
      ok: false,
      status: 500,
      bodyText: JSON.stringify({ code: 500, message: "eventList query failed" }),
      bodyTruncated: false,
      observedBytes: 48
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(platformResponse.status, "blocked");
  assert.equal(platformResponse.error_type, "platform_error");
  assert.ok(platformResponse.source_card);
  assert.ok(platformResponse.source_quality);
  assert.equal(JSON.stringify(platformResponse).includes("eventList query failed"), false);

  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      rcp: prewarmResult(config, "rcp")
    },
    runErrors: {
      rcp_snapshot: new Error("Failed to fetch")
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);
  service.warmState.set("rcp", warmStateReady(config, "rcp"));
  const networkResponse = await service.executeAction("rcp_snapshot", {});

  assert.equal(networkResponse.status, "blocked");
  assert.equal(networkResponse.error_type, "network_error");
  assert.equal(networkResponse.sensitive_output, false);
  assert.ok(networkResponse.source_card);
  assert.ok(networkResponse.source_quality);
});

test("live response shape summary does not include raw response body values", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.rcp_snapshot,
    { accountId: "demo" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        visible_key: "raw-body-value",
        nested: { token: "never-output" }
      }),
      bodyTruncated: false,
      observedBytes: 80
    },
    {
      latencyMs: 12,
      originWarmed: true,
      actionDiagnostics: {
        action_name: "rcp_snapshot",
        expected_origin: "https://rcp.example.test",
        bound_page_origin: "https://rcp.example.test",
        origin_warmed: true,
        origin_match: true
      }
    }
  );

  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("raw-body-value"), false);
  assert.equal(serialized.includes("never-output"), false);
  assert.equal(response.sensitive_output, false);
  assert.equal(response.source_card.body_policy.raw_response_full_body_returned, false);
});

test("track_analysis_summary missing typed params returns parameter_error without platform fetch", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config);
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("track_analysis_summary", { appName: "KUAISHOU" });

  assert.equal(response.status, "parameter_error");
  assert.equal(response.source_status, "parameter_error");
  assert.equal(response.error_type, "parameter_error");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.deepEqual(fakeClient.prewarmCalls, []);
  assert.deepEqual(fakeClient.runCalls, []);
});

test("track_analysis_summary builds fixed getLastestDateTime relative path from typed params", () => {
  const request = buildActionBody(ACTIONS.track_analysis_summary, {
    user_id: "demo-user",
    appName: "KUAISHOU"
  });

  assert.equal(request.method, "GET");
  assert.equal(request.body && Object.keys(request.body).length, 0);
  assert.equal(request.path.startsWith("/dp/platform/app/analytics/v2/sequence/getLastestDateTime?"), true);
  assert.equal(request.path.includes("product=KUAISHOU"), true);
  assert.equal(request.path.includes("type=userId"), true);
  assert.equal(request.path.includes("funcType=USER_PROFILE_QUERY"), true);
  assert.equal(request.path.includes("_t="), true);
  assert.equal(request.path.includes("demo-user"), false);
});

test("track_analysis_summary getUseDuration missing typed params returns parameter_error", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config);
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("track_analysis_summary", {
    sub_interface: "getUseDuration",
    appName: "KUAISHOU"
  });

  assert.equal(response.status, "parameter_error");
  assert.equal(response.source_status, "parameter_error");
  assert.equal(response.error_type, "parameter_error");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.deepEqual(fakeClient.runCalls, []);
});

test("track_analysis_summary builds fixed getUseDuration request from typed params", () => {
  const request = buildActionBody(ACTIONS.track_analysis_summary, {
    sub_interface: "getUseDuration",
    device_id: "ANDROID_demo",
    appName: "KUAISHOU"
  });

  assert.equal(request.method, "POST");
  assert.equal(request.path, "/dp/platform/app/analytics/v2/sequence/getUseDuration");
  assert.equal(request.body.appName, "KUAISHOU");
  assert.equal(request.body.funcType, "USER_PROFILE_QUERY");
  assert.equal(request.body.deviceId, "ANDROID_demo");
  assert.equal(typeof request.body._t, "string");
  assert.equal(Object.hasOwn(request.body, "user_id"), false);
  assert.equal(Object.hasOwn(request.body, "url"), false);
});

test("track_analysis_summary profile missing typed params returns parameter_error", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config);
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("track_analysis_summary", {
    sub_interface: "profile",
    appName: "KUAISHOU"
  });

  assert.equal(response.status, "parameter_error");
  assert.equal(response.source_status, "parameter_error");
  assert.equal(response.error_type, "parameter_error");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.deepEqual(fakeClient.runCalls, []);
});

test("track_analysis_summary builds fixed profile request from typed params", () => {
  const request = buildActionBody(ACTIONS.track_analysis_summary, {
    sub_interface: "profile",
    user_id: "demo-user",
    appName: "KUAISHOU",
    time_window: {
      startTime: 1780000000000,
      endTime: 1780086400000
    }
  });

  assert.equal(request.method, "POST");
  assert.equal(request.path, "/dp/platform/app/analytics/v2/sequence/profile");
  assert.equal(request.body.appName, "KUAISHOU");
  assert.equal(request.body.startTime, 1780000000000);
  assert.equal(request.body.endTime, 1780086400000);
  assert.equal(request.body.include, 1);
  assert.equal(request.body.pageSize, 100);
  assert.equal(request.body.funcType, "USER_PROFILE_QUERY");
  assert.equal(request.body.userId, "demo-user");
  assert.equal(typeof request.body._t, "string");
  assert.equal(Object.hasOwn(request.body, "url"), false);
});

test("track_analysis_summary getDeviceIds missing typed params returns parameter_error", async () => {
  const config = createLiveConfig();
  const fakeClient = new FakeBrowserClient(config);
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("track_analysis_summary", {
    sub_interface: "getDeviceIds",
    appName: "KUAISHOU"
  });

  assert.equal(response.status, "parameter_error");
  assert.equal(response.source_status, "parameter_error");
  assert.equal(response.error_type, "parameter_error");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.deepEqual(fakeClient.runCalls, []);
});

test("track_analysis_summary builds fixed getDeviceIds request from typed params", () => {
  const request = buildActionBody(ACTIONS.track_analysis_summary, {
    sub_interface: "getDeviceIds",
    user_id: "demo-user",
    appName: "KUAISHOU"
  });

  assert.equal(request.method, "POST");
  assert.equal(request.path, "/dp/platform/app/analytics/v2/sequence/getDeviceIds");
  assert.equal(request.body.appName, "KUAISHOU");
  assert.equal(request.body.funcType, "USER_PROFILE_QUERY");
  assert.equal(request.body.userId, "demo-user");
  assert.equal(typeof request.body._t, "string");
  assert.equal(Object.hasOwn(request.body, "url"), false);
  assert.equal(Object.hasOwn(request.body, "path"), false);

  const deviceRequest = buildActionBody(ACTIONS.track_analysis_summary, {
    sub_interface: "getDeviceIds",
    device_id: "ANDROID_demo",
    appName: "NEBULA"
  });

  assert.equal(deviceRequest.path, "/dp/platform/app/analytics/v2/sequence/getDeviceIds");
  assert.equal(deviceRequest.body.appName, "NEBULA");
  assert.equal(deviceRequest.body.deviceId, "ANDROID_demo");
  assert.equal(Object.hasOwn(deviceRequest.body, "userId"), false);
});

test("track_analysis_summary successful live JSON returns completed shape-only source result", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        code: 0,
        data: {
          lastestDateTime: "raw-latest-value",
          uidDidRelLatestDateTime: "raw-relation-value"
        }
      }),
      bodyTruncated: false,
      observedBytes: 120
    },
    {
      latencyMs: 15,
      originWarmed: true,
      requestPath: "/dp/platform/app/analytics/v2/sequence/getLastestDateTime?product=KUAISHOU&type=userId&funcType=USER_PROFILE_QUERY&_t=1"
    }
  );

  assert.equal(response.status, "completed");
  assert.equal(response.source_status, "completed");
  assert.equal(response.error_type, null);
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.equal(response.data.response_summary.track_analysis.sub_interface, "getLastestDateTime");
  assert.equal(response.data.response_summary.track_analysis.latest_datetime_present, true);
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("raw-latest-value"), false);
  assert.equal(serialized.includes("raw-relation-value"), false);
});

test("track_analysis_summary getUseDuration successful rows returns activity summary", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "getUseDuration", user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        code: 0,
        data: {
          rows: [
            { date: "2026-05-26", duration: 0, debugValue: "raw-duration-debug-value" },
            { date: "2026-05-27", duration: 60 },
            { date: "2026-05-28", duration: 120 }
          ]
        }
      }),
      bodyTruncated: false,
      observedBytes: 180
    },
    {
      latencyMs: 18,
      originWarmed: true,
      requestPath: "/dp/platform/app/analytics/v2/sequence/getUseDuration",
      requestMethod: "POST"
    }
  );

  assert.equal(response.status, "completed");
  assert.equal(response.source_status, "completed");
  assert.equal(response.error_type, null);
  assert.equal(response.source_card.method, "POST");
  assert.equal(response.source_card.path, "/dp/platform/app/analytics/v2/sequence/getUseDuration");
  const summary = response.data.response_summary.track_analysis.activity_summary;
  assert.deepEqual(summary, {
    rows_count: 3,
    total_duration: 180,
    peak_duration: 120,
    peak_date: "2026-05-28",
    nonzero_days_count: 2,
    date_range_observed: {
      from: "2026-05-26",
      to: "2026-05-28"
    }
  });
  assert.deepEqual(response.data.response_summary.track_analysis.output_fields_observed, [
    "data.rows[].date",
    "data.rows[].duration"
  ]);
  assert.equal(JSON.stringify(response).includes("raw-duration-debug-value"), false);
});

test("track_analysis_summary profile successful JSON returns profile summary without raw values", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "profile", user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        code: 0,
        data: {
          deviceIds: ["ANDROID_raw_device_id", "IOS_raw_device_id"],
          latestDateTime: "raw-latest-profile-date",
          profile: {
            firstLevelProfile: {
              userId: "raw-user-value",
              gender: "raw-gender-value",
              city: "raw-city-value"
            },
            secondLevelProfile: [
              { label: "register_time", value: "raw-register-time-value" },
              { label: "fan_distribution", value: "raw-fan-value" },
              { label: "active_days_bucket", value: "raw-active-days-value" }
            ]
          }
        }
      }),
      bodyTruncated: false,
      observedBytes: 360
    },
    {
      latencyMs: 20,
      originWarmed: true,
      requestPath: "/dp/platform/app/analytics/v2/sequence/profile",
      requestMethod: "POST"
    }
  );

  assert.equal(response.status, "completed");
  assert.equal(response.source_status, "completed");
  assert.equal(response.error_type, null);
  assert.equal(response.source_card.method, "POST");
  assert.equal(response.source_card.path, "/dp/platform/app/analytics/v2/sequence/profile");
  const summary = response.data.response_summary.track_analysis.profile_summary;
  assert.equal(summary.first_level_profile_keys_count, 3);
  assert.equal(summary.second_level_profile_keys_count, 3);
  assert.equal(summary.register_time_present, true);
  assert.equal(summary.fan_distribution_present, true);
  assert.equal(summary.active_days_bucket_present, true);
  assert.equal(summary.device_ids_count, 2);
  assert.ok(summary.profile_sections_observed.includes("data.profile.firstLevelProfile"));
  assert.ok(summary.output_fields_observed.includes("data.profile.secondLevelProfile[].label"));
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("raw-user-value"), false);
  assert.equal(serialized.includes("raw-register-time-value"), false);
  assert.equal(serialized.includes("ANDROID_raw_device_id"), false);
});

test("track_analysis_summary getDeviceIds successful JSON returns device summary without raw values", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "getDeviceIds", user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        code: 0,
        data: {
          deviceIds: [
            {
              deviceId: "ANDROID_raw_device_id_1",
              deviceModel: "raw-model-value",
              lastActiveTime: "raw-active-time-value",
              debugValue: "raw-device-debug-value"
            },
            {
              deviceId: "IOS_raw_device_id_2",
              deviceModel: "raw-second-model-value",
              lastActiveTime: "raw-second-active-time-value"
            }
          ]
        }
      }),
      bodyTruncated: false,
      observedBytes: 360
    },
    {
      latencyMs: 20,
      originWarmed: true,
      requestPath: "/dp/platform/app/analytics/v2/sequence/getDeviceIds",
      requestMethod: "POST"
    }
  );

  assert.equal(response.status, "completed");
  assert.equal(response.source_status, "completed");
  assert.equal(response.error_type, null);
  assert.equal(response.source_card.method, "POST");
  assert.equal(response.source_card.path, "/dp/platform/app/analytics/v2/sequence/getDeviceIds");
  const summary = response.data.response_summary.track_analysis.device_summary;
  assert.equal(summary.device_ids_count, 2);
  assert.equal(summary.device_id_sample_masked, "[masked_device_id:length=23]");
  assert.equal(summary.device_model_fields_present, true);
  assert.equal(summary.last_active_fields_present, true);
  assert.deepEqual(summary.device_fields_observed, ["deviceId", "deviceModel", "lastActiveTime", "debugValue"]);
  assert.ok(summary.output_fields_observed.includes("data.deviceIds[].deviceId"));
  assert.ok(summary.output_fields_observed.includes("data.deviceIds[].lastActiveTime"));
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("ANDROID_raw_device_id_1"), false);
  assert.equal(serialized.includes("raw-model-value"), false);
  assert.equal(serialized.includes("raw-device-debug-value"), false);
});

test("track_analysis_summary HTML login page is classified as auth_failed without raw body", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { device_id: "ANDROID_demo", appName: "NEBULA" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: "<html><title>SSO Login</title><body>login required</body></html>",
      bodyTruncated: false,
      observedBytes: 64
    },
    { latencyMs: 12, originWarmed: true }
  );

  assert.equal(response.status, "auth_failed");
  assert.equal(response.source_status, "auth_failed");
  assert.equal(response.error_type, "auth_failed");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.equal(JSON.stringify(response).includes("login required"), false);
});

test("track_analysis_summary getUseDuration HTML login page is classified as auth_failed", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "getUseDuration", device_id: "ANDROID_demo", appName: "NEBULA" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: "<html><title>SSO Login</title><body>duration login required</body></html>",
      bodyTruncated: false,
      observedBytes: 73
    },
    { latencyMs: 12, originWarmed: true }
  );

  assert.equal(response.status, "auth_failed");
  assert.equal(response.source_status, "auth_failed");
  assert.equal(response.error_type, "auth_failed");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.equal(JSON.stringify(response).includes("duration login required"), false);
});

test("track_analysis_summary profile HTML login page is classified as auth_failed", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "profile", device_id: "ANDROID_demo", appName: "NEBULA" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: "<html><title>SSO Login</title><body>profile login required</body></html>",
      bodyTruncated: false,
      observedBytes: 72
    },
    { latencyMs: 12, originWarmed: true }
  );

  assert.equal(response.status, "auth_failed");
  assert.equal(response.source_status, "auth_failed");
  assert.equal(response.error_type, "auth_failed");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.equal(JSON.stringify(response).includes("profile login required"), false);
});

test("track_analysis_summary getDeviceIds HTML login page is classified as auth_failed", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "getDeviceIds", user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: "<html><title>SSO Login</title><body>device login required</body></html>",
      bodyTruncated: false,
      observedBytes: 72
    },
    { latencyMs: 12, originWarmed: true }
  );

  assert.equal(response.status, "auth_failed");
  assert.equal(response.source_status, "auth_failed");
  assert.equal(response.error_type, "auth_failed");
  assert.equal(response.sensitive_output, false);
  assert.ok(response.source_card);
  assert.ok(response.source_quality);
  assert.equal(JSON.stringify(response).includes("device login required"), false);
});

test("track_analysis_summary empty data returns no_data without risk exclusion", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({ code: 0, data: {} }),
      bodyTruncated: false,
      observedBytes: 20
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(response.status, "no_data");
  assert.equal(response.source_status, "no_data");
  assert.equal(response.error_type, null);
  assert.equal(response.data.response_summary.track_analysis.no_data, true);
  assert.equal(response.source_quality.no_data_not_risk_exclusion, true);
});

test("track_analysis_summary getUseDuration empty rows returns no_data without risk exclusion", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "getUseDuration", user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({ code: 0, data: { rows: [] } }),
      bodyTruncated: false,
      observedBytes: 29
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(response.status, "no_data");
  assert.equal(response.source_status, "no_data");
  assert.equal(response.error_type, null);
  assert.equal(response.data.response_summary.track_analysis.no_data, true);
  assert.equal(response.data.response_summary.track_analysis.activity_summary.rows_count, 0);
  assert.equal(response.source_quality.no_data_not_risk_exclusion, true);
});

test("track_analysis_summary profile empty data returns no_data without risk exclusion", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "profile", user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({ code: 0, data: { profile: {} } }),
      bodyTruncated: false,
      observedBytes: 30
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(response.status, "no_data");
  assert.equal(response.source_status, "no_data");
  assert.equal(response.error_type, null);
  assert.equal(response.data.response_summary.track_analysis.no_data, true);
  assert.equal(response.data.response_summary.track_analysis.profile_summary.first_level_profile_keys_count, 0);
  assert.equal(response.source_quality.no_data_not_risk_exclusion, true);
});

test("track_analysis_summary getDeviceIds empty data returns no_data without risk exclusion", () => {
  const config = createLiveConfig();
  const response = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "getDeviceIds", user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: true,
      status: 200,
      bodyText: JSON.stringify({ code: 0, data: { deviceIds: [] } }),
      bodyTruncated: false,
      observedBytes: 32
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(response.status, "no_data");
  assert.equal(response.source_status, "no_data");
  assert.equal(response.error_type, null);
  assert.equal(response.data.response_summary.track_analysis.no_data, true);
  assert.equal(response.data.response_summary.track_analysis.device_summary.device_ids_count, 0);
  assert.equal(response.source_quality.no_data_not_risk_exclusion, true);
});

test("track_analysis_summary platform and network errors stay standardized", async () => {
  const config = createLiveConfig();
  const platformResponse = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: false,
      status: 500,
      bodyText: JSON.stringify({ code: 500, data: null }),
      bodyTruncated: false,
      observedBytes: 28
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(platformResponse.status, "blocked");
  assert.equal(platformResponse.error_type, "platform_error");
  assert.ok(platformResponse.source_card);
  assert.ok(platformResponse.source_quality);

  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      track_analysis: prewarmResult(config, "track_analysis")
    },
    runErrors: {
      track_analysis_summary: new Error("Failed to fetch")
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);
  service.warmState.set("track_analysis", warmStateReady(config, "track_analysis"));
  const networkResponse = await service.executeAction("track_analysis_summary", {
    user_id: "demo-user",
    appName: "KUAISHOU"
  });

  assert.equal(networkResponse.status, "blocked");
  assert.equal(networkResponse.error_type, "network_error");
  assert.equal(networkResponse.sensitive_output, false);
  assert.ok(networkResponse.source_card);
  assert.ok(networkResponse.source_quality);
});

test("track_analysis_summary getDeviceIds platform and network errors stay standardized", async () => {
  const config = createLiveConfig();
  const platformResponse = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "getDeviceIds", user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: false,
      status: 500,
      bodyText: JSON.stringify({ code: 500, data: null }),
      bodyTruncated: false,
      observedBytes: 28
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(platformResponse.status, "blocked");
  assert.equal(platformResponse.error_type, "platform_error");
  assert.ok(platformResponse.source_card);
  assert.ok(platformResponse.source_quality);

  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      track_analysis: prewarmResult(config, "track_analysis")
    },
    runErrors: {
      track_analysis_summary: new Error("Failed to fetch")
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);
  service.warmState.set("track_analysis", warmStateReady(config, "track_analysis"));
  const networkResponse = await service.executeAction("track_analysis_summary", {
    sub_interface: "getDeviceIds",
    user_id: "demo-user",
    appName: "KUAISHOU"
  });

  assert.equal(networkResponse.status, "blocked");
  assert.equal(networkResponse.error_type, "network_error");
  assert.equal(networkResponse.sensitive_output, false);
  assert.ok(networkResponse.source_card);
  assert.ok(networkResponse.source_quality);
});

test("track_analysis_summary profile platform and network errors stay standardized", async () => {
  const config = createLiveConfig();
  const platformResponse = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "profile", user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: false,
      status: 500,
      bodyText: JSON.stringify({ code: 500, data: null }),
      bodyTruncated: false,
      observedBytes: 28
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(platformResponse.status, "blocked");
  assert.equal(platformResponse.error_type, "platform_error");
  assert.ok(platformResponse.source_card);
  assert.ok(platformResponse.source_quality);

  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      track_analysis: prewarmResult(config, "track_analysis")
    },
    runErrors: {
      track_analysis_summary: new Error("Failed to fetch")
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);
  service.warmState.set("track_analysis", warmStateReady(config, "track_analysis"));
  const networkResponse = await service.executeAction("track_analysis_summary", {
    sub_interface: "profile",
    user_id: "demo-user",
    appName: "KUAISHOU"
  });

  assert.equal(networkResponse.status, "blocked");
  assert.equal(networkResponse.error_type, "network_error");
  assert.equal(networkResponse.sensitive_output, false);
  assert.ok(networkResponse.source_card);
  assert.ok(networkResponse.source_quality);
});

test("track_analysis_summary getUseDuration platform and network errors stay standardized", async () => {
  const config = createLiveConfig();
  const platformResponse = buildLiveActionResponse(
    ACTIONS.track_analysis_summary,
    { sub_interface: "getUseDuration", user_id: "demo-user", appName: "KUAISHOU" },
    config,
    {
      completed: true,
      ok: false,
      status: 500,
      bodyText: JSON.stringify({ code: 500, data: null }),
      bodyTruncated: false,
      observedBytes: 28
    },
    { latencyMs: 10, originWarmed: true }
  );

  assert.equal(platformResponse.status, "blocked");
  assert.equal(platformResponse.error_type, "platform_error");
  assert.ok(platformResponse.source_card);
  assert.ok(platformResponse.source_quality);

  const fakeClient = new FakeBrowserClient(config, {
    prewarmResults: {
      track_analysis: prewarmResult(config, "track_analysis")
    },
    runErrors: {
      track_analysis_summary: new Error("Failed to fetch")
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);
  service.warmState.set("track_analysis", warmStateReady(config, "track_analysis"));
  const networkResponse = await service.executeAction("track_analysis_summary", {
    sub_interface: "getUseDuration",
    user_id: "demo-user",
    appName: "KUAISHOU"
  });

  assert.equal(networkResponse.status, "blocked");
  assert.equal(networkResponse.error_type, "network_error");
  assert.equal(networkResponse.sensitive_output, false);
  assert.ok(networkResponse.source_card);
  assert.ok(networkResponse.source_quality);
});

function weaponCombinedResponse({
  pointInfoMap,
  relationEdgeList,
  riskDataResults = [
    {
      ok: true,
      status: 200,
      body: {
        code: 0,
        data: [
          {
            deviceId: "ANDROID_raw_device_1",
            productName: "KUAISHOU",
            labelInfo: [
              {
                groupName: "risk_group",
                labelName: "readable_risk_label",
                debugValue: "raw-risk-debug-value"
              }
            ],
            originalLog: {
              eventId: "raw-event-id",
              extra: "raw-original-log-value"
            },
            userLevel: "L3"
          }
        ]
      }
    }
  ]
}) {
  return {
    graphData: {
      code: 0,
      data: {
        pointInfoMap,
        relationEdgeList
      }
    },
    riskDataResults,
    weapon_chain: {
      graphData_status: "completed",
      riskData_status: riskDataResults.length > 0 ? "completed" : "not_executed_missing_device_id",
      selected_device_count: riskDataResults.length
    }
  };
}

class FakeBrowserClient {
  constructor(config, options = {}) {
    this.config = config;
    this.prewarmResults = options.prewarmResults || {};
    this.diagnostics = options.diagnostics || {};
    this.diagnosticCalls = new Map();
    this.fetchResults = options.fetchResults || {};
    this.runErrors = options.runErrors || {};
    this.prewarmCalls = [];
    this.runCalls = [];
  }

  status() {
    return {
      browser_initialized: true,
      context_initialized: true
    };
  }

  async start() {}

  async prewarmDomain(domainKey) {
    this.prewarmCalls.push(domainKey);
    return this.prewarmResults[domainKey] || prewarmResult(this.config, domainKey);
  }

  actionDiagnostics(action, originWarmed) {
    const domain = this.config.domains[action.domainKey];
    const configuredDiagnostics = this.diagnostics[action.domainKey] || {
      bound_page_origin: domain.origin,
      origin_match: true,
      page_ready: true
    };
    const diagnostics = Array.isArray(configuredDiagnostics)
      ? configuredDiagnostics[Math.min(this.nextDiagnosticIndex(action.domainKey), configuredDiagnostics.length - 1)]
      : configuredDiagnostics;

    return {
      action_name: action.name,
      expected_origin: domain.origin,
      bound_page_origin: diagnostics.bound_page_origin,
      origin_warmed: Boolean(originWarmed),
      page_ready: Boolean(diagnostics.page_ready),
      origin_match: diagnostics.origin_match
    };
  }

  domainState(domainKey) {
    const domain = this.config.domains[domainKey];
    return {
      current_origin: domain.origin,
      page_ready: true
    };
  }

  async runAction(action, actionRequest) {
    if (this.runErrors[action.name]) {
      throw this.runErrors[action.name];
    }
    this.runCalls.push({
      actionName: action.name,
      domainKey: action.domainKey,
      path: actionRequest.path,
      method: actionRequest.method,
      body: actionRequest.body
    });
    return this.fetchResults[action.name] || {
      completed: true,
      ok: true,
      status: 200,
      bodyText: "{}",
      bodyTruncated: false,
      observedBytes: 2
    };
  }

  nextDiagnosticIndex(domainKey) {
    const current = this.diagnosticCalls.get(domainKey) || 0;
    this.diagnosticCalls.set(domainKey, current + 1);
    return current;
  }
}

function prewarmResult(config, domainKey, overrides = {}) {
  const domain = config.domains[domainKey];
  const finalOrigin = overrides.finalOrigin || domain.origin;
  const errorType = overrides.errorType || null;
  const pageReady = overrides.pageReady ?? finalOrigin === domain.origin;
  const status = overrides.status || (pageReady ? "ready" : errorType ? "auth_failed" : "error");
  return {
    key: domain.key,
    domain: domain.label,
    origin: domain.origin,
    configured_origin: domain.origin,
    prewarm_path: domain.prewarmPath,
    initial_url: `${domain.origin}${domain.prewarmPath}`,
    final_url: `${finalOrigin}${domain.prewarmPath}`,
    final_origin: finalOrigin,
    current_origin: finalOrigin,
    same_origin_expected: true,
    same_origin_actual: finalOrigin === domain.origin,
    navigation_status: 200,
    status,
    warmed: pageReady,
    page_ready: pageReady,
    error_type: errorType,
    error_message_sanitized: errorType ? "Navigation ended outside configured origin" : null,
    auth_redirect_detected: errorType === "auth_redirect" || errorType === "landing_flow_blocked",
    landing_flow_attempted: errorType === "auth_redirect" || errorType === "landing_flow_blocked",
    allowed_clicks_executed: errorType === "landing_flow_blocked" ? 2 : 0,
    final_origin_after_landing: finalOrigin,
    landing_flow_status: errorType === "landing_flow_blocked" ? "max_clicks_exceeded" : "not_needed"
  };
}

function warmStateReady(config, domainKey) {
  const domain = config.domains[domainKey];
  return {
    ...prewarmResult(config, domainKey),
    warmed: true,
    page_ready: true,
    current_origin: domain.origin,
    latency_ms: 1,
    warmed_at: "2026-05-29T00:00:00.000Z",
    last_prewarm_at: "2026-05-29T00:00:00.000Z",
    last_error_type: null,
    last_landing_flow_status: "not_needed"
  };
}

class FakeLandingPage {
  constructor({ gotoUrl, waitOutcomes = [], controls = {} }) {
    this.gotoUrl = gotoUrl;
    this.waitOutcomes = [...waitOutcomes];
    this.controls = controls;
    this.clickedLabels = [];
    this.currentUrl = "about:blank";
    this.targetUrl = null;
  }

  async goto(target) {
    this.targetUrl = target;
    this.currentUrl = this.gotoUrl;
    return { status: () => 200 };
  }

  url() {
    return this.currentUrl;
  }

  async waitForURL(predicate) {
    const outcome = this.waitOutcomes.shift() || "timeout";
    if (outcome === "return") {
      this.currentUrl = this.targetUrl;
      assert.equal(predicate(new URL(this.currentUrl)), true);
      return;
    }
    throw new Error("timeout");
  }

  getByRole(_role, options) {
    const label = Object.keys(this.controls).find((candidate) => options.name.test(candidate));
    if (!label) {
      return new FakeLandingControl(this, null, { exists: false });
    }
    return new FakeLandingControl(this, label, this.controls[label]);
  }
}

class FakeLandingControl {
  constructor(page, label, options) {
    this.page = page;
    this.label = label;
    this.options = options;
  }

  first() {
    return this;
  }

  async count() {
    return this.options.exists === false ? 0 : 1;
  }

  async isVisible() {
    return this.options.visible !== false;
  }

  async isEnabled() {
    return this.options.enabled !== false;
  }

  async evaluate() {
    return {
      isButton: true,
      isSubmit: this.options.safe === false,
      inForm: this.options.safe === false,
      disabled: this.options.enabled === false
    };
  }

  async click() {
    this.page.clickedLabels.push(this.label);
  }
}
