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
        bodyText: JSON.stringify({ count: 1, items: [{ id: "shape-only" }] }),
        bodyTruncated: false,
        observedBytes: 48
      }
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);

  const response = await service.executeAction("weapon_inventory", { workspaceId: "demo" });

  assert.deepEqual(fakeClient.prewarmCalls, ["weapon"]);
  assert.equal(fakeClient.runCalls.length, 1);
  assert.equal(fakeClient.runCalls[0].domainKey, "weapon");
  assert.equal(fakeClient.runCalls[0].actionName, "weapon_inventory");
  assert.equal(response.status, "ok");
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
        bodyText: JSON.stringify({ items: [{ id: "shape-only" }] }),
        bodyTruncated: false,
        observedBytes: 38
      }
    }
  });
  const service = new BrowserBackedApiService(config, fakeClient);
  service.warmState.set("weapon", warmStateReady(config, "weapon"));

  const response = await service.executeAction("weapon_inventory", { workspaceId: "demo" });

  assert.equal(fakeClient.runCalls.length, 1);
  assert.equal(response.status, "ok");
  assert.equal(response.source_status, "ok");
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
  for (const key of ["url", "path", "header", "cookie", "token", "session", "secret"]) {
    await assert.rejects(
      () => service.executeAction("rcp_snapshot", { [key]: "blocked" }),
      (error) => error.statusCode === 400 && error.code === "forbidden_action_input"
    );
  }
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
